/**
 * Structured Logging with Pino
 *
 * Provides consistent, structured logging across all services with:
 * - JSON output for production (machine-parseable)
 * - Pretty output for development (human-readable)
 * - Context enrichment (request IDs, user IDs, service names)
 * - Log levels: trace, debug, info, warn, error, fatal
 */

import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

export interface LogContext {
  email?: string;
  requestId?: string;
  service?: string;
  provider?: string;
  duration?: number;
  [key: string]: unknown;
}

// Determine if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Base pino configuration
const baseConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  base: {
    env: process.env.NODE_ENV,
    version: process.env.APP_VERSION || process.env.npm_package_version,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Redact sensitive information
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
    ],
    remove: true,
  },
};

// Create the base logger with transport for development
const createBaseLogger = (): PinoLogger => {
  if (isDevelopment) {
    // Use pino-pretty in development for readable output
    return pino({
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }
  // JSON output for production
  return pino(baseConfig);
};

const baseLogger = createBaseLogger();

/**
 * Service-specific logger interface
 */
export interface ServiceLogger {
  trace: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, error?: Error | unknown, context?: LogContext) => void;
  fatal: (message: string, error?: Error | unknown, context?: LogContext) => void;
  child: (bindings: LogContext) => ServiceLogger;
}

/**
 * Create a logger for a specific service
 *
 * @example
 * ```ts
 * const log = createLogger('InsightTriggerService');
 *
 * log.info('Processing insights', { email: 'user@example.com', providerCount: 5 });
 * log.error('Failed to fetch data', error, { email: 'user@example.com' });
 * ```
 */
export function createLogger(service: string): ServiceLogger {
  const childLogger = baseLogger.child({ service });

  const formatError = (error: unknown): Record<string, unknown> => {
    if (error instanceof Error) {
      return {
        err: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
      };
    }
    return { err: error };
  };

  return {
    trace: (message: string, context?: LogContext) => {
      childLogger.trace(context || {}, message);
    },
    debug: (message: string, context?: LogContext) => {
      childLogger.debug(context || {}, message);
    },
    info: (message: string, context?: LogContext) => {
      childLogger.info(context || {}, message);
    },
    warn: (message: string, context?: LogContext) => {
      childLogger.warn(context || {}, message);
    },
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      if (error) {
        childLogger.error({ ...context, ...formatError(error) }, message);
      } else {
        childLogger.error(context || {}, message);
      }
    },
    fatal: (message: string, error?: Error | unknown, context?: LogContext) => {
      if (error) {
        childLogger.fatal({ ...context, ...formatError(error) }, message);
      } else {
        childLogger.fatal(context || {}, message);
      }
    },
    child: (bindings: LogContext): ServiceLogger => {
      const nestedLogger = childLogger.child(bindings);
      return createChildLogger(nestedLogger);
    },
  };
}

/**
 * Create a child logger from an existing pino logger
 */
function createChildLogger(pinoLogger: PinoLogger): ServiceLogger {
  const formatError = (error: unknown): Record<string, unknown> => {
    if (error instanceof Error) {
      return {
        err: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
      };
    }
    return { err: error };
  };

  return {
    trace: (message: string, context?: LogContext) => {
      pinoLogger.trace(context || {}, message);
    },
    debug: (message: string, context?: LogContext) => {
      pinoLogger.debug(context || {}, message);
    },
    info: (message: string, context?: LogContext) => {
      pinoLogger.info(context || {}, message);
    },
    warn: (message: string, context?: LogContext) => {
      pinoLogger.warn(context || {}, message);
    },
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      if (error) {
        pinoLogger.error({ ...context, ...formatError(error) }, message);
      } else {
        pinoLogger.error(context || {}, message);
      }
    },
    fatal: (message: string, error?: Error | unknown, context?: LogContext) => {
      if (error) {
        pinoLogger.fatal({ ...context, ...formatError(error) }, message);
      } else {
        pinoLogger.fatal(context || {}, message);
      }
    },
    child: (bindings: LogContext): ServiceLogger => {
      const nestedLogger = pinoLogger.child(bindings);
      return createChildLogger(nestedLogger);
    },
  };
}

/**
 * Create a request-scoped logger with request ID
 *
 * @example
 * ```ts
 * const log = createRequestLogger('API', requestId);
 * log.info('Handling request', { path: '/api/insights' });
 * ```
 */
export function createRequestLogger(service: string, requestId: string): ServiceLogger {
  return createLogger(service).child({ requestId });
}

/**
 * Pre-configured loggers for common services
 */
export const loggers = {
  ecosystemFetcher: createLogger('EcosystemFetcher'),
  insightTrigger: createLogger('InsightTriggerService'),
  mcpSync: createLogger('MCPSync'),
  userContext: createLogger('UserContextService'),
  healthPattern: createLogger('HealthPatternAnalyzer'),
  proactiveEngagement: createLogger('ProactiveEngagement'),
  api: createLogger('API'),
};

/**
 * Default logger for quick usage
 */
export const logger = baseLogger;

export default createLogger;
