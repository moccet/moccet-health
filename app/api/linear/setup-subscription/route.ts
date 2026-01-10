import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Linear Webhook Setup
 *
 * Creates a webhook subscription via Linear's GraphQL API.
 * Should be called after OAuth callback to enable real-time updates.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Linear Setup] Creating webhook subscription for ${email}`);

    // Get the stored token
    const tokenResult = await getToken(email, 'linear');
    if (!tokenResult.success || !tokenResult.token) {
      return NextResponse.json(
        { error: 'Linear not connected' },
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = tokenResult.token;

    // Webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/linear/webhook`;

    // Generate a unique label for this subscription
    const subscriptionLabel = `moccet-${email.replace(/[^a-z0-9]/gi, '-').substring(0, 20)}`;

    // Check if webhook already exists
    const existingWebhooksQuery = `
      query {
        webhooks {
          nodes {
            id
            url
            label
            enabled
          }
        }
      }
    `;

    const existingResult = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: existingWebhooksQuery }),
    });

    const existingData = await existingResult.json();
    const existingWebhooks = existingData?.data?.webhooks?.nodes || [];

    // Check if we already have a webhook for this URL
    const existingWebhook = existingWebhooks.find(
      (w: { url: string }) => w.url === webhookUrl
    );

    if (existingWebhook) {
      console.log(`[Linear Setup] Webhook already exists: ${existingWebhook.id}`);

      // Update enabled status if needed
      if (!existingWebhook.enabled) {
        await updateWebhookEnabled(accessToken, existingWebhook.id, true);
      }

      return NextResponse.json({
        success: true,
        webhookId: existingWebhook.id,
        message: 'Webhook already configured',
      }, { headers: corsHeaders });
    }

    // Create new webhook subscription
    const createWebhookMutation = `
      mutation CreateWebhook($input: WebhookCreateInput!) {
        webhookCreate(input: $input) {
          success
          webhook {
            id
            url
            label
            enabled
            secret
            resourceTypes
          }
        }
      }
    `;

    const createResult = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: createWebhookMutation,
        variables: {
          input: {
            url: webhookUrl,
            label: subscriptionLabel,
            resourceTypes: ['Issue', 'Comment', 'Project'],
            enabled: true,
          },
        },
      }),
    });

    const createData = await createResult.json();

    if (createData.errors) {
      console.error('[Linear Setup] GraphQL errors:', createData.errors);
      return NextResponse.json(
        { error: 'Failed to create webhook', details: createData.errors },
        { status: 500, headers: corsHeaders }
      );
    }

    const webhook = createData?.data?.webhookCreate?.webhook;
    const success = createData?.data?.webhookCreate?.success;

    if (!success || !webhook) {
      console.error('[Linear Setup] Webhook creation failed');
      return NextResponse.json(
        { error: 'Failed to create webhook' },
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`[Linear Setup] Webhook created: ${webhook.id}`);

    // Store the webhook secret for signature verification
    if (webhook.secret) {
      const supabase = createAdminClient();
      await supabase.from('linear_webhook_subscriptions').upsert({
        user_email: email,
        webhook_id: webhook.id,
        webhook_url: webhookUrl,
        webhook_secret: webhook.secret,
        resource_types: webhook.resourceTypes,
        is_enabled: webhook.enabled,
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_email' });

      // Also store the secret globally if not set
      // Note: For security, each user should ideally have their own secret
      // But Linear uses a single secret per webhook
      console.log('[Linear Setup] Webhook secret stored');
    }

    return NextResponse.json({
      success: true,
      webhookId: webhook.id,
      message: 'Webhook subscription created',
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Linear Setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to setup webhook' },
      { status: 500, headers: corsHeaders }
    );
  }
}

async function updateWebhookEnabled(
  accessToken: string,
  webhookId: string,
  enabled: boolean
) {
  const mutation = `
    mutation UpdateWebhook($id: String!, $input: WebhookUpdateInput!) {
      webhookUpdate(id: $id, input: $input) {
        success
      }
    }
  `;

  await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: mutation,
      variables: {
        id: webhookId,
        input: { enabled },
      },
    }),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
