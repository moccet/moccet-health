import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const PROVIDERS = [
  'oura',
  'fitbit',
  'strava',
  'dexcom',
  'gmail',
  'outlook',
  'slack',
  'teams',
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get all active tokens for this user
    const { data: tokens, error } = await supabase
      .from('integration_tokens')
      .select('provider, provider_user_id, updated_at, is_active')
      .eq('user_email', email)
      .eq('is_active', true);

    if (error) {
      console.error('[Connectors Status] Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build status map
    const statuses: Record<string, {
      id: string;
      connected: boolean;
      lastSync?: string;
      providerUserId?: string;
    }> = {};

    // Initialize all providers as not connected
    for (const provider of PROVIDERS) {
      statuses[provider] = {
        id: provider,
        connected: false,
      };
    }

    // Mark connected providers
    if (tokens) {
      for (const token of tokens) {
        statuses[token.provider] = {
          id: token.provider,
          connected: true,
          lastSync: token.updated_at,
          providerUserId: token.provider_user_id || undefined,
        };
      }
    }

    return NextResponse.json({
      success: true,
      email,
      statuses,
      connectedCount: tokens?.length || 0,
      totalProviders: PROVIDERS.length,
    });
  } catch (error) {
    console.error('[Connectors Status] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
