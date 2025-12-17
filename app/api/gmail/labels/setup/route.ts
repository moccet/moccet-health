/**
 * Gmail Labels Setup API
 *
 * POST /api/gmail/labels/setup
 * Creates all Moccet labels in user's Gmail account.
 * Should be called once when enabling labeling feature.
 *
 * GET /api/gmail/labels/setup
 * Returns current label sync status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  setupUserLabels,
  getUserLabelMapping,
  hasLabelsSetup,
  backfillExistingEmails,
  MOCCET_LABELS,
} from '@/lib/services/gmail-label-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/gmail/labels/setup
 * Check if labels are set up for user
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Check if labels are set up
    const isSetup = await hasLabelsSetup(email);

    // Get label mapping
    const labelMapping = await getUserLabelMapping(email);

    // Get sync status from database
    const supabase = createAdminClient();
    const { data: labels } = await supabase
      .from('gmail_user_labels')
      .select('label_name, gmail_label_id, display_name, is_synced, sync_error, last_synced_at')
      .eq('user_email', email);

    return NextResponse.json(
      {
        isSetup,
        labelsCount: labelMapping.size,
        totalLabels: Object.keys(MOCCET_LABELS).length,
        labels: labels || [],
        labelDefinitions: MOCCET_LABELS,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Labels Setup API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check label status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/gmail/labels/setup
 * Create all Moccet labels in user's Gmail and optionally backfill existing emails
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, labelPrefix, backfill = true, backfillCount = 50 } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Labels Setup API] Setting up labels for ${email}`);

    // Step 1: Create labels in Gmail
    const result = await setupUserLabels(email, code, labelPrefix || 'Moccet');

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          labelsCreated: result.labelsCreated,
          labelsExisting: result.labelsExisting,
          errors: result.errors,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Step 2: Backfill existing emails (if enabled)
    let backfillResult = null;
    if (backfill) {
      console.log(`[Labels Setup API] Backfilling last ${backfillCount} emails for ${email}`);
      backfillResult = await backfillExistingEmails(email, code, backfillCount);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Labels setup complete${backfill ? ' with backfill' : ''}`,
        labelsCreated: result.labelsCreated,
        labelsExisting: result.labelsExisting,
        errors: result.errors,
        backfill: backfillResult
          ? {
              totalFetched: backfillResult.totalFetched,
              labeled: backfillResult.labeled,
              skippedSelf: backfillResult.skippedSelf,
              errors: backfillResult.errors,
            }
          : null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Labels Setup API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to setup labels' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
