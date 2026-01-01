/**
 * Outlook Folders Setup API
 *
 * POST /api/outlook/mail/folders/setup
 * Creates Moccet folders in user's Outlook account for email organization.
 *
 * GET /api/outlook/mail/folders/setup
 * Check if folders are set up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setupMoccetFolders, hasFoldersSetup } from '@/lib/services/outlook-category-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/outlook/mail/folders/setup
 * Check if folders are set up
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

    const isSetup = await hasFoldersSetup(email);

    return NextResponse.json({ isSetup }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Outlook Folders] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check folders status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/outlook/mail/folders/setup
 * Create Moccet folders in user's Outlook account
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Outlook Folders] Setting up folders for ${email}`);

    const result = await setupMoccetFolders(email, code);

    return NextResponse.json(
      {
        success: result.success,
        foldersCreated: result.foldersCreated,
        foldersExisting: result.foldersExisting,
        errors: result.errors,
      },
      { status: result.success ? 200 : 500, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Folders] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to setup folders' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
