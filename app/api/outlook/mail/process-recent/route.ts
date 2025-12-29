/**
 * Manual Outlook Email Processing API
 *
 * POST /api/outlook/mail/process-recent
 *
 * Manually process recent unread emails for a user.
 * Use this when push notifications aren't working.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createValidatedOutlookMailClient, OutlookMailClient, OutlookEmail } from '@/lib/services/outlook-mail-client';
import { classifyEmailWithLabeling } from '@/lib/services/email-classifier';
import { runEmailDraftAgent, OriginalEmail } from '@/lib/agents/email-draft-agent';
import { applyCategoryToEmail, hasCategoriesSetup, setupUserCategories, MoccetCategoryName } from '@/lib/services/outlook-category-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function fetchEmailContent(
  client: OutlookMailClient,
  messageId: string
): Promise<OriginalEmail | null> {
  try {
    const email = await client.getEmail(messageId);

    const fromAddress = email.from?.emailAddress?.address || '';
    const fromName = email.from?.emailAddress?.name;

    // Extract body text
    let body = email.body?.content || '';
    if (email.body?.contentType === 'html') {
      // Simple HTML to text conversion
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

    return {
      messageId: email.id,
      threadId: email.conversationId || '', // Outlook uses conversationId
      from: fromAddress,
      fromName,
      to: email.toRecipients?.map(r => r.emailAddress?.address).filter(Boolean).join(', ') || '',
      subject: email.subject || '',
      body: body.trim(),
      snippet: email.bodyPreview || undefined,
      labels: email.categories || [],
      receivedAt: new Date(email.receivedDateTime),
    };
  } catch (error) {
    console.error(`[Outlook ProcessRecent] Failed to fetch email ${messageId}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code, maxEmails = 5 } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Outlook ProcessRecent] Processing recent emails for ${email}`);

    // Get user settings
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from('email_draft_settings')
      .select('*')
      .eq('user_email', email)
      .maybeSingle();

    if (!settings?.outlook_auto_draft_enabled) {
      return NextResponse.json(
        { error: 'Auto-drafting is not enabled for Outlook for this user' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user code from subscription if not provided
    let userCode = code;
    if (!userCode) {
      const { data: subscription } = await supabase
        .from('outlook_subscriptions')
        .select('user_code')
        .eq('user_email', email)
        .maybeSingle();
      userCode = subscription?.user_code;
    }

    // Create Outlook client
    const { client, error: clientError } = await createValidatedOutlookMailClient(email, userCode);
    if (!client) {
      return NextResponse.json(
        { error: clientError || 'Failed to connect to Outlook' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Ensure categories are set up
    const categoriesReady = await hasCategoriesSetup(email);
    if (!categoriesReady) {
      console.log(`[Outlook ProcessRecent] Setting up categories for ${email}`);
      await setupUserCategories(email, userCode);
    }

    // Fetch recent unread emails from inbox
    const inboxResponse = await client.getInboxEmails({
      maxResults: maxEmails,
      filter: 'isRead eq false',
    });

    const messages = inboxResponse.value || [];
    console.log(`[Outlook ProcessRecent] Found ${messages.length} unread emails`);

    if (messages.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No unread emails to process',
      }, { headers: corsHeaders });
    }

    const results: Array<{
      messageId: string;
      subject: string;
      from: string;
      category: string;
      draftCreated: boolean;
      draftSkipped?: boolean;
      needsResponse?: boolean;
      error?: string;
    }> = [];

    // Check excluded senders/domains
    const excludedSenders = settings.excluded_senders || [];
    const excludedDomains = settings.excluded_domains || [];

    for (const message of messages) {
      const fullEmail = await fetchEmailContent(client, message.id);
      if (!fullEmail) {
        results.push({
          messageId: message.id,
          subject: 'Unknown',
          from: 'Unknown',
          category: 'error',
          draftCreated: false,
          error: 'Failed to fetch email content',
        });
        continue;
      }

      // Check if sender is excluded
      const fromLower = fullEmail.from.toLowerCase();
      const isExcluded = excludedSenders.some((s: string) => fromLower.includes(s.toLowerCase())) ||
        (fullEmail.from.includes('@') && excludedDomains.some((d: string) =>
          fromLower.split('@')[1]?.includes(d.toLowerCase())
        ));

      if (isExcluded) {
        results.push({
          messageId: fullEmail.messageId,
          subject: fullEmail.subject,
          from: fullEmail.from,
          category: 'excluded',
          draftCreated: false,
        });
        continue;
      }

      try {
        // Skip emails from the user's own email address
        const fromEmail = fullEmail.from.toLowerCase();
        const userEmailLower = email.toLowerCase();
        if (fromEmail.includes(userEmailLower) || userEmailLower.includes(fromEmail.split('@')[0])) {
          console.log(`[Outlook ProcessRecent] Skipping self-email: ${fullEmail.from}`);
          results.push({
            messageId: fullEmail.messageId,
            subject: fullEmail.subject,
            from: fullEmail.from,
            category: 'self',
            draftCreated: false,
            draftSkipped: true,
            needsResponse: false,
          });
          continue;
        }

        // Classify email
        const classification = await classifyEmailWithLabeling({
          messageId: fullEmail.messageId,
          threadId: fullEmail.threadId,
          from: fullEmail.from,
          fromName: fullEmail.fromName,
          to: fullEmail.to,
          subject: fullEmail.subject,
          body: fullEmail.body,
          snippet: fullEmail.snippet,
          labels: fullEmail.labels,
          receivedAt: fullEmail.receivedAt,
          isUnread: true,
        });

        // Apply category
        const categoryResult = await applyCategoryToEmail(
          email,
          fullEmail.messageId,
          classification.moccetLabel as MoccetCategoryName,
          userCode,
          {
            from: fullEmail.from,
            subject: fullEmail.subject,
            conversationId: fullEmail.threadId,
            source: classification.labelSource,
            confidence: classification.confidence,
            reasoning: classification.labelReasoning,
          }
        );

        if (!categoryResult.success) {
          console.error(`[Outlook ProcessRecent] Failed to apply category ${classification.moccetLabel} to ${fullEmail.messageId}: ${categoryResult.error}`);
        } else {
          console.log(`[Outlook ProcessRecent] Applied category ${classification.moccetLabel} to ${fullEmail.messageId}`);
        }

        let draftCreated = false;
        let draftError: string | undefined;
        let draftSkipped = false;

        // Generate draft if needed
        if (classification.needsResponse) {
          console.log(`[Outlook ProcessRecent] Running draft agent for ${fullEmail.messageId}`);
          const draftResult = await runEmailDraftAgent(email, fullEmail, userCode, classification, 'outlook');
          draftCreated = draftResult.success;
          draftSkipped = draftResult.skipped || false;
          draftError = draftResult.error;
          console.log(`[Outlook ProcessRecent] Draft result for ${fullEmail.messageId}: success=${draftResult.success}, skipped=${draftResult.skipped}`);

          if (!draftResult.success && !draftResult.skipped) {
            console.error(`[Outlook ProcessRecent] Draft failed for ${fullEmail.messageId}:`, draftResult.error);
          }
        }

        results.push({
          messageId: fullEmail.messageId,
          subject: fullEmail.subject,
          from: fullEmail.from,
          category: classification.moccetLabel,
          draftCreated,
          draftSkipped,
          draftError,
          needsResponse: classification.needsResponse,
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        console.error(`[Outlook ProcessRecent] Error processing ${fullEmail.messageId}:`, error);
        results.push({
          messageId: fullEmail.messageId,
          subject: fullEmail.subject,
          from: fullEmail.from,
          category: 'error',
          draftCreated: false,
          error: err.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    }, { headers: corsHeaders });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[Outlook ProcessRecent] Error:', error);
    return NextResponse.json(
      { error: err.message || 'Failed to process emails' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
