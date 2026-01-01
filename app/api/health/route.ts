/**
 * Health Check Endpoint
 *
 * Provides system health status for monitoring and orchestration.
 * Returns overall status and individual component health checks.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/utils/logger';
import { datadog } from '@/lib/services/datadog-service';

const logger = createLogger('HealthCheck');

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: CheckResult;
    supabaseAuth: CheckResult;
    datadog: CheckResult;
  };
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  latency?: number;
  message?: string;
}

// Track server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'fail',
        message: 'Missing Supabase configuration',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simple query to check connectivity
    const { error } = await supabase
      .from('real_time_insights')
      .select('id')
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      return {
        status: 'fail',
        latency,
        message: error.message,
      };
    }

    // Warn if latency is high
    if (latency > 1000) {
      return {
        status: 'warn',
        latency,
        message: 'High latency detected',
      };
    }

    return {
      status: 'pass',
      latency,
    };
  } catch (error) {
    return {
      status: 'fail',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Datadog connectivity
 */
function checkDatadog(): CheckResult {
  if (!datadog.isConfigured()) {
    return {
      status: 'warn',
      message: 'Datadog not configured (DD_API_KEY missing)',
    };
  }

  return {
    status: 'pass',
    message: 'Datadog configured',
  };
}

/**
 * Check Supabase Auth service
 */
async function checkSupabaseAuth(): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        status: 'fail',
        message: 'Missing Supabase configuration',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check auth service by listing users (admin only)
    const { error } = await supabase.auth.admin.listUsers({ perPage: 1 });

    const latency = Date.now() - startTime;

    if (error) {
      return {
        status: 'fail',
        latency,
        message: error.message,
      };
    }

    return {
      status: 'pass',
      latency,
    };
  } catch (error) {
    return {
      status: 'fail',
      latency: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET /api/health
 *
 * Returns the health status of all system components
 */
export async function GET(): Promise<NextResponse<HealthStatus>> {
  const startTime = Date.now();

  logger.info('Health check requested');

  // Run all checks in parallel
  const [database, supabaseAuth] = await Promise.all([
    checkDatabase(),
    checkSupabaseAuth(),
  ]);

  // Sync checks
  const datadogCheck = checkDatadog();

  const checks = {
    database,
    supabaseAuth,
    datadog: datadogCheck,
  };

  // Determine overall status
  const checkResults = Object.values(checks);
  const hasFailure = checkResults.some((c) => c.status === 'fail');
  const hasWarning = checkResults.some((c) => c.status === 'warn');

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (hasFailure) {
    status = 'unhealthy';
  } else if (hasWarning) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }

  const healthStatus: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || process.env.npm_package_version || 'unknown',
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    checks,
  };

  const duration = Date.now() - startTime;

  logger.info('Health check completed', {
    status,
    duration,
    checks: Object.fromEntries(
      Object.entries(checks).map(([key, value]) => [key, value.status])
    ),
  });

  // Return appropriate HTTP status code
  const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

  return NextResponse.json(healthStatus, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Response-Time': `${duration}ms`,
    },
  });
}

/**
 * HEAD /api/health
 *
 * Simple liveness check - returns 200 if server is running
 */
export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}
