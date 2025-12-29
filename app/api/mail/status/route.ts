/**
 * Unified Mail Status API
 *
 * GET /api/mail/status
 * Get status for ALL connected email providers (Gmail and Outlook).
 * Auto-detects which providers are connected and returns combined status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUnifiedStatus } from '@/lib/services/unified-mail-service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/mail/status
 * Get combined status for all connected providers
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

    console.log(`[Unified Mail Status] Getting status for ${email}`);

    const status = await getUnifiedStatus(email);

    return NextResponse.json(status, { headers: corsHeaders });
  } catch (error) {
    console.error('[Unified Mail Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
