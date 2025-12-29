/**
 * Unified Mail Enable Drafts API
 *
 * POST /api/mail/enable-drafts
 * Enable automatic draft generation for ALL connected email providers.
 * Auto-detects which providers are connected and enables drafts for each.
 *
 * GET /api/mail/enable-drafts
 * Check drafts status for all connected providers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { enableAllDrafts, getUnifiedStatus } from '@/lib/services/unified-mail-service';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/mail/enable-drafts
 * Check drafts status for all connected providers
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

    const status = await getUnifiedStatus(email);

    return NextResponse.json({
      gmail: status.providers.gmail
        ? {
            enabled: status.providers.gmail.draftsEnabled,
            watchEnabled: status.providers.gmail.watchEnabled,
          }
        : null,
      outlook: status.providers.outlook
        ? {
            enabled: status.providers.outlook.draftsEnabled,
            subscriptionEnabled: status.providers.outlook.watchEnabled,
          }
        : null,
      summary: {
        anyEnabled:
          (status.providers.gmail?.draftsEnabled ?? false) ||
          (status.providers.outlook?.draftsEnabled ?? false),
        allEnabled:
          (status.providers.gmail?.draftsEnabled ?? true) &&
          (status.providers.outlook?.draftsEnabled ?? true),
      },
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Unified Enable Drafts] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check drafts status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/mail/enable-drafts
 * Enable drafts for all connected providers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, enabled = true } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Unified Enable Drafts] ${enabled ? 'Enabling' : 'Disabling'} drafts for ${email}`);

    const result = await enableAllDrafts(email, code, { enabled });

    const statusCode = result.summary.allSuccess ? 200 : 207;

    return NextResponse.json(result, { status: statusCode, headers: corsHeaders });
  } catch (error) {
    console.error('[Unified Enable Drafts] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to enable drafts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
