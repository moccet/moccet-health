/**
 * Outlook Mail Status API
 *
 * GET /api/outlook/mail/status
 * Get user's Outlook mail integration status including:
 * - Connection status
 * - Categories setup status
 * - Drafts enabled status
 * - Subscription (real-time) enabled status
 * - Counts of categorized emails and drafts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getUserEmail(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = createAdminClient();

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        return user.email;
      }
    } catch {
      // Continue to check query param
    }
  }
  return null;
}

/**
 * GET /api/outlook/mail/status
 * Get comprehensive Outlook mail integration status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Run all queries in parallel for performance
    const [
      tokenResult,
      categoriesResult,
      settingsResult,
      subscriptionResult,
      categoryCountResult,
      draftCountResult,
    ] = await Promise.all([
      // Check if Outlook is connected (has tokens)
      getAccessToken(userEmail, 'outlook'),

      // Check if categories are setup
      supabase
        .from('outlook_user_categories')
        .select('id')
        .eq('user_email', userEmail)
        .eq('is_synced', true)
        .limit(1),

      // Get draft settings
      supabase
        .from('email_draft_settings')
        .select('outlook_auto_draft_enabled, created_at')
        .eq('user_email', userEmail)
        .maybeSingle(),

      // Check if subscription is enabled
      supabase
        .from('outlook_subscriptions')
        .select('id, expiration_datetime, is_active')
        .eq('user_email', userEmail)
        .maybeSingle(),

      // Count categorized emails
      supabase
        .from('email_label_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', userEmail)
        .eq('email_provider', 'outlook'),

      // Count drafts
      supabase
        .from('email_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', userEmail)
        .eq('email_provider', 'outlook'),
    ]);

    // Determine connection status
    const isConnected = !!tokenResult.token;

    // Determine categories setup status
    const categoriesSetup = !categoriesResult.error && (categoriesResult.data?.length ?? 0) > 0;

    // Determine drafts enabled status
    const draftsEnabled = settingsResult.data?.outlook_auto_draft_enabled ?? false;

    // Determine subscription status (check if active and not expired)
    let subscriptionEnabled = false;
    if (subscriptionResult.data?.is_active && subscriptionResult.data?.expiration_datetime) {
      const expirationDate = new Date(subscriptionResult.data.expiration_datetime);
      subscriptionEnabled = expirationDate > new Date();
    }

    // Get counts
    const categorizedEmailCount = categoryCountResult.count ?? 0;
    const draftCount = draftCountResult.count ?? 0;

    return NextResponse.json(
      {
        isConnected,
        categoriesSetup,
        draftsEnabled,
        subscriptionEnabled,
        categorizedEmailCount,
        draftCount,
        connectedAt: settingsResult.data?.created_at ?? null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Mail Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
