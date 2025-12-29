/**
 * Unified Mail Service
 *
 * Handles operations across multiple email providers (Gmail and Outlook).
 * Auto-detects connected providers and processes them in parallel.
 *
 * @module lib/services/unified-mail-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';

// =========================================================================
// TYPES
// =========================================================================

export type EmailProvider = 'gmail' | 'outlook';

export interface ConnectedProviders {
  gmail: boolean;
  outlook: boolean;
  any: boolean;
  both: boolean;
}

export interface ProviderStatus {
  isConnected: boolean;
  labelsSetup: boolean;
  draftsEnabled: boolean;
  watchEnabled: boolean;
  labeledEmailCount: number;
  draftCount: number;
}

export interface UnifiedMailStatus {
  providers: {
    gmail?: ProviderStatus;
    outlook?: ProviderStatus;
  };
  summary: {
    anyConnected: boolean;
    bothConnected: boolean;
    allSetup: boolean;
    totalDrafts: number;
    totalLabeled: number;
  };
}

export interface UnifiedSetupResult {
  gmail?: {
    success: boolean;
    labelsCreated?: number;
    labelsExisting?: number;
    backfillCount?: number;
    error?: string;
  };
  outlook?: {
    success: boolean;
    categoriesCreated?: number;
    categoriesExisting?: number;
    backfillCount?: number;
    error?: string;
  };
  summary: {
    allSuccess: boolean;
    errors: string[];
  };
}

export interface UnifiedEnableDraftsResult {
  gmail?: {
    success: boolean;
    styleLearned?: boolean;
    watchEnabled?: boolean;
    error?: string;
  };
  outlook?: {
    success: boolean;
    styleLearned?: boolean;
    subscriptionEnabled?: boolean;
    error?: string;
  };
  summary: {
    allSuccess: boolean;
    errors: string[];
  };
}

export interface UnifiedProcessResult {
  gmail?: {
    success: boolean;
    processed: number;
    labeled: number;
    draftsCreated: number;
    errors: string[];
  };
  outlook?: {
    success: boolean;
    processed: number;
    categorized: number;
    draftsCreated: number;
    errors: string[];
  };
  summary: {
    totalProcessed: number;
    totalLabeled: number;
    totalDrafts: number;
    errors: string[];
  };
}

// =========================================================================
// PROVIDER DETECTION
// =========================================================================

/**
 * Check which email providers are connected for a user
 */
export async function getConnectedProviders(userEmail: string): Promise<ConnectedProviders> {
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
// UNIFIED STATUS
// =========================================================================

/**
 * Get combined status for all connected email providers
 */
export async function getUnifiedStatus(userEmail: string): Promise<UnifiedMailStatus> {
  const providers = await getConnectedProviders(userEmail);
  const supabase = createAdminClient();

  const result: UnifiedMailStatus = {
    providers: {},
    summary: {
      anyConnected: providers.any,
      bothConnected: providers.both,
      allSetup: false,
      totalDrafts: 0,
      totalLabeled: 0,
    },
  };

  // Fetch data in parallel
  const queries: Promise<void>[] = [];

  if (providers.gmail) {
    queries.push(
      (async () => {
        const [labelsResult, settingsResult, watchResult, labelCountResult, draftCountResult] =
          await Promise.all([
            supabase
              .from('gmail_user_labels')
              .select('id')
              .eq('user_email', userEmail)
              .eq('is_synced', true)
              .limit(1),
            supabase
              .from('email_draft_settings')
              .select('auto_draft_enabled')
              .eq('user_email', userEmail)
              .maybeSingle(),
            supabase
              .from('gmail_watch_subscriptions')
              .select('is_active')
              .eq('user_email', userEmail)
              .maybeSingle(),
            supabase
              .from('email_label_assignments')
              .select('id', { count: 'exact', head: true })
              .eq('user_email', userEmail)
              .eq('email_provider', 'gmail'),
            supabase
              .from('email_drafts')
              .select('id', { count: 'exact', head: true })
              .eq('user_email', userEmail)
              .eq('email_provider', 'gmail'),
          ]);

        result.providers.gmail = {
          isConnected: true,
          labelsSetup: (labelsResult.data?.length ?? 0) > 0,
          draftsEnabled: settingsResult.data?.auto_draft_enabled ?? false,
          watchEnabled: watchResult.data?.is_active ?? false,
          labeledEmailCount: labelCountResult.count ?? 0,
          draftCount: draftCountResult.count ?? 0,
        };
      })()
    );
  }

  if (providers.outlook) {
    queries.push(
      (async () => {
        const [categoriesResult, settingsResult, subscriptionResult, categoryCountResult, draftCountResult] =
          await Promise.all([
            supabase
              .from('outlook_user_categories')
              .select('id')
              .eq('user_email', userEmail)
              .eq('is_synced', true)
              .limit(1),
            supabase
              .from('email_draft_settings')
              .select('outlook_auto_draft_enabled')
              .eq('user_email', userEmail)
              .maybeSingle(),
            supabase
              .from('outlook_subscriptions')
              .select('is_active, expiration_datetime')
              .eq('user_email', userEmail)
              .maybeSingle(),
            supabase
              .from('email_label_assignments')
              .select('id', { count: 'exact', head: true })
              .eq('user_email', userEmail)
              .eq('email_provider', 'outlook'),
            supabase
              .from('email_drafts')
              .select('id', { count: 'exact', head: true })
              .eq('user_email', userEmail)
              .eq('email_provider', 'outlook'),
          ]);

        // Check if subscription is active and not expired
        let subscriptionActive = false;
        if (subscriptionResult.data?.is_active && subscriptionResult.data?.expiration_datetime) {
          subscriptionActive = new Date(subscriptionResult.data.expiration_datetime) > new Date();
        }

        result.providers.outlook = {
          isConnected: true,
          labelsSetup: (categoriesResult.data?.length ?? 0) > 0,
          draftsEnabled: settingsResult.data?.outlook_auto_draft_enabled ?? false,
          watchEnabled: subscriptionActive,
          labeledEmailCount: categoryCountResult.count ?? 0,
          draftCount: draftCountResult.count ?? 0,
        };
      })()
    );
  }

  await Promise.all(queries);

  // Calculate summary
  const gmailSetup = result.providers.gmail?.labelsSetup ?? true; // true if not connected
  const outlookSetup = result.providers.outlook?.labelsSetup ?? true;
  result.summary.allSetup = gmailSetup && outlookSetup;
  result.summary.totalDrafts =
    (result.providers.gmail?.draftCount ?? 0) + (result.providers.outlook?.draftCount ?? 0);
  result.summary.totalLabeled =
    (result.providers.gmail?.labeledEmailCount ?? 0) +
    (result.providers.outlook?.labeledEmailCount ?? 0);

  return result;
}

// =========================================================================
// UNIFIED OPERATIONS
// =========================================================================

/**
 * Setup labels/categories for all connected providers
 */
export async function setupAllLabels(
  userEmail: string,
  userCode?: string,
  options?: { backfill?: boolean; backfillCount?: number }
): Promise<UnifiedSetupResult> {
  const { backfill = true, backfillCount = 50 } = options || {};
  const providers = await getConnectedProviders(userEmail);

  const result: UnifiedSetupResult = {
    summary: {
      allSuccess: true,
      errors: [],
    },
  };

  const operations: Promise<void>[] = [];

  if (providers.gmail) {
    operations.push(
      (async () => {
        try {
          const { setupUserLabels, backfillExistingEmails } = await import(
            '@/lib/services/gmail-label-manager'
          );

          const setupResult = await setupUserLabels(userEmail, userCode);

          let backfillResult = null;
          if (backfill && setupResult.success) {
            backfillResult = await backfillExistingEmails(userEmail, userCode, backfillCount);
          }

          result.gmail = {
            success: setupResult.success,
            labelsCreated: setupResult.labelsCreated,
            labelsExisting: setupResult.labelsExisting,
            backfillCount: backfillResult?.labeled ?? 0,
            error: setupResult.errors.length > 0 ? setupResult.errors.join(', ') : undefined,
          };

          if (!setupResult.success) {
            result.summary.allSuccess = false;
            result.summary.errors.push(`Gmail: ${setupResult.errors.join(', ')}`);
          }
        } catch (error) {
          result.gmail = { success: false, error: String(error) };
          result.summary.allSuccess = false;
          result.summary.errors.push(`Gmail: ${error}`);
        }
      })()
    );
  }

  if (providers.outlook) {
    operations.push(
      (async () => {
        try {
          const { setupUserCategories, backfillExistingEmails } = await import(
            '@/lib/services/outlook-category-manager'
          );

          const setupResult = await setupUserCategories(userEmail, userCode);

          let backfillResult = null;
          if (backfill && setupResult.success) {
            backfillResult = await backfillExistingEmails(userEmail, userCode, backfillCount);
          }

          result.outlook = {
            success: setupResult.success,
            categoriesCreated: setupResult.categoriesCreated,
            categoriesExisting: setupResult.categoriesExisting,
            backfillCount: backfillResult?.categorized ?? 0,
            error: setupResult.errors.length > 0 ? setupResult.errors.join(', ') : undefined,
          };

          if (!setupResult.success) {
            result.summary.allSuccess = false;
            result.summary.errors.push(`Outlook: ${setupResult.errors.join(', ')}`);
          }
        } catch (error) {
          result.outlook = { success: false, error: String(error) };
          result.summary.allSuccess = false;
          result.summary.errors.push(`Outlook: ${error}`);
        }
      })()
    );
  }

  await Promise.all(operations);

  return result;
}

/**
 * Enable drafts for all connected providers
 */
export async function enableAllDrafts(
  userEmail: string,
  userCode?: string,
  options?: { enabled?: boolean }
): Promise<UnifiedEnableDraftsResult> {
  const { enabled = true } = options || {};
  const providers = await getConnectedProviders(userEmail);
  const supabase = createAdminClient();

  const result: UnifiedEnableDraftsResult = {
    summary: {
      allSuccess: true,
      errors: [],
    },
  };

  const operations: Promise<void>[] = [];

  if (providers.gmail) {
    operations.push(
      (async () => {
        try {
          // Learn style
          const { learnEmailStyle } = await import('@/lib/services/email-style-learner');
          const styleResult = await learnEmailStyle(userEmail, userCode, { maxEmails: 200 });

          // Setup watch
          const { createValidatedGmailClient } = await import('@/lib/services/gmail-client');
          const { gmail } = await createValidatedGmailClient(userEmail, userCode);
          let watchEnabled = false;

          if (gmail) {
            try {
              const watchResponse = await gmail.users.watch({
                userId: 'me',
                requestBody: {
                  topicName: process.env.GMAIL_PUBSUB_TOPIC,
                  labelIds: ['INBOX'],
                },
              });

              if (watchResponse.data.historyId) {
                await supabase.from('gmail_watch_subscriptions').upsert(
                  {
                    user_email: userEmail,
                    user_code: userCode || null,
                    history_id: watchResponse.data.historyId,
                    expiration_timestamp: watchResponse.data.expiration
                      ? new Date(parseInt(watchResponse.data.expiration)).toISOString()
                      : null,
                    is_active: true,
                  },
                  { onConflict: 'user_email' }
                );
                watchEnabled = true;
              }
            } catch (e) {
              console.error('[UnifiedMail] Gmail watch setup failed:', e);
            }
          }

          // Update settings
          await supabase.from('email_draft_settings').upsert(
            {
              user_email: userEmail,
              user_code: userCode || null,
              auto_draft_enabled: enabled,
            },
            { onConflict: 'user_email' }
          );

          result.gmail = {
            success: true,
            styleLearned: styleResult.success,
            watchEnabled,
          };
        } catch (error) {
          result.gmail = { success: false, error: String(error) };
          result.summary.allSuccess = false;
          result.summary.errors.push(`Gmail: ${error}`);
        }
      })()
    );
  }

  if (providers.outlook) {
    operations.push(
      (async () => {
        try {
          // Learn style
          const { learnOutlookEmailStyle } = await import('@/lib/services/outlook-style-learner');
          const styleResult = await learnOutlookEmailStyle(userEmail, userCode, { maxEmails: 200 });

          // Setup subscription
          const { createValidatedOutlookMailClient } = await import(
            '@/lib/services/outlook-mail-client'
          );
          const { client } = await createValidatedOutlookMailClient(userEmail, userCode);
          let subscriptionEnabled = false;

          if (client) {
            try {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';
              const notificationUrl = `${baseUrl}/api/outlook/mail/webhook`;
              const clientState = require('crypto').randomBytes(32).toString('hex');

              const subscription = await client.createSubscription(notificationUrl, clientState);

              await supabase.from('outlook_subscriptions').upsert(
                {
                  user_email: userEmail,
                  user_code: userCode || null,
                  subscription_id: subscription.id,
                  resource: '/me/mailFolders/inbox/messages',
                  change_types: ['created', 'updated'],
                  notification_url: notificationUrl,
                  client_state: clientState,
                  expiration_datetime: subscription.expirationDateTime,
                  is_active: true,
                },
                { onConflict: 'user_email' }
              );
              subscriptionEnabled = true;
            } catch (e) {
              console.error('[UnifiedMail] Outlook subscription setup failed:', e);
            }
          }

          // Update settings
          await supabase.from('email_draft_settings').upsert(
            {
              user_email: userEmail,
              user_code: userCode || null,
              outlook_auto_draft_enabled: enabled,
            },
            { onConflict: 'user_email' }
          );

          result.outlook = {
            success: true,
            styleLearned: styleResult.success,
            subscriptionEnabled,
          };
        } catch (error) {
          result.outlook = { success: false, error: String(error) };
          result.summary.allSuccess = false;
          result.summary.errors.push(`Outlook: ${error}`);
        }
      })()
    );
  }

  await Promise.all(operations);

  return result;
}

/**
 * Process recent emails from all connected providers
 */
export async function processAllRecentEmails(
  userEmail: string,
  userCode?: string,
  options?: { maxEmails?: number }
): Promise<UnifiedProcessResult> {
  const { maxEmails = 10 } = options || {};
  const providers = await getConnectedProviders(userEmail);

  const result: UnifiedProcessResult = {
    summary: {
      totalProcessed: 0,
      totalLabeled: 0,
      totalDrafts: 0,
      errors: [],
    },
  };

  const operations: Promise<void>[] = [];

  if (providers.gmail) {
    operations.push(
      (async () => {
        try {
          // Use internal fetch to call the Gmail process-recent endpoint
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';
          const response = await fetch(`${baseUrl}/api/gmail/process-recent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              code: userCode,
              maxEmails,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            const results = data.results || [];
            result.gmail = {
              success: true,
              processed: results.length,
              labeled: results.filter((r: { label?: string }) => r.label && r.label !== 'error').length,
              draftsCreated: results.filter((r: { draftCreated?: boolean }) => r.draftCreated).length,
              errors: results
                .filter((r: { error?: string }) => r.error)
                .map((r: { error: string }) => r.error),
            };
          } else {
            result.gmail = {
              success: false,
              processed: 0,
              labeled: 0,
              draftsCreated: 0,
              errors: [data.error || 'Unknown error'],
            };
            result.summary.errors.push(`Gmail: ${data.error}`);
          }
        } catch (error) {
          result.gmail = {
            success: false,
            processed: 0,
            labeled: 0,
            draftsCreated: 0,
            errors: [String(error)],
          };
          result.summary.errors.push(`Gmail: ${error}`);
        }
      })()
    );
  }

  if (providers.outlook) {
    operations.push(
      (async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';
          const response = await fetch(`${baseUrl}/api/outlook/mail/process-recent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: userEmail,
              code: userCode,
              maxEmails,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            const results = data.results || [];
            result.outlook = {
              success: true,
              processed: results.length,
              categorized: results.filter((r: { category?: string }) => r.category && r.category !== 'error').length,
              draftsCreated: results.filter((r: { draftCreated?: boolean }) => r.draftCreated).length,
              errors: results
                .filter((r: { error?: string }) => r.error)
                .map((r: { error: string }) => r.error),
            };
          } else {
            result.outlook = {
              success: false,
              processed: 0,
              categorized: 0,
              draftsCreated: 0,
              errors: [data.error || 'Unknown error'],
            };
            result.summary.errors.push(`Outlook: ${data.error}`);
          }
        } catch (error) {
          result.outlook = {
            success: false,
            processed: 0,
            categorized: 0,
            draftsCreated: 0,
            errors: [String(error)],
          };
          result.summary.errors.push(`Outlook: ${error}`);
        }
      })()
    );
  }

  await Promise.all(operations);

  // Calculate summary
  result.summary.totalProcessed =
    (result.gmail?.processed ?? 0) + (result.outlook?.processed ?? 0);
  result.summary.totalLabeled =
    (result.gmail?.labeled ?? 0) + (result.outlook?.categorized ?? 0);
  result.summary.totalDrafts =
    (result.gmail?.draftsCreated ?? 0) + (result.outlook?.draftsCreated ?? 0);

  return result;
}
