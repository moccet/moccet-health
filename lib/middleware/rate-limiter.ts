/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting using Upstash Redis for distributed rate limiting.
 * Supports different limits per endpoint type and user tier.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '../utils/logger';

const logger = createLogger('RateLimiter');

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface RateLimitConfig {
  /** Requests per window */
  requests: number;
  /** Window duration (e.g., '1 h', '10 m', '1 d') */
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`;
}

/**
 * Rate limit configurations per endpoint type
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Insight generation (expensive AI operations)
  insights: { requests: 10, window: '1 h' },
  // Feedback submissions
  feedback: { requests: 50, window: '1 h' },
  // Data sync operations
  sync: { requests: 5, window: '1 h' },
  // General API requests
  default: { requests: 100, window: '1 h' },
  // Health check (more lenient)
  health: { requests: 1000, window: '1 h' },
};

/**
 * Tier-based multipliers for rate limits
 */
export const TIER_MULTIPLIERS: Record<string, number> = {
  free: 1,
  pro: 2,
  max: 5,
};

// ============================================================================
// REDIS CLIENT
// ============================================================================

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    logger.warn('Rate limiting disabled: Missing Upstash Redis configuration');
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

// ============================================================================
// RATE LIMITERS
// ============================================================================

const limiters = new Map<string, Ratelimit>();

function getLimiter(type: string): Ratelimit | null {
  const redisClient = getRedisClient();
  if (!redisClient) return null;

  const cacheKey = type;
  if (limiters.has(cacheKey)) {
    return limiters.get(cacheKey)!;
  }

  const config = RATE_LIMITS[type] || RATE_LIMITS.default;

  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    analytics: true,
    prefix: `ratelimit:${type}`,
  });

  limiters.set(cacheKey, limiter);
  return limiter;
}

// ============================================================================
// RATE LIMIT CHECK
// ============================================================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for an identifier
 */
export async function checkRateLimit(
  type: string,
  identifier: string,
  tierMultiplier = 1
): Promise<RateLimitResult> {
  const limiter = getLimiter(type);

  if (!limiter) {
    // Rate limiting disabled, allow all requests
    return {
      success: true,
      limit: Infinity,
      remaining: Infinity,
      reset: Date.now(),
    };
  }

  try {
    const result = await limiter.limit(identifier);

    // Apply tier multiplier (for upgraded limits)
    const effectiveLimit = Math.floor(result.limit * tierMultiplier);
    const effectiveRemaining = Math.floor(result.remaining * tierMultiplier);

    return {
      success: result.success,
      limit: effectiveLimit,
      remaining: effectiveRemaining,
      reset: result.reset,
    };
  } catch (error) {
    logger.error('Rate limit check failed', error, { type, identifier });
    // On error, allow the request (fail open)
    return {
      success: true,
      limit: 0,
      remaining: 0,
      reset: Date.now(),
    };
  }
}

// ============================================================================
// MIDDLEWARE
// ============================================================================

export type RateLimitedHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * Create a rate-limited version of an API handler
 *
 * @example
 * ```ts
 * export const POST = withRateLimit('insights', async (request) => {
 *   // Handler logic
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withRateLimit(type: string, handler: RateLimitedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Get identifier (prefer email from body/query, fallback to IP)
    const identifier = await getIdentifier(request);

    // Get tier multiplier if available
    const tierMultiplier = await getTierMultiplier(request);

    // Check rate limit
    const result = await checkRateLimit(type, identifier, tierMultiplier);

    // Add rate limit headers
    const headers = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toString(),
    };

    if (!result.success) {
      logger.warn('Rate limit exceeded', { type, identifier });
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again later.`,
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        },
        { status: 429, headers }
      );
    }

    // Execute handler
    const response = await handler(request);

    // Add rate limit headers to response
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }

    return response;
  };
}

/**
 * Get identifier for rate limiting
 */
async function getIdentifier(request: NextRequest): Promise<string> {
  // Try to get email from body
  try {
    const body = await request.clone().json();
    if (body.email) {
      return `email:${body.email}`;
    }
  } catch {
    // Not JSON or no email field
  }

  // Try to get email from query params
  const email = request.nextUrl.searchParams.get('email');
  if (email) {
    return `email:${email}`;
  }

  // Try to get email from headers
  const headerEmail = request.headers.get('x-user-email');
  if (headerEmail) {
    return `email:${headerEmail}`;
  }

  // Fallback to IP address
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Get tier multiplier for rate limiting
 */
async function getTierMultiplier(_request: NextRequest): Promise<number> {
  // TODO: Implement tier lookup from user session/token
  // For now, return default multiplier
  return TIER_MULTIPLIERS.free;
}

// ============================================================================
// BARREL EXPORT FOR MIDDLEWARE
// ============================================================================

export const rateLimiters = {
  insights: (handler: RateLimitedHandler) => withRateLimit('insights', handler),
  feedback: (handler: RateLimitedHandler) => withRateLimit('feedback', handler),
  sync: (handler: RateLimitedHandler) => withRateLimit('sync', handler),
  default: (handler: RateLimitedHandler) => withRateLimit('default', handler),
  health: (handler: RateLimitedHandler) => withRateLimit('health', handler),
};
