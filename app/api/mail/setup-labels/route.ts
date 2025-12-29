/**
 * Unified Mail Setup Labels API
 *
 * POST /api/mail/setup-labels
 * Setup labels/categories for ALL connected email providers.
 * Auto-detects which providers are connected and sets up labels/categories for each.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setupAllLabels } from '@/lib/services/unified-mail-service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * POST /api/mail/setup-labels
 * Setup labels/categories for all connected providers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, backfill = true, backfillCount = 50 } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Unified Mail Setup] Setting up labels for ${email}`);

    const result = await setupAllLabels(email, code, { backfill, backfillCount });

    const statusCode = result.summary.allSuccess ? 200 : 207; // 207 Multi-Status if partial success

    return NextResponse.json(result, { status: statusCode, headers: corsHeaders });
  } catch (error) {
    console.error('[Unified Mail Setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to setup labels' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
