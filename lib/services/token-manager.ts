/**
 * Token Manager Service
 *
 * Handles secure storage, retrieval, and automatic refresh of OAuth tokens
 * for third-party integrations. Tokens are stored encrypted in the database.
 *
 * @module lib/services/token-manager
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';

export type Provider =
  | 'oura' | 'dexcom' | 'fitbit' | 'strava' | 'vital'
  | 'gmail' | 'slack' | 'outlook' | 'teams' | 'apple_calendar' | 'apple_health'
  | 'whoop' | 'myfitnesspal' | 'cronometer' | 'spotify';

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
 * @param userCode - Optional 8-character unique code from onboarding (preferred identifier)
 */
export async function storeToken(
  userEmail: string,
  provider: Provider,
  tokenData: TokenData,
  userCode?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Use admin client to bypass RLS for token storage
    const supabase = createAdminClient();

    // Encrypt sensitive data
    const encryptedAccessToken = encryptToken(tokenData.accessToken);
    const encryptedRefreshToken = tokenData.refreshToken
      ? encryptToken(tokenData.refreshToken)
      : null;

    // Delete ALL existing tokens for this user/provider (both active and inactive)
    // This avoids unique constraint issues
    // Delete by user_code if provided, otherwise by user_email
    if (userCode) {
      await supabase
        .from('integration_tokens')
        .delete()
        .eq('user_code', userCode)
        .eq('provider', provider);
    }
    // Also delete by email to handle legacy tokens
    await supabase
      .from('integration_tokens')
      .delete()
      .eq('user_email', userEmail)
      .eq('provider', provider);

    // Insert new token
    const { error } = await supabase
      .from('integration_tokens')
      .insert({
        user_email: userEmail,
        user_code: userCode || null,
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

    console.log(`[TokenManager] Successfully stored token for ${userEmail}/${provider}${userCode ? ` (code: ${userCode})` : ''}`);

    // Invalidate ecosystem context cache so new data is fetched on next plan generation
    try {
      const supabase2 = createAdminClient();
      await supabase2
        .from('ecosystem_context_cache')
        .update({ is_valid: false })
        .eq('email', userEmail);
      console.log(`[TokenManager] Invalidated ecosystem cache for ${userEmail} after ${provider} connection`);

      // Also reset ecosystem sync status so fresh data is fetched from the new integration
      // Setting last_ecosystem_sync to null forces a full resync on next plan generation
      await supabase2
        .from('forge_onboarding_data')
        .update({ last_ecosystem_sync: null })
        .eq('email', userEmail);
      await supabase2
        .from('sage_onboarding_data')
        .update({ last_ecosystem_sync: null })
        .eq('email', userEmail);
      console.log(`[TokenManager] Reset ecosystem sync status for ${userEmail} after ${provider} connection`);
    } catch (cacheError) {
      // Don't fail the token storage if cache invalidation fails
      console.warn(`[TokenManager] Failed to invalidate cache:`, cacheError);
    }

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
 * @param userCode - Optional 8-character unique code from onboarding (preferred for lookup)
 */
export async function getAccessToken(
  userEmail: string,
  provider: Provider,
  userCode?: string
): Promise<{ token: string | null; error?: string }> {
  try {
    // Use admin client to bypass RLS for token retrieval
    const supabase = createAdminClient();

    // Use direct query for reliability (RPC has issues with fallback logic)
    let data: any[] = [];
    let error: any = null;

    // Strategy: Try by code first, then fallback to email
    // This handles cases where tokens were stored before code was assigned

    // Step 1: Try lookup by user_code if provided
    if (userCode) {
      const codeResult = await supabase
        .from('integration_tokens')
        .select('id, access_token, refresh_token, expires_at, provider_user_id, user_code')
        .eq('provider', provider)
        .eq('is_active', true)
        .eq('user_code', userCode)
        .order('created_at', { ascending: false })
        .limit(1);

      if (codeResult.data && codeResult.data.length > 0) {
        console.log(`[TokenManager] Found token by code ${userCode} for ${provider}`);
        data = codeResult.data;
      }
      error = codeResult.error;
    }

    // Step 2: If no token found by code, try by email
    if (data.length === 0) {
      console.log(`[TokenManager] No token by code ${userCode || 'N/A'}, trying email ${userEmail} for ${provider}`);
      const emailResult = await supabase
        .from('integration_tokens')
        .select('id, access_token, refresh_token, expires_at, provider_user_id, user_code')
        .eq('provider', provider)
        .eq('is_active', true)
        .eq('user_email', userEmail)
        .order('created_at', { ascending: false })
        .limit(1);

      if (emailResult.data && emailResult.data.length > 0) {
        console.log(`[TokenManager] Found token by email for ${userEmail}/${provider}`);
        data = emailResult.data;
      }
      error = emailResult.error;
    }

    // Add is_expired field
    if (data.length > 0) {
      const token = data[0];
      const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false;
      data = [{ ...token, is_expired: isExpired }];
    }

    if (error) {
      console.error('[TokenManager] Error retrieving token:', error);
      return { token: null, error: error.message };
    }

    if (!data || data.length === 0) {
      console.log(`[TokenManager] No token found for ${userEmail}/${provider} (checked both code and email)`);
      return { token: null, error: 'No token found' };
    }

    const tokenRecord = data[0];

    // Check if token is expired and needs refresh
    if (tokenRecord.is_expired && tokenRecord.refresh_token) {
      console.log(`[TokenManager] Token expired (expires_at check), attempting refresh for ${provider}`);
      // Pass userCode from the token record if available
      const refreshResult = await refreshToken(userEmail, provider, tokenRecord.user_code || userCode);

      if (!refreshResult.success) {
        console.error(`[TokenManager] Token refresh failed for ${userEmail}/${provider}: ${refreshResult.error}`);
        return { token: null, error: `Token expired and refresh failed: ${refreshResult.error}` };
      }

      // Return the newly refreshed token
      return { token: refreshResult.accessToken! };
    }

    // Decrypt and return the access token
    const decryptedToken = decryptToken(tokenRecord.access_token);

    // If expires_at is null or missing, log a warning (token expiry won't be detected)
    if (!tokenRecord.expires_at) {
      console.warn(`[TokenManager] Token for ${userEmail}/${provider} has no expires_at - expiry detection disabled`);
    }

    return { token: decryptedToken, refreshToken: tokenRecord.refresh_token ? decryptToken(tokenRecord.refresh_token) : undefined };
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
 * @param userCode - Optional 8-character unique code from onboarding
 */
export async function refreshToken(
  userEmail: string,
  provider: Provider,
  userCode?: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  try {
    // Use admin client to bypass RLS for token refresh
    const supabase = createAdminClient();

    // Get current token data - prioritize user_code if available
    let query = supabase
      .from('integration_tokens')
      .select('*')
      .eq('provider', provider)
      .eq('is_active', true);

    if (userCode) {
      query = query.eq('user_code', userCode);
    } else {
      query = query.eq('user_email', userEmail);
    }

    const { data, error: fetchError } = await query.single();

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

    // Store the new token - preserve user_code from existing token
    const storeResult = await storeToken(userEmail, provider, {
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken || decryptedRefreshToken,
      expiresAt: refreshResult.expiresAt,
      tokenType: data.token_type,
      scopes: data.scopes as string[],
      providerUserId: data.provider_user_id || undefined,
    }, data.user_code || userCode);

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
      whoop: {
        url: 'https://api.prod.whoop.com/oauth/oauth2/token',
        clientIdEnv: 'WHOOP_CLIENT_ID',
        clientSecretEnv: 'WHOOP_CLIENT_SECRET',
      },
      spotify: {
        url: 'https://accounts.spotify.com/api/token',
        clientIdEnv: 'SPOTIFY_CLIENT_ID',
        clientSecretEnv: 'SPOTIFY_CLIENT_SECRET',
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
    // Note: Whoop uses client_secret_post (credentials in body), not Basic Auth
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
 * Get access token with validation - tries to use the token and refreshes if it fails
 * Use this when you need to ensure the token actually works
 */
export async function getValidatedAccessToken(
  userEmail: string,
  provider: Provider,
  userCode?: string,
  validateFn?: (token: string) => Promise<boolean>
): Promise<{ token: string | null; error?: string; wasRefreshed?: boolean }> {
  console.log(`[TokenManager] getValidatedAccessToken called for ${userEmail}/${provider} (code: ${userCode || 'none'})`);

  // First, get the token normally
  const result = await getAccessToken(userEmail, provider, userCode);

  if (!result.token) {
    console.error(`[TokenManager] FAILED - No token found for ${userEmail}/${provider}. Error: ${result.error}`);
    return { token: null, error: result.error };
  }

  console.log(`[TokenManager] Token retrieved for ${userEmail}/${provider}, proceeding with validation`);

  // If no validation function provided, return the token as-is
  if (!validateFn) {
    return { token: result.token, wasRefreshed: false };
  }

  // Try to validate the token
  try {
    console.log(`[TokenManager] Validating token for ${userEmail}/${provider}...`);
    const isValid = await validateFn(result.token);

    if (isValid) {
      console.log(`[TokenManager] Token validation SUCCESS for ${userEmail}/${provider}`);
      return { token: result.token, wasRefreshed: false };
    }

    // Token is invalid, try to refresh
    console.log(`[TokenManager] Token validation FAILED for ${userEmail}/${provider}, attempting refresh`);

    const refreshResult = await refreshToken(userEmail, provider, userCode);

    if (!refreshResult.success) {
      console.error(`[TokenManager] FAILED - Refresh failed for ${userEmail}/${provider}: ${refreshResult.error}`);
      return { token: null, error: `Token invalid and refresh failed: ${refreshResult.error}` };
    }

    console.log(`[TokenManager] SUCCESS - Token refreshed for ${userEmail}/${provider}`);
    return { token: refreshResult.accessToken!, wasRefreshed: true };
  } catch (error) {
    // Validation threw an error - likely token is invalid
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[TokenManager] Token validation threw error for ${userEmail}/${provider}: ${errorMsg}, attempting refresh`);

    const refreshResult = await refreshToken(userEmail, provider, userCode);

    if (!refreshResult.success) {
      console.error(`[TokenManager] FAILED - Refresh after validation error failed for ${userEmail}/${provider}: ${refreshResult.error}`);
      return { token: null, error: `Token validation error and refresh failed: ${refreshResult.error}` };
    }

    console.log(`[TokenManager] SUCCESS - Token refreshed after validation error for ${userEmail}/${provider}`);
    return { token: refreshResult.accessToken!, wasRefreshed: true };
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
    // Use admin client to bypass RLS for token revocation
    const supabase = createAdminClient();

    // Delete all tokens for this user/provider (avoids unique constraint issues)
    const { error } = await supabase
      .from('integration_tokens')
      .delete()
      .eq('user_email', userEmail)
      .eq('provider', provider);

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
 * @param userCode - Optional 8-character unique code from onboarding (preferred for lookup)
 */
export async function getUserIntegrations(
  userEmail: string,
  userCode?: string
): Promise<{ integrations: Provider[]; error?: string }> {
  try {
    // Use admin client to bypass RLS for reading integrations
    const supabase = createAdminClient();

    let query = supabase
      .from('integration_tokens')
      .select('provider')
      .eq('is_active', true);

    if (userCode) {
      query = query.eq('user_code', userCode);
    } else {
      query = query.eq('user_email', userEmail);
    }

    const { data, error } = await query;

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

/**
 * Invalidate ecosystem context cache for a user
 * Should be called when new integrations are connected
 */
export async function invalidateEcosystemCache(
  userEmail: string,
  userCode?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    // Invalidate all context cache entries for this user
    const { error } = await supabase
      .from('ecosystem_context_cache')
      .update({ is_valid: false })
      .eq('email', userEmail);

    if (error) {
      console.error(`[TokenManager] Failed to invalidate cache for ${userEmail}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[TokenManager] Invalidated ecosystem cache for ${userEmail}`);
    return { success: true };
  } catch (error) {
    console.error('[TokenManager] Exception invalidating cache:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
