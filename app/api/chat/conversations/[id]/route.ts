/**
 * Single Chat Conversation API
 *
 * GET /api/chat/conversations/[id] - Get a specific conversation
 * PATCH /api/chat/conversations/[id] - Update a conversation (archive, rename)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/chat/conversations/[id]
 * Get a specific conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', id)
      .eq('user_email', email)
      .single();

    if (error || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Get message count
    const { count: messageCount } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', id);

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        userEmail: conversation.user_email,
        title: conversation.title,
        status: conversation.status,
        messageCount: messageCount || 0,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Chat Conversation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * PATCH /api/chat/conversations/[id]
 * Update a conversation (archive, rename, etc.)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, status, title } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) updates.status = status;
    if (title) updates.title = title;

    const { data: conversation, error } = await supabase
      .from('chat_conversations')
      .update(updates)
      .eq('id', id)
      .eq('user_email', email)
      .select()
      .single();

    if (error) {
      console.error('[Chat Conversation] Update error:', error);
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        userEmail: conversation.user_email,
        title: conversation.title,
        status: conversation.status,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Chat Conversation] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
