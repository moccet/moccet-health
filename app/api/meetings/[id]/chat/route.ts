/**
 * Meeting Transcript Chat API Route
 *
 * POST /api/meetings/[id]/chat - Ask a question about the meeting transcript
 * GET /api/meetings/[id]/chat - Get chat history
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  answerTranscriptQuestion,
  getChatHistory,
} from '@/lib/services/meeting-notetaker/transcript-chat';

// ============================================================================
// POST - Ask Question
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { email, question } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const result = await answerTranscriptQuestion(id, question.trim(), email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process question' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: result.response,
    });
  } catch (error) {
    console.error('[ChatAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - Chat History
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const history = await getChatHistory(id, email, limit);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('[ChatAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
