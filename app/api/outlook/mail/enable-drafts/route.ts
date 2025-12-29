/**
 * Enable Outlook Email Drafts API
 *
 * POST /api/outlook/mail/enable-drafts
 * Opt-in endpoint to enable automatic email draft generation for Outlook.
 * Called from the Flutter app when user explicitly enables the feature.
 *
 * This sets up:
 * 1. Email style learning (analyzes sent emails)
 * 2. Microsoft Graph subscriptions (watch for new emails)
 * 3. Draft generation settings
 *
 * DELETE /api/outlook/mail/enable-drafts
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
 * GET /api/outlook/mail/enable-drafts
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

    // Check if Outlook is connected
    const { token } = await getAccessToken(userEmail, 'outlook');
    const isOutlookConnected = !!token;

    // Check draft settings
    const { data: settings } = await supabase
      .from('email_draft_settings')
      .select('outlook_auto_draft_enabled, created_at')
      .eq('user_email', userEmail)
      .maybeSingle();

    // Check if style has been learned
    const { data: style } = await supabase
      .from('user_email_style')
      .select('sample_emails_analyzed, last_learned_at')
      .eq('user_email', userEmail)
      .maybeSingle();

    // Check subscription
    const { data: subscription } = await supabase
      .from('outlook_subscriptions')
      .select('is_active, expiration_datetime')
      .eq('user_email', userEmail)
      .maybeSingle();

    return NextResponse.json({
      isOutlookConnected,
      isEnabled: settings?.outlook_auto_draft_enabled ?? false,
      styleLearnedAt: style?.last_learned_at || null,
      emailsAnalyzed: style?.sample_emails_analyzed || 0,
      subscriptionActive: subscription?.is_active ?? false,
      subscriptionExpires: subscription?.expiration_datetime || null,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Outlook EnableDrafts] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/outlook/mail/enable-drafts
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
    const userCode = code;
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

    // Verify Outlook is connected
    const { token } = await getAccessToken(userEmail, 'outlook', userCode);
    if (!token) {
      return NextResponse.json(
        { error: 'Outlook not connected. Please connect Outlook first.' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Outlook EnableDrafts] Enabling email drafts for ${userEmail}`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';
    const results: Record<string, unknown> = {};

    // 1. Learn email writing style
    console.log(`[Outlook EnableDrafts] Learning email style...`);
    try {
      const styleResponse = await fetch(`${baseUrl}/api/outlook/mail/learn-style`, {
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
        console.log(`[Outlook EnableDrafts] Style learning complete: ${styleResult.emailsAnalyzed} emails`);
      } else {
        results.styleLearning = { success: false, error: `Status ${styleResponse.status}` };
      }
    } catch (err) {
      results.styleLearning = { success: false, error: String(err) };
    }

    // 2. Setup Microsoft Graph subscription for push notifications
    console.log(`[Outlook EnableDrafts] Setting up subscription...`);
    try {
      const subscriptionResponse = await fetch(`${baseUrl}/api/outlook/mail/setup-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          code: userCode,
        }),
      });

      if (subscriptionResponse.ok) {
        const subscriptionResult = await subscriptionResponse.json();
        results.subscriptionSetup = {
          success: true,
          expiration: subscriptionResult.expiration,
        };
        console.log(`[Outlook EnableDrafts] Subscription setup complete`);
      } else {
        results.subscriptionSetup = { success: false, error: `Status ${subscriptionResponse.status}` };
      }
    } catch (err) {
      results.subscriptionSetup = { success: false, error: String(err) };
    }

    // 3. Create/update draft settings with outlook_auto_draft_enabled = true
    const { error: settingsError } = await supabase
      .from('email_draft_settings')
      .upsert({
        user_email: userEmail,
        user_code: userCode || null,
        outlook_auto_draft_enabled: true,
        outlook_auto_labeling_enabled: true,
        require_approval: false,
        process_primary_only: true,
        max_drafts_per_day: 20,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_email' });

    if (settingsError) {
      console.error('[Outlook EnableDrafts] Failed to update settings:', settingsError);
      results.settings = { success: false, error: settingsError.message };
    } else {
      results.settings = { success: true };
    }

    console.log(`[Outlook EnableDrafts] Email drafts enabled for ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Outlook email draft generation enabled',
      results,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Outlook EnableDrafts] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to enable email drafts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/outlook/mail/enable-drafts
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

    console.log(`[Outlook EnableDrafts] Disabling email drafts for ${userEmail}`);

    // Disable auto drafting
    await supabase
      .from('email_draft_settings')
      .update({
        outlook_auto_draft_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail);

    // Deactivate subscription
    await supabase
      .from('outlook_subscriptions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', userEmail);

    return NextResponse.json({
      success: true,
      message: 'Outlook email draft generation disabled',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Outlook EnableDrafts] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to disable email drafts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
