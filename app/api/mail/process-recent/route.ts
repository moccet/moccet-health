/**
 * Unified Mail Process Recent API
 *
 * POST /api/mail/process-recent
 * Process recent unread emails from ALL connected email providers.
 * Auto-detects which providers are connected and processes emails from each.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processAllRecentEmails } from '@/lib/services/unified-mail-service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * POST /api/mail/process-recent
 * Process recent emails from all connected providers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, maxEmails = 10 } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Unified Process Recent] Processing emails for ${email} (max: ${maxEmails})`);

    const result = await processAllRecentEmails(email, code, { maxEmails });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error('[Unified Process Recent] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process emails' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
