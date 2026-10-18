"""
AI client pool with round-robin cycling and rate-limit handling.

Default pool = Google AI Studio (Gemini) keys via the OpenAI-compatible
endpoint. With river_first=True the pool gains a River lane (paid, no
burst-rate stall) ahead of the Gemini keys, so a 429 storm on one provider
falls through to the other instead of stalling the run. The generation
model lives in config/models.py — swap it there, not here.
"""
import os
import time
from itertools import cycle

from openai import OpenAI

from config.models import GEN_CONTENT_MODEL, PILOT_MODEL, RIVER_BASE_URL

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

# Accepts GEMINI_API_KEY first, then the legacy GEMINI_API name, then numbered
# extras (GEMINI_API_KEY2..4) so more keys can be added without code changes.
_KEY_VARS = [
    "GEMINI_API_KEY",
    "GEMINI_API",
    "GEMINI_API_KEY2",
    "GEMINI_API_KEY3",
    "GEMINI_API_KEY4",
]


def is_rate_limit_error(error: Exception) -> bool:
    """True for 429 / quota errors from the Gemini OpenAI-compatible endpoint."""
    text = str(error).lower()
    return "rate_limit" in text or "rate limit" in text or "quota" in text or "resource_exhausted" in text


class AIClientPool:
    """Manages API-key lanes with round-robin cycling and backoff.

    river_first=True prepends a River lane (PILOT_MODEL) ahead of the Gemini
    keys — used by the teacher content-generation pools. key_num 1 is the
    River lane when present; Gemini keys follow.
    """

    def __init__(self, river_first=False):
        self.keys = []
        self.clients = []
        self.models = {}
        self.key_states = {}
        self.current_index = 0

        if river_first and os.getenv("RIVER_API_KEY"):
            client = OpenAI(api_key=os.getenv("RIVER_API_KEY"), base_url=RIVER_BASE_URL, timeout=120, max_retries=1)
            self.clients.append(client)
            self.models[len(self.clients)] = PILOT_MODEL
            self.key_states[len(self.clients)] = {
                'backoff_until': 0,
                'rate_limited': False,
                'last_error': None
            }
            print(f"[AI POOL] Lane 1: River ({PILOT_MODEL}) — teacher generation primary")

        for env_var in _KEY_VARS:
            key = os.getenv(env_var)
            if key and key not in self.keys:
                self.keys.append(key)
                client = OpenAI(api_key=key, base_url=GEMINI_BASE_URL, timeout=120, max_retries=1)
                self.clients.append(client)
                self.models[len(self.clients)] = GEN_CONTENT_MODEL
                self.key_states[len(self.clients)] = {
                    'backoff_until': 0,
                    'rate_limited': False,
                    'last_error': None
                }

        self.cycle_iter = cycle(range(len(self.clients)))

        gemini_count = len(self.clients) - (1 if river_first and os.getenv("RIVER_API_KEY") else 0)
        print(f"[AI POOL] Initialized with {gemini_count} Gemini API key(s) via {GEMINI_BASE_URL}")

    def model_for(self, key_num):
        """Model name for the lane that get_available_client returned."""
        return self.models.get(key_num, GEN_CONTENT_MODEL)

    def get_available_client(self):
        """
        Get next available client, respecting backoff for rate-limited keys.
        Returns the next available key that's NOT in backoff.
        If all are in backoff, returns the one closest to recovery.
        """
        now = time.time()
        best_available = None
        best_available_idx = None
        best_backoff = None
        best_backoff_idx = None

        # Check all clients in round-robin order
        for _ in range(len(self.clients)):
            idx = next(self.cycle_iter)
            key_num = idx + 1
            state = self.key_states[key_num]

            # If NOT in backoff, use this one immediately
            if state['backoff_until'] <= now:
                return self.clients[idx], key_num

            # Track the key closest to recovery (in case all are backed off)
            backoff_remaining = state['backoff_until'] - now
            if best_backoff is None or backoff_remaining < best_backoff:
                best_backoff = backoff_remaining
                best_backoff_idx = idx

        # All keys in backoff - return the one closest to recovery
        if best_backoff_idx is not None:
            key_num = best_backoff_idx + 1
            print(f"[AI POOL] All keys in backoff. Returning key {key_num} (recovers in {best_backoff:.1f}s)")
            return self.clients[best_backoff_idx], key_num

        # Fallback (shouldn't reach here)
        return self.clients[0], 1

    def mark_rate_limited(self, key_num, backoff_seconds=60):
        """Mark a key as rate-limited with exponential backoff"""
        state = self.key_states[key_num]
        state['rate_limited'] = True
        state['backoff_until'] = time.time() + backoff_seconds
        print(f"[AI POOL] Key {key_num} rate-limited, backing off for {backoff_seconds}s")

    def mark_success(self, key_num):
        """Clear rate-limit on successful request"""
        state = self.key_states[key_num]
        if state['rate_limited']:
            state['rate_limited'] = False
            state['backoff_until'] = 0
            print(f"[AI POOL] Key {key_num} recovered, backoff cleared")

    def get_available_count(self):
        """Count how many keys are currently available (not in backoff)"""
        now = time.time()
        available = sum(1 for i in range(1, len(self.clients) + 1)
                       if self.key_states[i]['backoff_until'] <= now)
        return available

    def get_status(self):
        """Get status of all lanes"""
        status = {}
        now = time.time()
        for i in range(1, len(self.clients) + 1):
            state = self.key_states[i]
            backoff_remaining = max(0, state['backoff_until'] - now)
            status[f"key_{i}"] = {
                'available': backoff_remaining == 0,
                'backoff_remaining_s': round(backoff_remaining, 1),
                'rate_limited': state['rate_limited'],
                'model': self.models.get(i),
            }
        return status

    def all_rate_limited(self):
        """Check if all keys are currently rate-limited"""
        return self.get_available_count() == 0

    def recovery_wait_seconds(self, cap=60.0):
        """Seconds until the earliest key recovers, capped. 0.0 if a key is free now."""
        now = time.time()
        remaining = [max(0.0, self.key_states[i]['backoff_until'] - now)
                     for i in range(1, len(self.clients) + 1)]
        wait = min(remaining) if remaining else 0.0
        return min(wait, cap)
