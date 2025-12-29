/**
 * Outlook Categories Setup API
 *
 * POST /api/outlook/mail/categories/setup
 * Creates all Moccet categories in user's Outlook account.
 * Should be called once when enabling categorization feature.
 *
 * GET /api/outlook/mail/categories/setup
 * Returns current category sync status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  setupUserCategories,
  getUserCategoryMapping,
  hasCategoriesSetup,
  backfillExistingEmails,
  MOCCET_CATEGORIES,
} from '@/lib/services/outlook-category-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/outlook/mail/categories/setup
 * Check if categories are set up for user
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

    // Check if categories are set up
    const isSetup = await hasCategoriesSetup(email);

    // Get category mapping
    const categoryMapping = await getUserCategoryMapping(email);

    // Get sync status from database
    const supabase = createAdminClient();
    const { data: categories } = await supabase
      .from('outlook_user_categories')
      .select('category_name, outlook_category_id, display_name, color_preset, is_synced, sync_error, last_synced_at')
      .eq('user_email', email);

    return NextResponse.json(
      {
        isSetup,
        categoriesCount: categoryMapping.size,
        totalCategories: Object.keys(MOCCET_CATEGORIES).length,
        categories: categories || [],
        categoryDefinitions: MOCCET_CATEGORIES,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Categories Setup API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check category status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/outlook/mail/categories/setup
 * Create all Moccet categories in user's Outlook and optionally backfill existing emails
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

    console.log(`[Outlook Categories Setup API] Setting up categories for ${email}`);

    // Step 1: Create categories in Outlook
    const result = await setupUserCategories(email, code);

    if (!result.success && result.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          categoriesCreated: result.categoriesCreated,
          categoriesExisting: result.categoriesExisting,
          errors: result.errors,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // Step 2: Backfill existing emails (if enabled)
    let backfillResult = null;
    if (backfill) {
      console.log(`[Outlook Categories Setup API] Backfilling last ${backfillCount} emails for ${email}`);
      backfillResult = await backfillExistingEmails(email, code, backfillCount);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Categories setup complete${backfill ? ' with backfill' : ''}`,
        categoriesCreated: result.categoriesCreated,
        categoriesExisting: result.categoriesExisting,
        errors: result.errors,
        backfill: backfillResult
          ? {
              totalFetched: backfillResult.totalFetched,
              categorized: backfillResult.categorized,
              skippedSelf: backfillResult.skippedSelf,
              errors: backfillResult.errors,
            }
          : null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Categories Setup API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to setup categories' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
