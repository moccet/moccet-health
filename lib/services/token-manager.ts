/**
 * Token Manager Service
 *
 * Handles secure storage, retrieval, and automatic refresh of OAuth tokens
 * for third-party integrations. Tokens are stored encrypted in the database.
 *
 * @module lib/services/token-manager
 */

import { createClient } from '@/lib/supabase/server';

export type Provider =
  | 'oura' | 'dexcom' | 'fitbit' | 'strava' | 'vital'
  | 'gmail' | 'slack' | 'outlook' | 'teams' | 'apple_calendar' | 'apple_health'
  | 'whoop' | 'myfitnesspal' | 'cronometer';

export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scopes?: string[];
  providerUserId?: string;
  metadata?: Record<string, unknown>;
}

export interface StoredToken extends TokenData {
  id: string;
  isExpired: boolean;
}

/**
 * Simple encryption/decryption using base64 encoding
 * In production, use a proper encryption library like crypto-js or node:crypto
 *
 * TODO: Replace with proper AES-256 encryption using encryption key from env
 */
function encryptToken(token: string): string {
  // For now, just base64 encode. In production, use proper encryption.
  return Buffer.from(token).toString('base64');
}

function decryptToken(encryptedToken: string): string {
  // For now, just base64 decode. In production, use proper decryption.
  return Buffer.from(encryptedToken, 'base64').toString('utf-8');
}

/**
 * Store OAuth tokens securely in the database
 */
export async function storeToken(
  userEmail: string,
  provider: Provider,
  tokenData: TokenData
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Revoke any existing active tokens for this user/provider
    await revokeToken(userEmail, provider);

    // Encrypt sensitive data
    const encryptedAccessToken = encryptToken(tokenData.accessToken);
    const encryptedRefreshToken = tokenData.refreshToken
      ? encryptToken(tokenData.refreshToken)
      : null;

    // Insert new token
    const { error } = await supabase
      .from('integration_tokens')
      .insert({
        user_email: userEmail,
        provider,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_type: tokenData.tokenType || 'Bearer',
        expires_at: tokenData.expiresAt?.toISOString() || null,
        scopes: tokenData.scopes || [],
        provider_user_id: tokenData.providerUserId || null,
        metadata: tokenData.metadata || {},
        is_active: true,
      });

    if (error) {
      console.error('[TokenManager] Error storing token:', error);
      return { success: false, error: error.message };
    }

    console.log(`[TokenManager] Successfully stored token for ${userEmail}/${provider}`);
    return { success: true };
  } catch (error) {
    console.error('[TokenManager] Exception storing token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Retrieve access token, automatically refreshing if expired
 */
export async function getAccessToken(
  userEmail: string,
  provider: Provider
): Promise<{ token: string | null; error?: string }> {
  try {
    const supabase = await createClient();

    // Get active token using stored procedure
    const { data, error } = await supabase.rpc('get_active_token', {
      p_user_email: userEmail,
      p_provider: provider,
    });

    if (error) {
      console.error('[TokenManager] Error retrieving token:', error);
      return { token: null, error: error.message };
    }

    if (!data || data.length === 0) {
      console.log(`[TokenManager] No token found for ${userEmail}/${provider}`);
      return { token: null, error: 'No token found' };
    }

    const tokenRecord = data[0];

    // Check if token is expired and needs refresh
    if (tokenRecord.is_expired && tokenRecord.refresh_token) {
      console.log(`[TokenManager] Token expired, attempting refresh for ${provider}`);
      const refreshResult = await refreshToken(userEmail, provider);

      if (!refreshResult.success) {
        return { token: null, error: 'Token expired and refresh failed' };
      }

      // Return the newly refreshed token
      return { token: refreshResult.accessToken! };
    }

    // Decrypt and return the access token
    const decryptedToken = decryptToken(tokenRecord.access_token);
    return { token: decryptedToken };
  } catch (error) {
    console.error('[TokenManager] Exception retrieving token:', error);
    return {
      token: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Refresh an expired OAuth token
 */
export async function refreshToken(
  userEmail: string,
  provider: Provider
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current token data
    const { data, error: fetchError } = await supabase
      .from('integration_tokens')
      .select('*')
      .eq('user_email', userEmail)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (fetchError || !data) {
      return { success: false, error: 'No token found to refresh' };
    }

    if (!data.refresh_token) {
      return { success: false, error: 'No refresh token available' };
    }

    const decryptedRefreshToken = decryptToken(data.refresh_token);

    // Call provider-specific refresh endpoint
    const refreshResult = await callProviderRefresh(provider, decryptedRefreshToken);

    if (!refreshResult.success || !refreshResult.accessToken) {
      return { success: false, error: refreshResult.error || 'Refresh failed' };
    }

    // Store the new token
    const storeResult = await storeToken(userEmail, provider, {
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken || decryptedRefreshToken,
      expiresAt: refreshResult.expiresAt,
      tokenType: data.token_type,
      scopes: data.scopes as string[],
      providerUserId: data.provider_user_id || undefined,
    });

    if (!storeResult.success) {
      return { success: false, error: 'Failed to store refreshed token' };
    }

    // Update last_refreshed_at timestamp
    await supabase
      .from('integration_tokens')
      .update({ last_refreshed_at: new Date().toISOString() })
      .eq('user_email', userEmail)
      .eq('provider', provider)
      .eq('is_active', true);

    console.log(`[TokenManager] Successfully refreshed token for ${userEmail}/${provider}`);
    return { success: true, accessToken: refreshResult.accessToken };
  } catch (error) {
    console.error('[TokenManager] Exception refreshing token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Provider-specific token refresh logic
 */
async function callProviderRefresh(
  provider: Provider,
  refreshToken: string
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}> {
  try {
    // Provider-specific refresh endpoints
    const refreshEndpoints: Record<string, { url: string; clientIdEnv: string; clientSecretEnv: string }> = {
      oura: {
        url: 'https://api.ouraring.com/oauth/token',
        clientIdEnv: 'OURA_CLIENT_ID',
        clientSecretEnv: 'OURA_CLIENT_SECRET',
      },
      fitbit: {
        url: 'https://api.fitbit.com/oauth2/token',
        clientIdEnv: 'FITBIT_CLIENT_ID',
        clientSecretEnv: 'FITBIT_CLIENT_SECRET',
      },
      strava: {
        url: 'https://www.strava.com/oauth/token',
        clientIdEnv: 'STRAVA_CLIENT_ID',
        clientSecretEnv: 'STRAVA_CLIENT_SECRET',
      },
      gmail: {
        url: 'https://oauth2.googleapis.com/token',
        clientIdEnv: 'GOOGLE_CLIENT_ID',
        clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
      },
      slack: {
        url: 'https://slack.com/api/oauth.v2.access',
        clientIdEnv: 'SLACK_CLIENT_ID',
        clientSecretEnv: 'SLACK_CLIENT_SECRET',
      },
      outlook: {
        url: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        clientIdEnv: 'OUTLOOK_CLIENT_ID',
        clientSecretEnv: 'OUTLOOK_CLIENT_SECRET',
      },
      // Add more providers as needed
    };

    const config = refreshEndpoints[provider];
    if (!config) {
      return { success: false, error: `Token refresh not implemented for ${provider}` };
    }

    const clientId = process.env[config.clientIdEnv];
    const clientSecret = process.env[config.clientSecretEnv];

    if (!clientId || !clientSecret) {
      return { success: false, error: `Missing credentials for ${provider}` };
    }

    // Build refresh request
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Special case for Fitbit (uses Basic Auth)
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    if (provider === 'fitbit') {
      const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    const response = await fetch(config.url, {
      method: 'POST',
      headers,
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TokenManager] ${provider} refresh failed:`, errorText);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();

    // Parse response (provider-specific field names)
    const accessToken = data.access_token;
    const newRefreshToken = data.refresh_token; // Some providers return new refresh token
    const expiresIn = data.expires_in; // Seconds until expiry

    if (!accessToken) {
      return { success: false, error: 'No access token in refresh response' };
    }

    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000)
      : undefined;

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      expiresAt,
    };
  } catch (error) {
    console.error(`[TokenManager] Exception refreshing ${provider}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revoke/delete token for a user and provider
 */
export async function revokeToken(
  userEmail: string,
  provider: Provider
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Use stored procedure for safe revocation
    const { error } = await supabase.rpc('revoke_integration_token', {
      p_user_email: userEmail,
      p_provider: provider,
    });

    if (error) {
      console.error('[TokenManager] Error revoking token:', error);
      return { success: false, error: error.message };
    }

    console.log(`[TokenManager] Successfully revoked token for ${userEmail}/${provider}`);
    return { success: true };
  } catch (error) {
    console.error('[TokenManager] Exception revoking token:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all active integrations for a user
 */
export async function getUserIntegrations(
  userEmail: string
): Promise<{ integrations: Provider[]; error?: string }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('integration_tokens')
      .select('provider')
      .eq('user_email', userEmail)
      .eq('is_active', true);

    if (error) {
      return { integrations: [], error: error.message };
    }

    const providers = data.map((row) => row.provider as Provider);
    return { integrations: providers };
  } catch (error) {
    return {
      integrations: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
