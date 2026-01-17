/**
 * User Location Profile API
 *
 * Manages user location data for personalized local recommendations.
 *
 * GET /api/user/location-profile - Get user's location profile
 * PUT /api/user/location-profile - Update location profile
 * POST /api/user/location-profile/infer-activities - Trigger activity inference
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { inferUserActivities, formatActivitySummary } from '@/lib/services/activity-inference-service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('LocationProfileAPI');

// ============================================================================
// GET - Fetch user's location profile
// ============================================================================

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

    logger.info('Fetching location profile', { email: user.email });

    const adminClient = createAdminClient();

    // Fetch location profile
    const { data: profile, error: profileError } = await adminClient
      .from('user_location_profile')
      .select('*')
      .eq('email', user.email)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = no rows found
      logger.error('Error fetching profile', { error: profileError });
      return NextResponse.json(
        { error: 'Failed to fetch location profile' },
        { status: 500 }
      );
    }

    // If profile exists, also get activity summary
    let activitySummary: string | null = null;
    if (profile?.inferred_activities?.length > 0) {
      activitySummary = formatActivitySummary({
        inferredActivities: profile.inferred_activities,
        primaryActivity: profile.primary_activity,
        activityFrequency: profile.activity_frequency || {},
        totalWorkouts: Object.values(profile.activity_frequency || {}).reduce((a: number, b) => a + (b as number), 0) as number,
        lastInferred: profile.last_activity_inference,
        dataSource: 'combined',
        averageWeeklyFrequency: 0,
        activityStats: [],
      });
    }

    return NextResponse.json({
      success: true,
      profile: profile || {
        email: user.email,
        city: null,
        neighborhood: null,
        home_latitude: null,
        home_longitude: null,
        preferred_radius_km: 10,
        inferred_activities: [],
        primary_activity: null,
      },
      activitySummary,
    });
  } catch (error) {
    logger.error('Error in GET location profile', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch location profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update user's location profile
// ============================================================================

interface UpdateLocationProfileBody {
  city?: string;
  neighborhood?: string;
  homeLatitude?: number;
  homeLongitude?: number;
  workLatitude?: number;
  workLongitude?: number;
  preferredRadiusKm?: number;
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

    const body: UpdateLocationProfileBody = await request.json();

    // Validate inputs
    if (body.preferredRadiusKm !== undefined) {
      if (body.preferredRadiusKm < 1 || body.preferredRadiusKm > 100) {
        return NextResponse.json(
          { error: 'preferredRadiusKm must be between 1 and 100' },
          { status: 400 }
        );
      }
    }

    if (body.homeLatitude !== undefined || body.homeLongitude !== undefined) {
      if (
        body.homeLatitude === undefined ||
        body.homeLongitude === undefined ||
        body.homeLatitude < -90 ||
        body.homeLatitude > 90 ||
        body.homeLongitude < -180 ||
        body.homeLongitude > 180
      ) {
        return NextResponse.json(
          { error: 'Invalid home coordinates' },
          { status: 400 }
        );
      }
    }

    logger.info('Updating location profile', {
      email: user.email,
      city: body.city,
      neighborhood: body.neighborhood,
    });

    const adminClient = createAdminClient();

    // Build update object
    const updateData: Record<string, unknown> = {
      email: user.email,
      updated_at: new Date().toISOString(),
    };

    if (body.city !== undefined) updateData.city = body.city;
    if (body.neighborhood !== undefined) updateData.neighborhood = body.neighborhood;
    if (body.homeLatitude !== undefined) updateData.home_latitude = body.homeLatitude;
    if (body.homeLongitude !== undefined) updateData.home_longitude = body.homeLongitude;
    if (body.workLatitude !== undefined) updateData.work_latitude = body.workLatitude;
    if (body.workLongitude !== undefined) updateData.work_longitude = body.workLongitude;
    if (body.preferredRadiusKm !== undefined) updateData.preferred_radius_km = body.preferredRadiusKm;

    // Upsert the profile
    const { data: profile, error: upsertError } = await adminClient
      .from('user_location_profile')
      .upsert(updateData, { onConflict: 'email' })
      .select()
      .single();

    if (upsertError) {
      logger.error('Error upserting profile', { error: upsertError });
      return NextResponse.json(
        { error: 'Failed to update location profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Location profile updated',
      profile,
    });
  } catch (error) {
    logger.error('Error in PUT location profile', { error });
    return NextResponse.json(
      {
        error: 'Failed to update location profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Trigger activity inference
// ============================================================================

export async function POST(request: NextRequest) {
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

    logger.info('Triggering activity inference', { email: user.email });

    // Run activity inference
    const inference = await inferUserActivities(user.email);

    return NextResponse.json({
      success: true,
      inference: {
        inferredActivities: inference.inferredActivities,
        primaryActivity: inference.primaryActivity,
        activityFrequency: inference.activityFrequency,
        totalWorkouts: inference.totalWorkouts,
        averageWeeklyFrequency: inference.averageWeeklyFrequency,
        lastInferred: inference.lastInferred,
        dataSource: inference.dataSource,
      },
      summary: formatActivitySummary(inference),
      activityStats: inference.activityStats,
    });
  } catch (error) {
    logger.error('Error in POST activity inference', { error });
    return NextResponse.json(
      {
        error: 'Failed to infer activities',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
