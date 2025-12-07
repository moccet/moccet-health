import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get Oura token from integration_tokens table
    const { data: tokenData, error: tokenError } = await supabase
      .from('integration_tokens')
      .select('*')
      .eq('user_email', email)
      .eq('provider', 'oura')
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({
        success: false,
        notConnected: true,
        message: 'Oura not connected for this user',
        error: tokenError?.message,
      });
    }

    // Token is stored base64 encoded, decode it
    const accessToken = Buffer.from(tokenData.access_token, 'base64').toString('utf-8');

    // Fetch Oura data
    const results: Record<string, any> = {};
    const errors: Record<string, string> = {};

    // Personal Info
    try {
      const res = await fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        results.personalInfo = await res.json();
      } else {
        errors.personalInfo = `${res.status}: ${await res.text()}`;
      }
    } catch (e) {
      errors.personalInfo = String(e);
    }

    // Daily Sleep (last 7 days)
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(
        `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        results.dailySleep = await res.json();
      } else {
        errors.dailySleep = `${res.status}: ${await res.text()}`;
      }
    } catch (e) {
      errors.dailySleep = String(e);
    }

    // Daily Readiness (last 7 days)
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(
        `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        results.dailyReadiness = await res.json();
      } else {
        errors.dailyReadiness = `${res.status}: ${await res.text()}`;
      }
    } catch (e) {
      errors.dailyReadiness = String(e);
    }

    // Daily Activity (last 7 days)
    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const res = await fetch(
        `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        results.dailyActivity = await res.json();
      } else {
        errors.dailyActivity = `${res.status}: ${await res.text()}`;
      }
    } catch (e) {
      errors.dailyActivity = String(e);
    }

    // Heart Rate (last 24 hours)
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `https://api.ouraring.com/v2/usercollection/heartrate?start_datetime=${startDate}&end_datetime=${endDate}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        results.heartRate = {
          count: data.data?.length || 0,
          sample: data.data?.slice(0, 5), // Just show first 5
        };
      } else {
        errors.heartRate = `${res.status}: ${await res.text()}`;
      }
    } catch (e) {
      errors.heartRate = String(e);
    }

    return NextResponse.json({
      success: true,
      tokenInfo: {
        hasToken: true,
        expiresAt: tokenData.expires_at,
        scopes: tokenData.scopes,
      },
      data: results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      summary: {
        sleepDays: results.dailySleep?.data?.length || 0,
        readinessDays: results.dailyReadiness?.data?.length || 0,
        activityDays: results.dailyActivity?.data?.length || 0,
        heartRateReadings: results.heartRate?.count || 0,
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal error',
      details: String(error)
    }, { status: 500 });
  }
}
