/**
 * Outlook Category Apply API
 *
 * POST /api/outlook/mail/categories/apply
 * Apply a Moccet category to an email in Outlook.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  applyCategoryToEmail,
  MoccetCategoryName,
  MOCCET_CATEGORIES,
} from '@/lib/services/outlook-category-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * POST /api/outlook/mail/categories/apply
 * Apply a category to an email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, messageId, categoryName, conversationId, from, subject, source, confidence, reasoning } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!categoryName) {
      return NextResponse.json(
        { error: 'categoryName is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate category name
    if (!(categoryName in MOCCET_CATEGORIES)) {
      return NextResponse.json(
        {
          error: `Invalid categoryName. Must be one of: ${Object.keys(MOCCET_CATEGORIES).join(', ')}`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Outlook Category Apply API] Applying ${categoryName} to ${messageId} for ${email}`);

    const result = await applyCategoryToEmail(
      email,
      messageId,
      categoryName as MoccetCategoryName,
      code,
      {
        from,
        subject,
        conversationId,
        source: source || 'api',
        confidence,
        reasoning,
      }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `Applied category '${categoryName}' to message`,
        messageId,
        categoryName,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Category Apply API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to apply category' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
