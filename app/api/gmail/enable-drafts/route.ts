/**
 * Enable Email Drafts API
 *
 * POST /api/gmail/enable-drafts
 * Opt-in endpoint to enable automatic email draft generation.
 * Called from the Flutter app when user explicitly enables the feature.
 *
 * This sets up:
 * 1. Email style learning (analyzes sent emails)
 * 2. Gmail push notifications (watch for new emails)
 * 3. Draft generation settings
 *
 * DELETE /api/gmail/enable-drafts
 * Disable the feature and stop generating drafts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/gmail/enable-drafts
 * Check if email drafts feature is enabled for user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const userId = searchParams.get('userId');

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'email or userId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Get user email from userId if needed
    let userEmail = email;
    if (!userEmail && userId) {
      const { data: user } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();
      userEmail = user?.email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if Gmail is connected
    const { token } = await getAccessToken(userEmail, 'gmail');
    const isGmailConnected = !!token;

    // Check draft settings
    const { data: settings } = await supabase
      .from('email_draft_settings')
      .select('auto_draft_enabled, created_at')
      .eq('user_email', userEmail)
      .maybeSingle();

    // Check if style has been learned
    const { data: style } = await supabase
      .from('user_email_style')
      .select('sample_emails_analyzed, last_learned_at')
      .eq('user_email', userEmail)
      .maybeSingle();

    // Check watch subscription
    const { data: watch } = await supabase
      .from('gmail_watch_subscriptions')
      .select('is_active, expiration_timestamp')
      .eq('user_email', userEmail)
      .maybeSingle();

    return NextResponse.json({
      isGmailConnected,
      isEnabled: settings?.auto_draft_enabled ?? false,
      styleLearnedAt: style?.last_learned_at || null,
      emailsAnalyzed: style?.sample_emails_analyzed || 0,
      watchActive: watch?.is_active ?? false,
      watchExpires: watch?.expiration_timestamp || null,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[EnableDrafts] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/gmail/enable-drafts
 * Enable email draft generation for user
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId, code } = body;

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'email or userId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Get user email from userId if needed
    let userEmail = email;
    let userCode = code;
    if (!userEmail && userId) {
      const { data: user } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();
      userEmail = user?.email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify Gmail is connected
    const { token } = await getAccessToken(userEmail, 'gmail', userCode);
    if (!token) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please connect Gmail first.' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[EnableDrafts] Enabling email drafts for ${userEmail}`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';
    const results: Record<string, unknown> = {};

    // 1. Learn email writing style
    console.log(`[EnableDrafts] Learning email style...`);
    try {
      const styleResponse = await fetch(`${baseUrl}/api/gmail/learn-style`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          code: userCode,
          maxEmails: 200,
        }),
      });

      if (styleResponse.ok) {
        const styleResult = await styleResponse.json();
        results.styleLearning = {
          success: true,
          emailsAnalyzed: styleResult.emailsAnalyzed,
        };
        console.log(`[EnableDrafts] Style learning complete: ${styleResult.emailsAnalyzed} emails`);
      } else {
        results.styleLearning = { success: false, error: `Status ${styleResponse.status}` };
      }
    } catch (err) {
      results.styleLearning = { success: false, error: String(err) };
    }

    // 2. Setup Gmail watch for push notifications
    console.log(`[EnableDrafts] Setting up Gmail watch...`);
    try {
      const watchResponse = await fetch(`${baseUrl}/api/gmail/setup-watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          code: userCode,
          labelIds: ['INBOX'],
        }),
      });

      if (watchResponse.ok) {
        const watchResult = await watchResponse.json();
        results.watchSetup = {
          success: true,
          expiration: watchResult.expiration,
        };
        console.log(`[EnableDrafts] Watch setup complete`);
      } else {
        results.watchSetup = { success: false, error: `Status ${watchResponse.status}` };
      }
    } catch (err) {
      results.watchSetup = { success: false, error: String(err) };
    }

    // 3. Create/update draft settings with auto_draft_enabled = true
    const { error: settingsError } = await supabase
      .from('email_draft_settings')
      .upsert({
        user_email: userEmail,
        user_code: userCode || null,
        auto_draft_enabled: true,
        require_approval: false,
        process_primary_only: true,
        max_drafts_per_day: 20,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_email' });

    if (settingsError) {
      console.error('[EnableDrafts] Failed to update settings:', settingsError);
      results.settings = { success: false, error: settingsError.message };
    } else {
      results.settings = { success: true };
    }

    console.log(`[EnableDrafts] Email drafts enabled for ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Email draft generation enabled',
      results,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[EnableDrafts] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to enable email drafts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/gmail/enable-drafts
 * Disable email draft generation
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const userId = searchParams.get('userId');

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'email or userId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Get user email from userId if needed
    let userEmail = email;
    if (!userEmail && userId) {
      const { data: user } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();
      userEmail = user?.email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`[EnableDrafts] Disabling email drafts for ${userEmail}`);

    // Disable auto drafting
    await supabase
      .from('email_draft_settings')
      .update({
        auto_draft_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail);

    // Deactivate Gmail watch
    await supabase
      .from('gmail_watch_subscriptions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail);

    return NextResponse.json({
      success: true,
      message: 'Email draft generation disabled',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[EnableDrafts] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to disable email drafts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
