/**
 * Outlook Email Drafts Management API
 *
 * GET /api/outlook/mail/drafts
 * List AI-generated email drafts.
 *
 * PATCH /api/outlook/mail/drafts
 * Update draft status (approve, discard, etc.).
 *
 * DELETE /api/outlook/mail/drafts
 * Delete a draft (also removes from Outlook if created there).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createValidatedOutlookMailClient } from '@/lib/services/outlook-mail-client';

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
 * GET /api/outlook/mail/drafts
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
      .eq('email_provider', 'outlook')
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
        conversationId: d.original_thread_id, // Outlook uses conversationId
        from: d.original_from,
        fromName: d.original_from_name,
        subject: d.original_subject,
        snippet: d.original_snippet,
        receivedAt: d.original_received_at,
      },
      draft: {
        outlookDraftId: d.outlook_draft_id,
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
    console.error('[Outlook Drafts API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PATCH /api/outlook/mail/drafts
 * Update draft status
 *
 * Body: { id: string, action: 'approve' | 'discard' | 'mark_sent' | 'mark_modified' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, email, code } = body;

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
      .eq('email_provider', 'outlook')
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    let newStatus: string;
    let outlookDraftId = draft.outlook_draft_id;

    switch (action) {
      case 'approve':
        // If pending, create in Outlook now
        if (draft.status === 'pending' && !outlookDraftId) {
          const { client } = await createValidatedOutlookMailClient(userEmail, code);
          if (client) {
            // Create reply draft in Outlook
            const replyDraft = await client.createReplyDraft(
              draft.original_message_id,
              draft.draft_body
            );

            // Update the draft with full body
            if (replyDraft.id) {
              await client.updateDraft(replyDraft.id, {
                body: {
                  contentType: 'text',
                  content: draft.draft_body,
                },
              });
              outlookDraftId = replyDraft.id;
            }
          }
        }
        newStatus = 'created';
        break;

      case 'discard':
        // Delete from Outlook if exists
        if (outlookDraftId) {
          const { client } = await createValidatedOutlookMailClient(userEmail, code);
          if (client) {
            try {
              await client.deleteDraft(outlookDraftId);
            } catch (e) {
              console.warn('[Outlook Drafts API] Failed to delete Outlook draft:', e);
            }
          }
          outlookDraftId = null;
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
        outlook_draft_id: outlookDraftId,
        outlook_created_at: outlookDraftId && !draft.outlook_draft_id ? new Date().toISOString() : draft.outlook_created_at,
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
        outlookDraftId,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Outlook Drafts API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * DELETE /api/outlook/mail/drafts
 * Delete a draft
 *
 * Query: ?id=xxx&email=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const email = searchParams.get('email');
    const code = searchParams.get('code');

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

    // Get draft to check Outlook ID
    const { data: draft } = await supabase
      .from('email_drafts')
      .select('outlook_draft_id')
      .eq('id', id)
      .eq('user_email', userEmail)
      .eq('email_provider', 'outlook')
      .single();

    // Delete from Outlook if exists
    if (draft?.outlook_draft_id) {
      const { client } = await createValidatedOutlookMailClient(userEmail, code || undefined);
      if (client) {
        try {
          await client.deleteDraft(draft.outlook_draft_id);
        } catch (e) {
          console.warn('[Outlook Drafts API] Failed to delete Outlook draft:', e);
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
    console.error('[Outlook Drafts API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
