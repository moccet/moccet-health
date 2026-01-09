/**
 * Action Items API
 *
 * GET /api/mail/action-items
 * Returns action items for the moccet-mail widget:
 * - Pending drafts (AI-generated, awaiting approval)
 * - Emails labeled "to_respond" (need your response)
 * - Emails labeled "awaiting_reply" (waiting on others)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export interface ActionItem {
  id: string;
  type: 'pending_draft' | 'to_respond' | 'awaiting_reply';
  subject: string;
  from?: string;
  to?: string;
  preview?: string;
  provider: 'gmail' | 'outlook';
  createdAt: string;
  messageId?: string;
  threadId?: string;
}

export interface ActionItemsResponse {
  actionItems: ActionItem[];
  counts: {
    pendingDrafts: number;
    toRespond: number;
    awaitingReply: number;
    total: number;
  };
}

/**
 * GET /api/mail/action-items
 * Returns action items for the dashboard widget
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Fetch all data in parallel
    const [pendingDraftsResult, toRespondResult, awaitingReplyResult] = await Promise.all([
      // Pending drafts (from email_drafts table)
      supabase
        .from('email_drafts')
        .select('*')
        .eq('user_email', email)
        .in('status', ['pending', 'created'])
        .order('created_at', { ascending: false })
        .limit(limit),

      // Emails labeled "to_respond"
      supabase
        .from('email_label_assignments')
        .select('*')
        .eq('user_email', email)
        .eq('label_name', 'to_respond')
        .eq('is_applied', true)
        .order('labeled_at', { ascending: false })
        .limit(limit),

      // Emails labeled "awaiting_reply"
      supabase
        .from('email_label_assignments')
        .select('*')
        .eq('user_email', email)
        .eq('label_name', 'awaiting_reply')
        .eq('is_applied', true)
        .order('labeled_at', { ascending: false })
        .limit(limit),
    ]);

    // Get counts (separate queries for accurate totals)
    const [pendingDraftsCount, toRespondCount, awaitingReplyCount] = await Promise.all([
      supabase
        .from('email_drafts')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email)
        .in('status', ['pending', 'created']),

      supabase
        .from('email_label_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email)
        .eq('label_name', 'to_respond')
        .eq('is_applied', true),

      supabase
        .from('email_label_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email)
        .eq('label_name', 'awaiting_reply')
        .eq('is_applied', true),
    ]);

    // Format pending drafts as action items
    const pendingDraftItems: ActionItem[] = (pendingDraftsResult.data || []).map((d) => ({
      id: d.id,
      type: 'pending_draft' as const,
      subject: d.draft_subject || `Re: ${d.original_subject}`,
      from: d.original_from_name || d.original_from,
      to: d.original_from,
      preview: d.draft_body?.substring(0, 80) + (d.draft_body?.length > 80 ? '...' : '') || '',
      provider: (d.email_provider || 'gmail') as 'gmail' | 'outlook',
      createdAt: d.created_at,
      messageId: d.original_message_id,
      threadId: d.original_thread_id,
    }));

    // Format "to_respond" emails as action items
    const toRespondItems: ActionItem[] = (toRespondResult.data || []).map((e) => ({
      id: e.id,
      type: 'to_respond' as const,
      subject: e.subject || 'No subject',
      from: e.from_email,
      provider: (e.email_provider || 'gmail') as 'gmail' | 'outlook',
      createdAt: e.labeled_at,
      messageId: e.message_id,
      threadId: e.thread_id,
    }));

    // Format "awaiting_reply" emails as action items
    const awaitingReplyItems: ActionItem[] = (awaitingReplyResult.data || []).map((e) => ({
      id: e.id,
      type: 'awaiting_reply' as const,
      subject: e.subject || 'No subject',
      from: e.from_email,
      provider: (e.email_provider || 'gmail') as 'gmail' | 'outlook',
      createdAt: e.labeled_at,
      messageId: e.message_id,
      threadId: e.thread_id,
    }));

    // Combine and sort by date (newest first), then limit to requested count
    const allItems: ActionItem[] = [
      ...pendingDraftItems,
      ...toRespondItems,
      ...awaitingReplyItems,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    const response: ActionItemsResponse = {
      actionItems: allItems,
      counts: {
        pendingDrafts: pendingDraftsCount.count ?? 0,
        toRespond: toRespondCount.count ?? 0,
        awaitingReply: awaitingReplyCount.count ?? 0,
        total: (pendingDraftsCount.count ?? 0) + (toRespondCount.count ?? 0) + (awaitingReplyCount.count ?? 0),
      },
    };

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    console.error('[Action Items API] Error:', error);
    return NextResponse.json(
      {
        actionItems: [],
        counts: { pendingDrafts: 0, toRespond: 0, awaitingReply: 0, total: 0 },
      },
      { headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
