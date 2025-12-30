/**
 * Unsubscribe Executor Service
 *
 * Executes unsubscribe actions via one-click POST or mailto.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createValidatedGmailClient } from '@/lib/services/gmail-client';
import { createValidatedOutlookMailClient } from '@/lib/services/outlook-mail-client';

// =========================================================================
// TYPES
// =========================================================================

export interface UnsubscribeResult {
  success: boolean;
  method: 'one_click' | 'mailto' | 'failed';
  subscriptionId: string;
  error?: string;
}

// =========================================================================
// ONE-CLICK UNSUBSCRIBE (RFC 8058)
// =========================================================================

async function executeOneClickUnsubscribe(
  url: string,
  subscriptionId: string,
  userEmail: string
): Promise<UnsubscribeResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    // POST with the required body
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'List-Unsubscribe=One-Click',
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text().catch(() => '');

    // Log the attempt
    await supabase.from('email_unsubscribe_logs').insert({
      subscription_id: subscriptionId,
      user_email: userEmail,
      method: 'one_click',
      target_url: url,
      success: response.ok || response.status === 202,
      http_status: response.status,
      response_body: responseText.slice(0, 1000), // Truncate
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    });

    // 200, 202, 204 all indicate success
    if (response.ok || response.status === 202) {
      return {
        success: true,
        method: 'one_click',
        subscriptionId,
      };
    }

    return {
      success: false,
      method: 'one_click',
      subscriptionId,
      error: `HTTP ${response.status}: ${responseText.slice(0, 200)}`,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    await supabase.from('email_unsubscribe_logs').insert({
      subscription_id: subscriptionId,
      user_email: userEmail,
      method: 'one_click',
      target_url: url,
      success: false,
      error_message: error.message,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    });

    return {
      success: false,
      method: 'one_click',
      subscriptionId,
      error: error.message,
    };
  }
}

// =========================================================================
// MAILTO UNSUBSCRIBE
// =========================================================================

async function executeMailtoUnsubscribe(
  mailto: string,
  subscriptionId: string,
  userEmail: string,
  provider: 'gmail' | 'outlook',
  userCode?: string
): Promise<UnsubscribeResult> {
  const startTime = Date.now();
  const supabase = createAdminClient();

  try {
    // Parse mailto URL
    const mailtoUrl = new URL(mailto);
    const toAddress = decodeURIComponent(mailtoUrl.pathname);
    const params = new URLSearchParams(mailtoUrl.search);
    const subject = params.get('subject') || 'Unsubscribe';
    const body = params.get('body') || 'Please unsubscribe me from this mailing list.';

    if (provider === 'gmail') {
      const { gmail, error } = await createValidatedGmailClient(userEmail, userCode);
      if (!gmail) {
        throw new Error(error || 'Failed to connect to Gmail');
      }

      // Create and send message
      const message = [`To: ${toAddress}`, `From: ${userEmail}`, `Subject: ${subject}`, '', body].join(
        '\n'
      );

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
    } else {
      const { client, error } = await createValidatedOutlookMailClient(userEmail, userCode);
      if (!client) {
        throw new Error(error || 'Failed to connect to Outlook');
      }

      await client.sendEmail({
        subject,
        body: {
          contentType: 'text',
          content: body,
        },
        toRecipients: [{ emailAddress: { address: toAddress } }],
      });
    }

    const duration = Date.now() - startTime;

    await supabase.from('email_unsubscribe_logs').insert({
      subscription_id: subscriptionId,
      user_email: userEmail,
      method: 'mailto',
      target_url: mailto,
      success: true,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    });

    return {
      success: true,
      method: 'mailto',
      subscriptionId,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    await supabase.from('email_unsubscribe_logs').insert({
      subscription_id: subscriptionId,
      user_email: userEmail,
      method: 'mailto',
      target_url: mailto,
      success: false,
      error_message: error.message,
      completed_at: new Date().toISOString(),
      duration_ms: duration,
    });

    return {
      success: false,
      method: 'mailto',
      subscriptionId,
      error: error.message,
    };
  }
}

// =========================================================================
// MAIN UNSUBSCRIBE FUNCTION
// =========================================================================

/**
 * Execute unsubscribe for a subscription
 * Prefers one-click, falls back to mailto
 */
export async function executeUnsubscribe(
  subscriptionId: string,
  userEmail: string,
  userCode?: string
): Promise<UnsubscribeResult> {
  const supabase = createAdminClient();

  // Get subscription details
  const { data: subscription, error } = await supabase
    .from('email_subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .eq('user_email', userEmail)
    .single();

  if (error || !subscription) {
    return {
      success: false,
      method: 'failed',
      subscriptionId,
      error: 'Subscription not found',
    };
  }

  // Update status to pending
  await supabase.from('email_subscriptions').update({ status: 'pending' }).eq('id', subscriptionId);

  let result: UnsubscribeResult | null = null;

  // Try one-click first if supported
  if (subscription.supports_one_click && subscription.unsubscribe_https) {
    result = await executeOneClickUnsubscribe(
      subscription.unsubscribe_https,
      subscriptionId,
      userEmail
    );

    if (result.success) {
      await supabase
        .from('email_subscriptions')
        .update({
          status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString(),
          unsubscribe_method: 'one_click',
        })
        .eq('id', subscriptionId);

      return result;
    }
  }

  // Try mailto if available
  if (subscription.unsubscribe_mailto) {
    result = await executeMailtoUnsubscribe(
      subscription.unsubscribe_mailto,
      subscriptionId,
      userEmail,
      subscription.email_provider,
      userCode
    );

    if (result.success) {
      await supabase
        .from('email_subscriptions')
        .update({
          status: 'unsubscribed',
          unsubscribed_at: new Date().toISOString(),
          unsubscribe_method: 'mailto',
        })
        .eq('id', subscriptionId);

      return result;
    }
  }

  // Mark as failed
  await supabase
    .from('email_subscriptions')
    .update({
      status: 'failed',
      unsubscribe_error: result?.error || 'No unsubscribe method available',
    })
    .eq('id', subscriptionId);

  return (
    result || {
      success: false,
      method: 'failed',
      subscriptionId,
      error: 'No unsubscribe method available',
    }
  );
}

/**
 * Bulk unsubscribe from multiple subscriptions
 */
export async function bulkUnsubscribe(
  subscriptionIds: string[],
  userEmail: string,
  userCode?: string
): Promise<UnsubscribeResult[]> {
  const results: UnsubscribeResult[] = [];

  for (const id of subscriptionIds) {
    const result = await executeUnsubscribe(id, userEmail, userCode);
    results.push(result);

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
