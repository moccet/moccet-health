/**
 * Unified Mail Subscriptions API
 *
 * GET /api/mail/subscriptions
 * Returns cached subscription list for the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCachedSubscriptions } from '@/lib/services/subscription-scanner';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const provider = searchParams.get('provider') as 'gmail' | 'outlook' | null;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400, headers: corsHeaders });
    }

    const subscriptions = await getCachedSubscriptions(email, provider || undefined);

    return NextResponse.json({ subscriptions }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Subscriptions Get] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get subscriptions' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
