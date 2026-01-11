import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { revokeToken, getAccessToken, Provider } from '@/lib/services/token-manager';

/**
 * Validate a token by making an actual API call to the provider
 * This catches cases where our database thinks the token is valid but it's been revoked
 */
async function validateTokenWithProvider(provider: Provider, accessToken: string): Promise<boolean> {
  try {
    const endpoints: Record<string, string> = {
      'spotify': 'https://api.spotify.com/v1/me',
      'whoop': 'https://api.prod.whoop.com/developer/v1/user/profile/basic',
      'oura': 'https://api.ouraring.com/v2/usercollection/personal_info',
      'strava': 'https://www.strava.com/api/v3/athlete',
      'fitbit': 'https://api.fitbit.com/1/user/-/profile.json',
      'gmail': 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
      'slack': 'https://slack.com/api/auth.test',
      'dexcom': 'https://api.dexcom.com/v3/users/self',
    };

    const endpoint = endpoints[provider];
    if (!endpoint) {
      console.log(`[Token Validation] No validation endpoint for ${provider}, assuming valid`);
      return true; // No endpoint to validate, assume valid
    }

    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    const isValid = response.ok;
    console.log(`[Token Validation] ${provider} token validation: ${isValid ? 'VALID' : 'INVALID'} (status: ${response.status})`);

    return isValid;
  } catch (error) {
    console.error(`[Token Validation] Error validating ${provider} token:`, error);
    return false; // Assume invalid on error
  }
}

// Map connector names to OAuth provider names
const connectorToProvider: Record<string, Provider> = {
  'Whoop': 'whoop',
  'whoop': 'whoop',
  'Oura Ring': 'oura',
  'oura': 'oura',
  'Gmail': 'gmail',
  'gmail': 'gmail',
  'Outlook': 'outlook',
  'outlook': 'outlook',
  'Spotify': 'spotify',
  'spotify': 'spotify',
  'Strava': 'strava',
  'strava': 'strava',
  'Fitbit': 'fitbit',
  'fitbit': 'fitbit',
  'Slack': 'slack',
  'slack': 'slack',
  'Dexcom': 'dexcom',
  'dexcom': 'dexcom',
};

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

    // If disconnecting, also revoke the OAuth token from integration_tokens
    if (!is_connected) {
      const provider = connectorToProvider[connector_name];
      if (provider) {
        // Get user's email to revoke token
        const { data: userData } = await supabase.auth.admin.getUserById(user_id);
        const userEmail = userData?.user?.email;

        if (userEmail) {
          console.log(`[Connector Update] Revoking ${provider} token for ${userEmail}`);
          const revokeResult = await revokeToken(userEmail, provider);
          if (!revokeResult.success) {
            console.warn(`[Connector Update] Failed to revoke token: ${revokeResult.error}`);
          } else {
            console.log(`[Connector Update] Successfully revoked ${provider} token`);
          }
        }
      }
    }

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

    // Map provider names to connector names (for OAuth connectors)
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
      'notion': 'Notion',
      'linear': 'Linear',
    };

    const connectorToProvider: Record<string, Provider> = {
      'Whoop': 'whoop',
      'Oura Ring': 'oura',
      'Gmail': 'gmail',
      'Outlook': 'outlook',
      'Spotify': 'spotify',
      'Strava': 'strava',
      'Fitbit': 'fitbit',
      'Slack': 'slack',
      'Dexcom': 'dexcom',
      'Notion': 'notion' as Provider,
      'Linear': 'linear' as Provider,
    };

    // Validate ALL OAuth connectors that are marked as connected in user_connectors
    // This catches cases where token was deleted/revoked but user_connectors wasn't updated
    if (userEmail) {
      // Find all OAuth connectors marked as connected
      const oauthConnectorsToValidate = Object.entries(connectors)
        .filter(([name, isConnected]) => isConnected && connectorToProvider[name])
        .map(([name]) => ({ connectorName: name, provider: connectorToProvider[name] }));

      console.log(`[Connector Check] Validating ${oauthConnectorsToValidate.length} OAuth connectors for ${userEmail}`);

      // Validate tokens in parallel for speed
      const validationPromises = oauthConnectorsToValidate.map(async ({ connectorName, provider }) => {
        try {
          // Try to get a valid access token (this will attempt refresh if expired)
          const { token: accessToken, error } = await getAccessToken(userEmail, provider);

          if (!accessToken || error) {
            // No token in database or error getting it
            console.log(`[Connector Check] ${provider} token not found for ${userEmail}: ${error}`);

            // Update user_connectors to reflect the broken connection
            await supabase.from('user_connectors')
              .update({ is_connected: false, updated_at: new Date().toISOString() })
              .eq('user_id', user_id)
              .eq('connector_name', connectorName);

            return { connectorName, valid: false };
          }

          // Token exists in database - now verify it actually works with the provider's API
          const isReallyValid = await validateTokenWithProvider(provider, accessToken);

          if (isReallyValid) {
            console.log(`[Connector Check] ${provider} token verified valid for ${userEmail}`);
            return { connectorName, valid: true };
          } else {
            // Token exists but doesn't work - mark as disconnected
            console.log(`[Connector Check] ${provider} token exists but API validation failed for ${userEmail}`);

            // Update user_connectors to reflect the broken connection
            await supabase.from('user_connectors')
              .update({ is_connected: false, updated_at: new Date().toISOString() })
              .eq('user_id', user_id)
              .eq('connector_name', connectorName);

            // Also mark the token as inactive in integration_tokens
            await supabase.from('integration_tokens')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('user_email', userEmail)
              .eq('provider', provider);

            return { connectorName, valid: false };
          }
        } catch (e) {
          console.error(`[Connector Check] Error validating ${provider}: ${e}`);
          return { connectorName, valid: false };
        }
      });

      const validationResults = await Promise.all(validationPromises);

      for (const result of validationResults) {
        if (result.connectorName) {
          connectors[result.connectorName] = result.valid;
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
