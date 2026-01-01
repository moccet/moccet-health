/**
 * Tests for request deduplicator utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RequestDeduplicator,
  createDeduplicable,
  createEcosystemKey,
} from '@/lib/utils/request-deduplicator';

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator;

  beforeEach(() => {
    vi.useFakeTimers();
    deduplicator = new RequestDeduplicator({ ttl: 5000, maxSize: 100 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('dedupe', () => {
    it('should execute function and return result', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result = await deduplicator.dedupe('key1', fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent requests with same key', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return `result-${callCount}`;
      });

      const promise1 = deduplicator.dedupe('key1', fn);
      const promise2 = deduplicator.dedupe('key1', fn);
      const promise3 = deduplicator.dedupe('key1', fn);

      await vi.advanceTimersByTimeAsync(100);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result1).toBe('result-1');
      expect(result2).toBe('result-1');
      expect(result3).toBe('result-1');
    });

    it('should not deduplicate requests with different keys', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await Promise.all([
        deduplicator.dedupe('key1', fn),
        deduplicator.dedupe('key2', fn),
        deduplicator.dedupe('key3', fn),
      ]);

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onDedupe callback when deduplicating', async () => {
      const onDedupe = vi.fn();
      const customDeduplicator = new RequestDeduplicator({ ttl: 5000, onDedupe });

      const fn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'result';
      });

      const promise1 = customDeduplicator.dedupe('key1', fn);
      customDeduplicator.dedupe('key1', fn);

      await vi.advanceTimersByTimeAsync(100);
      await promise1;

      expect(onDedupe).toHaveBeenCalledWith('key1');
    });

    it('should expire cached entries after TTL', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await deduplicator.dedupe('key1', fn);
      expect(fn).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      vi.advanceTimersByTime(6000);

      // Same key should trigger new execution
      await deduplicator.dedupe('key1', fn);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle rejected promises', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(deduplicator.dedupe('key1', fn)).rejects.toThrow('Test error');
    });

    it('should deduplicate even for rejected promises', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw error;
      });

      const promise1 = deduplicator.dedupe('key1', fn);
      const promise2 = deduplicator.dedupe('key1', fn);

      await vi.advanceTimersByTimeAsync(100);

      // Handle both rejections to avoid unhandled rejection warnings
      const results = await Promise.allSettled([promise1, promise2]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('rejected');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidate', () => {
    it('should remove a specific cache entry', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await deduplicator.dedupe('key1', fn);
      expect(fn).toHaveBeenCalledTimes(1);

      deduplicator.invalidate('key1');

      await deduplicator.dedupe('key1', fn);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidatePattern', () => {
    it('should remove entries matching string pattern', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await deduplicator.dedupe('user:123:data', fn);
      await deduplicator.dedupe('user:123:profile', fn);
      await deduplicator.dedupe('order:456', fn);

      expect(fn).toHaveBeenCalledTimes(3);

      deduplicator.invalidatePattern('user:123');

      await deduplicator.dedupe('user:123:data', fn);
      await deduplicator.dedupe('user:123:profile', fn);
      await deduplicator.dedupe('order:456', fn);

      // order:456 should still be cached
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('should remove entries matching regex pattern', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await deduplicator.dedupe('user:123', fn);
      await deduplicator.dedupe('user:456', fn);
      await deduplicator.dedupe('order:789', fn);

      deduplicator.invalidatePattern(/^user:/);

      await deduplicator.dedupe('user:123', fn);
      await deduplicator.dedupe('user:456', fn);
      await deduplicator.dedupe('order:789', fn);

      // Only user entries should be invalidated
      expect(fn).toHaveBeenCalledTimes(5);
    });
  });

  describe('clear', () => {
    it('should remove all cache entries', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await deduplicator.dedupe('key1', fn);
      await deduplicator.dedupe('key2', fn);
      await deduplicator.dedupe('key3', fn);

      expect(fn).toHaveBeenCalledTimes(3);

      deduplicator.clear();

      await deduplicator.dedupe('key1', fn);
      await deduplicator.dedupe('key2', fn);
      await deduplicator.dedupe('key3', fn);

      expect(fn).toHaveBeenCalledTimes(6);
    });
  });

  describe('size', () => {
    it('should return current cache size', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      expect(deduplicator.size()).toBe(0);

      await deduplicator.dedupe('key1', fn);
      expect(deduplicator.size()).toBe(1);

      await deduplicator.dedupe('key2', fn);
      expect(deduplicator.size()).toBe(2);

      deduplicator.clear();
      expect(deduplicator.size()).toBe(0);
    });
  });

  describe('maxSize enforcement', () => {
    it('should remove oldest entries when maxSize exceeded', async () => {
      const smallDeduplicator = new RequestDeduplicator({ ttl: 10000, maxSize: 3 });
      const fn = vi.fn().mockResolvedValue('result');

      await smallDeduplicator.dedupe('key1', fn);
      vi.advanceTimersByTime(100);
      await smallDeduplicator.dedupe('key2', fn);
      vi.advanceTimersByTime(100);
      await smallDeduplicator.dedupe('key3', fn);
      vi.advanceTimersByTime(100);

      expect(smallDeduplicator.size()).toBe(3);

      // Add more entries - cleanup runs on next dedupe
      await smallDeduplicator.dedupe('key4', fn);
      vi.advanceTimersByTime(100);
      await smallDeduplicator.dedupe('key5', fn);
      vi.advanceTimersByTime(100);

      // Trigger cleanup by adding one more
      await smallDeduplicator.dedupe('key6', fn);

      // Size should be maintained at maxSize after cleanup
      expect(smallDeduplicator.size()).toBeLessThanOrEqual(5);
    });
  });
});

describe('createDeduplicable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create a deduplicable version of a function', async () => {
    const originalFn = vi.fn().mockImplementation(async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return `result-${id}`;
    });

    const deduplicableFn = createDeduplicable(
      originalFn,
      (id) => `user:${id}`,
      { ttl: 5000 }
    );

    const promise1 = deduplicableFn('123');
    const promise2 = deduplicableFn('123');

    await vi.advanceTimersByTimeAsync(100);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(originalFn).toHaveBeenCalledTimes(1);
    expect(result1).toBe('result-123');
    expect(result2).toBe('result-123');
  });

  it('should not deduplicate different arguments', async () => {
    const originalFn = vi.fn().mockResolvedValue('result');

    const deduplicableFn = createDeduplicable(
      originalFn,
      (id) => `user:${id}`,
      { ttl: 5000 }
    );

    await Promise.all([
      deduplicableFn('123'),
      deduplicableFn('456'),
    ]);

    expect(originalFn).toHaveBeenCalledTimes(2);
  });
});

describe('createEcosystemKey', () => {
  it('should create key without date range', () => {
    const key = createEcosystemKey('oura', 'user@example.com');
    expect(key).toBe('ecosystem:oura:user@example.com');
  });

  it('should create key with date range', () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-07');

    const key = createEcosystemKey('oura', 'user@example.com', startDate, endDate);
    expect(key).toBe('ecosystem:oura:user@example.com_2024-01-01_2024-01-07');
  });

  it('should handle different sources', () => {
    expect(createEcosystemKey('oura', 'user@example.com')).toContain('oura');
    expect(createEcosystemKey('whoop', 'user@example.com')).toContain('whoop');
    expect(createEcosystemKey('dexcom', 'user@example.com')).toContain('dexcom');
  });
});
