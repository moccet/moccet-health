/**
 * Retry utility with exponential backoff
 *
 * Provides resilient execution of async operations with configurable
 * retry logic, exponential backoff, and retryable error detection.
 */

export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds between retries (default: 1000) */
  baseDelay: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay: number;
  /** Error codes or messages that should trigger a retry */
  retryableErrors?: string[];
  /** Custom function to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'EPIPE',
    'EHOSTUNREACH',
    'EAI_AGAIN',
    'socket hang up',
    'network error',
    'timeout',
    'rate limit',
    '429',
    '500',
    '502',
    '503',
    '504',
  ],
};

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delayWithJitter = exponentialDelay + jitter;
  // Cap at maxDelay
  return Math.min(delayWithJitter, maxDelay);
}

/**
 * Check if an error is retryable based on config
 */
function isErrorRetryable(error: unknown, config: RetryConfig): boolean {
  // Use custom function if provided
  if (config.isRetryable) {
    return config.isRetryable(error);
  }

  // Check against retryable error patterns
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = (error as { code?: string })?.code;

  const patterns = config.retryableErrors || DEFAULT_CONFIG.retryableErrors!;

  for (const pattern of patterns) {
    if (
      errorMessage.toLowerCase().includes(pattern.toLowerCase()) ||
      errorCode === pattern
    ) {
      return true;
    }
  }

  // Check HTTP status codes in error responses
  const statusCode = (error as { status?: number; statusCode?: number })?.status ||
                     (error as { status?: number; statusCode?: number })?.statusCode;
  if (statusCode && patterns.includes(String(statusCode))) {
    return true;
  }

  return false;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry
      const shouldRetry = attempt < finalConfig.maxRetries && isErrorRetryable(error, finalConfig);

      if (!shouldRetry) {
        // Not retryable or out of retries
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDuration: Date.now() - startTime,
        };
      }

      // Calculate delay for next retry
      const delay = calculateDelay(attempt, finalConfig.baseDelay, finalConfig.maxDelay);

      // Notify about retry if callback provided
      if (finalConfig.onRetry) {
        finalConfig.onRetry(attempt + 1, error, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: finalConfig.maxRetries + 1,
    totalDuration: Date.now() - startTime,
  };
}

/**
 * Simple retry wrapper that throws on failure (for backward compatibility)
 *
 * @example
 * ```ts
 * try {
 *   const data = await retry(() => fetchData(), { maxRetries: 3 });
 *   console.log('Data:', data);
 * } catch (error) {
 *   console.error('Failed:', error);
 * }
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const result = await withRetry(fn, config);
  if (result.success) {
    return result.data as T;
  }
  throw result.error;
}

/**
 * Create a retryable version of any async function
 *
 * @example
 * ```ts
 * const fetchWithRetry = createRetryable(
 *   (url: string) => fetch(url).then(r => r.json()),
 *   { maxRetries: 3 }
 * );
 *
 * const data = await fetchWithRetry('https://api.example.com/data');
 * ```
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  config: Partial<RetryConfig> = {}
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => retry(() => fn(...args), config);
}
