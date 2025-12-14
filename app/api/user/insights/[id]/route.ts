import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/user/insights/:id
 * Get a single insight by ID
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('real_time_insights')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[Insight API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      insight: data,
    });
  } catch (error) {
    console.error('[Insight API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/insights/:id
 * Update an insight (mark viewed, dismissed, or action taken)
 *
 * Body (all optional):
 * - viewed: boolean - Mark as viewed
 * - dismissed: boolean - Mark as dismissed
 * - acted_on: boolean - Mark action taken
 * - action_taken: string - Description of action taken
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const supabase = await createClient();

    // Build update object based on provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.viewed === true) {
      updateData.viewed_at = new Date().toISOString();
    }

    if (body.dismissed === true) {
      updateData.dismissed_at = new Date().toISOString();
    }

    if (body.acted_on === true) {
      updateData.acted_on = true;
      if (body.action_taken) {
        updateData.action_taken = body.action_taken;
      }
      // Also dismiss when action is taken
      updateData.dismissed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('real_time_insights')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Insight API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      insight: data,
    });
  } catch (error) {
    console.error('[Insight API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/insights/:id
 * Delete an insight (soft delete by dismissing)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('real_time_insights')
      .update({
        dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Insight API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Insight dismissed',
      insight: data,
    });
  } catch (error) {
    console.error('[Insight API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
