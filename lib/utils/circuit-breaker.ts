/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping calls to a failing service
 * after a threshold of failures, allowing time for recovery.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests are rejected immediately
 * - HALF_OPEN: Testing if service has recovered
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold: number;
  /** Number of successes in half-open state to close circuit (default: 2) */
  successThreshold: number;
  /** Time in ms before attempting reset from open state (default: 30000) */
  resetTimeout: number;
  /** Called when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, name: string) => void;
  /** Called when a request is rejected due to open circuit */
  onRejected?: (name: string) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  totalRejections: number;
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly resetTimeout: number
  ) {
    super(`Circuit breaker '${circuitName}' is open. Service unavailable.`);
    this.name = 'CircuitOpenError';
  }
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 30000,
};

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private totalRejections = 0;
  private config: CircuitBreakerConfig;

  constructor(
    private readonly name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      totalRejections: this.totalRejections,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (this.state !== 'OPEN' || !this.lastFailureTime) {
      return false;
    }
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.config.onStateChange?.(oldState, newState, this.name);
    }
  }

  /**
   * Record a successful call
   */
  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        // Enough successes to close the circuit
        this.transitionTo('CLOSED');
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Record a failed call
   */
  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.totalFailures++;
    this.failures++;

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open state reopens the circuit
      this.transitionTo('OPEN');
      this.successes = 0;
    } else if (this.state === 'CLOSED') {
      if (this.failures >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Execute a function through the circuit breaker
   *
   * @throws CircuitOpenError if the circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        // Try to transition to half-open
        this.transitionTo('HALF_OPEN');
        this.successes = 0;
      } else {
        // Still open, reject the request
        this.totalRejections++;
        this.config.onRejected?.(this.name);
        throw new CircuitOpenError(this.name, this.config.resetTimeout);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Manually reset the circuit breaker to closed state
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failures = 0;
    this.successes = 0;
  }

  /**
   * Manually open the circuit breaker
   */
  trip(): void {
    this.transitionTo('OPEN');
    this.lastFailureTime = new Date();
  }
}

/**
 * Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: Partial<CircuitBreakerConfig>;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create a circuit breaker by name
   */
  get(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    let breaker = this.breakers.get(name);
    if (!breaker) {
      breaker = new CircuitBreaker(name, { ...this.defaultConfig, ...config });
      this.breakers.set(name, breaker);
    }
    return breaker;
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  /**
   * Get stats for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

/**
 * Pre-configured circuit breakers for data providers
 */
export const providerCircuitBreakers = new CircuitBreakerRegistry({
  onStateChange: (from, to, name) => {
    console.log(`[Circuit Breaker] ${name}: ${from} -> ${to}`);
  },
});

// Create provider-specific circuit breakers with different thresholds
export const circuitBreakers = {
  oura: providerCircuitBreakers.get('oura', { failureThreshold: 5 }),
  dexcom: providerCircuitBreakers.get('dexcom', { failureThreshold: 3 }),
  whoop: providerCircuitBreakers.get('whoop', { failureThreshold: 5 }),
  vital: providerCircuitBreakers.get('vital', { failureThreshold: 5 }),
  gmail: providerCircuitBreakers.get('gmail', { failureThreshold: 5 }),
  slack: providerCircuitBreakers.get('slack', { failureThreshold: 5 }),
  outlook: providerCircuitBreakers.get('outlook', { failureThreshold: 5 }),
  teams: providerCircuitBreakers.get('teams', { failureThreshold: 5 }),
  spotify: providerCircuitBreakers.get('spotify', { failureThreshold: 5 }),
  openai: providerCircuitBreakers.get('openai', { failureThreshold: 3, resetTimeout: 60000 }),
  anthropic: providerCircuitBreakers.get('anthropic', { failureThreshold: 3, resetTimeout: 60000 }),
};
