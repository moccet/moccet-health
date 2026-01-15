/**
 * Resilient Fetcher Service
 * Provides retry logic, circuit breaker, and error classification for all data fetching
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FetchResult<T> {
  data: T | null;
  status: 'success' | 'partial' | 'failed';
  error?: string;
  errorCategory?: ErrorCategory;
  attempts: number;
  latencyMs: number;
}

export type ErrorCategory =
  | 'network_transient'    // Retry immediately
  | 'rate_limited'         // Retry after delay
  | 'auth_expired'         // Refresh token and retry
  | 'data_not_found'       // No retry, use fallback
  | 'service_down'         // Circuit breaker
  | 'llm_overload'         // Try smaller model
  | 'tool_failed'          // Log and continue without tool
  | 'unknown';             // Generic error

export interface ResilientFetchOptions<T> {
  retries?: number;
  backoffMs?: number[];
  timeout?: number;
  fallback?: T;
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS = {
  retries: 3,
  backoffMs: [100, 500, 2000],
  timeout: 30000,
};

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

/**
 * Classify an error to determine retry strategy
 */
export function classifyError(error: Error | unknown): ErrorCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const name = error instanceof Error ? error.name.toLowerCase() : '';

  // Network transient errors - retry immediately
  if (
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('network') ||
    message.includes('socket') ||
    message.includes('fetch failed') ||
    name.includes('fetcherror')
  ) {
    return 'network_transient';
  }

  // Rate limiting - retry with backoff
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    message.includes('quota exceeded')
  ) {
    return 'rate_limited';
  }

  // Auth errors - need token refresh
  if (
    message.includes('unauthorized') ||
    message.includes('401') ||
    message.includes('token expired') ||
    message.includes('invalid token') ||
    message.includes('authentication')
  ) {
    return 'auth_expired';
  }

  // Data not found - no retry needed
  if (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('no data') ||
    message.includes('empty result')
  ) {
    return 'data_not_found';
  }

  // Service down - circuit breaker
  if (
    message.includes('503') ||
    message.includes('502') ||
    message.includes('500') ||
    message.includes('service unavailable') ||
    message.includes('internal server error')
  ) {
    return 'service_down';
  }

  // LLM overload
  if (
    message.includes('overloaded') ||
    message.includes('capacity') ||
    message.includes('openai') ||
    message.includes('anthropic')
  ) {
    return 'llm_overload';
  }

  return 'unknown';
}

/**
 * Determine if an error category should trigger retry
 */
export function shouldRetryCategory(category: ErrorCategory): boolean {
  return ['network_transient', 'rate_limited', 'service_down', 'llm_overload'].includes(category);
}

/**
 * Get recommended backoff multiplier for error category
 */
export function getBackoffMultiplier(category: ErrorCategory): number {
  switch (category) {
    case 'rate_limited':
      return 3; // Longer waits for rate limits
    case 'service_down':
      return 2;
    case 'llm_overload':
      return 2;
    default:
      return 1;
  }
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  openUntil: number;
}

const circuitStates: Map<string, CircuitState> = new Map();

const CIRCUIT_CONFIG = {
  failureThreshold: 3,      // Open after 3 failures
  failureWindow: 300000,    // Within 5 minutes
  resetTimeout: 600000,     // Stay open for 10 minutes
};

/**
 * Circuit Breaker implementation
 * Prevents hammering services that are clearly down
 */
export class CircuitBreaker {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private getState(): CircuitState {
    let state = circuitStates.get(this.serviceName);
    if (!state) {
      state = { failures: 0, lastFailure: 0, isOpen: false, openUntil: 0 };
      circuitStates.set(this.serviceName, state);
    }
    return state;
  }

  isOpen(): boolean {
    const state = this.getState();
    const now = Date.now();

    // Check if circuit should auto-close
    if (state.isOpen && now > state.openUntil) {
      state.isOpen = false;
      state.failures = 0;
      return false;
    }

    return state.isOpen;
  }

  recordSuccess(): void {
    const state = this.getState();
    state.failures = 0;
    state.isOpen = false;
  }

  recordFailure(): void {
    const state = this.getState();
    const now = Date.now();

    // Reset counter if outside failure window
    if (now - state.lastFailure > CIRCUIT_CONFIG.failureWindow) {
      state.failures = 0;
    }

    state.failures++;
    state.lastFailure = now;

    // Open circuit if threshold reached
    if (state.failures >= CIRCUIT_CONFIG.failureThreshold) {
      state.isOpen = true;
      state.openUntil = now + CIRCUIT_CONFIG.resetTimeout;
      console.warn(`[CircuitBreaker] Circuit OPEN for ${this.serviceName} until ${new Date(state.openUntil).toISOString()}`);
    }
  }

  async call<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.isOpen()) {
      console.warn(`[CircuitBreaker] Circuit OPEN for ${this.serviceName}, skipping call`);
      return null;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

// Service-level circuit breakers
const circuitBreakers: Map<string, CircuitBreaker> = new Map();

export function getCircuitBreaker(serviceName: string): CircuitBreaker {
  let breaker = circuitBreakers.get(serviceName);
  if (!breaker) {
    breaker = new CircuitBreaker(serviceName);
    circuitBreakers.set(serviceName, breaker);
  }
  return breaker;
}

// =============================================================================
// MAIN FETCH FUNCTION
// =============================================================================

/**
 * Resilient fetch with retry logic, circuit breaker, and error classification
 */
export async function resilientFetch<T>(
  name: string,
  fetcher: () => Promise<T>,
  options?: ResilientFetchOptions<T>
): Promise<FetchResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error | null = null;
  let lastCategory: ErrorCategory = 'unknown';

  // Check circuit breaker
  const breaker = getCircuitBreaker(name);
  if (breaker.isOpen()) {
    return {
      data: opts.fallback ?? null,
      status: opts.fallback ? 'partial' : 'failed',
      error: `Circuit breaker open for ${name}`,
      errorCategory: 'service_down',
      attempts: 0,
      latencyMs: Date.now() - startTime,
    };
  }

  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    try {
      // Add timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), opts.timeout);
      });

      const result = await Promise.race([fetcher(), timeoutPromise]);

      breaker.recordSuccess();

      return {
        data: result,
        status: 'success',
        attempts: attempt,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      lastCategory = classifyError(error);

      // Notify retry callback
      if (opts.onRetry) {
        opts.onRetry(attempt, lastError);
      }

      // Check if we should retry based on error category
      const shouldRetry = opts.shouldRetry
        ? opts.shouldRetry(lastError)
        : shouldRetryCategory(lastCategory);

      if (!shouldRetry || attempt === opts.retries) {
        breaker.recordFailure();
        break;
      }

      // Calculate backoff
      const baseBackoff = opts.backoffMs[Math.min(attempt - 1, opts.backoffMs.length - 1)];
      const multiplier = getBackoffMultiplier(lastCategory);
      const jitter = Math.random() * 100; // Add jitter to prevent thundering herd
      const backoff = baseBackoff * multiplier + jitter;

      console.log(`[ResilientFetch] ${name} attempt ${attempt} failed (${lastCategory}), retrying in ${Math.round(backoff)}ms`);
      await sleep(backoff);
    }
  }

  // All retries exhausted
  return {
    data: opts.fallback ?? null,
    status: opts.fallback ? 'partial' : 'failed',
    error: lastError?.message || 'Unknown error',
    errorCategory: lastCategory,
    attempts: opts.retries,
    latencyMs: Date.now() - startTime,
  };
}

// =============================================================================
// BATCH FETCH
// =============================================================================

export interface BatchFetchResult<T> {
  results: Map<string, FetchResult<T>>;
  successCount: number;
  failureCount: number;
  partialCount: number;
  totalLatencyMs: number;
}

/**
 * Fetch multiple sources in parallel with individual error handling
 */
export async function batchResilientFetch<T>(
  fetchers: Map<string, () => Promise<T>>,
  options?: ResilientFetchOptions<T>
): Promise<BatchFetchResult<T>> {
  const startTime = Date.now();
  const results = new Map<string, FetchResult<T>>();

  const promises = Array.from(fetchers.entries()).map(async ([name, fetcher]) => {
    const result = await resilientFetch(name, fetcher, options);
    results.set(name, result);
    return result;
  });

  await Promise.all(promises);

  let successCount = 0;
  let failureCount = 0;
  let partialCount = 0;

  results.forEach((result) => {
    switch (result.status) {
      case 'success':
        successCount++;
        break;
      case 'failed':
        failureCount++;
        break;
      case 'partial':
        partialCount++;
        break;
    }
  });

  return {
    results,
    successCount,
    failureCount,
    partialCount,
    totalLatencyMs: Date.now() - startTime,
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap an existing async function with resilient fetching
 */
export function withResilience<T, Args extends any[]>(
  name: string,
  fn: (...args: Args) => Promise<T>,
  options?: ResilientFetchOptions<T>
): (...args: Args) => Promise<FetchResult<T>> {
  return (...args: Args) => resilientFetch(name, () => fn(...args), options);
}

/**
 * Create a cached resilient fetcher that deduplicates concurrent requests
 */
export function createDedupedFetcher<T>(
  name: string,
  fetcher: () => Promise<T>,
  options?: ResilientFetchOptions<T> & { cacheTtlMs?: number }
) {
  let inFlightPromise: Promise<FetchResult<T>> | null = null;
  let cachedResult: FetchResult<T> | null = null;
  let cachedAt = 0;
  const cacheTtl = options?.cacheTtlMs ?? 0;

  return async (): Promise<FetchResult<T>> => {
    // Return cached result if valid
    if (cachedResult && cacheTtl > 0 && Date.now() - cachedAt < cacheTtl) {
      return { ...cachedResult, attempts: 0 }; // 0 attempts = cache hit
    }

    // Return in-flight promise if exists (deduplication)
    if (inFlightPromise) {
      return inFlightPromise;
    }

    // Start new fetch
    inFlightPromise = resilientFetch(name, fetcher, options);

    try {
      const result = await inFlightPromise;
      if (result.status === 'success') {
        cachedResult = result;
        cachedAt = Date.now();
      }
      return result;
    } finally {
      inFlightPromise = null;
    }
  };
}

// =============================================================================
// GRACEFUL DEGRADATION HELPERS
// =============================================================================

/**
 * Try primary fetcher, fall back to secondary on failure
 */
export async function fetchWithFallback<T>(
  primary: { name: string; fetcher: () => Promise<T> },
  fallback: { name: string; fetcher: () => Promise<T> },
  options?: ResilientFetchOptions<T>
): Promise<FetchResult<T> & { source: 'primary' | 'fallback' }> {
  const primaryResult = await resilientFetch(primary.name, primary.fetcher, options);

  if (primaryResult.status === 'success') {
    return { ...primaryResult, source: 'primary' };
  }

  console.log(`[GracefulDegradation] Primary ${primary.name} failed, trying fallback ${fallback.name}`);

  const fallbackResult = await resilientFetch(fallback.name, fallback.fetcher, options);
  return { ...fallbackResult, source: 'fallback' };
}

/**
 * Try multiple sources and merge results
 */
export async function fetchAndMerge<T>(
  sources: Array<{ name: string; fetcher: () => Promise<Partial<T>>; priority: number }>,
  merger: (results: Partial<T>[]) => T,
  options?: ResilientFetchOptions<Partial<T>>
): Promise<FetchResult<T>> {
  const startTime = Date.now();

  // Fetch all in parallel
  const results = await Promise.all(
    sources.map((s) => resilientFetch(s.name, s.fetcher, options))
  );

  // Collect successful partial results, sorted by priority
  const successfulResults = sources
    .map((source, index) => ({ source, result: results[index] }))
    .filter(({ result }) => result.status === 'success' && result.data)
    .sort((a, b) => a.source.priority - b.source.priority)
    .map(({ result }) => result.data as Partial<T>);

  if (successfulResults.length === 0) {
    return {
      data: null,
      status: 'failed',
      error: 'All sources failed',
      attempts: sources.length,
      latencyMs: Date.now() - startTime,
    };
  }

  try {
    const merged = merger(successfulResults);
    return {
      data: merged,
      status: successfulResults.length === sources.length ? 'success' : 'partial',
      attempts: sources.length,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      data: null,
      status: 'failed',
      error: `Merge failed: ${error instanceof Error ? error.message : 'Unknown'}`,
      attempts: sources.length,
      latencyMs: Date.now() - startTime,
    };
  }
}
