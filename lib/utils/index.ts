/**
 * Utility functions and classes for the Moccet backend
 */

// Retry with exponential backoff
export {
  withRetry,
  retry,
  createRetryable,
  type RetryConfig,
  type RetryResult,
} from './retry';

// Circuit breaker pattern
export {
  CircuitBreaker,
  CircuitBreakerRegistry,
  CircuitOpenError,
  circuitBreakers,
  providerCircuitBreakers,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
} from './circuit-breaker';

// Request deduplication
export {
  RequestDeduplicator,
  ecosystemDeduplicator,
  createEcosystemKey,
  createDeduplicable,
  type DeduplicatorConfig,
} from './request-deduplicator';

// Structured logging
export {
  createLogger,
  createRequestLogger,
  loggers,
  logger,
  type LogContext,
  type ServiceLogger,
} from './logger';
