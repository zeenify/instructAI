/**
 * Simple in-memory cache for API responses
 * Reduces redundant network requests for frequently accessed data
 */

class Cache {
  constructor() {
    this.cache = new Map();
    this.timestamps = new Map();
    this.TTL = 5 * 60 * 1000; // 5 minutes default TTL
  }

  /**
   * Get cached value if it exists and is not expired
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if expired/not found
   */
  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.timestamps.get(key);
    const now = Date.now();

    // Check if expired
    if (now - timestamp > this.TTL) {
      this.cache.delete(key);
      this.timestamps.delete(key);
      return null;
    }

    console.log(`[Cache HIT] ${key}`);
    return this.cache.get(key);
  }

  /**
   * Set cache value with current timestamp
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  set(key, value) {
    console.log(`[Cache SET] ${key}`);
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }

  /**
   * Invalidate specific cache key
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    console.log(`[Cache INVALIDATE] ${key}`);
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  /**
   * Invalidate all cache keys matching a pattern
   * @param {RegExp|string} pattern - Pattern to match against keys
   */
  invalidatePattern(pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.invalidate(key);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    console.log('[Cache CLEAR] All cache cleared');
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export default new Cache();
