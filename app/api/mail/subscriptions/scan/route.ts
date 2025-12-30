/**
 * Unified Mail Subscriptions Scan API
 *
 * POST /api/mail/subscriptions/scan
 * Scans emails for unsubscribe options across all connected providers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanAllSubscriptions } from '@/lib/services/subscription-scanner';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, forceRefresh = false, maxEmails = 100 } = body;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400, headers: corsHeaders });
    }

    console.log(`[Subscriptions Scan] Scanning for ${email} (force: ${forceRefresh}, max: ${maxEmails})`);

    const result = await scanAllSubscriptions(email, code, { forceRefresh, maxEmails });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Subscriptions Scan] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to scan subscriptions' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
