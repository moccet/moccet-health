/**
 * Weekly Preference Decay Cron Job
 *
 * Decays user preferences toward neutral (0.5) so recent engagement
 * matters more than old engagement. Run weekly.
 *
 * GET /api/cron/decay-preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { PreferenceLearner } from '@/lib/services/preference-learner';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('DecayPreferencesCron');

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');
    const isDev = process.env.NODE_ENV === 'development';

    if (authHeader !== `Bearer ${CRON_SECRET}` && cronSecret !== CRON_SECRET && !isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting weekly preference decay');

    // Decay with factor 0.95 (5% decay toward neutral)
    await PreferenceLearner.decayAllPreferences(0.95);

    logger.info('Preference decay completed');

    return NextResponse.json({
      success: true,
      message: 'Preferences decayed successfully',
      decayFactor: 0.95,
    });
  } catch (error) {
    logger.error('Preference decay failed', { error });
    return NextResponse.json(
      {
        error: 'Decay failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
