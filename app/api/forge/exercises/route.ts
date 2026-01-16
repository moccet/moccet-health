/**
 * Forge Exercises API
 * Returns exercises from the forge_exercises database
 *
 * GET /api/forge/exercises
 * Query params:
 *   - difficulty: filter by difficulty level (beginner, intermediate, advanced)
 *   - type: filter by exercise type (weightTraining, hiit, cardio, etc.)
 *   - muscle: filter by muscle group (case-insensitive partial match)
 *   - equipment: filter by available equipment (comma-separated)
 *   - compound: filter by compound (true) or isolation (false)
 *   - limit: max number of results (default 100)
 *   - offset: pagination offset (default 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import type { ForgeExercise, DifficultyLevel, ExerciseType } from '@/lib/forge/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const difficulty = searchParams.get('difficulty') as DifficultyLevel | null;
    const exerciseType = searchParams.get('type') as ExerciseType | null;
    const muscle = searchParams.get('muscle');
    const equipment = searchParams.get('equipment');
    const compoundOnly = searchParams.get('compound');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getServiceClient();

    // Build query
    let query = supabase
      .from('forge_exercises')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    // Apply filters
    if (difficulty) {
      query = query.eq('difficulty_level', difficulty);
    }

    if (exerciseType) {
      query = query.eq('exercise_type', exerciseType);
    }

    if (compoundOnly !== null) {
      query = query.eq('is_compound', compoundOnly === 'true');
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: exercises, error, count } = await query;

    if (error) {
      console.error('[ForgeExercises] Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch exercises' },
        { status: 500 }
      );
    }

    // Post-query filtering for JSONB fields
    let filteredExercises = exercises || [];

    // Filter by muscle group (partial match in muscle_groups array)
    if (muscle) {
      const muscleLower = muscle.toLowerCase();
      filteredExercises = filteredExercises.filter((ex: ForgeExercise) => {
        const muscleGroups = (ex.muscle_groups || []) as string[];
        return muscleGroups.some(m => m.toLowerCase().includes(muscleLower));
      });
    }

    // Filter by equipment availability
    if (equipment) {
      const availableEquipment = equipment.split(',').map(e => e.trim().toLowerCase());
      filteredExercises = filteredExercises.filter((ex: ForgeExercise) => {
        const required = (ex.equipment_required || []) as string[];
        // Include if no equipment required or all required equipment is available
        return required.length === 0 || required.every(eq =>
          availableEquipment.some(avail =>
            avail === eq.toLowerCase() || avail === 'bodyweight'
          )
        );
      });
    }

    return NextResponse.json({
      success: true,
      exercises: filteredExercises,
      total: filteredExercises.length,
      limit,
      offset,
    });

  } catch (error) {
    console.error('[ForgeExercises] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/forge/exercises/[id]
 * Get a single exercise by ID
 */
export async function POST(request: NextRequest) {
  // POST method to get exercise by ID (to avoid path param complexity)
  try {
    const { exerciseId } = await request.json();

    if (!exerciseId) {
      return NextResponse.json(
        { success: false, error: 'exerciseId is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    const { data: exercise, error } = await supabase
      .from('forge_exercises')
      .select('*')
      .eq('id', exerciseId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Exercise not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      exercise,
    });

  } catch (error) {
    console.error('[ForgeExercises] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
