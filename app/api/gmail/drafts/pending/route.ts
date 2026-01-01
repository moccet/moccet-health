/**
 * Pending Drafts API
 *
 * GET /api/gmail/drafts/pending
 * Returns AI-generated drafts awaiting user approval before sending.
 * These drafts are shown on the dashboard for user review.
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/gmail/drafts/pending
 * Returns pending drafts for the dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Fetch pending and created drafts (not yet sent)
    const { data, error } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('user_email', email)
      .in('status', ['pending', 'created'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Pending Drafts API] Database error:', error);
      // Return empty array instead of error for better UX
      return NextResponse.json(
        { drafts: [], total: 0 },
        { headers: corsHeaders }
      );
    }

    // Format drafts for dashboard display
    const drafts = (data || []).map((d) => ({
      id: d.id,
      subject: d.draft_subject || `Re: ${d.original_subject}`,
      to: d.original_from || 'Unknown',
      preview: d.draft_body?.substring(0, 100) + (d.draft_body?.length > 100 ? '...' : '') || '',
      createdAt: d.created_at,
      threadId: d.original_thread_id,
      gmailDraftId: d.gmail_draft_id,
      status: d.status,
      originalEmail: {
        messageId: d.original_message_id,
        subject: d.original_subject,
        from: d.original_from,
        fromName: d.original_from_name,
      }
    }));

    return NextResponse.json(
      { drafts, total: drafts.length },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Pending Drafts API] Error:', error);
    return NextResponse.json(
      { drafts: [], total: 0 },
      { headers: corsHeaders }
    );
  }
}

/**
 * POST /api/gmail/drafts/pending
 * Send a pending draft
 *
 * Body: { draftId: string, email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, email } = body;

    if (!draftId || !email) {
      return NextResponse.json(
        { error: 'draftId and email are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Get the draft
    const { data: draft, error: fetchError } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', draftId)
      .eq('user_email', email)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get Gmail access token
    const { token } = await getAccessToken(email, 'gmail');
    if (!token) {
      return NextResponse.json(
        { error: 'Gmail not connected or token expired' },
        { status: 401, headers: corsHeaders }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let messageId: string | null = null;

    // If draft exists in Gmail, send it
    if (draft.gmail_draft_id) {
      const response = await gmail.users.drafts.send({
        userId: 'me',
        requestBody: {
          id: draft.gmail_draft_id,
        },
      });
      messageId = response.data.id || null;
    } else {
      // Create and send the message directly
      const message = [
        `To: ${draft.original_from}`,
        `Subject: ${draft.draft_subject}`,
        draft.original_message_id ? `In-Reply-To: ${draft.original_message_id}` : '',
        draft.original_message_id ? `References: ${draft.original_message_id}` : '',
        'Content-Type: text/plain; charset=utf-8',
        '',
        draft.draft_body,
      ].filter(Boolean).join('\r\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: draft.original_thread_id || undefined,
        },
      });
      messageId = response.data.id || null;
    }

    // Update draft status to sent
    await supabase
      .from('email_drafts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_message_id: messageId,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    return NextResponse.json(
      {
        success: true,
        messageId,
        message: 'Email sent successfully'
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Pending Drafts API] Send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
