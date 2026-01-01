/**
 * Outlook Organization Mode API
 *
 * GET /api/outlook/mail/organization-mode
 * Get user's organization mode (categories, folders, or both).
 *
 * POST /api/outlook/mail/organization-mode
 * Set user's organization mode.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationMode,
  setOrganizationMode,
  hasCategoriesSetup,
  hasFoldersSetup,
  OrganizationMode,
} from '@/lib/services/outlook-category-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/outlook/mail/organization-mode
 * Get current organization mode and setup status
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

    const [mode, categoriesSetup, foldersSetup] = await Promise.all([
      getOrganizationMode(email),
      hasCategoriesSetup(email),
      hasFoldersSetup(email),
    ]);

    return NextResponse.json(
      {
        mode,
        categoriesSetup,
        foldersSetup,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Organization Mode] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get organization mode' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/outlook/mail/organization-mode
 * Set organization mode
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, mode } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!mode || !['categories', 'folders', 'both'].includes(mode)) {
      return NextResponse.json(
        { error: 'mode must be one of: categories, folders, both' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Organization Mode] Setting mode to ${mode} for ${email}`);

    const result = await setOrganizationMode(email, mode as OrganizationMode);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to set organization mode' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        mode,
        message: `Organization mode set to ${mode}`,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Organization Mode] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set organization mode' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
