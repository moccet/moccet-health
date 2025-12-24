/**
 * Gmail Status API
 *
 * GET /api/gmail/status
 * Get user's Gmail integration status including:
 * - Connection status
 * - Labels setup status
 * - Drafts enabled status
 * - Watch (real-time) enabled status
 * - Counts of labeled emails and drafts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

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
 * GET /api/gmail/status
 * Get comprehensive Gmail integration status
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
      tokensResult,
      labelsResult,
      settingsResult,
      watchResult,
      labelCountResult,
      draftCountResult,
    ] = await Promise.all([
      // Check if Gmail is connected (has tokens)
      supabase
        .from('gmail_tokens')
        .select('id, created_at')
        .eq('user_email', userEmail)
        .maybeSingle(),

      // Check if labels are setup
      supabase
        .from('gmail_user_labels')
        .select('id')
        .eq('user_email', userEmail)
        .limit(1),

      // Get draft settings
      supabase
        .from('email_draft_settings')
        .select('auto_draft_enabled')
        .eq('user_email', userEmail)
        .maybeSingle(),

      // Check if watch is enabled
      supabase
        .from('gmail_watch_subscriptions')
        .select('id, expiration')
        .eq('user_email', userEmail)
        .maybeSingle(),

      // Count labeled emails
      supabase
        .from('email_label_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', userEmail),

      // Count drafts
      supabase
        .from('email_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', userEmail),
    ]);

    // Determine connection status
    const isConnected = !!tokensResult.data;

    // Determine labels setup status
    const labelsSetup = !labelsResult.error && (labelsResult.data?.length ?? 0) > 0;

    // Determine drafts enabled status
    const draftsEnabled = settingsResult.data?.auto_draft_enabled ?? false;

    // Determine watch status (check if not expired)
    let watchEnabled = false;
    if (watchResult.data?.expiration) {
      const expirationDate = new Date(watchResult.data.expiration);
      watchEnabled = expirationDate > new Date();
    }

    // Get counts
    const labeledEmailCount = labelCountResult.count ?? 0;
    const draftCount = draftCountResult.count ?? 0;

    return NextResponse.json(
      {
        isConnected,
        labelsSetup,
        draftsEnabled,
        watchEnabled,
        labeledEmailCount,
        draftCount,
        connectedAt: tokensResult.data?.created_at ?? null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Gmail Status API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
