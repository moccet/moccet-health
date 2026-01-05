/**
 * User Preferences API
 *
 * Manages user content preferences and delivery settings.
 *
 * GET /api/preferences - Get user's content preferences
 * PUT /api/preferences - Update preferred notification time
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PreferenceLearner } from '@/lib/services/preference-learner';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('PreferencesAPI');

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

    logger.info('Fetching preferences', { email: user.email });

    const preferences = await PreferenceLearner.getPreferences(user.email);
    const topCategories = await PreferenceLearner.getTopCategories(user.email, 5);

    return NextResponse.json({
      success: true,
      preferences: {
        ...preferences,
        topCategories,
      },
    });
  } catch (error) {
    logger.error('Error fetching preferences', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

interface UpdatePreferencesBody {
  preferredTime?: string; // HH:MM format
  timezone?: string;
}

export async function PUT(request: NextRequest) {
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

    const body: UpdatePreferencesBody = await request.json();

    // Validate time format if provided
    if (body.preferredTime) {
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(body.preferredTime)) {
        return NextResponse.json(
          { error: 'Invalid time format. Use HH:MM (e.g., 08:00)' },
          { status: 400 }
        );
      }
    }

    if (!body.preferredTime && !body.timezone) {
      return NextResponse.json(
        { error: 'Must provide preferredTime or timezone' },
        { status: 400 }
      );
    }

    logger.info('Updating preferences', {
      email: user.email,
      preferredTime: body.preferredTime,
      timezone: body.timezone,
    });

    if (body.preferredTime) {
      await PreferenceLearner.setPreferredTime(
        user.email,
        body.preferredTime,
        body.timezone
      );
    }

    // Return updated preferences
    const preferences = await PreferenceLearner.getPreferences(user.email);

    return NextResponse.json({
      success: true,
      message: 'Preferences updated',
      preferences,
    });
  } catch (error) {
    logger.error('Error updating preferences', { error });
    return NextResponse.json(
      {
        error: 'Failed to update preferences',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
