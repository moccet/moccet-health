/**
 * Gmail Push Notification Service
 *
 * Handles setup and management of Gmail push notifications via Google Pub/Sub.
 * Gmail watch() expires after 7 days, so this service also handles renewal.
 *
 * @module lib/services/gmail-push
 */

import { gmail_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { createValidatedGmailClient } from '@/lib/services/gmail-client';

// =========================================================================
// TYPES
// =========================================================================

export interface WatchResult {
  success: boolean;
  historyId?: string;
  expiration?: Date;
  error?: string;
}

export interface WatchSubscription {
  id: string;
  userEmail: string;
  userCode?: string;
  historyId: string;
  expiration: Date;
  topicName: string;
  isActive: boolean;
  lastNotificationAt?: Date;
  notificationCount: number;
}

export interface HistoryChange {
  messageId: string;
  threadId: string;
  labelIds: string[];
  action: 'messageAdded' | 'messageDeleted' | 'labelAdded' | 'labelRemoved';
}

// =========================================================================
// CONFIGURATION
// =========================================================================

// Gmail Pub/Sub topic - must be created in Google Cloud Console
// Format: projects/{project-id}/topics/{topic-name}
const PUBSUB_TOPIC = process.env.GMAIL_PUBSUB_TOPIC || 'projects/moccet-bdae2/topics/gmail-notifications';

// Watch expiration is 7 days, renew 1 day before
const WATCH_RENEWAL_BUFFER_MS = 24 * 60 * 60 * 1000; // 1 day

// =========================================================================
// GMAIL CLIENT
// =========================================================================

async function createGmailClient(
  userEmail: string,
  userCode?: string
): Promise<gmail_v1.Gmail | null> {
  console.log(`[GmailPush] Creating Gmail client for ${userEmail} (code: ${userCode || 'none'})`);

  // Use validated client to ensure token actually works
  // This will automatically refresh if the token is invalid
  const { gmail, error, wasRefreshed } = await createValidatedGmailClient(userEmail, userCode);

  if (!gmail) {
    console.error(`[GmailPush] Failed to get Gmail client for ${userEmail}:`, error);
    console.error(`[GmailPush] This usually means: 1) Token expired and refresh failed, 2) Token not found for this email/code`);
    return null;
  }

  if (wasRefreshed) {
    console.log(`[GmailPush] Token was auto-refreshed for ${userEmail}`);
  }

  return gmail;
}

// =========================================================================
// WATCH MANAGEMENT
// =========================================================================

/**
 * Setup Gmail push notifications for a user
 *
 * @param userEmail - User's email address
 * @param userCode - Optional user code
 * @param labelIds - Gmail labels to watch (default: INBOX and SENT for reply tracking)
 * @returns Watch result with historyId and expiration
 */
export async function setupGmailWatch(
  userEmail: string,
  userCode?: string,
  labelIds: string[] = ['INBOX', 'SENT']
): Promise<WatchResult> {
  console.log(`[GmailPush] Setting up watch for ${userEmail}`);

  const gmail = await createGmailClient(userEmail, userCode);
  if (!gmail) {
    return { success: false, error: 'Failed to authenticate with Gmail' };
  }

  try {
    // Call Gmail watch API
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: PUBSUB_TOPIC,
        labelIds,
        labelFilterBehavior: 'include',
      },
    });

    const historyId = response.data.historyId;
    const expiration = response.data.expiration
      ? new Date(parseInt(response.data.expiration))
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    console.log(`[GmailPush] Watch created: historyId=${historyId}, expires=${expiration}`);

    // Store subscription in database
    await storeWatchSubscription(userEmail, historyId!, expiration, userCode, labelIds);

    return {
      success: true,
      historyId: historyId!,
      expiration,
    };
  } catch (error: any) {
    console.error('[GmailPush] Watch setup failed:', error);

    // Check for specific errors
    if (error.code === 400 && error.message?.includes('topicName')) {
      return {
        success: false,
        error: 'Pub/Sub topic not configured correctly. Please check GMAIL_PUBSUB_TOPIC.',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to setup Gmail watch',
    };
  }
}

/**
 * Stop Gmail push notifications for a user
 */
export async function stopGmailWatch(
  userEmail: string,
  userCode?: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[GmailPush] Stopping watch for ${userEmail}`);

  const gmail = await createGmailClient(userEmail, userCode);
  if (!gmail) {
    return { success: false, error: 'Failed to authenticate with Gmail' };
  }

  try {
    await gmail.users.stop({
      userId: 'me',
    });

    // Update database
    await deactivateWatchSubscription(userEmail);

    return { success: true };
  } catch (error: any) {
    console.error('[GmailPush] Watch stop failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Renew Gmail watch if expiring soon
 */
export async function renewWatchIfNeeded(
  userEmail: string,
  userCode?: string
): Promise<WatchResult | null> {
  const subscription = await getWatchSubscription(userEmail);

  if (!subscription || !subscription.isActive) {
    return null;
  }

  const timeUntilExpiry = subscription.expiration.getTime() - Date.now();

  if (timeUntilExpiry <= WATCH_RENEWAL_BUFFER_MS) {
    console.log(`[GmailPush] Renewing watch for ${userEmail} (expires in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes)`);
    return setupGmailWatch(userEmail, userCode);
  }

  return null;
}

// =========================================================================
// HISTORY PROCESSING
// =========================================================================

/**
 * Get history changes since a given historyId
 * This is called when we receive a push notification
 */
export async function getHistoryChanges(
  userEmail: string,
  startHistoryId: string,
  userCode?: string
): Promise<{
  success: boolean;
  changes: HistoryChange[];
  newHistoryId?: string;
  error?: string;
}> {
  const gmail = await createGmailClient(userEmail, userCode);
  if (!gmail) {
    return { success: false, changes: [], error: 'Failed to authenticate' };
  }

  try {
    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    });

    const changes: HistoryChange[] = [];
    const history = response.data.history || [];

    for (const item of history) {
      // Process added messages
      if (item.messagesAdded) {
        for (const added of item.messagesAdded) {
          if (added.message?.id && added.message?.threadId) {
            changes.push({
              messageId: added.message.id,
              threadId: added.message.threadId,
              labelIds: added.message.labelIds || [],
              action: 'messageAdded',
            });
          }
        }
      }
    }

    return {
      success: true,
      changes,
      newHistoryId: response.data.historyId || undefined,
    };
  } catch (error: any) {
    // Handle historyId too old error
    if (error.code === 404) {
      console.warn('[GmailPush] History ID too old, full sync needed');
      return {
        success: false,
        changes: [],
        error: 'History ID expired. Full sync required.',
      };
    }

    console.error('[GmailPush] History fetch failed:', error);
    return {
      success: false,
      changes: [],
      error: error.message,
    };
  }
}

/**
 * Filter changes to only include new messages needing response
 */
export function filterNewInboxMessages(changes: HistoryChange[]): HistoryChange[] {
  return changes.filter((change) => {
    // Only messageAdded
    if (change.action !== 'messageAdded') return false;

    // Must be in INBOX
    if (!change.labelIds.includes('INBOX')) return false;

    // Must be UNREAD
    if (!change.labelIds.includes('UNREAD')) return false;

    // Exclude SENT (user's own messages)
    if (change.labelIds.includes('SENT')) return false;

    // Exclude SPAM
    if (change.labelIds.includes('SPAM')) return false;

    // Exclude TRASH
    if (change.labelIds.includes('TRASH')) return false;

    return true;
  });
}

/**
 * Filter changes to only include sent messages (user's outgoing emails)
 * Used for tracking "Awaiting Reply" status
 */
export function filterSentMessages(changes: HistoryChange[]): HistoryChange[] {
  return changes.filter((change) => {
    // Only messageAdded
    if (change.action !== 'messageAdded') return false;

    // Must be in SENT
    if (!change.labelIds.includes('SENT')) return false;

    // Exclude DRAFT (not actually sent yet)
    if (change.labelIds.includes('DRAFT')) return false;

    // Exclude TRASH
    if (change.labelIds.includes('TRASH')) return false;

    return true;
  });
}

// =========================================================================
// DATABASE OPERATIONS
// =========================================================================

async function storeWatchSubscription(
  userEmail: string,
  historyId: string,
  expiration: Date,
  userCode?: string,
  labelIds: string[] = ['INBOX']
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('gmail_watch_subscriptions').upsert(
    {
      user_email: userEmail,
      user_code: userCode || null,
      history_id: historyId,
      expiration_timestamp: expiration.toISOString(),
      topic_name: PUBSUB_TOPIC,
      label_ids: labelIds,
      is_active: true,
      renewed_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_email',
    }
  );

  if (error) {
    console.error('[GmailPush] Failed to store subscription:', error);
    throw error;
  }
}

async function deactivateWatchSubscription(userEmail: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('gmail_watch_subscriptions')
    .update({ is_active: false })
    .eq('user_email', userEmail);
}

export async function getWatchSubscription(
  userEmail: string
): Promise<WatchSubscription | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('gmail_watch_subscriptions')
    .select('*')
    .eq('user_email', userEmail)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    userEmail: data.user_email,
    userCode: data.user_code || undefined,
    historyId: data.history_id,
    expiration: new Date(data.expiration_timestamp),
    topicName: data.topic_name,
    isActive: data.is_active,
    lastNotificationAt: data.last_notification_at
      ? new Date(data.last_notification_at)
      : undefined,
    notificationCount: data.notification_count || 0,
  };
}

export async function updateHistoryId(
  userEmail: string,
  newHistoryId: string
): Promise<void> {
  const supabase = createAdminClient();

  // First get current count, then increment
  const { data: current } = await supabase
    .from('gmail_watch_subscriptions')
    .select('notification_count')
    .eq('user_email', userEmail)
    .single();

  await supabase
    .from('gmail_watch_subscriptions')
    .update({
      history_id: newHistoryId,
      last_notification_at: new Date().toISOString(),
      notification_count: (current?.notification_count || 0) + 1,
    })
    .eq('user_email', userEmail);
}

export async function incrementProcessingStats(
  userEmail: string,
  emailsProcessed: number,
  draftsGenerated: number
): Promise<void> {
  const supabase = createAdminClient();

  await supabase.rpc('increment_gmail_watch_stats', {
    p_user_email: userEmail,
    p_emails_processed: emailsProcessed,
    p_drafts_generated: draftsGenerated,
  });
}

/**
 * Get all active subscriptions that need renewal
 */
export async function getSubscriptionsNeedingRenewal(): Promise<WatchSubscription[]> {
  const supabase = createAdminClient();

  const renewalThreshold = new Date(Date.now() + WATCH_RENEWAL_BUFFER_MS);

  const { data, error } = await supabase
    .from('gmail_watch_subscriptions')
    .select('*')
    .eq('is_active', true)
    .lt('expiration_timestamp', renewalThreshold.toISOString());

  if (error || !data) {
    return [];
  }

  return data.map((d) => ({
    id: d.id,
    userEmail: d.user_email,
    userCode: d.user_code || undefined,
    historyId: d.history_id,
    expiration: new Date(d.expiration_timestamp),
    topicName: d.topic_name,
    isActive: d.is_active,
    lastNotificationAt: d.last_notification_at
      ? new Date(d.last_notification_at)
      : undefined,
    notificationCount: d.notification_count || 0,
  }));
}

/**
 * Renew all expiring subscriptions (called by cron job)
 */
export async function renewAllExpiringSubscriptions(): Promise<{
  renewed: number;
  failed: number;
  errors: string[];
}> {
  const subscriptions = await getSubscriptionsNeedingRenewal();
  let renewed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const sub of subscriptions) {
    const result = await setupGmailWatch(sub.userEmail, sub.userCode);
    if (result.success) {
      renewed++;
    } else {
      failed++;
      errors.push(`${sub.userEmail}: ${result.error}`);
    }
  }

  console.log(`[GmailPush] Renewal complete: ${renewed} renewed, ${failed} failed`);

  return { renewed, failed, errors };
}
