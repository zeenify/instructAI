# AI Tutor Database Connection Fix

## Problem
The AI tutor was crashing with:
```
psycopg2.OperationalError: SSL connection has been closed unexpectedly
```

This occurred during the RAG retrieval phase when querying pgvector from NeonDB.

## Root Cause
- `retrieval_service.py` and `indexing_service.py` created a **single persistent connection** on module initialization
- This connection was reused for all requests
- PostgreSQL connections timeout after idle periods (NeonDB is aggressive about this)
- When a request came in after idle time, the connection was dead → SSL error

## Solution
Implemented **connection pooling** using psycopg2's built-in `SimpleConnectionPool`:

### Changes Made

#### 1. `retrieval_service.py`
```python
# BEFORE: Single persistent connection
class RetrievalService:
    def __init__(self):
        self.conn = psycopg2.connect(os.getenv('DATABASE_URL'))

# AFTER: Connection pool with auto-reconnect
class RetrievalService:
    def __init__(self):
        self.conn_pool = pool.SimpleConnectionPool(1, 5, os.getenv('DATABASE_URL'))
    
    def get_connection(self):
        """Get fresh connection from pool, auto-reconnect on failure"""
        try:
            conn = self.conn_pool.getconn()
            conn.isolation_level  # Test connection
            register_vector(conn)
            return conn
        except (psycopg2.OperationalError, pool.PoolError):
            conn = psycopg2.connect(os.getenv('DATABASE_URL'))
            register_vector(conn)
            return conn
    
    def search(self, ...):
        conn = self.get_connection()
        try:
            # ... query code ...
        finally:
            self.conn_pool.putconn(conn)  # Return to pool
```

#### 2. `indexing_service.py`
Applied the same pattern to all three indexing methods:
- `index_lesson()`
- `index_curriculum()`
- `index_course_combined()`

Each method now:
1. Gets a fresh connection from the pool
2. Runs the query
3. Returns the connection to the pool in `finally` block

## Benefits
✅ **Handles idle timeouts**: Fresh connections on each request  
✅ **Connection reuse**: Pool of 5 connections (faster than reconnecting every time)  
✅ **Auto-reconnection**: If a connection fails, creates a new one  
✅ **Thread-safe**: psycopg2's pool manages locking  
✅ **No code changes needed**: Frontend/backend unaffected, transparent fix  

## Testing
The AI tutor should now work reliably without SSL connection drops:

```bash
# Test in browser or via cURL
POST /api/student/ai/chat
{
  "class_id": 2,
  "question": "test...",
  "character_name": "buddy",
  "mode": "restricted",
  "lesson_id": 496,
  "chat_history": [...]
}

# Should now return response without SSL error
```

## Deployment Notes
- **No database changes needed**
- **No new dependencies** (psycopg2.pool is built-in)
- **Restart AI service** after deploying this fix
- **Connection pool size**: Currently 1-5 connections (tunable if needed)

## Future Optimization
After confirming stability, consider adding **IVFFlat indexing** to pgvector for faster vector searches:
```sql
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);
```
