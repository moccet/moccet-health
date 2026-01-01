import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { uuidSchema, patchInsightSchema, validateBody, formatZodError } from '@/lib/validation/schemas';

const logger = createLogger('InsightDetailAPI');

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

    // Validate UUID format
    const idValidation = uuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid insight ID format' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('real_time_insights')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Error fetching insight', error, { id });
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
    logger.error('Error fetching insight', error);
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
 * Body (at least one required):
 * - viewed: boolean - Mark as viewed
 * - dismissed: boolean - Mark as dismissed
 * - acted_on: boolean - Mark action taken
 * - action_taken: string - Description of action taken
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Validate UUID format
    const idValidation = uuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid insight ID format' },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validation = validateBody(body, patchInsightSchema);
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 });
    }

    const { viewed, dismissed, acted_on, action_taken } = validation.data;

    const supabase = await createClient();

    // Build update object based on provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (viewed === true) {
      updateData.viewed_at = new Date().toISOString();
    }

    if (dismissed === true) {
      updateData.dismissed_at = new Date().toISOString();
    }

    if (acted_on === true) {
      updateData.acted_on = true;
      if (action_taken) {
        updateData.action_taken = action_taken;
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
      logger.error('Error updating insight', error, { id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info('Insight updated', { id, viewed, dismissed, acted_on });

    return NextResponse.json({
      success: true,
      insight: data,
    });
  } catch (error) {
    logger.error('Error updating insight', error);
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

    // Validate UUID format
    const idValidation = uuidSchema.safeParse(id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: 'Invalid insight ID format' },
        { status: 400 }
      );
    }

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
      logger.error('Error dismissing insight', error, { id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info('Insight dismissed', { id });

    return NextResponse.json({
      success: true,
      message: 'Insight dismissed',
      insight: data,
    });
  } catch (error) {
    logger.error('Error dismissing insight', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
