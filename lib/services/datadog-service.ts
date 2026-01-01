/**
 * Datadog Service for Backend
 *
 * Provides logging, error tracking, and metrics for the Next.js backend.
 * Uses Datadog's HTTP intake API for serverless compatibility.
 *
 * Required environment variables:
 * - DD_API_KEY: Datadog API key
 * - DD_SITE: Datadog site (e.g., 'datadoghq.eu' for EU, 'datadoghq.com' for US)
 * - DD_SERVICE: Service name (default: 'moccet-api')
 * - DD_ENV: Environment (default: process.env.NODE_ENV)
 */

import { metrics as datadogMetrics } from 'datadog-metrics';

// Types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  message: string;
  level: LogLevel;
  service: string;
  ddsource: string;
  ddtags: string;
  hostname: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface DatadogConfig {
  apiKey: string;
  site: string;
  service: string;
  env: string;
  version?: string;
}

// Configuration
const config: DatadogConfig = {
  apiKey: process.env.DD_API_KEY || '',
  site: process.env.DD_SITE || 'datadoghq.eu',
  service: process.env.DD_SERVICE || 'moccet-api',
  env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
  version: process.env.DD_VERSION || '1.0.0',
};

// Check if Datadog is configured
const isConfigured = (): boolean => {
  return !!config.apiKey;
};

// Initialize metrics
let metricsInitialized = false;

function initMetrics(): void {
  if (metricsInitialized || !isConfigured()) return;

  datadogMetrics.init({
    apiKey: config.apiKey,
    host: config.site,
    prefix: `${config.service}.`,
    defaultTags: [
      `env:${config.env}`,
      `service:${config.service}`,
      `version:${config.version}`,
    ],
    flushIntervalSeconds: 15,
  });

  metricsInitialized = true;
}

/**
 * Send logs to Datadog via HTTP API
 */
async function sendLogs(logs: LogEntry[]): Promise<void> {
  if (!isConfigured()) {
    // Fallback to console in development
    logs.forEach((log) => {
      const method = log.level === 'error' ? 'error' : log.level === 'warn' ? 'warn' : 'log';
      console[method](`[${log.level.toUpperCase()}] ${log.message}`, log);
    });
    return;
  }

  const url = `https://http-intake.logs.${config.site}/api/v2/logs`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': config.apiKey,
      },
      body: JSON.stringify(logs),
    });

    if (!response.ok) {
      console.error(`[Datadog] Failed to send logs: ${response.status}`);
    }
  } catch (error) {
    console.error('[Datadog] Error sending logs:', error);
  }
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  attributes?: Record<string, unknown>
): LogEntry {
  return {
    message,
    level,
    service: config.service,
    ddsource: 'nodejs',
    ddtags: `env:${config.env},service:${config.service},version:${config.version}`,
    hostname: process.env.VERCEL_URL || 'localhost',
    timestamp: Date.now(),
    ...attributes,
  };
}

// Buffer for batching logs
let logBuffer: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

function scheduleFlush(): void {
  if (flushTimeout) return;

  flushTimeout = setTimeout(async () => {
    const logsToSend = [...logBuffer];
    logBuffer = [];
    flushTimeout = null;

    if (logsToSend.length > 0) {
      await sendLogs(logsToSend);
    }
  }, 1000); // Flush every second
}

function queueLog(entry: LogEntry): void {
  logBuffer.push(entry);

  // Flush immediately if buffer is large
  if (logBuffer.length >= 10) {
    const logsToSend = [...logBuffer];
    logBuffer = [];
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    sendLogs(logsToSend);
  } else {
    scheduleFlush();
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Datadog Backend Service
 */
export const datadog = {
  /**
   * Check if Datadog is configured
   */
  isConfigured,

  /**
   * Log a debug message
   */
  debug(message: string, attributes?: Record<string, unknown>): void {
    queueLog(createLogEntry('debug', message, attributes));
  },

  /**
   * Log an info message
   */
  info(message: string, attributes?: Record<string, unknown>): void {
    queueLog(createLogEntry('info', message, attributes));
  },

  /**
   * Log a warning message
   */
  warn(message: string, attributes?: Record<string, unknown>): void {
    queueLog(createLogEntry('warn', message, attributes));
  },

  /**
   * Log an error message
   */
  error(
    message: string,
    error?: Error | unknown,
    attributes?: Record<string, unknown>
  ): void {
    const errorAttributes: Record<string, unknown> = { ...attributes };

    if (error instanceof Error) {
      errorAttributes.error = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    } else if (error) {
      errorAttributes.error = String(error);
    }

    queueLog(createLogEntry('error', message, errorAttributes));
  },

  /**
   * Track a custom event
   */
  trackEvent(
    name: string,
    attributes?: Record<string, unknown>
  ): void {
    this.info(`event.${name}`, {
      event_name: name,
      ...attributes,
    });
  },

  /**
   * Track API request
   */
  trackRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    attributes?: Record<string, unknown>
  ): void {
    this.info(`http.request`, {
      http: {
        method,
        url: path,
        status_code: statusCode,
      },
      duration_ms: durationMs,
      ...attributes,
    });

    // Also send as metric
    this.incrementMetric('http.requests', 1, [
      `method:${method}`,
      `status:${statusCode}`,
      `path:${path.split('?')[0]}`,
    ]);

    this.gaugeMetric('http.request.duration', durationMs, [
      `method:${method}`,
      `path:${path.split('?')[0]}`,
    ]);
  },

  /**
   * Track user action
   */
  trackUserAction(
    action: string,
    email?: string,
    attributes?: Record<string, unknown>
  ): void {
    this.info(`user.${action}`, {
      action,
      user_email: email,
      ...attributes,
    });
  },

  // ============================================================================
  // METRICS
  // ============================================================================

  /**
   * Increment a counter metric
   */
  incrementMetric(name: string, value: number = 1, tags?: string[]): void {
    if (!isConfigured()) return;
    initMetrics();
    datadogMetrics.increment(name, value, tags);
  },

  /**
   * Set a gauge metric
   */
  gaugeMetric(name: string, value: number, tags?: string[]): void {
    if (!isConfigured()) return;
    initMetrics();
    datadogMetrics.gauge(name, value, tags);
  },

  /**
   * Record a histogram metric
   */
  histogramMetric(name: string, value: number, tags?: string[]): void {
    if (!isConfigured()) return;
    initMetrics();
    datadogMetrics.histogram(name, value, tags);
  },

  /**
   * Flush all pending logs and metrics
   */
  async flush(): Promise<void> {
    // Flush logs
    if (logBuffer.length > 0) {
      const logsToSend = [...logBuffer];
      logBuffer = [];
      if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
      }
      await sendLogs(logsToSend);
    }

    // Flush metrics
    if (metricsInitialized) {
      datadogMetrics.flush();
    }
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a logger for a specific service/component
 */
export function createDatadogLogger(component: string) {
  const addComponent = (attrs?: Record<string, unknown>) => ({
    component,
    ...attrs,
  });

  return {
    debug: (msg: string, attrs?: Record<string, unknown>) =>
      datadog.debug(msg, addComponent(attrs)),
    info: (msg: string, attrs?: Record<string, unknown>) =>
      datadog.info(msg, addComponent(attrs)),
    warn: (msg: string, attrs?: Record<string, unknown>) =>
      datadog.warn(msg, addComponent(attrs)),
    error: (msg: string, error?: Error | unknown, attrs?: Record<string, unknown>) =>
      datadog.error(msg, error, addComponent(attrs)),
  };
}

/**
 * Wrap an async function with error tracking
 */
export function withDatadogErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  name: string
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();
    try {
      const result = await fn(...args);
      datadog.histogramMetric(`function.duration`, Date.now() - startTime, [`function:${name}`]);
      return result;
    } catch (error) {
      datadog.error(`Function ${name} failed`, error, {
        function_name: name,
        duration_ms: Date.now() - startTime,
      });
      throw error;
    }
  }) as T;
}

export default datadog;
