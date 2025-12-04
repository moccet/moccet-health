import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('fitbit_access_token')?.value;
    const userId = cookieStore.get('fitbit_user_id')?.value;

    if (!accessToken || !userId) {
      return NextResponse.json(
        { error: 'Not authenticated with Fitbit' },
        { status: 401 }
      );
    }

    // Get date parameter from request (defaults to today)
    const body = await request.json();
    const date = body.date || new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    console.log(`[Fitbit] Syncing data for user ${userId} on date ${date}`);

    // Fetch activity data
    const activityResponse = await fetch(
      `https://api.fitbit.com/1/user/${userId}/activities/date/${date}.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // Fetch sleep data
    const sleepResponse = await fetch(
      `https://api.fitbit.com/1.2/user/${userId}/sleep/date/${date}.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    // Fetch heart rate data
    const heartRateResponse = await fetch(
      `https://api.fitbit.com/1/user/${userId}/activities/heart/date/${date}/1d.json`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!activityResponse.ok || !sleepResponse.ok || !heartRateResponse.ok) {
      // Check if token expired (401)
      if (activityResponse.status === 401 || sleepResponse.status === 401 || heartRateResponse.status === 401) {
        console.error('[Fitbit] Access token expired');
        return NextResponse.json(
          { error: 'Access token expired. Please reconnect.' },
          { status: 401 }
        );
      }

      throw new Error('Failed to fetch Fitbit data');
    }

    const activityData = await activityResponse.json();
    const sleepData = await sleepResponse.json();
    const heartRateData = await heartRateResponse.json();

    const syncedData = {
      date,
      userId,
      activity: {
        steps: activityData.summary?.steps || 0,
        distance: activityData.summary?.distances?.[0]?.distance || 0,
        caloriesBurned: activityData.summary?.caloriesOut || 0,
        activeMinutes: activityData.summary?.veryActiveMinutes + activityData.summary?.fairlyActiveMinutes || 0,
        floors: activityData.summary?.floors || 0,
      },
      sleep: {
        totalMinutesAsleep: sleepData.summary?.totalMinutesAsleep || 0,
        totalTimeInBed: sleepData.summary?.totalTimeInBed || 0,
        efficiency: sleepData.summary?.efficiency || 0,
        stages: sleepData.summary?.stages || {},
      },
      heartRate: {
        restingHeartRate: heartRateData['activities-heart']?.[0]?.value?.restingHeartRate || null,
        zones: heartRateData['activities-heart']?.[0]?.value?.heartRateZones || [],
      },
    };

    console.log(`[Fitbit] Successfully synced data for ${date}`);

    // TODO: Store this data in your database for the user
    // For now, we just return it

    return NextResponse.json({
      success: true,
      data: syncedData,
    });

  } catch (error) {
    console.error('[Fitbit] Error syncing data:', error);
    return NextResponse.json(
      { error: 'Failed to sync Fitbit data' },
      { status: 500 }
    );
  }
}

// Handle token refresh if access token expires
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Fitbit credentials not configured');
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('[Fitbit] Token refresh failed');
      return null;
    }

    const data = await response.json();

    // Update cookies with new tokens
    const cookieStore = await cookies();
    cookieStore.set('fitbit_access_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    if (data.refresh_token) {
      cookieStore.set('fitbit_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }

    return data.access_token;
  } catch (error) {
    console.error('[Fitbit] Error refreshing token:', error);
    return null;
  }
}
