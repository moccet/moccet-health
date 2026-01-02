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
  filterSentMessages,
  updateHistoryId,
  HistoryChange,
} from '@/lib/services/gmail-push';
import { classifyEmailWithLabeling, LabeledEmailClassification } from '@/lib/services/email-classifier';
import { runEmailDraftAgent, OriginalEmail } from '@/lib/agents/email-draft-agent';
import { applyLabelToEmail, hasLabelsSetup, setupUserLabels } from '@/lib/services/gmail-label-manager';
import { processSentMessage, processIncomingForReplyTracking } from '@/lib/services/sent-email-tracker';

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
 * Category preferences from user settings
 */
interface CategoryPreferences {
  moveOut: Record<string, boolean>;
  keepInbox: Record<string, boolean>;
  respectExisting: boolean;
}

/**
 * Check if user has auto-drafting enabled and get category preferences
 */
async function getUserDraftSettings(userEmail: string): Promise<{
  enabled: boolean;
  maxDraftsPerDay: number;
  excludedSenders: string[];
  excludedDomains: string[];
  autoLabelingEnabled: boolean;
  trackSentForAwaitingReply: boolean;
  categoryPreferences: CategoryPreferences | null;
}> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_draft_settings')
    .select('auto_draft_enabled, max_drafts_per_day, excluded_senders, excluded_domains, auto_labeling_enabled, track_sent_for_awaiting_reply, category_preferences')
    .eq('user_email', userEmail)
    .maybeSingle();

  return {
    enabled: data?.auto_draft_enabled ?? true,
    maxDraftsPerDay: data?.max_drafts_per_day ?? 20,
    excludedSenders: data?.excluded_senders ?? [],
    excludedDomains: data?.excluded_domains ?? [],
    autoLabelingEnabled: data?.auto_labeling_enabled ?? true,
    trackSentForAwaitingReply: data?.track_sent_for_awaiting_reply ?? true,
    categoryPreferences: data?.category_preferences as CategoryPreferences | null,
  };
}

/**
 * Check if a label category is enabled based on user preferences
 */
function isLabelEnabled(
  labelName: string,
  preferences: CategoryPreferences | null
): boolean {
  // If no preferences set, all labels are enabled by default
  if (!preferences) return true;

  // Check moveOut categories (meeting_update, marketing)
  if (preferences.moveOut && labelName in preferences.moveOut) {
    return preferences.moveOut[labelName] ?? true;
  }

  // Check keepInbox categories (to_respond, fyi, comment, notifications, awaiting_reply, actioned)
  if (preferences.keepInbox && labelName in preferences.keepInbox) {
    return preferences.keepInbox[labelName] ?? true;
  }

  // Default to enabled for unknown labels
  return true;
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
 * Process a single new email with labeling
 */
async function processNewEmail(
  userEmail: string,
  email: OriginalEmail,
  userCode?: string,
  applyLabel: boolean = true
): Promise<void> {
  console.log(`[Webhook] Processing email: ${email.subject} from ${email.from}`);

  // Skip emails from the user's own email address (BCC'd to self, etc.)
  const fromEmail = email.from.toLowerCase();
  const userEmailLower = userEmail.toLowerCase();
  if (fromEmail.includes(userEmailLower) || userEmailLower.includes(fromEmail.split('@')[0])) {
    console.log(`[Webhook] Skipping self-email: ${email.from}`);
    return;
  }

  try {
    // Get user's category preferences
    const userSettings = await getUserDraftSettings(userEmail);
    const { categoryPreferences } = userSettings;

    // 1. Classify email with label
    const emailToClassify = {
      messageId: email.messageId,
      threadId: email.threadId,
      from: email.from,
      fromName: email.fromName,
      to: email.to,
      subject: email.subject,
      body: email.body,
      snippet: email.snippet,
      labels: email.labels,
      receivedAt: email.receivedAt,
      isUnread: true,
    };

    const classification = await classifyEmailWithLabeling(emailToClassify);

    // 2. Check if this is a reply to a tracked thread (Awaiting Reply)
    const replyTracking = await processIncomingForReplyTracking(
      userEmail,
      email.messageId,
      email.threadId,
      userCode
    );

    // If this was a reply to a tracked thread, the label might need adjustment
    let finalLabel = classification.moccetLabel;
    if (replyTracking.wasAwaiting) {
      console.log(`[Webhook] Reply received for tracked thread ${email.threadId}`);
      // Keep the classification label - it will handle actioned detection
    }

    // 3. Check if the classified label is enabled by user preferences
    const labelEnabled = isLabelEnabled(finalLabel, categoryPreferences);

    // 4. Apply label to Gmail only if enabled and auto-labeling is on
    if (applyLabel && userSettings.autoLabelingEnabled && labelEnabled) {
      const labelResult = await applyLabelToEmail(userEmail, email.messageId, finalLabel, userCode, {
        from: email.from,
        subject: email.subject,
        threadId: email.threadId,
        source: classification.labelSource,
        confidence: classification.confidence,
        reasoning: classification.labelReasoning,
      });

      if (labelResult.success) {
        console.log(`[Webhook] Applied label "${finalLabel}" to ${email.messageId}`);
      } else {
        console.warn(`[Webhook] Failed to apply label: ${labelResult.error}`);
      }
    } else if (!labelEnabled) {
      console.log(`[Webhook] Label "${finalLabel}" is disabled by user preferences, skipping`);
    }

    // 5. Run draft agent if email needs response - pass existing classification to avoid re-classification
    // Only if the category is a "respond" type and is enabled
    if (classification.needsResponse && userSettings.enabled) {
      const result = await runEmailDraftAgent(userEmail, email, userCode, classification);

      if (result.success) {
        console.log(`[Webhook] Draft created for email ${email.messageId}`);
      } else if (result.skipped) {
        console.log(`[Webhook] Email skipped: ${result.reasoning.join(', ')}`);
      } else {
        console.error(`[Webhook] Draft generation failed: ${result.error}`);
      }
    } else {
      console.log(`[Webhook] No response needed or drafts disabled, label: ${finalLabel}`);
    }
  } catch (error) {
    console.error(`[Webhook] Error processing email ${email.messageId}:`, error);
  }
}

/**
 * Process a sent email for "Awaiting Reply" tracking
 */
async function processSentEmail(
  userEmail: string,
  messageId: string,
  threadId: string,
  userCode?: string
): Promise<void> {
  console.log(`[Webhook] Processing sent email ${messageId}`);

  try {
    await processSentMessage(userEmail, messageId, threadId, userCode);
    console.log(`[Webhook] Tracked sent email ${messageId} for reply`);
  } catch (error) {
    console.error(`[Webhook] Error tracking sent email ${messageId}:`, error);
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

    // Get history changes since last processed
    console.log(`[Webhook] Fetching history for ${userEmail} (code: ${subscription.userCode || 'none'}, historyId: ${subscription.historyId})`);
    const historyResult = await getHistoryChanges(
      userEmail,
      subscription.historyId,
      subscription.userCode
    );

    if (!historyResult.success) {
      console.error(`[Webhook] FAILED to get history for ${userEmail} (code: ${subscription.userCode || 'none'}): ${historyResult.error}`);
      console.error(`[Webhook] This likely means the Gmail OAuth token is expired/invalid and refresh failed. User may need to re-authenticate.`);
      return NextResponse.json({ success: true });
    }

    // Filter to new inbox messages and sent messages
    const newInboxMessages = filterNewInboxMessages(historyResult.changes);
    const newSentMessages = settings.trackSentForAwaitingReply
      ? filterSentMessages(historyResult.changes)
      : [];

    if (newInboxMessages.length === 0 && newSentMessages.length === 0) {
      console.log('[Webhook] No new messages to process');

      // Update history ID anyway
      if (historyResult.newHistoryId) {
        await updateHistoryId(userEmail, historyResult.newHistoryId);
      }

      return NextResponse.json({ success: true });
    }

    console.log(
      `[Webhook] Found ${newInboxMessages.length} inbox, ${newSentMessages.length} sent messages`
    );

    // Create Gmail client
    const gmail = await createGmailClient(userEmail, subscription.userCode);

    if (!gmail) {
      console.error(`[Webhook] Failed to create Gmail client for ${userEmail}`);
      return NextResponse.json({ success: true });
    }

    // Ensure labels are set up if labeling is enabled
    if (settings.autoLabelingEnabled) {
      const labelsReady = await hasLabelsSetup(userEmail);
      if (!labelsReady) {
        console.log(`[Webhook] Setting up labels for ${userEmail}`);
        await setupUserLabels(userEmail, subscription.userCode);
      }
    }

    // Process sent messages first (for Awaiting Reply tracking)
    const sentPromises = newSentMessages.slice(0, 5).map((change) =>
      processSentEmail(userEmail, change.messageId, change.threadId, subscription.userCode).catch(
        (err) => console.error(`[Webhook] Sent email tracking error:`, err)
      )
    );
    await Promise.all(sentPromises);

    // Check daily limit for draft generation
    const hitDraftLimit = await hasHitDailyLimit(userEmail, settings.maxDraftsPerDay);

    // Process inbox messages
    const processingLimit = 3;
    const messagesToProcess = newInboxMessages.slice(0, processingLimit);

    // Collect all processing promises to await them
    const processingPromises: Promise<void>[] = [];

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

      // Process the email with labeling - MUST await or Vercel will kill it
      processingPromises.push(
        processNewEmail(
          userEmail,
          email,
          subscription.userCode,
          settings.autoLabelingEnabled
        ).catch((err) => {
          console.error(`[Webhook] Processing error for ${email.messageId}:`, err);
        })
      );
    }

    // Wait for all email processing to complete before returning
    // This is critical - Vercel kills async work after response is sent
    await Promise.all(processingPromises);

    // Update history ID
    if (historyResult.newHistoryId) {
      await updateHistoryId(userEmail, historyResult.newHistoryId);
    }

    // Return 200 OK after processing completes
    return NextResponse.json({
      success: true,
      inboxProcessed: messagesToProcess.length,
      sentTracked: newSentMessages.length,
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
