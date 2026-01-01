/**
 * Request Deduplicator
 *
 * Prevents duplicate concurrent requests by caching in-flight promises.
 * When multiple callers request the same resource simultaneously,
 * only one actual request is made and all callers receive the same result.
 */

export interface DeduplicatorConfig {
  /** Time in ms to keep completed requests in cache (default: 5000) */
  ttl: number;
  /** Maximum number of cached entries (default: 1000) */
  maxSize: number;
  /** Called when a request is deduplicated */
  onDedupe?: (key: string) => void;
}

interface CacheEntry<T> {
  promise: Promise<T>;
  expiresAt: number;
}

const DEFAULT_CONFIG: DeduplicatorConfig = {
  ttl: 5000,
  maxSize: 1000,
};

export class RequestDeduplicator {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: DeduplicatorConfig;

  constructor(config: Partial<DeduplicatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with deduplication
   *
   * If a request with the same key is already in flight, returns the existing promise.
   * Otherwise, executes the function and caches the promise.
   *
   * @param key Unique identifier for this request
   * @param fn Function to execute if not already cached
   * @returns Promise that resolves to the function result
   *
   * @example
   * ```ts
   * const deduplicator = new RequestDeduplicator({ ttl: 5000 });
   *
   * // These will only make one actual fetch
   * const [result1, result2] = await Promise.all([
   *   deduplicator.dedupe('user:123', () => fetchUser(123)),
   *   deduplicator.dedupe('user:123', () => fetchUser(123)),
   * ]);
   * ```
   */
  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // Clean up expired entries periodically
    this.cleanup();

    // Check for existing in-flight or cached request
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      this.config.onDedupe?.(key);
      return existing.promise as Promise<T>;
    }

    // Create new request
    const promise = fn().finally(() => {
      // Schedule cleanup after TTL
      setTimeout(() => {
        const entry = this.cache.get(key);
        if (entry && entry.promise === promise) {
          this.cache.delete(key);
        }
      }, this.config.ttl);
    });

    // Cache the promise
    this.cache.set(key, {
      promise,
      expiresAt: Date.now() + this.config.ttl,
    });

    return promise;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired entries and enforce max size
   */
  private cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }

    // Enforce max size by removing oldest entries
    if (this.cache.size > this.config.maxSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toRemove = entries.slice(0, this.cache.size - this.config.maxSize);
      for (const [key] of toRemove) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Global deduplicator instance for ecosystem fetches
 */
export const ecosystemDeduplicator = new RequestDeduplicator({
  ttl: 5000, // 5 seconds
  maxSize: 500,
  onDedupe: (key) => {
    console.log(`[Request Deduplicator] Deduplicating request: ${key}`);
  },
});

/**
 * Helper to create a deduplication key for ecosystem fetches
 */
export function createEcosystemKey(source: string, email: string, startDate?: Date, endDate?: Date): string {
  const dateRange = startDate && endDate
    ? `_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`
    : '';
  return `ecosystem:${source}:${email}${dateRange}`;
}

/**
 * Create a deduplicable version of any async function
 *
 * @example
 * ```ts
 * const fetchUserDedupe = createDeduplicable(
 *   (id: string) => fetchUser(id),
 *   (id) => `user:${id}`,
 *   { ttl: 10000 }
 * );
 *
 * // Only one request made
 * const [user1, user2] = await Promise.all([
 *   fetchUserDedupe('123'),
 *   fetchUserDedupe('123'),
 * ]);
 * ```
 */
export function createDeduplicable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  keyFn: (...args: TArgs) => string,
  config: Partial<DeduplicatorConfig> = {}
): (...args: TArgs) => Promise<TResult> {
  const deduplicator = new RequestDeduplicator(config);
  return (...args: TArgs) => {
    const key = keyFn(...args);
    return deduplicator.dedupe(key, () => fn(...args));
  };
}
