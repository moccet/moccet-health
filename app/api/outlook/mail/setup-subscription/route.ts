/**
 * Outlook Mail Subscription Setup API
 *
 * POST /api/outlook/mail/setup-subscription
 * Creates a Microsoft Graph subscription to receive real-time email notifications.
 *
 * GET /api/outlook/mail/setup-subscription
 * Check subscription status.
 *
 * DELETE /api/outlook/mail/setup-subscription
 * Delete the subscription.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createValidatedOutlookMailClient } from '@/lib/services/outlook-mail-client';
import crypto from 'crypto';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/outlook/mail/setup-subscription
 * Check subscription status
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

    const supabase = createAdminClient();

    const { data: subscription } = await supabase
      .from('outlook_subscriptions')
      .select('*')
      .eq('user_email', email)
      .maybeSingle();

    if (!subscription) {
      return NextResponse.json(
        {
          hasSubscription: false,
          isActive: false,
        },
        { headers: corsHeaders }
      );
    }

    const isExpired = subscription.expiration_datetime
      ? new Date(subscription.expiration_datetime) < new Date()
      : true;

    return NextResponse.json(
      {
        hasSubscription: true,
        isActive: subscription.is_active && !isExpired,
        subscriptionId: subscription.subscription_id,
        expiresAt: subscription.expiration_datetime,
        lastNotification: subscription.last_notification_at,
        notificationCount: subscription.notification_count,
        isExpired,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Subscription] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/outlook/mail/setup-subscription
 * Create or renew a Microsoft Graph subscription
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

    console.log(`[Outlook Subscription] Setting up subscription for ${email}`);

    const supabase = createAdminClient();

    // Create Outlook client
    const { client, error: clientError } = await createValidatedOutlookMailClient(email, code);
    if (!client) {
      return NextResponse.json(
        { error: clientError || 'Failed to connect to Outlook' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Check for existing subscription
    const { data: existingSubscription } = await supabase
      .from('outlook_subscriptions')
      .select('*')
      .eq('user_email', email)
      .maybeSingle();

    // Generate webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';
    const notificationUrl = `${baseUrl}/api/outlook/mail/webhook`;

    // Generate client state for validation
    const clientState = crypto.randomBytes(32).toString('hex');

    let subscriptionId: string;
    let expirationDateTime: string;

    if (existingSubscription?.subscription_id) {
      // Try to renew existing subscription
      try {
        const renewed = await client.renewSubscription(existingSubscription.subscription_id);
        subscriptionId = renewed.id;
        expirationDateTime = renewed.expirationDateTime;
        console.log(`[Outlook Subscription] Renewed existing subscription: ${subscriptionId}`);
      } catch (renewError) {
        // Subscription might be expired/deleted, create new one
        console.log(`[Outlook Subscription] Failed to renew, creating new subscription`);
        const created = await client.createSubscription(notificationUrl, clientState);
        subscriptionId = created.id;
        expirationDateTime = created.expirationDateTime;
      }
    } else {
      // Create new subscription
      const created = await client.createSubscription(notificationUrl, clientState);
      subscriptionId = created.id;
      expirationDateTime = created.expirationDateTime;
      console.log(`[Outlook Subscription] Created new subscription: ${subscriptionId}`);
    }

    // Store/update subscription in database
    await supabase.from('outlook_subscriptions').upsert(
      {
        user_email: email,
        user_code: code || null,
        subscription_id: subscriptionId,
        resource: '/me/mailFolders/inbox/messages',
        change_types: ['created', 'updated'],
        notification_url: notificationUrl,
        client_state: clientState,
        expiration_datetime: expirationDateTime,
        is_active: true,
        renewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' }
    );

    return NextResponse.json(
      {
        success: true,
        subscriptionId,
        expiration: expirationDateTime,
        message: 'Subscription created successfully',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Subscription] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to setup subscription' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/outlook/mail/setup-subscription
 * Delete subscription
 */
export async function DELETE(request: NextRequest) {
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

    console.log(`[Outlook Subscription] Deleting subscription for ${email}`);

    const supabase = createAdminClient();

    // Get existing subscription
    const { data: subscription } = await supabase
      .from('outlook_subscriptions')
      .select('subscription_id')
      .eq('user_email', email)
      .maybeSingle();

    if (subscription?.subscription_id) {
      // Try to delete from Microsoft Graph
      const { client } = await createValidatedOutlookMailClient(email, code || undefined);
      if (client) {
        try {
          await client.deleteSubscription(subscription.subscription_id);
        } catch (e) {
          console.warn('[Outlook Subscription] Failed to delete from Graph:', e);
        }
      }
    }

    // Mark as inactive in database
    await supabase
      .from('outlook_subscriptions')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_email', email);

    return NextResponse.json(
      {
        success: true,
        message: 'Subscription deleted',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Subscription] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
