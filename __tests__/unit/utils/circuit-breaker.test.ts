/**
 * Tests for circuit breaker utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitOpenError,
} from '@/lib/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeout: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should have zero stats initially', () => {
      const stats = breaker.getStats();
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalFailures).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.totalRejections).toBe(0);
    });
  });

  describe('CLOSED state', () => {
    it('should allow requests to pass through', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalled();
    });

    it('should count successes', async () => {
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));

      const stats = breaker.getStats();
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalRequests).toBe(2);
    });

    it('should count failures', async () => {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }

      const stats = breaker.getStats();
      expect(stats.failures).toBe(1);
      expect(stats.totalFailures).toBe(1);
    });

    it('should reset failure count on success', async () => {
      // Fail twice
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }

      expect(breaker.getStats().failures).toBe(2);

      // Succeed once
      await breaker.execute(() => Promise.resolve('ok'));

      expect(breaker.getStats().failures).toBe(0);
    });

    it('should transition to OPEN after failure threshold', async () => {
      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('OPEN state', () => {
    beforeEach(async () => {
      // Transition to OPEN state
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }
    });

    it('should reject requests immediately', async () => {
      await expect(
        breaker.execute(() => Promise.resolve('ok'))
      ).rejects.toThrow(CircuitOpenError);

      const stats = breaker.getStats();
      expect(stats.totalRejections).toBe(1);
    });

    it('should include circuit name in error', async () => {
      try {
        await breaker.execute(() => Promise.resolve('ok'));
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitOpenError);
        expect((error as CircuitOpenError).circuitName).toBe('test');
      }
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Advance time past reset timeout
      vi.advanceTimersByTime(5001);

      // Next request should be allowed (transitions to HALF_OPEN)
      const fn = vi.fn().mockResolvedValue('ok');
      await breaker.execute(fn);

      expect(fn).toHaveBeenCalled();
      // State should now be HALF_OPEN or CLOSED depending on success
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Transition to OPEN state
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }
      // Advance time to allow transition to HALF_OPEN
      vi.advanceTimersByTime(5001);
    });

    it('should allow test requests through', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      await breaker.execute(fn);

      expect(fn).toHaveBeenCalled();
    });

    it('should transition to CLOSED after success threshold', async () => {
      // Need 2 successes (successThreshold: 2)
      await breaker.execute(() => Promise.resolve('ok'));
      await breaker.execute(() => Promise.resolve('ok'));

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition back to OPEN on any failure', async () => {
      // First request succeeds (transitions to HALF_OPEN)
      await breaker.execute(() => Promise.resolve('ok'));

      // Second request fails
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('manual controls', () => {
    it('should reset to CLOSED state', async () => {
      // Transition to OPEN
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe('OPEN');

      breaker.reset();

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should manually trip the circuit', () => {
      expect(breaker.getState()).toBe('CLOSED');

      breaker.trip();

      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('state change callbacks', () => {
    it('should call onStateChange when state changes', async () => {
      const onStateChange = vi.fn();
      const breakerWithCallback = new CircuitBreaker('callback-test', {
        failureThreshold: 2,
        onStateChange,
      });

      // Fail twice to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breakerWithCallback.execute(() => Promise.reject(new Error('fail')));
        } catch {
          // Expected
        }
      }

      expect(onStateChange).toHaveBeenCalledWith('CLOSED', 'OPEN', 'callback-test');
    });

    it('should call onRejected when request is rejected', async () => {
      const onRejected = vi.fn();
      const breakerWithCallback = new CircuitBreaker('rejection-test', {
        failureThreshold: 1,
        onRejected,
      });

      // Fail once to open circuit
      try {
        await breakerWithCallback.execute(() => Promise.reject(new Error('fail')));
      } catch {
        // Expected
      }

      // Try again - should be rejected
      try {
        await breakerWithCallback.execute(() => Promise.resolve('ok'));
      } catch {
        // Expected
      }

      expect(onRejected).toHaveBeenCalledWith('rejection-test');
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry({ failureThreshold: 5 });
  });

  it('should create and cache circuit breakers by name', () => {
    const breaker1 = registry.get('service-a');
    const breaker2 = registry.get('service-a');

    expect(breaker1).toBe(breaker2);
  });

  it('should create different breakers for different names', () => {
    const breaker1 = registry.get('service-a');
    const breaker2 = registry.get('service-b');

    expect(breaker1).not.toBe(breaker2);
  });

  it('should apply custom config per breaker', async () => {
    const breaker = registry.get('custom', { failureThreshold: 1 });

    try {
      await breaker.execute(() => Promise.reject(new Error('fail')));
    } catch {
      // Expected
    }

    expect(breaker.getState()).toBe('OPEN');
  });

  it('should return all stats', async () => {
    const breaker1 = registry.get('service-a');
    const breaker2 = registry.get('service-b');

    await breaker1.execute(() => Promise.resolve('ok'));
    await breaker2.execute(() => Promise.resolve('ok'));

    const allStats = registry.getAllStats();

    expect(allStats['service-a'].totalSuccesses).toBe(1);
    expect(allStats['service-b'].totalSuccesses).toBe(1);
  });

  it('should reset all breakers', async () => {
    const breaker1 = registry.get('service-a', { failureThreshold: 1 });
    const breaker2 = registry.get('service-b', { failureThreshold: 1 });

    try {
      await breaker1.execute(() => Promise.reject(new Error('fail')));
    } catch {
      // Expected
    }
    try {
      await breaker2.execute(() => Promise.reject(new Error('fail')));
    } catch {
      // Expected
    }

    expect(breaker1.getState()).toBe('OPEN');
    expect(breaker2.getState()).toBe('OPEN');

    registry.resetAll();

    expect(breaker1.getState()).toBe('CLOSED');
    expect(breaker2.getState()).toBe('CLOSED');
  });
});
