/**
 * Gmail Client Service
 *
 * Provides a validated Gmail client that automatically refreshes tokens
 * when they're invalid, even if expires_at is null in the database.
 *
 * @module lib/services/gmail-client
 */

import { google, gmail_v1 } from 'googleapis';
import { getValidatedAccessToken, getAccessToken } from '@/lib/services/token-manager';

// =========================================================================
// TYPES
// =========================================================================

export interface GmailClientResult {
  gmail: gmail_v1.Gmail | null;
  error?: string;
  wasRefreshed?: boolean;
}

// =========================================================================
// TOKEN VALIDATION
// =========================================================================

/**
 * Validate a Gmail token by making a simple API call
 * This checks if the token actually works, not just if expires_at says it's valid
 */
async function validateGmailToken(accessToken: string): Promise<boolean> {
  try {
    // Create a minimal OAuth client for validation
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Make a minimal API call - get user profile
    // This is lightweight and confirms the token works
    await gmail.users.getProfile({ userId: 'me' });

    return true;
  } catch (error: any) {
    // Token is invalid if we get auth errors
    if (error.code === 401 || error.code === 403) {
      console.log('[GmailClient] Token validation failed: unauthorized');
      return false;
    }

    // Check for specific Google API errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('[GmailClient] Token validation failed: API auth error');
      return false;
    }

    // Check error messages for auth issues
    const errorMessage = error.message?.toLowerCase() || '';
    if (
      errorMessage.includes('invalid_token') ||
      errorMessage.includes('token has been expired') ||
      errorMessage.includes('token revoked') ||
      errorMessage.includes('unauthorized')
    ) {
      console.log('[GmailClient] Token validation failed:', errorMessage);
      return false;
    }

    // Other errors (network, rate limit, etc.) - assume token is valid
    // We don't want to force a refresh just because of transient errors
    console.warn('[GmailClient] Token validation encountered non-auth error:', error.message);
    return true;
  }
}

// =========================================================================
// GMAIL CLIENT CREATION
// =========================================================================

/**
 * Create a Gmail client with validated and auto-refreshed token
 *
 * This function:
 * 1. Gets the stored token
 * 2. Validates it by making a test API call
 * 3. If validation fails, refreshes the token
 * 4. Returns a working Gmail client
 *
 * Use this instead of manually calling getAccessToken for Gmail operations.
 *
 * @param userEmail - User's email address
 * @param userCode - Optional user code for lookup
 * @param skipValidation - If true, skip validation and use token as-is (faster but may fail)
 * @returns Gmail client or null if auth fails
 */
export async function createValidatedGmailClient(
  userEmail: string,
  userCode?: string,
  skipValidation: boolean = false
): Promise<GmailClientResult> {
  console.log(`[GmailClient] Creating client for ${userEmail} (validate: ${!skipValidation})`);

  let token: string | null = null;
  let wasRefreshed = false;

  if (skipValidation) {
    // Fast path - just get token without validation
    const result = await getAccessToken(userEmail, 'gmail', userCode);
    if (!result.token || result.error) {
      console.error(`[GmailClient] Failed to get token for ${userEmail}:`, result.error);
      return { gmail: null, error: result.error || 'No token found' };
    }
    token = result.token;
  } else {
    // Validated path - checks token actually works
    const result = await getValidatedAccessToken(
      userEmail,
      'gmail',
      userCode,
      validateGmailToken
    );

    if (!result.token) {
      console.error(`[GmailClient] Failed to get validated token for ${userEmail}:`, result.error);
      return { gmail: null, error: result.error || 'Token validation failed' };
    }

    token = result.token;
    wasRefreshed = result.wasRefreshed || false;

    if (wasRefreshed) {
      console.log(`[GmailClient] Token was refreshed for ${userEmail}`);
    }
  }

  // Create OAuth client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: token });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  return { gmail, wasRefreshed };
}

/**
 * Simple Gmail client creation without validation
 * Use this for performance-critical paths where you're okay with potential auth failures
 *
 * @deprecated Prefer createValidatedGmailClient for reliability
 */
export async function createGmailClientSimple(
  userEmail: string,
  userCode?: string
): Promise<gmail_v1.Gmail | null> {
  const { token, error } = await getAccessToken(userEmail, 'gmail', userCode);
  if (!token || error) {
    console.error(`[GmailClient] Failed to get token for ${userEmail}:`, error);
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: token });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}
