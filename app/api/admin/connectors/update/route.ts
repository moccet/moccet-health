import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * API endpoint for mobile app to update connector status.
 * Uses admin client to bypass RLS policies.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, connector_name, is_connected, connected_at } = body;

    // Validate required fields
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    if (!connector_name) {
      return NextResponse.json({ error: 'connector_name is required' }, { status: 400 });
    }
    if (typeof is_connected !== 'boolean') {
      return NextResponse.json({ error: 'is_connected must be a boolean' }, { status: 400 });
    }

    console.log(`[Connector Update] Updating ${connector_name} for user ${user_id} -> ${is_connected}`);

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Upsert the connector status
    const { error } = await supabase.from('user_connectors').upsert({
      user_id,
      connector_name,
      is_connected,
      connected_at: is_connected ? (connected_at || new Date().toISOString()) : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,connector_name'
    });

    if (error) {
      console.error('[Connector Update] Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[Connector Update] Successfully updated ${connector_name} for user ${user_id}`);

    return NextResponse.json({
      success: true,
      user_id,
      connector_name,
      is_connected,
    });
  } catch (error) {
    console.error('[Connector Update] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to fetch connector status for a user
 * Checks both user_connectors table AND integration_tokens for OAuth connections
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // First, get user's email from auth
    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const userEmail = userData?.user?.email;

    // Check user_connectors table
    const { data: connectorData, error } = await supabase
      .from('user_connectors')
      .select('connector_name, is_connected, connected_at, updated_at')
      .eq('user_id', user_id);

    if (error) {
      console.error('[Connector Update] Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build a map of connector status from user_connectors
    const connectors: Record<string, boolean> = {};
    for (const row of connectorData || []) {
      connectors[row.connector_name] = row.is_connected;
    }

    // Also check integration_tokens for OAuth providers (Whoop, Oura, etc.)
    if (userEmail) {
      const { data: tokenData } = await supabase
        .from('integration_tokens')
        .select('provider, is_active')
        .eq('user_email', userEmail)
        .eq('is_active', true);

      // Map provider names to connector names
      const providerToConnector: Record<string, string> = {
        'whoop': 'Whoop',
        'oura': 'Oura Ring',
        'gmail': 'Gmail',
        'outlook': 'Outlook',
        'spotify': 'Spotify',
        'strava': 'Strava',
        'fitbit': 'Fitbit',
        'slack': 'Slack',
        'dexcom': 'Dexcom',
      };

      for (const token of tokenData || []) {
        const connectorName = providerToConnector[token.provider];
        if (connectorName && token.is_active) {
          connectors[connectorName] = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      user_id,
      connectors,
      raw: connectorData,
    });
  } catch (error) {
    console.error('[Connector Update] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
