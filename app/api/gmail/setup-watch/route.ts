/**
 * Gmail Watch Setup API
 *
 * POST /api/gmail/setup-watch
 * Setup Gmail push notifications for real-time email monitoring.
 *
 * GET /api/gmail/setup-watch
 * Get current watch subscription status.
 *
 * DELETE /api/gmail/setup-watch
 * Stop Gmail push notifications.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  setupGmailWatch,
  stopGmailWatch,
  getWatchSubscription,
} from '@/lib/services/gmail-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getUserEmail(request: NextRequest): Promise<string | null> {
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
      // Continue
    }
  }
  return null;
}

/**
 * POST /api/gmail/setup-watch
 * Setup Gmail push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, labelIds } = body;

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

    console.log(`[SetupWatch API] Setting up watch for ${userEmail}`);

    const result = await setupGmailWatch(userEmail, code, labelIds);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        historyId: result.historyId,
        expiration: result.expiration?.toISOString(),
        message: 'Gmail push notifications enabled',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[SetupWatch API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to setup Gmail watch' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/gmail/setup-watch
 * Get current watch subscription status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

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

    const subscription = await getWatchSubscription(userEmail);

    if (!subscription) {
      return NextResponse.json(
        {
          active: false,
          message: 'No active Gmail watch subscription',
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        active: subscription.isActive,
        historyId: subscription.historyId,
        expiration: subscription.expiration.toISOString(),
        lastNotificationAt: subscription.lastNotificationAt?.toISOString(),
        notificationCount: subscription.notificationCount,
        expiresIn: Math.max(0, subscription.expiration.getTime() - Date.now()),
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[SetupWatch API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get watch status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/gmail/setup-watch
 * Stop Gmail push notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const code = searchParams.get('code');

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

    const result = await stopGmailWatch(userEmail, code || undefined);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Gmail push notifications disabled',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[SetupWatch API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to stop Gmail watch' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
