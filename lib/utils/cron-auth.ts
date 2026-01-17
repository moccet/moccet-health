import { NextRequest } from 'next/server';

/**
 * Shared cron authentication helper
 *
 * Validates cron requests using a standardized pattern:
 * 1. Vercel's built-in x-vercel-cron header (automatic for Vercel cron jobs)
 * 2. Bearer token with CRON_SECRET (for manual triggers or non-Vercel environments)
 *
 * Usage:
 * ```typescript
 * import { isValidCronRequest } from '@/lib/utils/cron-auth';
 *
 * export async function GET(request: NextRequest) {
 *   if (!isValidCronRequest(request)) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // ... handle cron job
 * }
 * ```
 */
export function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const vercelCron = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  // Accept Vercel's built-in cron header
  if (vercelCron === '1') {
    return true;
  }

  // Accept Bearer token if secret is configured
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Log failed auth attempts for debugging (but not the secret itself)
  console.warn('[Cron Auth] Unauthorized request', {
    hasAuthHeader: !!authHeader,
    hasVercelCron: !!vercelCron,
    hasCronSecret: !!cronSecret,
    authType: authHeader?.startsWith('Bearer ') ? 'bearer' : 'other',
  });

  return false;
}

/**
 * Validates a cron request and requires CRON_SECRET to be configured.
 * Use this for stricter validation where cron secret must be set.
 */
export function requireCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('[Cron Auth] CRON_SECRET not configured - request denied');
    return false;
  }

  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Also accept Vercel's built-in cron header
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron === '1') {
    return true;
  }

  return false;
}
