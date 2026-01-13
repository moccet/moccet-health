/**
 * Food Logs API Endpoint
 *
 * GET /api/food/logs?email=xxx&date=YYYY-MM-DD
 * POST /api/food/logs - Create a new food log with achievement checking
 *
 * Retrieves food log entries for a user.
 * - If date is provided, returns logs for that specific day
 * - If no date, returns recent logs (last 7 days)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/services/onesignal-service';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const date = searchParams.get('date'); // Format: YYYY-MM-DD

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    let query = supabase
      .from('sage_food_logs')
      .select('*')
      .eq('user_email', email)
      .order('logged_at', { ascending: false });

    if (date) {
      // Get logs for a specific date
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      query = query.gte('logged_at', startOfDay).lte('logged_at', endOfDay);
    } else {
      // Default: last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query.gte('logged_at', sevenDaysAgo.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[FoodLogs] Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve food logs' },
        { status: 500 }
      );
    }

    // Calculate daily totals if date is provided
    let dailyTotals = null;
    if (date && data && data.length > 0) {
      dailyTotals = data.reduce(
        (acc, log) => ({
          calories: acc.calories + (log.calories || 0),
          protein: acc.protein + (log.protein || 0),
          carbs: acc.carbs + (log.carbs || 0),
          fat: acc.fat + (log.fat || 0),
          fiber: acc.fiber + (log.fiber || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );
    }

    return NextResponse.json({
      success: true,
      logs: data || [],
      count: data?.length || 0,
      dailyTotals,
    });
  } catch (error) {
    console.error('[FoodLogs] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve food logs' },
      { status: 500 }
    );
  }
}

// Meal logging achievement definitions
const MEAL_LOGGING_ACHIEVEMENTS = {
  meal_streak_3: { title: '3-Day Tracker', emoji: '🥗', description: 'Logged meals 3 days in a row', threshold: 3 },
  meal_streak_7: { title: 'Nutrition Week', emoji: '📊', description: 'Logged meals for a full week', threshold: 7 },
  meal_streak_14: { title: 'Logging Pro', emoji: '🏅', description: 'Logged meals for 2 weeks straight', threshold: 14 },
  meal_streak_30: { title: 'Meal Master', emoji: '👑', description: 'Logged meals for a full month', threshold: 30 },
};

// Handle POST for creating a new food log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, food_name, meal_type, calories, protein, carbs, fat, fiber, logged_at, image_url, notes } = body;

    if (!email || !food_name) {
      return NextResponse.json(
        { success: false, error: 'Email and food_name are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Insert the food log
    const { data: foodLog, error } = await supabase
      .from('sage_food_logs')
      .insert({
        user_email: email,
        food_name,
        meal_type: meal_type || 'other',
        calories: calories || 0,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        fiber: fiber || 0,
        logged_at: logged_at || new Date().toISOString(),
        image_url,
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('[FoodLogs] Insert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create food log' },
        { status: 500 }
      );
    }

    // Check for meal logging streak achievements
    const achievementsEarned = await checkMealLoggingAchievements(supabase, email);

    return NextResponse.json({
      success: true,
      log: foodLog,
      achievementsEarned,
    });
  } catch (error) {
    console.error('[FoodLogs] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create food log' },
      { status: 500 }
    );
  }
}

/**
 * Check and grant meal logging streak achievements
 */
async function checkMealLoggingAchievements(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: string
): Promise<Array<{ type: string; title: string; emoji: string }>> {
  const earned: Array<{ type: string; title: string; emoji: string }> = [];

  try {
    // Get existing achievements
    const { data: existing } = await supabase
      .from('health_achievements')
      .select('achievement_type')
      .eq('user_email', email);

    const alreadyEarned = new Set(existing?.map(a => a.achievement_type) || []);

    // Calculate meal logging streak
    const streak = await calculateMealStreak(supabase, email);

    // Check each achievement threshold
    for (const [type, def] of Object.entries(MEAL_LOGGING_ACHIEVEMENTS)) {
      if (streak >= def.threshold && !alreadyEarned.has(type)) {
        // Grant achievement
        const { error } = await supabase.from('health_achievements').insert({
          user_email: email,
          achievement_type: type,
          title: def.title,
          description: def.description,
          emoji: def.emoji,
          streak_days: streak,
          earned_at: new Date().toISOString(),
        });

        if (!error) {
          earned.push({ type, title: def.title, emoji: def.emoji });

          // Send notification
          await sendPushNotification(email, {
            title: `Achievement Unlocked! ${def.emoji}`,
            body: def.title,
            data: {
              type: 'achievement',
              achievement_type: type,
              deep_link: 'sage',
            },
          });
        }
      }
    }

    if (earned.length > 0) {
      console.log(`[FoodLogs] Achievements earned by ${email}:`, earned.map(e => e.type));
    }
  } catch (e) {
    console.error('[FoodLogs] Error checking achievements:', e);
  }

  return earned;
}

/**
 * Calculate consecutive days with meal logs
 */
async function calculateMealStreak(
  supabase: ReturnType<typeof getSupabaseClient>,
  email: string
): Promise<number> {
  // Get distinct dates with food logs, ordered by date descending
  const { data: logs } = await supabase
    .from('sage_food_logs')
    .select('logged_at')
    .eq('user_email', email)
    .order('logged_at', { ascending: false });

  if (!logs || logs.length === 0) return 0;

  // Get unique dates
  const dates = [...new Set(logs.map(l => new Date(l.logged_at).toISOString().split('T')[0]))];
  dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Count consecutive days (including today)
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < dates.length; i++) {
    const logDate = new Date(dates[i]);
    logDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (logDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else if (logDate.getTime() < expectedDate.getTime()) {
      // Missed a day, stop counting
      break;
    }
  }

  return streak;
}

// Handle DELETE for removing a food log entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id || !email) {
      return NextResponse.json(
        { success: false, error: 'Both id and email parameters are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('sage_food_logs')
      .delete()
      .eq('id', id)
      .eq('user_email', email);

    if (error) {
      console.error('[FoodLogs] Delete error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete food log' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FoodLogs] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete food log' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
