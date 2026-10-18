# InstructAI AI service — FastAPI + torch (RAG embeddings) + Gemini pool.
# Listens on $PORT (Render injects it; 8001 keeps dev parity).
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# torch/torchvision from the CPU-only wheel index — PyPI's default Linux
# builds bundle CUDA (~2.5 GB of NVIDIA libs) for nothing on a CPU host.
# Installed BEFORE requirements.txt so its pins are already satisfied.
RUN pip install --no-cache-dir torch==2.2.0 torchvision==0.17.0 \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the RAG embedding model into the image so every cold boot skips the
# ~90 MB Hugging Face download (the container's disk is ephemeral).
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

EXPOSE 8001
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}"]
