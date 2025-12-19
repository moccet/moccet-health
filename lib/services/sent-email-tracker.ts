/**
 * Sent Email Tracker Service
 *
 * Monitors user's sent emails to track "Awaiting Reply" status.
 * Updates labels when replies are received.
 *
 * @module lib/services/sent-email-tracker
 */

import { google, gmail_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { applyLabelToEmail, getThreadLabel, MoccetLabelName } from '@/lib/services/gmail-label-manager';

// =========================================================================
// TYPES
// =========================================================================

export interface SentEmailInfo {
  messageId: string;
  threadId: string;
  toRecipients: string[];
  ccRecipients?: string[];
  subject: string;
  sentAt: Date;
}

export interface ThreadStatus {
  threadId: string;
  awaitingReply: boolean;
  lastSentAt: Date | null;
  replyReceived: boolean;
  replyReceivedAt: Date | null;
}

// =========================================================================
// GMAIL CLIENT
// =========================================================================

async function createGmailClient(
  userEmail: string,
  userCode?: string
): Promise<gmail_v1.Gmail | null> {
  const { token, error } = await getAccessToken(userEmail, 'gmail', userCode);
  if (!token || error) {
    console.error(`[SentTracker] Failed to get token for ${userEmail}:`, error);
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: token });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// =========================================================================
// SENT EMAIL TRACKING
// =========================================================================

/**
 * Track a sent email for "Awaiting Reply" detection
 * Called when we detect the user has sent an email
 */
export async function trackSentEmail(
  userEmail: string,
  messageId: string,
  threadId: string,
  userCode?: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[SentTracker] Tracking sent email ${messageId} in thread ${threadId}`);

  const supabase = createAdminClient();

  try {
    // Fetch email details from Gmail
    const gmail = await createGmailClient(userEmail, userCode);
    if (!gmail) {
      return { success: false, error: 'Failed to authenticate with Gmail' };
    }

    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['To', 'Cc', 'Subject', 'Date'],
    });

    const headers = message.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const toHeader = getHeader('To');
    const ccHeader = getHeader('Cc');
    const subject = getHeader('Subject');
    const dateHeader = getHeader('Date');

    // Parse recipients
    const toRecipients = toHeader.split(',').map((e) => e.trim()).filter(Boolean);
    const ccRecipients = ccHeader ? ccHeader.split(',').map((e) => e.trim()).filter(Boolean) : [];
    const sentAt = dateHeader ? new Date(dateHeader) : new Date();

    // Store in database
    const { error: insertError } = await supabase.from('sent_email_tracking').upsert(
      {
        user_email: userEmail,
        user_code: userCode || null,
        message_id: messageId,
        thread_id: threadId,
        to_recipients: toRecipients,
        cc_recipients: ccRecipients,
        subject,
        awaiting_reply: true,
        reply_received: false,
        sent_at: sentAt.toISOString(),
      },
      { onConflict: 'user_email,message_id' }
    );

    if (insertError) {
      console.error('[SentTracker] Failed to store sent email:', insertError);
      return { success: false, error: insertError.message };
    }

    // Get all messages in the thread to update labels on all of them
    const thread = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'minimal',
    });

    const allMessageIds = thread.data.messages?.map(m => m.id).filter(Boolean) as string[] || [];
    console.log(`[SentTracker] Updating labels for ${allMessageIds.length} messages in thread ${threadId}`);

    // Apply "Awaiting Reply" label to ALL messages in the thread
    // This also removes "to_respond" and other Moccet labels
    for (const msgId of allMessageIds) {
      await applyLabelToEmail(userEmail, msgId, 'awaiting_reply', userCode, {
        threadId,
        subject,
        source: 'sent_tracking',
        reasoning: 'User replied to thread, now awaiting reply',
      });
    }

    console.log(`[SentTracker] Tracked sent email ${messageId}, updated ${allMessageIds.length} messages to awaiting_reply`);
    return { success: true };
  } catch (error: any) {
    console.error('[SentTracker] Error tracking sent email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a thread has a pending "Awaiting Reply" status
 */
export async function isAwaitingReply(
  userEmail: string,
  threadId: string
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('sent_email_tracking')
    .select('awaiting_reply')
    .eq('user_email', userEmail)
    .eq('thread_id', threadId)
    .eq('awaiting_reply', true)
    .limit(1)
    .maybeSingle();

  return !!data;
}

/**
 * Mark a thread as having received a reply
 * Called when an incoming email matches a tracked thread
 */
export async function markReplyReceived(
  userEmail: string,
  threadId: string,
  replyMessageId: string
): Promise<{ success: boolean; wasAwaiting: boolean }> {
  const supabase = createAdminClient();

  // Check if we were tracking this thread
  const { data: tracked } = await supabase
    .from('sent_email_tracking')
    .select('id, awaiting_reply')
    .eq('user_email', userEmail)
    .eq('thread_id', threadId)
    .eq('awaiting_reply', true)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tracked || !tracked.awaiting_reply) {
    return { success: true, wasAwaiting: false };
  }

  // Update the record
  const { error } = await supabase
    .from('sent_email_tracking')
    .update({
      awaiting_reply: false,
      reply_received: true,
      reply_received_at: new Date().toISOString(),
      reply_message_id: replyMessageId,
    })
    .eq('id', tracked.id);

  if (error) {
    console.error('[SentTracker] Failed to mark reply received:', error);
    return { success: false, wasAwaiting: true };
  }

  console.log(`[SentTracker] Marked reply received for thread ${threadId}`);
  return { success: true, wasAwaiting: true };
}

/**
 * Get thread status for tracking
 */
export async function getThreadStatus(
  userEmail: string,
  threadId: string
): Promise<ThreadStatus | null> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('sent_email_tracking')
    .select('*')
    .eq('user_email', userEmail)
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    threadId: data.thread_id,
    awaitingReply: data.awaiting_reply,
    lastSentAt: data.sent_at ? new Date(data.sent_at) : null,
    replyReceived: data.reply_received,
    replyReceivedAt: data.reply_received_at ? new Date(data.reply_received_at) : null,
  };
}

/**
 * Process a sent message from webhook
 * Called when we detect a new message in the SENT folder
 */
export async function processSentMessage(
  userEmail: string,
  messageId: string,
  threadId: string,
  userCode?: string
): Promise<void> {
  console.log(`[SentTracker] Processing sent message ${messageId}`);

  // Track the sent email
  await trackSentEmail(userEmail, messageId, threadId, userCode);
}

/**
 * Process an incoming message to check for reply status update
 * Returns the recommended label change if this is a reply to a tracked thread
 */
export async function processIncomingForReplyTracking(
  userEmail: string,
  messageId: string,
  threadId: string,
  userCode?: string
): Promise<{ wasAwaiting: boolean; suggestedLabel?: MoccetLabelName }> {
  // Check if this thread was awaiting reply
  const wasAwaiting = await isAwaitingReply(userEmail, threadId);

  if (!wasAwaiting) {
    return { wasAwaiting: false };
  }

  // Mark reply received
  await markReplyReceived(userEmail, threadId, messageId);

  // The incoming message classifier will determine the new label
  // but we indicate that this was a reply to a tracked thread
  return { wasAwaiting: true };
}

/**
 * Get all threads currently awaiting reply for a user
 */
export async function getAwaitingReplyThreads(
  userEmail: string,
  limit: number = 50
): Promise<ThreadStatus[]> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('sent_email_tracking')
    .select('thread_id, awaiting_reply, sent_at, reply_received, reply_received_at')
    .eq('user_email', userEmail)
    .eq('awaiting_reply', true)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (!data) {
    return [];
  }

  return data.map((d) => ({
    threadId: d.thread_id,
    awaitingReply: d.awaiting_reply,
    lastSentAt: d.sent_at ? new Date(d.sent_at) : null,
    replyReceived: d.reply_received,
    replyReceivedAt: d.reply_received_at ? new Date(d.reply_received_at) : null,
  }));
}
