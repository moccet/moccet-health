/**
 * Daily Digest Cron Job
 *
 * Sends personalized daily digests to users at their preferred time.
 * This endpoint should be called by a cron service (e.g., Vercel Cron)
 * every 15 minutes to catch all timezone windows.
 *
 * Vercel Cron config (in vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-digest",
 *     "schedule": "0,15,30,45 * * * *"
 *   }]
 * }
 *
 * GET /api/cron/daily-digest - Run digest job for current time window
 * POST /api/cron/daily-digest - Manual trigger for specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { DailyDigestService } from '@/lib/services/daily-digest-service';
import { MorningBriefingService } from '@/lib/services/morning-briefing-service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('DailyDigestCron');

// Cron secret for verification (set in env)
const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

/**
 * GET - Run scheduled digest job
 * Called by Vercel Cron every 15 minutes
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this in Authorization header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');

    // Check for Vercel cron verification or manual secret
    const isVercelCron = authHeader === `Bearer ${CRON_SECRET}`;
    const hasSecret = cronSecret === CRON_SECRET;

    // In development, allow without secret
    const isDev = process.env.NODE_ENV === 'development';

    if (!isVercelCron && !hasSecret && !isDev) {
      logger.warn('Unauthorized cron request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    logger.info('Daily digest cron job triggered');

    // Run the digest job and morning briefing job in parallel
    const [digestResult, briefingResult] = await Promise.all([
      DailyDigestService.runDigestJob(),
      MorningBriefingService.runBriefingJob(),
    ]);

    logger.info('Daily digest and morning briefing cron jobs completed', {
      digest: {
        processed: digestResult.processed,
        successful: digestResult.successful,
        notificationsSent: digestResult.notificationsSent,
      },
      briefing: {
        processed: briefingResult.processed,
        sent: briefingResult.sent,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Daily digest and morning briefing jobs completed',
      stats: {
        digest: {
          processed: digestResult.processed,
          successful: digestResult.successful,
          notificationsSent: digestResult.notificationsSent,
        },
        briefing: {
          processed: briefingResult.processed,
          sent: briefingResult.sent,
        },
      },
      // Only include detailed results in dev
      ...(isDev ? {
        digestResults: digestResult.results,
        briefingResults: briefingResult.results,
      } : {}),
    });
  } catch (error) {
    logger.error('Daily digest cron job failed', { error });
    return NextResponse.json(
      {
        error: 'Digest job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Manual trigger for a specific user
 * Useful for testing or sending digest on demand
 */
export async function POST(request: NextRequest) {
  try {
    // Check for admin auth
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY || 'moccet-admin-seed-key';

    if (authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    logger.info('Manual digest trigger', { email });

    const result = await DailyDigestService.sendDigestNow(email);

    return NextResponse.json({
      success: result.success,
      result,
    });
  } catch (error) {
    logger.error('Manual digest trigger failed', { error });
    return NextResponse.json(
      {
        error: 'Failed to send digest',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
