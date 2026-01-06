/**
 * Chat Messages API
 *
 * GET /api/chat/messages - Get messages for a conversation
 * POST /api/chat/messages - Send a message and get AI response
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * GET /api/chat/messages
 * Get messages for a conversation
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Chat Messages] Error fetching:', error);
      return NextResponse.json(
        { messages: [] },
        { headers: corsHeaders }
      );
    }

    // Transform to expected format
    const formattedMessages = (messages || []).map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      role: m.role,
      content: m.content,
      inputSource: m.input_source || 'text',
      intent: m.intent,
      metadata: m.metadata,
      suggestedActions: m.suggested_actions,
      createdAt: m.created_at,
    }));

    return NextResponse.json(
      { messages: formattedMessages },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('[Chat Messages] Error:', error);
    return NextResponse.json(
      { messages: [] },
      { headers: corsHeaders }
    );
  }
}

/**
 * POST /api/chat/messages
 * Send a message and get AI response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, conversationId, content, inputSource, intent } = body;

    if (!email || !conversationId || !content) {
      return NextResponse.json(
        { error: 'email, conversationId, and content are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Create user message
    const userMessageId = `msg_${Date.now()}_user`;
    const { data: userMessage, error: userError } = await supabase
      .from('chat_messages')
      .insert({
        id: userMessageId,
        conversation_id: conversationId,
        role: 'user',
        content: content,
        input_source: inputSource || 'text',
        intent: intent,
        created_at: now,
      })
      .select()
      .single();

    if (userError) {
      console.error('[Chat Messages] Error saving user message:', userError);
    }

    // Generate AI response using GPT-4
    let assistantContent = '';
    try {
      const systemPrompt = `You are Moccet, a friendly and knowledgeable health AI assistant.
You help users with health insights, scheduling, nutrition, fitness, sleep optimization, and general wellness.
Be concise, helpful, and actionable in your responses.
If the user asks about something outside your expertise, acknowledge it and offer to help with health-related topics instead.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      assistantContent = completion.choices[0]?.message?.content || 'I apologize, but I was unable to process your request. Please try again.';
    } catch (aiError) {
      console.error('[Chat Messages] AI error:', aiError);
      assistantContent = 'I apologize, but I encountered an error processing your request. Please try again.';
    }

    // Create assistant message
    const assistantMessageId = `msg_${Date.now()}_assistant`;
    const { data: assistantMessage, error: assistantError } = await supabase
      .from('chat_messages')
      .insert({
        id: assistantMessageId,
        conversation_id: conversationId,
        role: 'assistant',
        content: assistantContent,
        input_source: 'ai',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (assistantError) {
      console.error('[Chat Messages] Error saving assistant message:', assistantError);
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return NextResponse.json({
      userMessage: userMessage ? {
        id: userMessage.id,
        conversationId: userMessage.conversation_id,
        role: userMessage.role,
        content: userMessage.content,
        inputSource: userMessage.input_source,
        createdAt: userMessage.created_at,
      } : {
        id: userMessageId,
        conversationId,
        role: 'user',
        content,
        inputSource: inputSource || 'text',
        createdAt: now,
      },
      assistantMessage: assistantMessage ? {
        id: assistantMessage.id,
        conversationId: assistantMessage.conversation_id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        inputSource: 'ai',
        createdAt: assistantMessage.created_at,
      } : {
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: assistantContent,
        inputSource: 'ai',
        createdAt: new Date().toISOString(),
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Chat Messages] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
