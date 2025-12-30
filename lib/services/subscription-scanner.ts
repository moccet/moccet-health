/**
 * Email Subscription Scanner Service
 *
 * Scans emails for List-Unsubscribe headers and groups them by sender.
 * Supports both Gmail and Outlook providers.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createValidatedGmailClient } from '@/lib/services/gmail-client';
import { createValidatedOutlookMailClient } from '@/lib/services/outlook-mail-client';

// =========================================================================
// TYPES
// =========================================================================

export interface UnsubscribeInfo {
  mailto?: string;
  https?: string;
  supportsOneClick: boolean;
}

export interface DetectedSubscription {
  senderDomain: string;
  senderName: string | null;
  senderEmail: string;
  sampleMessageId: string;
  sampleSubject: string;
  unsubscribeInfo: UnsubscribeInfo;
  emailCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface ScanResult {
  success: boolean;
  provider: 'gmail' | 'outlook';
  subscriptionsFound: number;
  emailsScanned: number;
  cached: boolean;
  error?: string;
}

export interface UnifiedScanResult {
  gmail?: ScanResult;
  outlook?: ScanResult;
  summary: {
    totalSubscriptions: number;
    totalScanned: number;
  };
}

export interface ConnectedProviders {
  gmail: boolean;
  outlook: boolean;
  any: boolean;
  both: boolean;
}

// =========================================================================
// HEADER PARSING
// =========================================================================

/**
 * Parse List-Unsubscribe header according to RFC 2369
 * Format: <mailto:unsub@example.com>, <https://example.com/unsub?token=xyz>
 */
export function parseListUnsubscribeHeader(header: string): UnsubscribeInfo {
  const result: UnsubscribeInfo = { supportsOneClick: false };

  if (!header) return result;

  // Extract URLs within angle brackets
  const urlMatches = header.match(/<([^>]+)>/g);

  if (urlMatches) {
    for (const match of urlMatches) {
      const url = match.slice(1, -1); // Remove < and >

      if (url.startsWith('mailto:')) {
        result.mailto = url;
      } else if (url.startsWith('https://') || url.startsWith('http://')) {
        result.https = url;
      }
    }
  }

  return result;
}

/**
 * Check if List-Unsubscribe-Post header indicates one-click support
 */
export function hasOneClickSupport(postHeader: string | null | undefined): boolean {
  if (!postHeader) return false;
  return postHeader.toLowerCase().includes('list-unsubscribe=one-click');
}

/**
 * Extract domain from email address for grouping
 */
export function extractSenderDomain(email: string): string {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase() : email.toLowerCase();
}

// =========================================================================
// GMAIL SCANNER
// =========================================================================

async function scanGmailSubscriptions(
  userEmail: string,
  userCode?: string,
  maxEmails: number = 100
): Promise<{ subscriptions: Map<string, DetectedSubscription>; scanned: number }> {
  const subscriptionMap = new Map<string, DetectedSubscription>();

  const { gmail, error } = await createValidatedGmailClient(userEmail, userCode);
  if (!gmail) {
    throw new Error(error || 'Failed to connect to Gmail');
  }

  // Fetch message IDs from inbox
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults: maxEmails,
    labelIds: ['INBOX'],
  });

  const messages = listResponse.data.messages || [];
  let scanned = 0;

  for (const msg of messages) {
    if (!msg.id) continue;

    try {
      // Fetch message with specific headers
      const messageResponse = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Unsubscribe-Post'],
      });

      scanned++;
      const headers = messageResponse.data.payload?.headers || [];

      // Extract headers into a map
      const headerMap: Record<string, string> = {};
      for (const h of headers) {
        if (h.name && h.value) {
          headerMap[h.name.toLowerCase()] = h.value;
        }
      }

      // Check for List-Unsubscribe header
      const unsubHeader = headerMap['list-unsubscribe'];
      if (!unsubHeader) continue;

      const unsubscribeInfo = parseListUnsubscribeHeader(unsubHeader);
      unsubscribeInfo.supportsOneClick = hasOneClickSupport(headerMap['list-unsubscribe-post']);

      // Skip if no unsubscribe method available
      if (!unsubscribeInfo.mailto && !unsubscribeInfo.https) continue;

      // Extract sender info
      const fromHeader = headerMap['from'] || '';
      const fromMatch = fromHeader.match(/(?:([^<]+)\s*)?<?([^>]+@[^>]+)>?/);
      const senderName = fromMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || null;
      const senderEmail = fromMatch?.[2] || fromHeader;
      const senderDomain = extractSenderDomain(senderEmail);

      const subject = headerMap['subject'] || '';
      const dateHeader = headerMap['date'];
      const emailDate = dateHeader ? new Date(dateHeader) : new Date();

      // Group by sender domain
      const existing = subscriptionMap.get(senderDomain);
      if (existing) {
        existing.emailCount++;
        if (emailDate > existing.lastSeenAt) {
          existing.lastSeenAt = emailDate;
          existing.sampleMessageId = msg.id;
          existing.sampleSubject = subject;
          existing.unsubscribeInfo = unsubscribeInfo; // Use most recent
        }
        if (emailDate < existing.firstSeenAt) {
          existing.firstSeenAt = emailDate;
        }
      } else {
        subscriptionMap.set(senderDomain, {
          senderDomain,
          senderName,
          senderEmail,
          sampleMessageId: msg.id,
          sampleSubject: subject,
          unsubscribeInfo,
          emailCount: 1,
          firstSeenAt: emailDate,
          lastSeenAt: emailDate,
        });
      }
    } catch (err) {
      console.error(`[SubscriptionScanner] Error processing Gmail message ${msg.id}:`, err);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return { subscriptions: subscriptionMap, scanned };
}

// =========================================================================
// OUTLOOK SCANNER
// =========================================================================

async function scanOutlookSubscriptions(
  userEmail: string,
  userCode?: string,
  maxEmails: number = 100
): Promise<{ subscriptions: Map<string, DetectedSubscription>; scanned: number }> {
  const subscriptionMap = new Map<string, DetectedSubscription>();

  const { client, error } = await createValidatedOutlookMailClient(userEmail, userCode);
  if (!client) {
    throw new Error(error || 'Failed to connect to Outlook');
  }

  // Fetch messages with internet headers
  const response = await client.getInboxEmails({
    maxResults: maxEmails,
    select: ['id', 'from', 'subject', 'receivedDateTime', 'internetMessageHeaders'],
  });

  const messages = response.value || [];
  let scanned = 0;

  for (const msg of messages) {
    if (!msg.id) continue;
    scanned++;

    try {
      // internetMessageHeaders is an array of {name, value} objects
      const headers = (msg as any).internetMessageHeaders || [];

      // Find List-Unsubscribe headers
      let unsubHeader = '';
      let unsubPostHeader = '';

      for (const h of headers) {
        const name = h.name?.toLowerCase();
        if (name === 'list-unsubscribe') {
          unsubHeader = h.value;
        } else if (name === 'list-unsubscribe-post') {
          unsubPostHeader = h.value;
        }
      }

      if (!unsubHeader) continue;

      const unsubscribeInfo = parseListUnsubscribeHeader(unsubHeader);
      unsubscribeInfo.supportsOneClick = hasOneClickSupport(unsubPostHeader);

      if (!unsubscribeInfo.mailto && !unsubscribeInfo.https) continue;

      // Extract sender info
      const senderEmail = msg.from?.emailAddress?.address || '';
      const senderName = msg.from?.emailAddress?.name || null;
      const senderDomain = extractSenderDomain(senderEmail);

      const subject = msg.subject || '';
      const emailDate = new Date(msg.receivedDateTime);

      // Group by sender domain
      const existing = subscriptionMap.get(senderDomain);
      if (existing) {
        existing.emailCount++;
        if (emailDate > existing.lastSeenAt) {
          existing.lastSeenAt = emailDate;
          existing.sampleMessageId = msg.id;
          existing.sampleSubject = subject;
          existing.unsubscribeInfo = unsubscribeInfo;
        }
        if (emailDate < existing.firstSeenAt) {
          existing.firstSeenAt = emailDate;
        }
      } else {
        subscriptionMap.set(senderDomain, {
          senderDomain,
          senderName,
          senderEmail,
          sampleMessageId: msg.id,
          sampleSubject: subject,
          unsubscribeInfo,
          emailCount: 1,
          firstSeenAt: emailDate,
          lastSeenAt: emailDate,
        });
      }
    } catch (err) {
      console.error(`[SubscriptionScanner] Error processing Outlook message ${msg.id}:`, err);
    }
  }

  return { subscriptions: subscriptionMap, scanned };
}

// =========================================================================
// DATABASE OPERATIONS
// =========================================================================

/**
 * Check if scan cache is still valid (less than 1 hour old)
 */
async function isScanCacheValid(
  userEmail: string,
  provider: 'gmail' | 'outlook'
): Promise<boolean> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_subscriptions')
    .select('last_scanned_at')
    .eq('user_email', userEmail)
    .eq('email_provider', provider)
    .order('last_scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.last_scanned_at) return false;

  const lastScan = new Date(data.last_scanned_at);
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  return lastScan > hourAgo;
}

/**
 * Save detected subscriptions to database
 */
async function saveSubscriptions(
  userEmail: string,
  provider: 'gmail' | 'outlook',
  subscriptions: Map<string, DetectedSubscription>,
  userCode?: string
): Promise<void> {
  const supabase = createAdminClient();

  for (const [domain, sub] of subscriptions) {
    await supabase.from('email_subscriptions').upsert(
      {
        user_email: userEmail,
        user_code: userCode || null,
        email_provider: provider,
        sender_domain: sub.senderDomain,
        sender_name: sub.senderName,
        sender_email: sub.senderEmail,
        sample_message_id: sub.sampleMessageId,
        sample_subject: sub.sampleSubject,
        unsubscribe_mailto: sub.unsubscribeInfo.mailto || null,
        unsubscribe_https: sub.unsubscribeInfo.https || null,
        supports_one_click: sub.unsubscribeInfo.supportsOneClick,
        email_count: sub.emailCount,
        first_seen_at: sub.firstSeenAt.toISOString(),
        last_seen_at: sub.lastSeenAt.toISOString(),
        last_scanned_at: new Date().toISOString(),
      },
      { onConflict: 'user_email,email_provider,sender_domain' }
    );
  }
}

/**
 * Get cached subscriptions from database
 */
export async function getCachedSubscriptions(
  userEmail: string,
  provider?: 'gmail' | 'outlook'
): Promise<any[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from('email_subscriptions')
    .select('*')
    .eq('user_email', userEmail)
    .eq('status', 'active')
    .order('email_count', { ascending: false });

  if (provider) {
    query = query.eq('email_provider', provider);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[SubscriptionScanner] Error fetching cached subscriptions:', error);
    return [];
  }

  return data || [];
}

// =========================================================================
// PROVIDER DETECTION
// =========================================================================

/**
 * Check which email providers are connected for a user
 */
async function getConnectedProviders(userEmail: string): Promise<ConnectedProviders> {
  const [gmailResult, outlookResult] = await Promise.all([
    getAccessToken(userEmail, 'gmail'),
    getAccessToken(userEmail, 'outlook'),
  ]);

  const gmail = !!gmailResult.token && !gmailResult.error;
  const outlook = !!outlookResult.token && !outlookResult.error;

  return {
    gmail,
    outlook,
    any: gmail || outlook,
    both: gmail && outlook,
  };
}

// =========================================================================
// MAIN SCAN FUNCTIONS
// =========================================================================

/**
 * Scan a single provider for subscriptions
 */
export async function scanProviderSubscriptions(
  userEmail: string,
  provider: 'gmail' | 'outlook',
  userCode?: string,
  options?: { forceRefresh?: boolean; maxEmails?: number }
): Promise<ScanResult> {
  const { forceRefresh = false, maxEmails = 100 } = options || {};

  console.log(`[SubscriptionScanner] Scanning ${provider} for ${userEmail}`);

  try {
    // Check cache validity
    if (!forceRefresh && (await isScanCacheValid(userEmail, provider))) {
      const cached = await getCachedSubscriptions(userEmail, provider);
      return {
        success: true,
        provider,
        subscriptionsFound: cached.length,
        emailsScanned: 0,
        cached: true,
      };
    }

    // Perform scan
    const { subscriptions, scanned } =
      provider === 'gmail'
        ? await scanGmailSubscriptions(userEmail, userCode, maxEmails)
        : await scanOutlookSubscriptions(userEmail, userCode, maxEmails);

    // Save to database
    await saveSubscriptions(userEmail, provider, subscriptions, userCode);

    return {
      success: true,
      provider,
      subscriptionsFound: subscriptions.size,
      emailsScanned: scanned,
      cached: false,
    };
  } catch (error: any) {
    console.error(`[SubscriptionScanner] Error scanning ${provider}:`, error);
    return {
      success: false,
      provider,
      subscriptionsFound: 0,
      emailsScanned: 0,
      cached: false,
      error: error.message,
    };
  }
}

/**
 * Scan all connected providers for subscriptions
 */
export async function scanAllSubscriptions(
  userEmail: string,
  userCode?: string,
  options?: { forceRefresh?: boolean; maxEmails?: number }
): Promise<UnifiedScanResult> {
  const providers = await getConnectedProviders(userEmail);

  const result: UnifiedScanResult = {
    summary: {
      totalSubscriptions: 0,
      totalScanned: 0,
    },
  };

  const scans: Promise<void>[] = [];

  if (providers.gmail) {
    scans.push(
      scanProviderSubscriptions(userEmail, 'gmail', userCode, options).then((r) => {
        result.gmail = r;
        result.summary.totalSubscriptions += r.subscriptionsFound;
        result.summary.totalScanned += r.emailsScanned;
      })
    );
  }

  if (providers.outlook) {
    scans.push(
      scanProviderSubscriptions(userEmail, 'outlook', userCode, options).then((r) => {
        result.outlook = r;
        result.summary.totalSubscriptions += r.subscriptionsFound;
        result.summary.totalScanned += r.emailsScanned;
      })
    );
  }

  await Promise.all(scans);

  return result;
}
