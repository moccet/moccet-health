import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';

// Helper function to look up user's unique code from onboarding data
async function getUserCode(email: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Try forge_onboarding_data first
  const { data: forgeData } = await supabase
    .from('forge_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (forgeData?.[0]?.form_data?.uniqueCode) {
    return forgeData[0].form_data.uniqueCode;
  }

  // Try sage_onboarding_data
  const { data: sageData } = await supabase
    .from('sage_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  if (sageData?.[0]?.form_data?.uniqueCode) {
    return sageData[0].form_data.uniqueCode;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { email, code, startDate, endDate } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get user code - use provided code or look it up from onboarding data
    const userCode = code || await getUserCode(email);
    if (userCode) {
      console.log(`[Oura Sync] Using user code: ${userCode}`);
    }

    // Get token using token-manager (handles RLS bypass and automatic refresh)
    const { token: accessToken, error: tokenError } = await getAccessToken(email, 'oura', userCode);

    if (!accessToken) {
      console.log(`[Oura Sync] No token found for ${email}. Error: ${tokenError}`);
      return NextResponse.json(
        { error: 'Oura not connected. Please connect your Oura Ring first.' },
        { status: 401 }
      );
    }

    console.log(`[Oura Sync] Token retrieved successfully for ${email}`);

    // Set default date range: last 30 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`[Oura Sync] Fetching data for ${email} from ${start} to ${end}`);

    // Fetch various data types from Oura API v2
    // Documentation: https://cloud.ouraring.com/v2/docs
    const dataTypes = [
      { name: 'sleep', endpoint: 'sleep' },
      { name: 'daily_activity', endpoint: 'daily_activity' },
      { name: 'daily_readiness', endpoint: 'daily_readiness' },
      { name: 'heart_rate', endpoint: 'heartrate' },
      { name: 'workout', endpoint: 'workout' },
    ];

    const allData: Record<string, unknown[]> = {};

    for (const dataType of dataTypes) {
      try {
        const url = `https://api.ouraring.com/v2/usercollection/${dataType.endpoint}?start_date=${start}&end_date=${end}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          allData[dataType.name] = data.data || [];
          console.log(`[Oura Sync] Fetched ${allData[dataType.name].length} ${dataType.name} records`);
        } else {
          console.error(`[Oura Sync] Failed to fetch ${dataType.name}:`, response.status);
        }
      } catch (error) {
        console.error(`[Oura Sync] Error fetching ${dataType.name}:`, error);
      }
    }

    // Store data in Supabase using admin client to bypass RLS
    const supabase = createAdminClient();
    const { error: insertError } = await supabase
      .from('oura_data')
      .insert({
        email,
        sync_date: new Date().toISOString(),
        start_date: start,
        end_date: end,
        sleep_data: allData.sleep || [],
        activity_data: allData.daily_activity || [],
        readiness_data: allData.daily_readiness || [],
        heart_rate_data: allData.heart_rate || [],
        workout_data: allData.workout || [],
        raw_data: allData,
      });

    if (insertError) {
      console.error('[Oura Sync] Error storing data:', insertError);
      return NextResponse.json(
        { error: 'Failed to store Oura data', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`[Oura Sync] Successfully synced and stored data for ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Oura data synced successfully',
      summary: {
        sleep_records: allData.sleep?.length || 0,
        activity_records: allData.daily_activity?.length || 0,
        readiness_records: allData.daily_readiness?.length || 0,
        heart_rate_records: allData.heart_rate?.length || 0,
        workout_records: allData.workout?.length || 0,
      },
    });

  } catch (error) {
    console.error('[Oura Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Oura data' },
      { status: 500 }
    );
  }
}
