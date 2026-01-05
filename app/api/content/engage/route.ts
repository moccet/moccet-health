/**
 * Content Engagement API
 *
 * Records user engagement signals (like, share, save, dismiss) and updates preferences.
 *
 * POST /api/content/engage
 * Body: { contentId, contentType, contentCategory, signalType, platform? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceLearner, SignalType } from '@/lib/services/preference-learner';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ContentEngageAPI');

interface EngageRequestBody {
  contentId: string;
  contentType: 'wisdom' | 'health_insight';
  contentCategory: string;
  signalType: SignalType;
  platform?: string;
  timeSpentSeconds?: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in' },
        { status: 401 }
      );
    }

    const body: EngageRequestBody = await request.json();

    // Validate required fields
    if (!body.contentId || !body.contentType || !body.signalType) {
      return NextResponse.json(
        { error: 'Missing required fields: contentId, contentType, signalType' },
        { status: 400 }
      );
    }

    // Validate signal type
    const validSignals: SignalType[] = ['like', 'share', 'save', 'dismiss', 'view', 'deep_read'];
    if (!validSignals.includes(body.signalType)) {
      return NextResponse.json(
        { error: `Invalid signal type. Must be one of: ${validSignals.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate content type
    if (!['wisdom', 'health_insight'].includes(body.contentType)) {
      return NextResponse.json(
        { error: 'Invalid content type. Must be "wisdom" or "health_insight"' },
        { status: 400 }
      );
    }

    logger.info('Recording engagement', {
      email: user.email,
      contentId: body.contentId,
      signalType: body.signalType,
    });

    // Record the engagement
    await PreferenceLearner.recordEngagement(user.email, {
      contentId: body.contentId,
      contentType: body.contentType,
      contentCategory: body.contentCategory || 'general',
      signalType: body.signalType,
      platform: body.platform,
      timeSpentSeconds: body.timeSpentSeconds,
    });

    return NextResponse.json({
      success: true,
      message: `Engagement recorded: ${body.signalType}`,
    });
  } catch (error) {
    logger.error('Error recording engagement', { error });
    return NextResponse.json(
      {
        error: 'Failed to record engagement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/content/engage?contentId=xxx
 * Get engagement history for a specific content item
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized - must be logged in' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contentId = searchParams.get('contentId');

    // Get user's engagement history
    const history = await PreferenceLearner.getEngagementHistory(
      user.email,
      contentId ? 1 : 50
    );

    // If specific content requested, filter
    if (contentId) {
      const engagement = history.find((h) => h.contentId === contentId);
      return NextResponse.json({
        success: true,
        engaged: !!engagement,
        engagement: engagement || null,
      });
    }

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error) {
    logger.error('Error fetching engagement', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch engagement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
