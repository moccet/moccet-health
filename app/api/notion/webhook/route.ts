import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Notion Webhook Receiver
 *
 * Setup Instructions:
 * 1. Go to https://www.notion.so/my-integrations
 * 2. Select your integration
 * 3. Navigate to the "Webhooks" tab
 * 4. Click "+ Create a subscription"
 * 5. Enter URL: https://www.moccet.ai/api/notion/webhook
 * 6. Select events: page.content_updated, page.created, etc.
 * 7. Notion will send a verification_token - copy it
 * 8. Paste the token in the Notion dashboard to verify
 * 9. Store the token in NOTION_WEBHOOK_SECRET env var for signature verification
 */

export const maxDuration = 30;

// Verify Notion webhook signature
function verifyNotionSignature(
  signature: string | null,
  body: string,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const expectedSignature = createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  // Notion sends signature as v1=<hash>
  const signatureHash = signature.replace('v1=', '');
  return signatureHash === expectedSignature;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.text();
    const signature = request.headers.get('x-notion-signature');

    console.log('[Notion Webhook] Received event');

    // Parse the body
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      console.error('[Notion Webhook] Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle verification token (initial setup)
    if (payload.verification_token) {
      console.log('[Notion Webhook] Received verification token');
      console.log('[Notion Webhook] Token:', payload.verification_token);
      console.log('[Notion Webhook] Copy this token and paste it in Notion dashboard');
      console.log('[Notion Webhook] Then add it to NOTION_WEBHOOK_SECRET env var');

      // Store verification token for later use
      const supabase = createAdminClient();
      await supabase.from('notion_webhook_tokens').upsert({
        id: 'verification',
        token: payload.verification_token as string,
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' }).catch(() => {
        // Table might not exist yet, that's OK
      });

      return NextResponse.json({
        success: true,
        message: 'Verification token received',
        token: payload.verification_token,
      });
    }

    // Verify signature for non-verification requests
    const webhookSecret = process.env.NOTION_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      if (!verifyNotionSignature(signature, body, webhookSecret)) {
        console.error('[Notion Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('[Notion Webhook] Signature verified');
    }

    // Extract event data
    const eventType = payload.type as string;
    const data = payload.data as Record<string, unknown> | undefined;
    const entity = payload.entity as Record<string, unknown> | undefined;

    console.log('[Notion Webhook] Event type:', eventType);

    // Handle different event types
    switch (eventType) {
      case 'page.content_updated':
      case 'page.created':
      case 'page.properties_updated':
        await handlePageEvent(payload);
        break;

      case 'page.deleted':
        await handlePageDeleted(payload);
        break;

      case 'comment.created':
        await handleCommentEvent(payload);
        break;

      case 'database.schema_updated':
      case 'data_source.schema_updated':
        console.log('[Notion Webhook] Database schema updated - may need to re-sync');
        break;

      default:
        console.log(`[Notion Webhook] Unhandled event type: ${eventType}`);
    }

    // Store event for debugging
    const supabase = createAdminClient();
    await supabase.from('notion_webhook_events').insert({
      event_type: eventType,
      payload: payload,
      entity_id: (entity?.id as string) || null,
      processed_at: new Date().toISOString(),
    }).catch((err) => {
      console.error('[Notion Webhook] Error storing event:', err);
    });

    const processingTime = Date.now() - startTime;
    console.log(`[Notion Webhook] Processed in ${processingTime}ms`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notion Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePageEvent(payload: Record<string, unknown>) {
  const entity = payload.entity as Record<string, unknown> | undefined;
  const pageId = entity?.id as string;
  const workspaceId = (payload.authors as Array<{ workspace_id: string }>)?.[0]?.workspace_id;

  if (!pageId) {
    console.log('[Notion Webhook] No page ID in event');
    return;
  }

  console.log(`[Notion Webhook] Page event for ${pageId}`);

  // Find the user by workspace ID and trigger a re-sync
  if (workspaceId) {
    const supabase = createAdminClient();

    // Find user with this Notion workspace
    const { data: tokens } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'notion')
      .contains('metadata', { workspace_id: workspaceId });

    if (tokens && tokens.length > 0) {
      for (const token of tokens) {
        console.log(`[Notion Webhook] Triggering sync for ${token.user_email}`);

        // Trigger fetch-data in background
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/notion/fetch-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: token.user_email }),
        }).catch(err => {
          console.error('[Notion Webhook] Error triggering sync:', err);
        });
      }
    }
  }
}

async function handlePageDeleted(payload: Record<string, unknown>) {
  const entity = payload.entity as Record<string, unknown> | undefined;
  const pageId = entity?.id as string;

  if (!pageId) return;

  console.log(`[Notion Webhook] Page deleted: ${pageId}`);

  // Remove from notion_tasks table
  const supabase = createAdminClient();
  await supabase
    .from('notion_tasks')
    .delete()
    .eq('notion_page_id', pageId)
    .catch(err => {
      console.error('[Notion Webhook] Error deleting task:', err);
    });
}

async function handleCommentEvent(payload: Record<string, unknown>) {
  const entity = payload.entity as Record<string, unknown> | undefined;
  const pageId = (entity?.parent as Record<string, unknown>)?.page_id as string;

  console.log(`[Notion Webhook] Comment on page: ${pageId}`);

  // Could trigger notification or analysis here
}

// Handle GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'notion-webhook',
    timestamp: new Date().toISOString(),
  });
}
