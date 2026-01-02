/**
 * Custom Words API Route
 *
 * GET /api/meetings/custom-words - List custom words for a user
 * POST /api/meetings/custom-words - Add a custom word
 * DELETE /api/meetings/custom-words - Remove a custom word
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// ============================================================================
// GET - List Custom Words
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('meeting_custom_words')
      .select('word, category, usage_count, created_at')
      .eq('user_email', email)
      .order('usage_count', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[CustomWordsAPI] Error fetching words:', error);
      return NextResponse.json(
        { error: 'Failed to fetch custom words' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      words: (data || []).map((w) => ({
        word: w.word,
        category: w.category,
        usageCount: w.usage_count,
      })),
    });
  } catch (error) {
    console.error('[CustomWordsAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Add Custom Word
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, word, category } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!word || typeof word !== 'string') {
      return NextResponse.json(
        { error: 'Word is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check count
    const { count } = await supabase
      .from('meeting_custom_words')
      .select('id', { count: 'exact', head: true })
      .eq('user_email', email);

    if (count && count >= 100) {
      return NextResponse.json(
        { error: 'Maximum custom words limit (100) reached' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('meeting_custom_words')
      .upsert(
        {
          user_email: email,
          word: word.trim(),
          category: category || 'other',
        },
        { onConflict: 'user_email,word' }
      )
      .select()
      .single();

    if (error) {
      console.error('[CustomWordsAPI] Error adding word:', error);
      return NextResponse.json(
        { error: 'Failed to add custom word' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      word: {
        word: data.word,
        category: data.category,
      },
    });
  } catch (error) {
    console.error('[CustomWordsAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Remove Custom Word
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, word } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!word) {
      return NextResponse.json(
        { error: 'Word is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from('meeting_custom_words')
      .delete()
      .eq('user_email', email)
      .eq('word', word);

    if (error) {
      console.error('[CustomWordsAPI] Error deleting word:', error);
      return NextResponse.json(
        { error: 'Failed to delete custom word' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CustomWordsAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
