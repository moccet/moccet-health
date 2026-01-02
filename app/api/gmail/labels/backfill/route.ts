/**
 * Gmail Labels Backfill API
 *
 * POST /api/gmail/labels/backfill
 * Labels the last N emails in the user's inbox using AI classification.
 * Used after setting up preferences on the website.
 */

import { NextRequest, NextResponse } from 'next/server';
import { backfillExistingEmails } from '@/lib/services/gmail-label-manager';
import { createAdminClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, count = 100, replaceExisting = true } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Labels Backfill API] Starting backfill for ${email} (count: ${count}, replace: ${replaceExisting})`);

    // Get user code if available
    const supabase = createAdminClient();
    const { data: subscription } = await supabase
      .from('gmail_watch_subscriptions')
      .select('user_code')
      .eq('user_email', email)
      .maybeSingle();

    const userCode = subscription?.user_code;

    // Run backfill
    const result = await backfillExistingEmails(email, userCode, count);

    console.log(`[Labels Backfill API] Completed: ${result.labeled} labeled, ${result.skippedSelf} skipped, ${result.errors.length} errors`);

    return NextResponse.json(
      {
        success: result.success,
        totalFetched: result.totalFetched,
        labeled: result.labeled,
        skippedSelf: result.skippedSelf,
        errors: result.errors.slice(0, 5), // Only return first 5 errors
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Labels Backfill API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to backfill labels' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
