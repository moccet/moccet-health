/**
 * Gmail Push Notification Webhook
 *
 * POST /api/gmail/webhook
 *
 * Receives push notifications from Google Pub/Sub when new emails arrive.
 * Triggers the Email Draft Agent for qualifying emails.
 *
 * IMPORTANT: This endpoint must:
 * 1. Return 200 OK quickly (Pub/Sub retries on failure)
 * 2. Process emails asynchronously to avoid timeout
 * 3. Never mark emails as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { google, gmail_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import {
  getWatchSubscription,
  getHistoryChanges,
  filterNewInboxMessages,
  updateHistoryId,
  HistoryChange,
} from '@/lib/services/gmail-push';
import { classifyEmail, EmailToClassify } from '@/lib/services/email-classifier';
import { runEmailDraftAgent, OriginalEmail } from '@/lib/agents/email-draft-agent';

// =========================================================================
// TYPES
// =========================================================================

interface PubSubMessage {
  message: {
    data: string; // base64 encoded
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

// =========================================================================
// HELPERS
// =========================================================================

async function createGmailClient(
  userEmail: string,
  userCode?: string
): Promise<gmail_v1.Gmail | null> {
  const { token, error } = await getAccessToken(userEmail, 'gmail', userCode);
  if (!token || error) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: token });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch full email content by message ID
 * IMPORTANT: Does NOT mark as read (using format=full)
 */
async function fetchEmailContent(
  gmail: gmail_v1.Gmail,
  messageId: string
): Promise<OriginalEmail | null> {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const headers = response.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    // Extract body
    let body = '';
    const payload = response.data.payload;

    if (payload?.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload?.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        }
      }
    }

    // Parse sender name and email
    const fromHeader = getHeader('from');
    const fromMatch = fromHeader.match(/^(.+?)\s*<(.+)>$/);
    const fromName = fromMatch ? fromMatch[1].replace(/"/g, '') : undefined;
    const fromEmail = fromMatch ? fromMatch[2] : fromHeader;

    return {
      messageId: response.data.id!,
      threadId: response.data.threadId!,
      from: fromEmail,
      fromName,
      to: getHeader('to'),
      subject: getHeader('subject'),
      body: body.trim(),
      snippet: response.data.snippet || undefined,
      labels: response.data.labelIds || [],
      receivedAt: new Date(parseInt(response.data.internalDate || '0')),
    };
  } catch (error) {
    console.error(`[Webhook] Failed to fetch email ${messageId}:`, error);
    return null;
  }
}

/**
 * Check if user has auto-drafting enabled
 */
async function getUserDraftSettings(userEmail: string): Promise<{
  enabled: boolean;
  maxDraftsPerDay: number;
  excludedSenders: string[];
  excludedDomains: string[];
}> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_draft_settings')
    .select('auto_draft_enabled, max_drafts_per_day, excluded_senders, excluded_domains')
    .eq('user_email', userEmail)
    .maybeSingle();

  return {
    enabled: data?.auto_draft_enabled ?? true,
    maxDraftsPerDay: data?.max_drafts_per_day ?? 20,
    excludedSenders: data?.excluded_senders ?? [],
    excludedDomains: data?.excluded_domains ?? [],
  };
}

/**
 * Check if user has hit daily draft limit
 */
async function hasHitDailyLimit(userEmail: string, limit: number): Promise<boolean> {
  const supabase = createAdminClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('email_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .gte('created_at', today.toISOString());

  return (count || 0) >= limit;
}

/**
 * Check if sender is excluded
 */
function isSenderExcluded(
  from: string,
  excludedSenders: string[],
  excludedDomains: string[]
): boolean {
  const fromLower = from.toLowerCase();

  // Check exact sender match
  if (excludedSenders.some((s) => fromLower.includes(s.toLowerCase()))) {
    return true;
  }

  // Check domain match
  const domain = fromLower.split('@')[1];
  if (domain && excludedDomains.some((d) => domain.includes(d.toLowerCase()))) {
    return true;
  }

  return false;
}

/**
 * Process a single new email
 */
async function processNewEmail(
  userEmail: string,
  email: OriginalEmail,
  userCode?: string
): Promise<void> {
  console.log(`[Webhook] Processing email: ${email.subject} from ${email.from}`);

  try {
    // Run the draft agent
    const result = await runEmailDraftAgent(userEmail, email, userCode);

    if (result.success) {
      console.log(`[Webhook] Draft created for email ${email.messageId}`);
    } else if (result.skipped) {
      console.log(`[Webhook] Email skipped: ${result.reasoning.join(', ')}`);
    } else {
      console.error(`[Webhook] Draft generation failed: ${result.error}`);
    }
  } catch (error) {
    console.error(`[Webhook] Error processing email ${email.messageId}:`, error);
  }
}

// =========================================================================
// MAIN HANDLER
// =========================================================================

export async function POST(request: NextRequest) {
  console.log('[Webhook] Received push notification');

  try {
    // Parse Pub/Sub message
    const body: PubSubMessage = await request.json();

    if (!body.message?.data) {
      console.warn('[Webhook] No message data in request');
      return NextResponse.json({ success: true }); // Still return 200 to prevent retries
    }

    // Decode notification
    const notificationData = Buffer.from(body.message.data, 'base64').toString('utf-8');
    const notification: GmailNotification = JSON.parse(notificationData);

    const userEmail = notification.emailAddress;
    const notificationHistoryId = notification.historyId;

    console.log(`[Webhook] Notification for ${userEmail}, historyId: ${notificationHistoryId}`);

    // Get user's watch subscription
    const subscription = await getWatchSubscription(userEmail);

    if (!subscription || !subscription.isActive) {
      console.warn(`[Webhook] No active subscription for ${userEmail}`);
      return NextResponse.json({ success: true });
    }

    // Check user settings
    const settings = await getUserDraftSettings(userEmail);

    if (!settings.enabled) {
      console.log(`[Webhook] Auto-drafting disabled for ${userEmail}`);
      return NextResponse.json({ success: true });
    }

    // Check daily limit
    if (await hasHitDailyLimit(userEmail, settings.maxDraftsPerDay)) {
      console.log(`[Webhook] Daily limit reached for ${userEmail}`);
      return NextResponse.json({ success: true });
    }

    // Get history changes since last processed
    const historyResult = await getHistoryChanges(
      userEmail,
      subscription.historyId,
      subscription.userCode
    );

    if (!historyResult.success) {
      console.error(`[Webhook] Failed to get history: ${historyResult.error}`);
      return NextResponse.json({ success: true });
    }

    // Filter to new inbox messages only
    const newMessages = filterNewInboxMessages(historyResult.changes);

    if (newMessages.length === 0) {
      console.log('[Webhook] No new inbox messages to process');

      // Update history ID anyway
      if (historyResult.newHistoryId) {
        await updateHistoryId(userEmail, historyResult.newHistoryId);
      }

      return NextResponse.json({ success: true });
    }

    console.log(`[Webhook] Found ${newMessages.length} new messages to process`);

    // Create Gmail client
    const gmail = await createGmailClient(userEmail, subscription.userCode);

    if (!gmail) {
      console.error(`[Webhook] Failed to create Gmail client for ${userEmail}`);
      return NextResponse.json({ success: true });
    }

    // Process each new message (limit concurrent processing)
    const processingLimit = 3; // Process max 3 emails per notification
    const messagesToProcess = newMessages.slice(0, processingLimit);

    for (const change of messagesToProcess) {
      // Fetch email content
      const email = await fetchEmailContent(gmail, change.messageId);

      if (!email) {
        continue;
      }

      // Check if sender is excluded
      if (isSenderExcluded(email.from, settings.excludedSenders, settings.excludedDomains)) {
        console.log(`[Webhook] Sender excluded: ${email.from}`);
        continue;
      }

      // Process the email (don't await - run in background)
      // Note: In production, you'd want to use a proper queue system
      processNewEmail(userEmail, email, subscription.userCode).catch((err) => {
        console.error(`[Webhook] Background processing error:`, err);
      });
    }

    // Update history ID
    if (historyResult.newHistoryId) {
      await updateHistoryId(userEmail, historyResult.newHistoryId);
    }

    // Return 200 OK immediately (required by Pub/Sub)
    return NextResponse.json({
      success: true,
      processed: messagesToProcess.length,
    });
  } catch (error) {
    console.error('[Webhook] Error processing notification:', error);

    // Still return 200 to prevent Pub/Sub retries for malformed requests
    // Pub/Sub will retry on 4xx/5xx errors
    return NextResponse.json({ success: false, error: 'Internal error' });
  }
}

// Pub/Sub verification endpoint (GET)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Gmail webhook is active',
    timestamp: new Date().toISOString(),
  });
}
