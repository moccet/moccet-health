import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { runHealthAnalysis } from '@/lib/services/health-pattern-analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, startDate, endDate } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get access token from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('dexcom_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Dexcom not connected. Please connect your Dexcom CGM first.' },
        { status: 401 }
      );
    }

    // Determine base URL based on environment
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.dexcom.com'
      : 'https://sandbox-api.dexcom.com';

    // Set default date range: last 30 days
    const end = endDate || new Date().toISOString();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log(`[Dexcom Sync] Fetching data for ${email} from ${start} to ${end}`);

    // Fetch various data types from Dexcom API v2
    // Documentation: https://developer.dexcom.com/
    const dataTypes = [
      { name: 'egvs', endpoint: 'egvs', description: 'Estimated Glucose Values' },
      { name: 'events', endpoint: 'events', description: 'User Events' },
      { name: 'calibrations', endpoint: 'calibrations', description: 'Calibrations' },
      { name: 'statistics', endpoint: 'statistics', description: 'Statistics' },
    ];

    const allData: Record<string, unknown[]> = {};

    for (const dataType of dataTypes) {
      try {
        const url = `${baseUrl}/v2/users/self/${dataType.endpoint}?startDate=${start}&endDate=${end}`;
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Dexcom returns different response structures per endpoint
          allData[dataType.name] = data.egvs || data.events || data.calibrations || data || [];
          console.log(`[Dexcom Sync] Fetched ${Array.isArray(allData[dataType.name]) ? allData[dataType.name].length : 'N/A'} ${dataType.description}`);
        } else {
          console.error(`[Dexcom Sync] Failed to fetch ${dataType.description}:`, response.status);
        }
      } catch (error) {
        console.error(`[Dexcom Sync] Error fetching ${dataType.description}:`, error);
      }
    }

    // Store data in Supabase
    const { error: insertError } = await supabase
      .from('dexcom_data')
      .insert({
        email,
        sync_date: new Date().toISOString(),
        start_date: start,
        end_date: end,
        egv_data: allData.egvs || [],
        events_data: allData.events || [],
        calibrations_data: allData.calibrations || [],
        statistics_data: allData.statistics || [],
        raw_data: allData,
      });

    if (insertError) {
      console.error('[Dexcom Sync] Error storing data:', insertError);
      return NextResponse.json(
        { error: 'Failed to store Dexcom data', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`[Dexcom Sync] Successfully synced and stored data for ${email}`);

    // =====================================================
    // TRIGGER HEALTH PATTERN ANALYSIS (Pro/Max feature)
    // Analyze glucose trends and correlate with life events
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
        console.log(`[Dexcom Sync] Running health pattern analysis for ${email} (${userData?.subscription_tier} tier)`);

        // Prepare Dexcom data for analysis
        const dexcomData = {
          glucoseData: (allData.egvs as any[] || []).map((egv: any) => ({
            date: egv.systemTime || egv.displayTime,
            value: egv.value,
            trend: egv.trend,
          })),
        };

        // Run health analysis (detects patterns + correlates with life events)
        healthAnalysisResult = await runHealthAnalysis(email, null, null, dexcomData);

        console.log(`[Dexcom Sync] Health analysis complete: ${healthAnalysisResult.patterns.length} patterns, ${healthAnalysisResult.correlations.length} correlations`);
      }
    } catch (analysisError) {
      // Don't fail the sync if analysis fails
      console.error('[Dexcom Sync] Health analysis error (non-fatal):', analysisError);
    }

    return NextResponse.json({
      success: true,
      message: 'Dexcom data synced successfully',
      summary: {
        egv_records: Array.isArray(allData.egvs) ? allData.egvs.length : 0,
        events_records: Array.isArray(allData.events) ? allData.events.length : 0,
        calibrations_records: Array.isArray(allData.calibrations) ? allData.calibrations.length : 0,
      },
      healthAnalysis: healthAnalysisResult ? {
        patterns: healthAnalysisResult.patterns.length,
        correlations: healthAnalysisResult.correlations.length,
        summary: healthAnalysisResult.summary,
      } : null,
    });

  } catch (error) {
    console.error('[Dexcom Sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Dexcom data' },
      { status: 500 }
    );
  }
}
