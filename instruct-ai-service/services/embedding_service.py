"""Course-material embeddings via Gemini's OpenAI-compatible endpoint
(free-tier text-embedding-004). No local model — the service stays small and
fits Render's 512 MB free tier. Key handling mirrors utils/ai_client_pool:
GEMINI_API first, numbered extras optional, round-robin with failover."""

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
EMBED_MODEL = "gemini-embedding-001"  # text-embedding-004 is retired (404 as of late 2026)
EMBED_DIM = 768  # native size — document_chunks migration must match
MAX_BATCH_INPUTS = 100  # Gemini batch-embed limit per request
_KEY_VARS = [
    "GEMINI_API_KEY",
    "GEMINI_API",
    "GEMINI_API_KEY2",
    "GEMINI_API_KEY3",
    "GEMINI_API_KEY4",
]


class EmbeddingService:
    def __init__(self):
        import os
        from openai import OpenAI

        self.dimension = EMBED_DIM
        self.clients = [
            OpenAI(api_key=os.getenv(var), base_url=GEMINI_BASE_URL, timeout=30, max_retries=1)
            for var in _KEY_VARS
            if os.getenv(var)
        ]
        self._next = 0
        if not self.clients:
            print("[EMBED] WARNING: no GEMINI_API key — embeddings unavailable until the env is set")
        else:
            print(f"[EMBED] {len(self.clients)} Gemini key(s) · model={EMBED_MODEL} dim={EMBED_DIM}")

    def _client(self):
        client = self.clients[self._next % len(self.clients)]
        self._next += 1
        return client

    def _embed_once(self, texts: list) -> list:
        if not self.clients:
            raise RuntimeError("No GEMINI_API key configured — cannot embed")
        if any(not (text or "").strip() for text in texts):
            texts = [text if (text or "").strip() else "(empty)" for text in texts]
        last_error = None
        # Try each key once (round-robin start) — one call serves the whole batch
        for _ in range(len(self.clients) * 2):
            try:
                response = self._client().embeddings.create(
                    model=EMBED_MODEL,
                    input=[t[:8000] for t in texts],
                    dimensions=EMBED_DIM,
                )
                return [item.embedding for item in response.data]
            except Exception as e:
                last_error = e
                print(f"[EMBED] attempt failed ({e.__class__.__name__}): {str(e)[:200]}")
        raise RuntimeError(f"Gemini embeddings failed after retries: {last_error}")

    def embed_text(self, text: str) -> list:
        """Embedding for a single text (list of floats)"""
        return self._embed_once([text])[0]

    def embed_batch(self, texts: list) -> list:
        """Embeddings for many texts — sliced into ≤100-input API calls"""
        embeddings = []
        for i in range(0, len(texts), MAX_BATCH_INPUTS):
            embeddings.extend(self._embed_once(texts[i : i + MAX_BATCH_INPUTS]))
        return embeddings


# Singleton instance
embedding_service = EmbeddingService()
