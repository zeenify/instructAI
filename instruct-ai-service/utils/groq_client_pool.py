"""
Groq API client pool with round-robin cycling and rate-limit handling
"""
import os
import time
from groq import Groq
from itertools import cycle


class GroqClientPool:
    """Manages multiple Groq API keys with round-robin cycling and backoff"""

    def __init__(self):
        self.keys = []
        self.clients = []
        self.key_states = {}
        self.current_index = 0

        # Load all 4 keys from environment
        for i in range(1, 5):
            env_var = f"GROQ_API_KEY{''.join(str(i)) if i > 1 else ''}"
            key = os.getenv(env_var)
            if key:
                self.keys.append(key)
                client = Groq(api_key=key)
                self.clients.append(client)
                self.key_states[i] = {
                    'backoff_until': 0,
                    'rate_limited': False,
                    'last_error': None
                }

        self.cycle_iter = cycle(range(len(self.clients)))

        print(f"[GROQ POOL] Initialized with {len(self.clients)} API keys")
        for i, key in enumerate(self.keys, 1):
            print(f"  Key {i}: {key[:15]}...")

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
            print(f"[GROQ POOL] All keys in backoff. Returning key {key_num} (recovers in {best_backoff:.1f}s)")
            return self.clients[best_backoff_idx], key_num

        # Fallback (shouldn't reach here)
        return self.clients[0], 1

    def mark_rate_limited(self, key_num, backoff_seconds=60):
        """Mark a key as rate-limited with exponential backoff"""
        state = self.key_states[key_num]
        state['rate_limited'] = True
        state['backoff_until'] = time.time() + backoff_seconds
        print(f"[GROQ POOL] Key {key_num} rate-limited, backing off for {backoff_seconds}s")

    def mark_success(self, key_num):
        """Clear rate-limit on successful request"""
        state = self.key_states[key_num]
        if state['rate_limited']:
            state['rate_limited'] = False
            state['backoff_until'] = 0
            print(f"[GROQ POOL] Key {key_num} recovered, backoff cleared")

    def get_available_count(self):
        """Count how many keys are currently available (not in backoff)"""
        now = time.time()
        available = sum(1 for i in range(1, len(self.clients) + 1)
                       if self.key_states[i]['backoff_until'] <= now)
        return available

    def get_status(self):
        """Get status of all keys"""
        status = {}
        now = time.time()
        for i, key in enumerate(self.keys, 1):
            state = self.key_states[i]
            backoff_remaining = max(0, state['backoff_until'] - now)
            status[f"key_{i}"] = {
                'available': backoff_remaining == 0,
                'backoff_remaining_s': round(backoff_remaining, 1),
                'rate_limited': state['rate_limited']
            }
        return status

    def all_rate_limited(self):
        """Check if all keys are currently rate-limited"""
        return self.get_available_count() == 0
