/**
 * Email Drafts Management API
 *
 * GET /api/gmail/drafts
 * List AI-generated email drafts.
 *
 * PATCH /api/gmail/drafts
 * Update draft status (approve, discard, etc.).
 *
 * DELETE /api/gmail/drafts
 * Delete a draft (also removes from Gmail if created there).
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getUserEmail(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = createAdminClient();

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.email) {
        return user.email;
      }
    } catch {
      // Continue
    }
  }
  return null;
}

/**
 * GET /api/gmail/drafts
 * List AI-generated email drafts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const status = searchParams.get('status'); // pending, created, sent, modified, discarded, all
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    let query = supabase
      .from('email_drafts')
      .select('*', { count: 'exact' })
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      throw error;
    }

    // Format drafts for response
    const drafts = (data || []).map((d) => ({
      id: d.id,
      originalEmail: {
        messageId: d.original_message_id,
        threadId: d.original_thread_id,
        from: d.original_from,
        fromName: d.original_from_name,
        subject: d.original_subject,
        snippet: d.original_snippet,
        receivedAt: d.original_received_at,
      },
      draft: {
        gmailDraftId: d.gmail_draft_id,
        subject: d.draft_subject,
        body: d.draft_body,
      },
      classification: {
        emailType: d.email_type,
        urgencyLevel: d.urgency_level,
        confidence: d.confidence_score,
      },
      status: d.status,
      createdAt: d.created_at,
      expiresAt: d.expires_at,
    }));

    return NextResponse.json(
      {
        drafts,
        total: count || 0,
        limit,
        offset,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Drafts API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PATCH /api/gmail/drafts
 * Update draft status
 *
 * Body: { id: string, action: 'approve' | 'discard' | 'mark_sent' | 'mark_modified' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, email } = body;

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Draft id and action are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Get the draft
    const { data: draft, error: fetchError } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', id)
      .eq('user_email', userEmail)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    let newStatus: string;
    let gmailDraftId = draft.gmail_draft_id;

    switch (action) {
      case 'approve':
        // If pending, create in Gmail now
        if (draft.status === 'pending' && !gmailDraftId) {
          const { token } = await getAccessToken(userEmail, 'gmail');
          if (token) {
            const oauth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET
            );
            oauth2Client.setCredentials({ access_token: token });
            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            // Create draft in Gmail
            const message = [
              `To: ${draft.original_from}`,
              `Subject: ${draft.draft_subject}`,
              `In-Reply-To: ${draft.original_message_id}`,
              `References: ${draft.original_message_id}`,
              'Content-Type: text/plain; charset=utf-8',
              '',
              draft.draft_body,
            ].join('\r\n');

            const encodedMessage = Buffer.from(message)
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            const response = await gmail.users.drafts.create({
              userId: 'me',
              requestBody: {
                message: {
                  raw: encodedMessage,
                  threadId: draft.original_thread_id,
                },
              },
            });

            gmailDraftId = response.data.id || null;
          }
        }
        newStatus = 'created';
        break;

      case 'discard':
        // Delete from Gmail if exists
        if (gmailDraftId) {
          const { token } = await getAccessToken(userEmail, 'gmail');
          if (token) {
            try {
              const oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET
              );
              oauth2Client.setCredentials({ access_token: token });
              const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

              await gmail.users.drafts.delete({
                userId: 'me',
                id: gmailDraftId,
              });
            } catch (e) {
              console.warn('[Drafts API] Failed to delete Gmail draft:', e);
            }
          }
          gmailDraftId = null;
        }
        newStatus = 'discarded';
        break;

      case 'mark_sent':
        newStatus = 'sent';
        break;

      case 'mark_modified':
        newStatus = 'modified';
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400, headers: corsHeaders }
        );
    }

    // Update database
    const { error: updateError } = await supabase
      .from('email_drafts')
      .update({
        status: newStatus,
        gmail_draft_id: gmailDraftId,
        gmail_created_at: gmailDraftId && !draft.gmail_draft_id ? new Date().toISOString() : draft.gmail_created_at,
        status_updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json(
      {
        success: true,
        id,
        status: newStatus,
        gmailDraftId,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Drafts API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/gmail/drafts
 * Delete a draft
 *
 * Query: ?id=xxx&email=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id) {
      return NextResponse.json(
        { error: 'Draft id is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let userEmail = await getUserEmail(request);
    if (!userEmail && email) {
      userEmail = email;
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Get draft to check Gmail ID
    const { data: draft } = await supabase
      .from('email_drafts')
      .select('gmail_draft_id')
      .eq('id', id)
      .eq('user_email', userEmail)
      .single();

    // Delete from Gmail if exists
    if (draft?.gmail_draft_id) {
      const { token } = await getAccessToken(userEmail, 'gmail');
      if (token) {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          oauth2Client.setCredentials({ access_token: token });
          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

          await gmail.users.drafts.delete({
            userId: 'me',
            id: draft.gmail_draft_id,
          });
        } catch (e) {
          console.warn('[Drafts API] Failed to delete Gmail draft:', e);
        }
      }
    }

    // Delete from database
    const { error } = await supabase
      .from('email_drafts')
      .delete()
      .eq('id', id)
      .eq('user_email', userEmail);

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { success: true, id },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Drafts API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
