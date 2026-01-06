/**
 * Chat Conversations API
 *
 * GET /api/chat/conversations - List user's conversations
 * POST /api/chat/conversations - Create a new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/chat/conversations
 * List user's conversations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_email', email)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Chat Conversations] Error fetching:', error);
      // Return empty array if table doesn't exist or other error
      return NextResponse.json(
        { conversations: [] },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { conversations: conversations || [] },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[Chat Conversations] Error:', error);
    return NextResponse.json(
      { conversations: [] },
      { headers: corsHeaders }
    );
  }
}

/**
 * POST /api/chat/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, title } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Generate conversation ID
    const conversationId = `conv_${Date.now()}`;
    const now = new Date().toISOString();

    // Try to insert into database
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        id: conversationId,
        user_email: email,
        title: title || 'New Conversation',
        status: 'active',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('[Chat Conversations] Error creating:', error);
      // Return a local conversation object if database fails
      return NextResponse.json({
        conversation: {
          id: conversationId,
          userEmail: email,
          title: title || 'New Conversation',
          status: 'active',
          messageCount: 0,
          createdAt: now,
          updatedAt: now,
        },
      }, { headers: corsHeaders });
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        userEmail: conversation.user_email,
        title: conversation.title,
        status: conversation.status,
        messageCount: 0,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Chat Conversations] Error:', error);

    // Return a fallback conversation
    const conversationId = `conv_${Date.now()}`;
    const now = new Date().toISOString();

    return NextResponse.json({
      conversation: {
        id: conversationId,
        userEmail: '',
        title: 'New Conversation',
        status: 'active',
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    }, { headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
