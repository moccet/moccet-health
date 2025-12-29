/**
 * Outlook Learn Style API
 *
 * POST /api/outlook/mail/learn-style
 * Analyzes user's sent emails to learn their writing style.
 * Used for generating drafts that match user's tone and patterns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { learnOutlookEmailStyle, getEmailStyle } from '@/lib/services/outlook-style-learner';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/outlook/mail/learn-style
 * Check if style has been learned
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const code = searchParams.get('code');

    if (!email) {
      return NextResponse.json(
        { error: 'email parameter is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const style = await getEmailStyle(email, code || undefined);

    return NextResponse.json(
      {
        hasStyle: !!style,
        emailsAnalyzed: style?.sampleEmailsAnalyzed || 0,
        confidenceScore: style?.confidenceScore || 0,
        verbosityLevel: style?.verbosityLevel || null,
        toneProfile: style?.toneProfile || null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Learn Style API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check style status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/outlook/mail/learn-style
 * Learn user's email writing style from sent emails
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, maxEmails = 200, forceRelearn = false } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Outlook Learn Style API] Learning style for ${email} (max: ${maxEmails}, force: ${forceRelearn})`);

    const result = await learnOutlookEmailStyle(email, code, {
      forceRelearn,
      maxEmails,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          emailsAnalyzed: result.emailsAnalyzed,
        },
        { status: result.error?.includes('authenticate') ? 401 : 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        emailsAnalyzed: result.emailsAnalyzed,
        profile: {
          greetingPatterns: result.profile?.greetingPatterns,
          signoffPatterns: result.profile?.signoffPatterns,
          verbosityLevel: result.profile?.verbosityLevel,
          toneProfile: result.profile?.toneProfile,
          confidenceScore: result.profile?.confidenceScore,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Learn Style API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to learn style' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
