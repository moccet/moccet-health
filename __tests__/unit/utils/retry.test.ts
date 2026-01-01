/**
 * Tests for retry utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, retry, createRetryable } from '@/lib/utils/retry';

describe('retry utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('withRetry', () => {
    it('should return success on first try when function succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error and succeed', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxRetries: 3, baseDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries exhausted', async () => {
      const error = new Error('ETIMEDOUT');
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = withRetry(fn, { maxRetries: 2, baseDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('ETIMEDOUT');
      expect(result.attempts).toBe(3); // initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Validation failed');
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = withRetry(fn, { maxRetries: 3, baseDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on 429 rate limit error', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce({ message: 'Rate limit exceeded', status: 429 })
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxRetries: 3, baseDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should retry on 503 service unavailable', async () => {
      const error503 = new Error('Service unavailable 503');
      const fn = vi
        .fn()
        .mockRejectedValueOnce(error503)
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxRetries: 3, baseDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should call onRetry callback before each retry', async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { maxRetries: 3, baseDelay: 100, onRetry });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should use custom isRetryable function', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('CUSTOM_ERROR'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, {
        maxRetries: 3,
        baseDelay: 100,
        isRetryable: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          return message === 'CUSTOM_ERROR';
        },
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should respect maxDelay limit', async () => {
      const onRetry = vi.fn();
      const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

      const resultPromise = withRetry(fn, {
        maxRetries: 5,
        baseDelay: 1000,
        maxDelay: 2000,
        onRetry,
      });

      // Run all timers to completion
      await vi.runAllTimersAsync();
      await resultPromise;

      // All delays should be capped at maxDelay (approximately, due to jitter)
      const delays = onRetry.mock.calls.map((call) => call[2]);
      delays.forEach((delay) => {
        expect(delay).toBeLessThanOrEqual(2000);
      });
    });
  });

  describe('retry', () => {
    it('should return data on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = retry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('success');
    });

    it('should throw on failure', async () => {
      const error = new Error('Failed');
      const fn = vi.fn().mockRejectedValue(error);

      const resultPromise = retry(fn, { maxRetries: 0 });
      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('Failed');
    });
  });

  describe('createRetryable', () => {
    it('should create a retryable version of a function', async () => {
      const originalFn = vi.fn().mockResolvedValue('result');
      const retryableFn = createRetryable(originalFn);

      const resultPromise = retryableFn('arg1', 'arg2');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('result');
      expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should apply retry logic to the wrapped function', async () => {
      const originalFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('result');

      const retryableFn = createRetryable(originalFn, { maxRetries: 2, baseDelay: 100 });

      const resultPromise = retryableFn('arg');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe('result');
      expect(originalFn).toHaveBeenCalledTimes(2);
    });
  });
});
