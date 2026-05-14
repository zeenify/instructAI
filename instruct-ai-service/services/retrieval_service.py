import psycopg2
from psycopg2 import pool
from pgvector.psycopg2 import register_vector
import os

class RetrievalService:
    def __init__(self):
        self.conn_pool = pool.SimpleConnectionPool(1, 5, os.getenv('DATABASE_URL'))

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

    def search(self, class_id: int, query_embedding: list, top_k: int = 5, lesson_id: int = None) -> list:
        """Semantic search in class materials"""
        print(f"[RETRIEVAL] Searching for class_id={class_id}, lesson_id={lesson_id}, top_k={top_k}")
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                if lesson_id:
                    # Prioritize current lesson, but also search broader class materials
                    cur.execute(
                        """
                        SELECT chunk_text, metadata,
                               1 - (embedding <=> %s::vector) as similarity,
                               CASE WHEN lesson_id = %s THEN 1 ELSE 0 END as is_current_lesson
                        FROM document_chunks
                        WHERE class_id = %s
                        ORDER BY is_current_lesson DESC, similarity DESC
                        LIMIT %s
                        """,
                        (query_embedding, lesson_id, class_id, top_k)
                    )
                else:
                    cur.execute(
                        """
                        SELECT chunk_text, metadata,
                               1 - (embedding <=> %s::vector) as similarity
                        FROM document_chunks
                        WHERE class_id = %s
                        ORDER BY similarity DESC
                        LIMIT %s
                        """,
                        (query_embedding, class_id, top_k)
                    )

                results = cur.fetchall()
                print(f"[RETRIEVAL] Found {len(results)} results")
                for i, row in enumerate(results):
                    print(f"  [{i}] similarity={row[2]:.4f}, text={row[0][:30]}...")

                return [
                    {
                        'text': row[0],
                        'metadata': row[1],
                        'similarity': float(row[2])
                    }
                    for row in results
                ]
        finally:
            self.conn_pool.putconn(conn)

retrieval_service = RetrievalService()
