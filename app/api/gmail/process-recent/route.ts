/**
 * Manual Email Processing API
 *
 * POST /api/gmail/process-recent
 *
 * Manually process recent unread emails for a user.
 * Use this when push notifications aren't working.
 */

import { NextRequest, NextResponse } from 'next/server';
import { google, gmail_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { classifyEmailWithLabeling } from '@/lib/services/email-classifier';
import { runEmailDraftAgent, OriginalEmail } from '@/lib/agents/email-draft-agent';
import { applyLabelToEmail, hasLabelsSetup, setupUserLabels } from '@/lib/services/gmail-label-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function createGmailClient(
  userEmail: string,
  userCode?: string
): Promise<gmail_v1.Gmail | null> {
  const { token, error } = await getAccessToken(userEmail, 'gmail', userCode);
  if (!token || error) {
    console.error(`[ProcessRecent] Token error for ${userEmail}:`, error);
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: token });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

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
    console.error(`[ProcessRecent] Failed to fetch email ${messageId}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, maxEmails = 5 } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[ProcessRecent] Processing recent emails for ${email}`);

    // Get user settings
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from('email_draft_settings')
      .select('*')
      .eq('user_email', email)
      .maybeSingle();

    if (!settings?.auto_draft_enabled) {
      return NextResponse.json(
        { error: 'Auto-drafting is not enabled for this user' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user code from watch subscription
    const { data: subscription } = await supabase
      .from('gmail_watch_subscriptions')
      .select('user_code')
      .eq('user_email', email)
      .maybeSingle();

    const userCode = subscription?.user_code;

    // Create Gmail client
    const gmail = await createGmailClient(email, userCode);
    if (!gmail) {
      return NextResponse.json(
        { error: 'Failed to connect to Gmail' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Ensure labels are set up
    const labelsReady = await hasLabelsSetup(email);
    if (!labelsReady) {
      console.log(`[ProcessRecent] Setting up labels for ${email}`);
      await setupUserLabels(email, userCode);
    }

    // Fetch recent unread emails
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread in:inbox -in:spam -in:trash',
      maxResults: maxEmails,
    });

    const messages = listResponse.data.messages || [];
    console.log(`[ProcessRecent] Found ${messages.length} unread emails`);

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
      label: string;
      draftCreated: boolean;
      error?: string;
    }> = [];

    // Check excluded senders/domains
    const excludedSenders = settings.excluded_senders || [];
    const excludedDomains = settings.excluded_domains || [];

    for (const message of messages) {
      const fullEmail = await fetchEmailContent(gmail, message.id!);
      if (!fullEmail) {
        results.push({
          messageId: message.id!,
          subject: 'Unknown',
          from: 'Unknown',
          label: 'error',
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
          label: 'excluded',
          draftCreated: false,
        });
        continue;
      }

      try {
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

        // Apply label
        const labelResult = await applyLabelToEmail(email, fullEmail.messageId, classification.moccetLabel, userCode, {
          from: fullEmail.from,
          subject: fullEmail.subject,
          threadId: fullEmail.threadId,
          source: classification.labelSource,
          confidence: classification.confidence,
          reasoning: classification.labelReasoning,
        });

        let draftCreated = false;

        // Generate draft if needed
        if (classification.needsResponse) {
          const draftResult = await runEmailDraftAgent(email, fullEmail, userCode);
          draftCreated = draftResult.success;

          if (!draftResult.success && !draftResult.skipped) {
            console.error(`[ProcessRecent] Draft failed for ${fullEmail.messageId}:`, draftResult.error);
          }
        }

        results.push({
          messageId: fullEmail.messageId,
          subject: fullEmail.subject,
          from: fullEmail.from,
          label: classification.moccetLabel,
          draftCreated,
        });
      } catch (error: any) {
        console.error(`[ProcessRecent] Error processing ${fullEmail.messageId}:`, error);
        results.push({
          messageId: fullEmail.messageId,
          subject: fullEmail.subject,
          from: fullEmail.from,
          label: 'error',
          draftCreated: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[ProcessRecent] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process emails' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
