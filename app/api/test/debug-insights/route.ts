/**
 * Debug endpoint to test insight generation pipeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  fetchOuraData,
  fetchDexcomData,
  fetchWhoopData,
  fetchGmailPatterns,
  fetchSlackPatterns,
  fetchSpotifyData,
} from '@/lib/services/ecosystem-fetcher';
import { getUserSubscriptionTier } from '@/lib/services/user-context-service';

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

export async function POST(request: NextRequest) {
  try {
    const cronSecret = request.headers.get('x-cron-secret');
    if (cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Check subscription tier
    const subscriptionTier = await getUserSubscriptionTier(email);

    // Check user_subscriptions table
    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    // Check integration_tokens
    const { data: tokens } = await supabase
      .from('integration_tokens')
      .select('provider, is_active, updated_at')
      .eq('user_email', email);

    // Check user_oauth_connections (for Spotify)
    const { data: oauthConnections } = await supabase
      .from('user_oauth_connections')
      .select('provider, updated_at')
      .eq('user_email', email);

    // Fetch ecosystem data with error catching
    const ecosystemResults: Record<string, any> = {};

    try {
      ecosystemResults.whoop = await fetchWhoopData(email);
    } catch (e) {
      ecosystemResults.whoop = { error: String(e) };
    }

    try {
      ecosystemResults.oura = await fetchOuraData(email);
    } catch (e) {
      ecosystemResults.oura = { error: String(e) };
    }

    try {
      ecosystemResults.gmail = await fetchGmailPatterns(email);
    } catch (e) {
      ecosystemResults.gmail = { error: String(e) };
    }

    try {
      ecosystemResults.slack = await fetchSlackPatterns(email);
    } catch (e) {
      ecosystemResults.slack = { error: String(e) };
    }

    try {
      ecosystemResults.spotify = await fetchSpotifyData(email);
    } catch (e) {
      ecosystemResults.spotify = { error: String(e) };
    }

    try {
      ecosystemResults.dexcom = await fetchDexcomData(email);
    } catch (e) {
      ecosystemResults.dexcom = { error: String(e) };
    }

    return NextResponse.json({
      email,
      subscriptionTier,
      subscription: subData,
      integrationTokens: tokens,
      oauthConnections,
      ecosystemData: {
        whoop: {
          available: ecosystemResults.whoop?.available,
          error: ecosystemResults.whoop?.error,
          hasData: !!ecosystemResults.whoop?.data,
        },
        oura: {
          available: ecosystemResults.oura?.available,
          error: ecosystemResults.oura?.error,
          hasData: !!ecosystemResults.oura?.data,
        },
        gmail: {
          available: ecosystemResults.gmail?.available,
          error: ecosystemResults.gmail?.error,
          hasData: !!ecosystemResults.gmail?.data,
        },
        slack: {
          available: ecosystemResults.slack?.available,
          error: ecosystemResults.slack?.error,
          hasData: !!ecosystemResults.slack?.data,
        },
        spotify: {
          available: ecosystemResults.spotify?.available,
          error: ecosystemResults.spotify?.error,
          hasData: !!ecosystemResults.spotify?.data,
          data: ecosystemResults.spotify?.data ? {
            inferredMood: ecosystemResults.spotify.data.inferredMood,
            avgValence: ecosystemResults.spotify.data.avgValence,
            avgEnergy: ecosystemResults.spotify.data.avgEnergy,
          } : null,
        },
        dexcom: {
          available: ecosystemResults.dexcom?.available,
          error: ecosystemResults.dexcom?.error,
          hasData: !!ecosystemResults.dexcom?.data,
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
