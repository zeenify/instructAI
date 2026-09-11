"""
Central model configuration for the InstructAI service.

All generation runs on Gemini 3.5 Flash Lite (Google AI Studio) — chosen for
its high tokens-per-minute and requests-per-day limits so the multi-stage
course pipeline rarely hits rate limits. Change the model here only.
"""

# Single model for every stage: outlines, section content, quiz generation,
# answer checking, challenge verification and the RAG tutor.
GEN_CONTENT_MODEL = "gemini-3.5-flash-lite"

# Back-compat aliases for the old two-tier Groq setup (quality vs speed).
# Flash Lite is fast enough to serve both tiers, so they point at one model.
MODEL_FAST = GEN_CONTENT_MODEL
MODEL_QUALITY = GEN_CONTENT_MODEL
