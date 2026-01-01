/**
 * Redis Cache Service
 *
 * Implements a two-tier caching strategy:
 * - L1: In-memory cache (fast, limited size, per-instance)
 * - L2: Redis cache via Upstash (distributed, persistent)
 *
 * Provides caching for:
 * - User baselines (24h TTL)
 * - User context snapshots (1h TTL)
 * - Insight counts (6h TTL)
 * - Weekly summaries (7d TTL)
 *
 * @module lib/services/cache-service
 */

import { Redis } from '@upstash/redis';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('CacheService');

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface CacheConfig {
  /** Default TTL in seconds */
  defaultTTL: number;
  /** Key prefix for namespacing */
  prefix: string;
  /** L1 cache max size in entries */
  l1MaxSize: number;
  /** L1 cache TTL in ms */
  l1TTL: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 3600, // 1 hour
  prefix: 'moccet:',
  l1MaxSize: 1000,
  l1TTL: 300000, // 5 minutes
};

/** TTL values for different cache types (in seconds) */
export const CACHE_TTL = {
  baseline: 86400,      // 24 hours
  userContext: 3600,    // 1 hour
  insights: 21600,      // 6 hours
  weeklySummary: 604800, // 7 days
  interventions: 3600,   // 1 hour
  goals: 86400,          // 24 hours
  providers: 300,        // 5 minutes (provider status)
} as const;

// ============================================================================
// CACHE KEY BUILDERS
// ============================================================================

export const CACHE_KEYS = {
  baseline: (email: string, metric: string) => `baseline:${email}:${metric}`,
  userContext: (email: string) => `context:${email}`,
  insights: (email: string, type?: string) => `insights:${email}${type ? `:${type}` : ''}`,
  insightCount: (email: string) => `insight_count:${email}`,
  weeklySummary: (email: string, week: string) => `weekly:${email}:${week}`,
  interventions: (email: string) => `interventions:${email}`,
  goals: (email: string) => `goals:${email}`,
  providerStatus: (email: string, provider: string) => `provider:${email}:${provider}`,
  syncStatus: (email: string) => `sync:${email}`,
};

// ============================================================================
// L1 IN-MEMORY CACHE
// ============================================================================

interface L1CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class L1Cache {
  private cache = new Map<string, L1CacheEntry<unknown>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttl: number = 300000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    // Enforce max size by removing oldest entries
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl || this.ttl),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deletePattern(pattern: string): number {
    let deleted = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

// ============================================================================
// CACHE SERVICE
// ============================================================================

export class CacheService {
  private redis: Redis | null = null;
  private l1: L1Cache;
  private config: CacheConfig;
  private initialized = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.l1 = new L1Cache(this.config.l1MaxSize, this.config.l1TTL);
  }

  /**
   * Initialize Redis connection
   */
  private initRedis(): Redis | null {
    if (this.initialized) return this.redis;
    this.initialized = true;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      logger.warn('Redis not configured - using L1 cache only');
      return null;
    }

    try {
      this.redis = new Redis({ url, token });
      logger.info('Redis connection initialized');
      return this.redis;
    } catch (error) {
      logger.error('Failed to initialize Redis', error);
      return null;
    }
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  /**
   * Get a value from cache (L1 first, then L2)
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    // Check L1 first
    const l1Value = this.l1.get<T>(fullKey);
    if (l1Value !== null) {
      logger.debug('Cache hit (L1)', { key });
      return l1Value;
    }

    // Check L2 (Redis)
    const redis = this.initRedis();
    if (!redis) return null;

    try {
      const l2Value = await redis.get<T>(fullKey);
      if (l2Value !== null) {
        // Populate L1 for faster subsequent access
        this.l1.set(fullKey, l2Value);
        logger.debug('Cache hit (L2)', { key });
        return l2Value;
      }
    } catch (error) {
      logger.error('Redis get error', error, { key });
    }

    logger.debug('Cache miss', { key });
    return null;
  }

  /**
   * Set a value in cache (both L1 and L2)
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const ttl = ttlSeconds || this.config.defaultTTL;

    // Set in L1
    this.l1.set(fullKey, value, ttl * 1000);

    // Set in L2 (Redis)
    const redis = this.initRedis();
    if (!redis) return;

    try {
      await redis.setex(fullKey, ttl, JSON.stringify(value));
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      logger.error('Redis set error', error, { key });
    }
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);

    // Delete from L1
    this.l1.delete(fullKey);

    // Delete from L2
    const redis = this.initRedis();
    if (!redis) return;

    try {
      await redis.del(fullKey);
      logger.debug('Cache delete', { key });
    } catch (error) {
      logger.error('Redis delete error', error, { key });
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);
    let deleted = 0;

    // Delete from L1
    deleted += this.l1.deletePattern(fullPattern);

    // Delete from L2
    const redis = this.initRedis();
    if (!redis) return deleted;

    try {
      // Upstash doesn't support SCAN, so we use KEYS (use sparingly)
      const keys = await redis.keys(`${fullPattern}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
      logger.debug('Cache pattern delete', { pattern, deleted });
    } catch (error) {
      logger.error('Redis pattern delete error', error, { pattern });
    }

    return deleted;
  }

  /**
   * Invalidate all cache for a user
   */
  async invalidateUser(email: string): Promise<void> {
    await this.deletePattern(`*:${email}*`);
    logger.info('User cache invalidated', { email });
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Compute value
    const value = await fetcher();

    // Cache the result
    await this.set(key, value, ttlSeconds);

    return value;
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.l1.clear();
    logger.info('L1 cache cleared');

    const redis = this.initRedis();
    if (!redis) return;

    try {
      // Clear all keys with our prefix
      const keys = await redis.keys(`${this.config.prefix}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.info('L2 cache cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Redis clear error', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { l1Size: number; l1MaxSize: number } {
    return {
      l1Size: this.l1.size(),
      l1MaxSize: this.config.l1MaxSize,
    };
  }

  /**
   * Cleanup expired L1 entries
   */
  cleanup(): number {
    return this.l1.cleanup();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const cacheService = new CacheService();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Cache user baseline with appropriate TTL
 */
export async function cacheBaseline(
  email: string,
  metric: string,
  data: unknown
): Promise<void> {
  const key = CACHE_KEYS.baseline(email, metric);
  await cacheService.set(key, data, CACHE_TTL.baseline);
}

/**
 * Get cached user baseline
 */
export async function getCachedBaseline<T>(
  email: string,
  metric: string
): Promise<T | null> {
  const key = CACHE_KEYS.baseline(email, metric);
  return cacheService.get<T>(key);
}

/**
 * Cache user context with appropriate TTL
 */
export async function cacheUserContext(
  email: string,
  context: unknown
): Promise<void> {
  const key = CACHE_KEYS.userContext(email);
  await cacheService.set(key, context, CACHE_TTL.userContext);
}

/**
 * Get cached user context
 */
export async function getCachedUserContext<T>(email: string): Promise<T | null> {
  const key = CACHE_KEYS.userContext(email);
  return cacheService.get<T>(key);
}

/**
 * Cache insights with appropriate TTL
 */
export async function cacheInsights(
  email: string,
  insights: unknown,
  type?: string
): Promise<void> {
  const key = CACHE_KEYS.insights(email, type);
  await cacheService.set(key, insights, CACHE_TTL.insights);
}

/**
 * Get cached insights
 */
export async function getCachedInsights<T>(
  email: string,
  type?: string
): Promise<T | null> {
  const key = CACHE_KEYS.insights(email, type);
  return cacheService.get<T>(key);
}

/**
 * Cache weekly summary with appropriate TTL
 */
export async function cacheWeeklySummary(
  email: string,
  week: string,
  summary: unknown
): Promise<void> {
  const key = CACHE_KEYS.weeklySummary(email, week);
  await cacheService.set(key, summary, CACHE_TTL.weeklySummary);
}

/**
 * Get cached weekly summary
 */
export async function getCachedWeeklySummary<T>(
  email: string,
  week: string
): Promise<T | null> {
  const key = CACHE_KEYS.weeklySummary(email, week);
  return cacheService.get<T>(key);
}

/**
 * Invalidate all caches for a user (call after data updates)
 */
export async function invalidateUserCache(email: string): Promise<void> {
  await cacheService.invalidateUser(email);
}

export default cacheService;
