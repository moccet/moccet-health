import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { runHealthAnalysis } from '@/lib/services/health-pattern-analyzer';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('strava_access_token')?.value;
    const athleteId = cookieStore.get('strava_athlete_id')?.value;

    if (!accessToken || !athleteId) {
      return NextResponse.json(
        { error: 'Not authenticated with Strava' },
        { status: 401 }
      );
    }

    // Get parameters from request
    const body = await request.json();
    const email = body.email;
    const page = body.page || 1;
    const perPage = body.perPage || 30;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[Strava] Syncing activities for athlete ${athleteId}`);

    // Fetch athlete's activities
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // Fetch athlete stats
    const statsResponse = await fetch(
      `https://www.strava.com/api/v3/athletes/${athleteId}/stats`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!activitiesResponse.ok || !statsResponse.ok) {
      // Check if token expired (401)
      if (activitiesResponse.status === 401 || statsResponse.status === 401) {
        console.error('[Strava] Access token expired');
        return NextResponse.json(
          { error: 'Access token expired. Please reconnect.' },
          { status: 401 }
        );
      }

      throw new Error('Failed to fetch Strava data');
    }

    const activities = await activitiesResponse.json();
    const stats = await statsResponse.json();

    // Transform activities data
    const transformedActivities = activities.map((activity: any) => ({
      id: activity.id,
      name: activity.name,
      type: activity.type,
      distance: activity.distance, // meters
      movingTime: activity.moving_time, // seconds
      elapsedTime: activity.elapsed_time, // seconds
      totalElevationGain: activity.total_elevation_gain, // meters
      startDate: activity.start_date,
      averageSpeed: activity.average_speed, // m/s
      maxSpeed: activity.max_speed, // m/s
      averageHeartrate: activity.average_heartrate,
      maxHeartrate: activity.max_heartrate,
      calories: activity.calories,
      kudosCount: activity.kudos_count,
      achievementCount: activity.achievement_count,
    }));

    const syncedData = {
      athleteId,
      activities: transformedActivities,
      stats: {
        recentRideTotals: stats.recent_ride_totals,
        recentRunTotals: stats.recent_run_totals,
        recentSwimTotals: stats.recent_swim_totals,
        ytdRideTotals: stats.ytd_ride_totals,
        ytdRunTotals: stats.ytd_run_totals,
        ytdSwimTotals: stats.ytd_swim_totals,
        allRideTotals: stats.all_ride_totals,
        allRunTotals: stats.all_run_totals,
        allSwimTotals: stats.all_swim_totals,
      },
    };

    console.log(`[Strava] Successfully synced ${transformedActivities.length} activities`);

    // TODO: Store this data in your database for the user
    // For now, we just return it

    // =====================================================
    // TRIGGER HEALTH PATTERN ANALYSIS (Pro/Max feature)
    // Analyze workout trends and correlate with life events
    // =====================================================
    let healthAnalysisResult = null;
    try {
      const adminClient = createAdminClient();

      // Check if user is Pro/Max
      const { data: userData } = await adminClient
        .from('users')
        .select('subscription_tier')
        .eq('email', email)
        .single();

      const isPremium = userData?.subscription_tier === 'pro' || userData?.subscription_tier === 'max';

      if (isPremium) {
        console.log(`[Strava] Running health pattern analysis for ${email} (${userData?.subscription_tier} tier)`);

        // Prepare Strava data for analysis
        const stravaData = {
          workouts: transformedActivities.map((activity: any) => ({
            date: activity.startDate,
            type: activity.type,
            distance: activity.distance,
            duration: activity.movingTime,
            calories: activity.calories,
            avgHeartRate: activity.averageHeartrate,
            maxHeartRate: activity.maxHeartrate,
          })),
        };

        // Run health analysis (detects patterns + correlates with life events)
        healthAnalysisResult = await runHealthAnalysis(email, null, null, stravaData);

        console.log(`[Strava] Health analysis complete: ${healthAnalysisResult.patterns.length} patterns, ${healthAnalysisResult.correlations.length} correlations`);
      }
    } catch (analysisError) {
      // Don't fail the sync if analysis fails
      console.error('[Strava] Health analysis error (non-fatal):', analysisError);
    }

    return NextResponse.json({
      success: true,
      data: syncedData,
      healthAnalysis: healthAnalysisResult ? {
        patterns: healthAnalysisResult.patterns.length,
        correlations: healthAnalysisResult.correlations.length,
        summary: healthAnalysisResult.summary,
      } : null,
    });

  } catch (error) {
    console.error('[Strava] Error syncing data:', error);
    return NextResponse.json(
      { error: 'Failed to sync Strava data' },
      { status: 500 }
    );
  }
}

// Handle token refresh if access token expires
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Strava credentials not configured');
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('[Strava] Token refresh failed');
      return null;
    }

    const data = await response.json();

    // Update cookies with new tokens
    const cookieStore = await cookies();
    cookieStore.set('strava_access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    if (data.refresh_token) {
      cookieStore.set('strava_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }

    return data.access_token;
  } catch (error) {
    console.error('[Strava] Error refreshing token:', error);
    return null;
  }
}
