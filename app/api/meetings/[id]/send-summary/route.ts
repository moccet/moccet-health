/**
 * Send Meeting Summary Email
 *
 * POST /api/meetings/[id]/send-summary - Send meeting summary email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

interface ActionItem {
  description: string;
  owner_name?: string;
  priority?: string;
}

interface Decision {
  decision_text: string;
}

interface Summary {
  summary_style: string;
  summary_text: string;
  key_points: string[];
  is_primary: boolean;
}

function generateEmailTemplate(
  meetingTitle: string,
  meetingDate: string,
  summary: Summary,
  actionItems: ActionItem[],
  decisions: Decision[],
  viewUrl: string
): string {
  const actionItemsHtml = actionItems.length > 0
    ? actionItems.map(item => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <p style="margin: 0 0 4px 0; font-size: 15px; line-height: 1.5; color: #1a1a1a;">${item.description}</p>
            ${item.owner_name ? `<p style="margin: 0; font-size: 13px; color: #666666;">Owner: ${item.owner_name}</p>` : ''}
          </td>
        </tr>
      `).join('')
    : '<tr><td style="padding: 12px 0; color: #666666; font-size: 14px;">No action items identified</td></tr>';

  const decisionsHtml = decisions.length > 0
    ? decisions.map(d => `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #1a1a1a;">${d.decision_text}</p>
          </td>
        </tr>
      `).join('')
    : '';

  const keyPointsHtml = summary.key_points?.length > 0
    ? summary.key_points.map(point => `
        <li style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.5; color: #1a1a1a;">${point}</li>
      `).join('')
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Summary - ${meetingTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f8f8f8; color: #1a1a1a;">

  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f8f8;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <!-- Main Container -->
        <table role="presentation" style="max-width: 600px; width: 100%; margin: 0 auto; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px 24px; border-bottom: 1px solid #f0f0f0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: #666666;">Meeting Summary</p>
                    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">${meetingTitle}</h1>
                    <p style="margin: 0; font-size: 14px; color: #666666;">${meetingDate}</p>
                  </td>
                  <td style="text-align: right; vertical-align: top;">
                    <p style="margin: 0; font-size: 20px; font-weight: 400; color: #1a1a1a;">moccet</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Key Points Section -->
          ${keyPointsHtml ? `
          <tr>
            <td style="padding: 28px 40px 24px;">
              <h2 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a1a;">Key Points</h2>
              <ul style="margin: 0; padding: 0 0 0 20px; list-style-type: disc;">
                ${keyPointsHtml}
              </ul>
            </td>
          </tr>
          ` : ''}

          <!-- Action Items Section -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa;">
              <h2 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a1a;">Action Items</h2>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                ${actionItemsHtml}
              </table>
            </td>
          </tr>

          ${decisions.length > 0 ? `
          <!-- Decisions Section -->
          <tr>
            <td style="padding: 24px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a1a;">Key Decisions</h2>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                ${decisionsHtml}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding: 24px 40px 32px; text-align: center;">
              <a href="${viewUrl}" style="display: inline-block; padding: 14px 32px; background-color: #1a1a1a; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; border-radius: 8px;">View Full Summary</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f8f8; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 13px; color: #999999; text-align: center;">
                This summary was generated by moccet notetaker
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;
  const supabase = createAdminClient();

  try {
    // Parse optional recipient from body
    const body = await request.json().catch(() => ({}));
    const customRecipient = body.to;

    // Get meeting with all related data
    const { data: meeting, error: meetingError } = await supabase
      .from('meeting_recordings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Get summaries
    const { data: summaries } = await supabase
      .from('meeting_summaries')
      .select('*')
      .eq('meeting_id', meetingId);

    // Get action items
    const { data: actionItems } = await supabase
      .from('meeting_action_items')
      .select('*')
      .eq('meeting_id', meetingId);

    // Get decisions
    const { data: decisions } = await supabase
      .from('meeting_decisions')
      .select('*')
      .eq('meeting_id', meetingId);

    // Find primary summary (executive)
    const primarySummary = summaries?.find(s => s.is_primary) || summaries?.[0];

    if (!primarySummary) {
      return NextResponse.json({ error: 'No summary available' }, { status: 400 });
    }

    // Determine recipient
    const recipient = customRecipient || meeting.user_email;

    if (!recipient) {
      return NextResponse.json({ error: 'No recipient email' }, { status: 400 });
    }

    // Format meeting date
    const meetingDate = new Date(meeting.scheduled_start).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Generate view URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai';
    const viewUrl = `${appUrl}/moccet-mail/dashboard/meetings/recordings/${meetingId}`;

    // Generate email HTML
    const emailHtml = generateEmailTemplate(
      meeting.title || 'Meeting',
      meetingDate,
      primarySummary,
      actionItems || [],
      decisions || [],
      viewUrl
    );

    // Send via SendGrid
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'team@moccet.com';

    if (!sendGridApiKey) {
      console.error('[SendSummary] SENDGRID_API_KEY not configured');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: recipient }],
            subject: `Meeting Summary: ${meeting.title || 'Your Meeting'}`,
          },
        ],
        from: {
          email: fromEmail,
          name: 'moccet',
        },
        reply_to: {
          email: fromEmail,
        },
        content: [
          {
            type: 'text/html',
            value: emailHtml,
          },
        ],
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('[SendSummary] SendGrid error:', errorText);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // Update meeting record
    await supabase
      .from('meeting_recordings')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    console.log('[SendSummary] Email sent successfully to:', recipient);

    return NextResponse.json({
      success: true,
      message: 'Summary email sent',
      recipient,
    });
  } catch (error) {
    console.error('[SendSummary] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send email' },
      { status: 500 }
    );
  }
}
