/**
 * Email Draft Settings API
 *
 * GET /api/gmail/draft-settings
 * Get user's draft generation preferences.
 *
 * PUT /api/gmail/draft-settings
 * Update user's draft generation preferences.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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
      // Continue
    }
  }
  return null;
}

/**
 * GET /api/gmail/draft-settings
 * Get user's draft generation preferences
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

    const { data, error } = await supabase
      .from('email_draft_settings')
      .select('*')
      .eq('user_email', userEmail)
      .maybeSingle();

    if (error) {
      throw error;
    }

    // Return defaults if no settings exist
    const settings = data || {
      auto_draft_enabled: true,
      require_approval: false,
      process_primary_only: true,
      process_social: false,
      process_promotions: false,
      process_updates: false,
      min_urgency_level: 'low',
      excluded_senders: [],
      excluded_domains: [],
      whitelisted_senders: [],
      only_known_senders: false,
      max_drafts_per_day: 20,
      max_drafts_per_hour: 5,
      draft_retention_days: 7,
      always_formal: false,
      always_casual: false,
      include_signature: true,
      signature_text: null,
      min_response_length: 50,
      max_response_length: 500,
      include_original_context: true,
      notify_on_draft_created: true,
      notify_channel: 'push',
    };

    return NextResponse.json(
      {
        exists: !!data,
        settings: {
          autoDraftEnabled: settings.auto_draft_enabled,
          requireApproval: settings.require_approval,
          processPrimaryOnly: settings.process_primary_only,
          processSocial: settings.process_social,
          processPromotions: settings.process_promotions,
          processUpdates: settings.process_updates,
          minUrgencyLevel: settings.min_urgency_level,
          excludedSenders: settings.excluded_senders,
          excludedDomains: settings.excluded_domains,
          whitelistedSenders: settings.whitelisted_senders,
          onlyKnownSenders: settings.only_known_senders,
          maxDraftsPerDay: settings.max_drafts_per_day,
          maxDraftsPerHour: settings.max_drafts_per_hour,
          draftRetentionDays: settings.draft_retention_days,
          alwaysFormal: settings.always_formal,
          alwaysCasual: settings.always_casual,
          includeSignature: settings.include_signature,
          signatureText: settings.signature_text,
          minResponseLength: settings.min_response_length,
          maxResponseLength: settings.max_response_length,
          includeOriginalContext: settings.include_original_context,
          notifyOnDraftCreated: settings.notify_on_draft_created,
          notifyChannel: settings.notify_channel,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[DraftSettings API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PUT /api/gmail/draft-settings
 * Update user's draft generation preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, settings } = body;

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

    if (!settings) {
      return NextResponse.json(
        { error: 'Settings object is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Build database row from camelCase settings
    const dbSettings: Record<string, any> = {
      user_email: userEmail,
      user_code: code || null,
    };

    // Map camelCase to snake_case
    const mapping: Record<string, string> = {
      autoDraftEnabled: 'auto_draft_enabled',
      requireApproval: 'require_approval',
      processPrimaryOnly: 'process_primary_only',
      processSocial: 'process_social',
      processPromotions: 'process_promotions',
      processUpdates: 'process_updates',
      minUrgencyLevel: 'min_urgency_level',
      excludedSenders: 'excluded_senders',
      excludedDomains: 'excluded_domains',
      whitelistedSenders: 'whitelisted_senders',
      onlyKnownSenders: 'only_known_senders',
      maxDraftsPerDay: 'max_drafts_per_day',
      maxDraftsPerHour: 'max_drafts_per_hour',
      draftRetentionDays: 'draft_retention_days',
      alwaysFormal: 'always_formal',
      alwaysCasual: 'always_casual',
      includeSignature: 'include_signature',
      signatureText: 'signature_text',
      minResponseLength: 'min_response_length',
      maxResponseLength: 'max_response_length',
      includeOriginalContext: 'include_original_context',
      notifyOnDraftCreated: 'notify_on_draft_created',
      notifyChannel: 'notify_channel',
    };

    for (const [camelKey, snakeKey] of Object.entries(mapping)) {
      if (settings[camelKey] !== undefined) {
        dbSettings[snakeKey] = settings[camelKey];
      }
    }

    // Upsert settings
    const { error } = await supabase.from('email_draft_settings').upsert(dbSettings, {
      onConflict: 'user_email',
    });

    if (error) {
      throw error;
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Settings updated successfully',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[DraftSettings API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
