/**
 * Meeting Summary API Route
 *
 * GET /api/meetings/[id]/summary - Get meeting summaries
 * POST /api/meetings/[id]/summary - Regenerate summary with new style/prompt
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { regenerateSummary } from '@/lib/services/meeting-notetaker/summary-generator';
import { SummaryStyle } from '@/lib/services/meeting-notetaker/types';

// ============================================================================
// GET - Get Summaries
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: summaries, error } = await supabase
      .from('meeting_summaries')
      .select('*')
      .eq('meeting_id', id)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('[SummaryAPI] Error fetching summaries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch summaries' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summaries: (summaries || []).map((s) => ({
        id: s.id,
        style: s.summary_style,
        text: s.summary_text,
        keyPoints: s.key_points,
        topicsDiscussed: s.topics_discussed,
        isPrimary: s.is_primary,
        generationModel: s.generation_model,
        customPrompt: s.custom_prompt,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    console.error('[SummaryAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Regenerate Summary
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { style, customPrompt, setPrimary } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    if (!style || !['executive', 'chronological', 'sales'].includes(style)) {
      return NextResponse.json(
        { error: 'Valid summary style is required (executive, chronological, sales)' },
        { status: 400 }
      );
    }

    const result = await regenerateSummary(
      id,
      style as SummaryStyle,
      customPrompt
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate summary' },
        { status: 500 }
      );
    }

    // If setPrimary, update the primary flag
    if (setPrimary) {
      const supabase = createAdminClient();

      // Clear other primary flags
      await supabase
        .from('meeting_summaries')
        .update({ is_primary: false })
        .eq('meeting_id', id);

      // Set this one as primary
      await supabase
        .from('meeting_summaries')
        .update({ is_primary: true })
        .eq('meeting_id', id)
        .eq('summary_style', style);
    }

    return NextResponse.json({
      success: true,
      summary: result.summary,
    });
  } catch (error) {
    console.error('[SummaryAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
