/**
 * Unsubscribe API
 *
 * POST /api/mail/subscriptions/unsubscribe
 * Executes unsubscribe action for one or more subscriptions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeUnsubscribe, bulkUnsubscribe } from '@/lib/services/unsubscribe-executor';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, subscriptionId, subscriptionIds } = body;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400, headers: corsHeaders });
    }

    if (!subscriptionId && !subscriptionIds) {
      return NextResponse.json(
        { error: 'subscriptionId or subscriptionIds is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let results;
    if (subscriptionIds && Array.isArray(subscriptionIds)) {
      console.log(`[Unsubscribe] Bulk unsubscribe for ${email}: ${subscriptionIds.length} items`);
      results = await bulkUnsubscribe(subscriptionIds, email, code);
    } else {
      console.log(`[Unsubscribe] Single unsubscribe for ${email}: ${subscriptionId}`);
      results = [await executeUnsubscribe(subscriptionId, email, code)];
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json(
      {
        success: failed === 0,
        results,
        summary: { successful, failed, total: results.length },
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to unsubscribe' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
