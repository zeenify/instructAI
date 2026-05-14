import psycopg2
from psycopg2 import pool
from pgvector.psycopg2 import register_vector
import tiktoken
import os
import json

class IndexingService:
    def __init__(self):
        self.conn_pool = pool.SimpleConnectionPool(1, 5, os.getenv('DATABASE_URL'))
        self.encoding = tiktoken.get_encoding("cl100k_base")

    def get_connection(self):
        """Get a connection from the pool, with automatic reconnection"""
        try:
            conn = self.conn_pool.getconn()
            # Test connection is still alive
            conn.isolation_level
            register_vector(conn)
            return conn
        except (psycopg2.OperationalError, pool.PoolError):
            # Reconnect if connection is dead
            conn = psycopg2.connect(os.getenv('DATABASE_URL'))
            register_vector(conn)
            return conn

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list:
        """Split text into overlapping chunks by tokens"""
        if not text:
            return []

        tokens = self.encoding.encode(text)
        chunks = []

        for i in range(0, len(tokens), chunk_size - overlap):
            chunk_tokens = tokens[i:i + chunk_size]
            chunk_text = self.encoding.decode(chunk_tokens)
            if chunk_text.strip():
                chunks.append(chunk_text)

        return chunks

    def index_lesson(self, class_id: int, course_id: int, lesson_id: int, content: str, embedding_service):
        """Chunk and index lesson content"""
        chunks = self.chunk_text(content)

        if not chunks:
            print(f"[Indexing] No chunks created for lesson {lesson_id}")
            return

        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                # Delete existing chunks for this lesson
                cur.execute("DELETE FROM document_chunks WHERE lesson_id = %s", (lesson_id,))

                # Insert new chunks
                for chunk in chunks:
                    embedding = embedding_service.embed_text(chunk)
                    metadata = json.dumps({"source": "lesson"})
                    cur.execute(
                        """
                        INSERT INTO document_chunks (class_id, course_id, lesson_id, chunk_text, embedding, metadata, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
                        """,
                        (class_id, course_id, lesson_id, chunk, embedding, metadata)
                    )

            conn.commit()
            print(f"[Indexing] Indexed {len(chunks)} chunks for lesson {lesson_id}")
        finally:
            self.conn_pool.putconn(conn)

    def index_curriculum(self, class_id: int, course_id: int, curriculum_text: str, embedding_service):
        """Chunk and index curriculum document"""
        chunks = self.chunk_text(curriculum_text, chunk_size=800)

        if not chunks:
            print(f"[Indexing] No chunks created for course {course_id}")
            return

        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                # Delete existing curriculum chunks for this course
                cur.execute("DELETE FROM document_chunks WHERE course_id = %s AND lesson_id IS NULL", (course_id,))

                # Insert new chunks
                for i, chunk in enumerate(chunks):
                    embedding = embedding_service.embed_text(chunk)
                    metadata = json.dumps({"source": "curriculum", "chunk_index": i})
                    cur.execute(
                        """
                        INSERT INTO document_chunks (class_id, course_id, chunk_text, embedding, metadata, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        """,
                        (class_id, course_id, chunk, embedding, metadata)
                    )

            conn.commit()
            print(f"[Indexing] Indexed {len(chunks)} chunks for course {course_id}")
        finally:
            self.conn_pool.putconn(conn)

    def index_course_combined(self, class_id: int, course_id: int, combined_content: str, embedding_service):
        """Chunk and index entire course (curriculum + all lessons) as unified content"""
        chunks = self.chunk_text(combined_content, chunk_size=600)

        if not chunks:
            print(f"[Indexing] No chunks created for combined course {course_id}")
            return

        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                # Delete ALL existing chunks for this course (both curriculum and lessons)
                cur.execute("DELETE FROM document_chunks WHERE course_id = %s", (course_id,))

                # Insert new unified chunks (no lesson_id, all in one pool)
                for i, chunk in enumerate(chunks):
                    embedding = embedding_service.embed_text(chunk)
                    metadata = json.dumps({"source": "combined", "chunk_index": i})
                    cur.execute(
                        """
                        INSERT INTO document_chunks (class_id, course_id, chunk_text, embedding, metadata, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
                        """,
                        (class_id, course_id, chunk, embedding, metadata)
                    )

            conn.commit()
            print(f"[Indexing] Indexed {len(chunks)} chunks from combined course content for course {course_id}")
        finally:
            self.conn_pool.putconn(conn)

indexing_service = IndexingService()
