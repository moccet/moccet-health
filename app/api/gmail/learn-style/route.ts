/**
 * Gmail Style Learning API
 *
 * POST /api/gmail/learn-style
 * Triggers analysis of user's sent emails to learn their writing style.
 *
 * Body: { email?: string, code?: string, forceRelearn?: boolean, maxEmails?: number }
 *
 * GET /api/gmail/learn-style
 * Retrieves the user's learned email style profile.
 *
 * Query: ?email=xxx&code=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { learnEmailStyle, getEmailStyle } from '@/lib/services/email-style-learner';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Extract user email from auth token or request
 */
async function getUserEmail(request: NextRequest): Promise<string | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = createAdminClient();

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        return user.email;
      }
    } catch {
      // Continue to other methods
    }
  }

  return null;
}

/**
 * POST /api/gmail/learn-style
 * Learn user's email writing style from their sent emails
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, forceRelearn, maxEmails } = body;

    // Get user email from auth or request body
    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[LearnStyle API] Starting style learning for ${userEmail}`);

    // Learn the style
    const result = await learnEmailStyle(userEmail, code, {
      forceRelearn: forceRelearn ?? false,
      maxEmails: maxEmails ?? 200,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          emailsAnalyzed: result.emailsAnalyzed,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile: result.profile,
        emailsAnalyzed: result.emailsAnalyzed,
        message: `Successfully analyzed ${result.emailsAnalyzed} emails`,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[LearnStyle API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to learn email style' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/gmail/learn-style
 * Retrieve user's learned email style profile
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const code = searchParams.get('code');

    // Get user email from auth or query params
    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get existing style
    const profile = await getEmailStyle(userEmail, code || undefined);

    if (!profile) {
      return NextResponse.json(
        {
          exists: false,
          message: 'No email style profile found. Use POST to learn style.',
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        exists: true,
        profile,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[LearnStyle API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve email style' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
