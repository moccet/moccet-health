import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { circuitBreakers, CircuitOpenError } from '@/lib/utils/circuit-breaker';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, userId, startDate, endDate } = await request.json();

    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Email and userId are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.VITAL_API_KEY;
    const environment = process.env.VITAL_ENVIRONMENT || 'sandbox';
    const region = process.env.VITAL_REGION || 'us';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Vital API key not configured' },
        { status: 500 }
      );
    }

    // Vital API base URL
    const baseUrl = region === 'eu'
      ? `https://api.eu.vital.io`
      : `https://api.${environment}.tryvital.io`;

    // Set default date range: last 30 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[Vital Sync] Fetching data for user ${userId} from ${start} to ${end}`);

    const headers = {
      'X-Vital-API-Key': apiKey,
    };

    // Fetch different data types from Vital API
    // Documentation: https://docs.tryvital.io/wearables/api-reference
    const dataTypes = [
      { name: 'sleep', endpoint: `/v2/summary/sleep/${userId}` },
      { name: 'activity', endpoint: `/v2/summary/activity/${userId}` },
      { name: 'body', endpoint: `/v2/summary/body/${userId}` },
      { name: 'workouts', endpoint: `/v2/summary/workouts/${userId}` },
      { name: 'glucose', endpoint: `/v2/timeseries/glucose/${userId}` },
    ];

    const allData: Record<string, unknown> = {};

    for (const dataType of dataTypes) {
      try {
        const url = `${baseUrl}${dataType.endpoint}?start_date=${start}&end_date=${end}`;

        // Use circuit breaker to protect against cascading failures
        const response = await circuitBreakers.vital.execute(async () => {
          return fetch(url, { headers });
        });

        if (response.ok) {
          const data = await response.json();
          allData[dataType.name] = data;

          const recordCount = Array.isArray(data) ? data.length :
                            (data[dataType.name] ? data[dataType.name].length : 'N/A');
          console.log(`[Vital Sync] Fetched ${recordCount} ${dataType.name} records`);
        } else {
          console.error(`[Vital Sync] Failed to fetch ${dataType.name}:`, response.status);
          if (response.status >= 500) {
            throw new Error(`Vital API error: ${response.status}`);
          }
        }
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          console.warn(`[Vital Sync] Circuit breaker open for Vital API, skipping ${dataType.name}`);
        } else {
          console.error(`[Vital Sync] Error fetching ${dataType.name}:`, error);
        }
      }
    }

    // Also fetch user profile and connected providers
    try {
      const profileResponse = await circuitBreakers.vital.execute(async () => {
        return fetch(`${baseUrl}/v2/user/${userId}`, { headers });
      });
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        allData.user_profile = profileData;
        allData.connected_providers = profileData.connected_sources || [];
        console.log(`[Vital Sync] Connected providers:`, allData.connected_providers);
      }
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        console.warn('[Vital Sync] Circuit breaker open for Vital API, skipping user profile');
      } else {
        console.error('[Vital Sync] Error fetching user profile:', error);
      }
    }

    // Store data in Supabase
    const { error: insertError } = await supabase
      .from('vital_data')
      .insert({
        email,
        vital_user_id: userId,
        sync_date: new Date().toISOString(),
        start_date: start,
        end_date: end,
        sleep_data: allData.sleep || {},
        activity_data: allData.activity || {},
        body_data: allData.body || {},
        workouts_data: allData.workouts || {},
        glucose_data: allData.glucose || {},
        user_profile: allData.user_profile || {},
        connected_providers: allData.connected_providers || [],
        raw_data: allData,
      });

    if (insertError) {
      console.error('[Vital Sync] Error storing data:', insertError);
      return NextResponse.json(
        { error: 'Failed to store Vital data', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`[Vital Sync] Successfully synced and stored data for ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Vital data synced successfully',
      userId,
      connectedProviders: allData.connected_providers,
    });

  } catch (error) {
    console.error('[Vital Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Vital data' },
      { status: 500 }
    );
  }
}
