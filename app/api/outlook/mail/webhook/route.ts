/**
 * Outlook Mail Webhook API
 *
 * POST /api/outlook/mail/webhook
 *
 * Handles Microsoft Graph change notifications for new emails.
 * Microsoft sends notifications when emails are created/updated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createValidatedOutlookMailClient } from '@/lib/services/outlook-mail-client';
import { classifyEmailWithLabeling } from '@/lib/services/email-classifier';
import { runEmailDraftAgent, OriginalEmail } from '@/lib/agents/email-draft-agent';
import { applyCategoryToEmail, MoccetCategoryName } from '@/lib/services/outlook-category-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface ChangeNotification {
  subscriptionId: string;
  clientState: string;
  changeType: string;
  resource: string;
  resourceData?: {
    id?: string;
    '@odata.type'?: string;
    '@odata.id'?: string;
    '@odata.etag'?: string;
  };
  subscriptionExpirationDateTime?: string;
  tenantId?: string;
}

interface NotificationPayload {
  value: ChangeNotification[];
}

/**
 * GET /api/outlook/mail/webhook
 * Handle Microsoft Graph validation requests (sent as GET with validationToken)
 */
export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get('validationToken');

  if (validationToken) {
    console.log('[Outlook Webhook] Responding to GET validation request');
    return new NextResponse(validationToken, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }

  // No validation token - return 200 to prevent errors
  return new NextResponse('Webhook endpoint active', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

/**
 * POST /api/outlook/mail/webhook
 * Handle Microsoft Graph change notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Check for validation token (Microsoft may also send via POST)
    const validationToken = request.nextUrl.searchParams.get('validationToken');

    if (validationToken) {
      console.log('[Outlook Webhook] Responding to POST validation request');
      return new NextResponse(validationToken, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Parse notification payload
    const payload: NotificationPayload = await request.json();
    const notifications = payload.value || [];

    console.log(`[Outlook Webhook] Received ${notifications.length} notifications`);

    const supabase = createAdminClient();

    for (const notification of notifications) {
      const { subscriptionId, clientState, changeType, resourceData } = notification;

      console.log(`[Outlook Webhook] Processing: subscriptionId=${subscriptionId}, changeType=${changeType}`);

      // Validate subscription and get user info
      const { data: subscription } = await supabase
        .from('outlook_subscriptions')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .eq('is_active', true)
        .maybeSingle();

      if (!subscription) {
        console.warn(`[Outlook Webhook] Unknown or inactive subscription: ${subscriptionId}`);
        continue;
      }

      // Validate client state
      if (subscription.client_state !== clientState) {
        console.warn(`[Outlook Webhook] Client state mismatch for subscription: ${subscriptionId}`);
        continue;
      }

      const userEmail = subscription.user_email;
      const userCode = subscription.user_code;

      // Update notification count
      await supabase
        .from('outlook_subscriptions')
        .update({
          last_notification_at: new Date().toISOString(),
          notification_count: (subscription.notification_count || 0) + 1,
          consecutive_errors: 0,
        })
        .eq('id', subscription.id);

      // Only process created/updated messages
      if (!['created', 'updated'].includes(changeType)) {
        console.log(`[Outlook Webhook] Skipping changeType: ${changeType}`);
        continue;
      }

      // Extract message ID from resource or resourceData
      const messageId = resourceData?.id || notification.resource?.split('/').pop();
      if (!messageId) {
        console.warn('[Outlook Webhook] No message ID in notification');
        continue;
      }

      // Check user settings
      const { data: settings } = await supabase
        .from('email_draft_settings')
        .select('*')
        .eq('user_email', userEmail)
        .maybeSingle();

      if (!settings?.outlook_auto_draft_enabled) {
        console.log(`[Outlook Webhook] Auto-drafting disabled for ${userEmail}`);
        continue;
      }

      // Process the email
      try {
        await processNewEmail(userEmail, userCode, messageId, settings);
      } catch (error) {
        console.error(`[Outlook Webhook] Error processing email ${messageId}:`, error);

        // Update error tracking
        await supabase
          .from('outlook_subscriptions')
          .update({
            last_error: error instanceof Error ? error.message : 'Unknown error',
            last_error_at: new Date().toISOString(),
            consecutive_errors: (subscription.consecutive_errors || 0) + 1,
          })
          .eq('id', subscription.id);
      }
    }

    // Microsoft expects 202 Accepted for successful processing
    return new NextResponse(null, { status: 202 });
  } catch (error) {
    console.error('[Outlook Webhook] Error:', error);
    // Still return 202 to prevent Microsoft from retrying
    return new NextResponse(null, { status: 202 });
  }
}

/**
 * Process a new email notification
 */
async function processNewEmail(
  userEmail: string,
  userCode: string | null,
  messageId: string,
  settings: Record<string, unknown>
): Promise<void> {
  console.log(`[Outlook Webhook] Processing email ${messageId} for ${userEmail}`);

  // Create Outlook client
  const { client, error } = await createValidatedOutlookMailClient(userEmail, userCode || undefined);
  if (!client) {
    throw new Error(error || 'Failed to create Outlook client');
  }

  // Fetch full email
  const email = await client.getEmail(messageId);

  // Skip if not unread
  if (email.isRead) {
    console.log(`[Outlook Webhook] Skipping read email: ${messageId}`);
    return;
  }

  // Skip drafts
  if (email.isDraft) {
    console.log(`[Outlook Webhook] Skipping draft: ${messageId}`);
    return;
  }

  const fromAddress = email.from?.emailAddress?.address || '';
  const fromName = email.from?.emailAddress?.name;

  // Skip if from self
  if (fromAddress.toLowerCase() === userEmail.toLowerCase()) {
    console.log(`[Outlook Webhook] Skipping self-email: ${fromAddress}`);
    return;
  }

  // Check excluded senders/domains
  const excludedSenders = (settings.excluded_senders as string[]) || [];
  const excludedDomains = (settings.excluded_domains as string[]) || [];
  const fromLower = fromAddress.toLowerCase();

  const isExcluded = excludedSenders.some((s: string) => fromLower.includes(s.toLowerCase())) ||
    (fromAddress.includes('@') && excludedDomains.some((d: string) =>
      fromLower.split('@')[1]?.includes(d.toLowerCase())
    ));

  if (isExcluded) {
    console.log(`[Outlook Webhook] Excluded sender: ${fromAddress}`);
    return;
  }

  // Extract body text
  let body = email.body?.content || '';
  if (email.body?.contentType === 'html') {
    body = body
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Build email object for classification
  const emailData: OriginalEmail = {
    messageId: email.id,
    threadId: email.conversationId || '',
    from: fromAddress,
    fromName,
    to: email.toRecipients?.map(r => r.emailAddress?.address).filter(Boolean).join(', ') || '',
    subject: email.subject || '',
    body: body.trim(),
    snippet: email.bodyPreview || undefined,
    labels: email.categories || [],
    receivedAt: new Date(email.receivedDateTime),
  };

  // Classify email
  const classification = await classifyEmailWithLabeling({
    ...emailData,
    isUnread: true,
  });

  console.log(`[Outlook Webhook] Classified ${messageId} as ${classification.moccetLabel}`);

  // Apply category
  const categoryResult = await applyCategoryToEmail(
    userEmail,
    messageId,
    classification.moccetLabel as MoccetCategoryName,
    userCode || undefined,
    {
      from: fromAddress,
      subject: email.subject || '',
      conversationId: email.conversationId || '',
      source: classification.labelSource,
      confidence: classification.confidence,
      reasoning: classification.labelReasoning,
    }
  );

  if (!categoryResult.success) {
    console.error(`[Outlook Webhook] Failed to apply category: ${categoryResult.error}`);
  }

  // Generate draft if needed
  if (classification.needsResponse) {
    console.log(`[Outlook Webhook] Running draft agent for ${messageId}`);

    const draftResult = await runEmailDraftAgent(
      userEmail,
      emailData,
      userCode || undefined,
      classification,
      'outlook'
    );

    if (draftResult.success) {
      console.log(`[Outlook Webhook] Draft created for ${messageId}`);
    } else if (draftResult.skipped) {
      console.log(`[Outlook Webhook] Draft skipped for ${messageId}: ${draftResult.reasoning?.join(', ')}`);
    } else {
      console.error(`[Outlook Webhook] Draft failed for ${messageId}: ${draftResult.error}`);
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
