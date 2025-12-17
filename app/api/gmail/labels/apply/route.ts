/**
 * Gmail Labels Apply API
 *
 * POST /api/gmail/labels/apply
 * Manually apply a Moccet label to an email.
 *
 * DELETE /api/gmail/labels/apply
 * Remove a Moccet label from an email.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  applyLabelToEmail,
  removeLabelFromEmail,
  getEmailLabel,
  MoccetLabelName,
  MOCCET_LABELS,
} from '@/lib/services/gmail-label-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Valid label names
const VALID_LABELS = Object.keys(MOCCET_LABELS) as MoccetLabelName[];

/**
 * GET /api/gmail/labels/apply
 * Get the current label for an email
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const messageId = searchParams.get('messageId');

    if (!email || !messageId) {
      return NextResponse.json(
        { error: 'email and messageId are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const currentLabel = await getEmailLabel(email, messageId);

    return NextResponse.json(
      {
        messageId,
        currentLabel,
        labelInfo: currentLabel ? MOCCET_LABELS[currentLabel] : null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Labels Apply API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get email label' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/gmail/labels/apply
 * Apply a label to an email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, messageId, labelName, threadId } = body;

    if (!email || !messageId || !labelName) {
      return NextResponse.json(
        { error: 'email, messageId, and labelName are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate label name
    if (!VALID_LABELS.includes(labelName as MoccetLabelName)) {
      return NextResponse.json(
        {
          error: `Invalid label name. Valid labels: ${VALID_LABELS.join(', ')}`,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Labels Apply API] Applying ${labelName} to ${messageId}`);

    const result = await applyLabelToEmail(email, messageId, labelName as MoccetLabelName, code, {
      threadId,
      source: 'user',
      reasoning: 'Manually applied by user',
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        messageId,
        labelApplied: labelName,
        labelInfo: MOCCET_LABELS[labelName as MoccetLabelName],
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Labels Apply API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to apply label' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/gmail/labels/apply
 * Remove a label from an email
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const code = searchParams.get('code');
    const messageId = searchParams.get('messageId');
    const labelName = searchParams.get('labelName');

    if (!email || !messageId || !labelName) {
      return NextResponse.json(
        { error: 'email, messageId, and labelName are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate label name
    if (!VALID_LABELS.includes(labelName as MoccetLabelName)) {
      return NextResponse.json(
        { error: `Invalid label name. Valid labels: ${VALID_LABELS.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Labels Apply API] Removing ${labelName} from ${messageId}`);

    const result = await removeLabelFromEmail(email, messageId, labelName as MoccetLabelName, code || undefined);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        messageId,
        labelRemoved: labelName,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Labels Apply API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove label' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
