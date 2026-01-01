/**
 * Request Tracing Middleware
 *
 * Adds request tracing capabilities to API routes:
 * - Generates or propagates x-request-id header
 * - Logs request start/end with timing
 * - Adds response timing headers
 * - Sends metrics to Datadog
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createRequestLogger, type ServiceLogger } from '../utils/logger';
import { datadog } from '../services/datadog-service';

export interface RequestContext {
  requestId: string;
  startTime: number;
  logger: ServiceLogger;
}

export type TracedHandler<T = unknown> = (
  request: NextRequest,
  context: RequestContext
) => Promise<NextResponse<T>>;

/**
 * Wrap an API route handler with request tracing
 *
 * @example
 * ```ts
 * export const GET = withRequestTracing(async (request, context) => {
 *   const { requestId, logger } = context;
 *
 *   logger.info('Processing request', { path: request.nextUrl.pathname });
 *
 *   const data = await fetchData();
 *
 *   return NextResponse.json({ success: true, data });
 * });
 * ```
 */
export function withRequestTracing<T>(handler: TracedHandler<T>) {
  return async (request: NextRequest): Promise<NextResponse<T>> => {
    // Generate or use existing request ID
    const requestId = request.headers.get('x-request-id') || uuidv4();
    const startTime = Date.now();

    // Create request-scoped logger
    const logger = createRequestLogger('API', requestId);

    // Log request start
    logger.info('Request started', {
      method: request.method,
      path: request.nextUrl.pathname,
      query: Object.fromEntries(request.nextUrl.searchParams),
      userAgent: request.headers.get('user-agent') || undefined,
    });

    try {
      // Execute the handler
      const response = await handler(request, { requestId, startTime, logger });

      // Calculate duration
      const duration = Date.now() - startTime;

      // Add tracing headers to response
      const headers = new Headers(response.headers);
      headers.set('x-request-id', requestId);
      headers.set('x-response-time', `${duration}ms`);

      // Log request completion
      logger.info('Request completed', {
        method: request.method,
        path: request.nextUrl.pathname,
        status: response.status,
        duration,
      });

      // Send to Datadog
      datadog.trackRequest(
        request.method,
        request.nextUrl.pathname,
        response.status,
        duration,
        { requestId }
      );

      // Return response with added headers
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }) as NextResponse<T>;
    } catch (error) {
      // Calculate duration
      const duration = Date.now() - startTime;

      // Log error
      logger.error('Request failed', error, {
        method: request.method,
        path: request.nextUrl.pathname,
        duration,
      });

      // Send to Datadog
      datadog.error('Request failed', error, {
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        duration_ms: duration,
      });
      datadog.trackRequest(
        request.method,
        request.nextUrl.pathname,
        500,
        duration,
        { requestId, error: true }
      );

      // Create error response
      const errorResponse = NextResponse.json(
        { error: 'Internal server error', requestId },
        {
          status: 500,
          headers: {
            'x-request-id': requestId,
            'x-response-time': `${duration}ms`,
          },
        }
      );

      return errorResponse as NextResponse<T>;
    }
  };
}

/**
 * Extract request ID from headers or generate a new one
 */
export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') || uuidv4();
}

/**
 * Create standard error response with tracing headers
 */
export function createErrorResponse(
  message: string,
  status: number,
  requestId: string,
  startTime: number
): NextResponse {
  const duration = Date.now() - startTime;
  return NextResponse.json(
    { error: message, requestId },
    {
      status,
      headers: {
        'x-request-id': requestId,
        'x-response-time': `${duration}ms`,
      },
    }
  );
}

/**
 * Create standard success response with tracing headers
 */
export function createSuccessResponse<T>(
  data: T,
  requestId: string,
  startTime: number,
  status = 200
): NextResponse<T> {
  const duration = Date.now() - startTime;
  return NextResponse.json(data, {
    status,
    headers: {
      'x-request-id': requestId,
      'x-response-time': `${duration}ms`,
    },
  }) as NextResponse<T>;
}
