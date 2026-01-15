/**
 * Streaks API
 * GET /api/streaks - Get user's streak dashboard data
 * POST /api/streaks - Update/refresh streak data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type StreakType =
  | 'sleep_logging'
  | 'activity'
  | 'meal_logging'
  | 'hydration'
  | 'check_in'
  | 'meditation'
  | 'weight_logging'
  | 'glucose_logging';

interface StreakData {
  type: StreakType;
  displayName: string;
  currentDays: number;
  personalBest: number;
  nextMilestone: number;
  daysToMilestone: number;
  atRisk: boolean;
  lastActivityDate: string | null;
  startedAt: string | null;
}

interface StreakDashboard {
  activeStreaks: StreakData[];
  totalStreakDays: number;
  streakScore: number;
  longestCurrentStreak: StreakData | null;
  atRiskStreaks: StreakData[];
  recentMilestones: Array<{ type: StreakType; milestone: number; achievedAt: string }>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const STREAK_DISPLAY_NAMES: Record<StreakType, string> = {
  sleep_logging: 'Sleep Logging',
  activity: 'Daily Activity',
  meal_logging: 'Meal Logging',
  hydration: 'Hydration',
  check_in: 'Daily Check-in',
  meditation: 'Meditation',
  weight_logging: 'Weight Logging',
  glucose_logging: 'Glucose Logging',
};

const MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getNextMilestone(currentDays: number): number {
  for (const milestone of MILESTONES) {
    if (currentDays < milestone) return milestone;
  }
  // After 365, next milestone is every 365 days
  return Math.ceil((currentDays + 1) / 365) * 365;
}

function calculateStreakScore(streaks: StreakData[]): number {
  let score = 0;
  for (const streak of streaks) {
    // Base score: 10 points per day
    score += streak.currentDays * 10;

    // Milestone bonus: 50 points per milestone passed
    for (const milestone of MILESTONES) {
      if (streak.currentDays >= milestone) {
        score += 50;
      }
    }

    // Consistency bonus: extra points for long streaks
    if (streak.currentDays >= 30) score += 100;
    if (streak.currentDays >= 60) score += 200;
    if (streak.currentDays >= 90) score += 300;
  }
  return score;
}

function isStreakAtRisk(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;

  const last = new Date(lastActivityDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);

  // At risk if last activity was yesterday (not yet logged today)
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

async function getStreaksFromDB(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<StreakData[]> {
  const { data: streaks } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_email', userEmail);

  if (!streaks || streaks.length === 0) {
    // Initialize default streaks if none exist
    const defaultTypes: StreakType[] = [
      'sleep_logging', 'activity', 'meal_logging', 'hydration', 'check_in'
    ];

    const newStreaks = defaultTypes.map(type => ({
      id: crypto.randomUUID(),
      user_email: userEmail,
      streak_type: type,
      current_days: 0,
      personal_best: 0,
      last_activity_date: null,
      started_at: null,
      updated_at: new Date().toISOString(),
    }));

    await supabase.from('user_streaks').insert(newStreaks);

    return defaultTypes.map(type => ({
      type,
      displayName: STREAK_DISPLAY_NAMES[type],
      currentDays: 0,
      personalBest: 0,
      nextMilestone: 3,
      daysToMilestone: 3,
      atRisk: false,
      lastActivityDate: null,
      startedAt: null,
    }));
  }

  return streaks.map((s: any) => {
    const currentDays = s.current_days || 0;
    const nextMilestone = getNextMilestone(currentDays);

    return {
      type: s.streak_type as StreakType,
      displayName: STREAK_DISPLAY_NAMES[s.streak_type as StreakType] || s.streak_type,
      currentDays,
      personalBest: s.personal_best || 0,
      nextMilestone,
      daysToMilestone: nextMilestone - currentDays,
      atRisk: isStreakAtRisk(s.last_activity_date),
      lastActivityDate: s.last_activity_date,
      startedAt: s.started_at,
    };
  });
}

async function updateStreak(
  userEmail: string,
  streakType: StreakType,
  supabase: ReturnType<typeof createClient>
): Promise<StreakData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get current streak
  const { data: existing } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_email', userEmail)
    .eq('streak_type', streakType)
    .single();

  let currentDays = 1;
  let personalBest = 1;
  let startedAt = todayStr;

  if (existing) {
    const lastDate = existing.last_activity_date;

    if (lastDate === todayStr) {
      // Already logged today, no change
      const nextMilestone = getNextMilestone(existing.current_days);
      return {
        type: streakType,
        displayName: STREAK_DISPLAY_NAMES[streakType],
        currentDays: existing.current_days,
        personalBest: existing.personal_best,
        nextMilestone,
        daysToMilestone: nextMilestone - existing.current_days,
        atRisk: false,
        lastActivityDate: lastDate,
        startedAt: existing.started_at,
      };
    }

    const lastActivity = new Date(lastDate);
    lastActivity.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Continuing streak
      currentDays = existing.current_days + 1;
      startedAt = existing.started_at || todayStr;
    } else if (diffDays > 1) {
      // Streak broken, start fresh
      currentDays = 1;
      startedAt = todayStr;
    }

    personalBest = Math.max(currentDays, existing.personal_best || 0);
  }

  // Upsert streak
  await supabase
    .from('user_streaks')
    .upsert({
      user_email: userEmail,
      streak_type: streakType,
      current_days: currentDays,
      personal_best: personalBest,
      last_activity_date: todayStr,
      started_at: startedAt,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email,streak_type',
    });

  // Check for milestone achievements
  for (const milestone of MILESTONES) {
    if (currentDays === milestone) {
      await recordMilestone(userEmail, streakType, milestone, supabase);
    }
  }

  const nextMilestone = getNextMilestone(currentDays);
  return {
    type: streakType,
    displayName: STREAK_DISPLAY_NAMES[streakType],
    currentDays,
    personalBest,
    nextMilestone,
    daysToMilestone: nextMilestone - currentDays,
    atRisk: false,
    lastActivityDate: todayStr,
    startedAt,
  };
}

async function recordMilestone(
  userEmail: string,
  streakType: StreakType,
  milestone: number,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  await supabase.from('streak_milestones').insert({
    id: crypto.randomUUID(),
    user_email: userEmail,
    streak_type: streakType,
    milestone,
    achieved_at: new Date().toISOString(),
  });
}

async function getRecentMilestones(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<Array<{ type: StreakType; milestone: number; achievedAt: string }>> {
  const { data } = await supabase
    .from('streak_milestones')
    .select('streak_type, milestone, achieved_at')
    .eq('user_email', userEmail)
    .order('achieved_at', { ascending: false })
    .limit(10);

  return (data || []).map(m => ({
    type: m.streak_type as StreakType,
    milestone: m.milestone,
    achievedAt: m.achieved_at,
  }));
}

async function calculateStreaksFromActivity(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // Calculate sleep streak from sleep logs
  const { data: sleepLogs } = await supabase
    .from('oura_sleep_periods')
    .select('day')
    .eq('user_email', userEmail)
    .order('day', { ascending: false })
    .limit(365);

  if (sleepLogs && sleepLogs.length > 0) {
    const streak = calculateConsecutiveDays(sleepLogs.map(s => s.day));
    if (streak > 0) {
      await updateStreakDirectly(userEmail, 'sleep_logging', streak, sleepLogs[0].day, supabase);
    }
  }

  // Calculate meal logging streak from sage
  const { data: mealLogs } = await supabase
    .from('sage_daily_intake')
    .select('date')
    .eq('user_email', userEmail)
    .order('date', { ascending: false })
    .limit(365);

  if (mealLogs && mealLogs.length > 0) {
    const streak = calculateConsecutiveDays(mealLogs.map(m => m.date));
    if (streak > 0) {
      await updateStreakDirectly(userEmail, 'meal_logging', streak, mealLogs[0].date, supabase);
    }
  }

  // Calculate hydration streak from water intake
  const { data: waterLogs } = await supabase
    .from('user_water_intake')
    .select('date')
    .eq('user_email', userEmail)
    .order('date', { ascending: false })
    .limit(365);

  if (waterLogs && waterLogs.length > 0) {
    const uniqueDates = [...new Set(waterLogs.map(w => w.date))];
    const streak = calculateConsecutiveDays(uniqueDates);
    if (streak > 0) {
      await updateStreakDirectly(userEmail, 'hydration', streak, uniqueDates[0], supabase);
    }
  }

  // Calculate weight logging streak
  const { data: weightLogs } = await supabase
    .from('user_weight_log')
    .select('date')
    .eq('user_email', userEmail)
    .order('date', { ascending: false })
    .limit(365);

  if (weightLogs && weightLogs.length > 0) {
    const streak = calculateConsecutiveDays(weightLogs.map(w => w.date));
    if (streak > 0) {
      await updateStreakDirectly(userEmail, 'weight_logging', streak, weightLogs[0].date, supabase);
    }
  }

  // Calculate check-in streak from conversation history
  const { data: checkins } = await supabase
    .from('user_conversation_history')
    .select('created_at')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(365);

  if (checkins && checkins.length > 0) {
    const dates = checkins.map(c => new Date(c.created_at).toISOString().split('T')[0]);
    const uniqueDates = [...new Set(dates)];
    const streak = calculateConsecutiveDays(uniqueDates);
    if (streak > 0) {
      await updateStreakDirectly(userEmail, 'check_in', streak, uniqueDates[0], supabase);
    }
  }
}

function calculateConsecutiveDays(dates: string[]): number {
  if (dates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort dates descending (most recent first)
  const sortedDates = [...new Set(dates)]
    .map(d => new Date(d))
    .sort((a, b) => b.getTime() - a.getTime());

  // Check if most recent is today or yesterday
  const mostRecent = sortedDates[0];
  mostRecent.setHours(0, 0, 0, 0);
  const daysSinceLast = Math.floor((today.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceLast > 1) return 0; // Streak broken

  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = sortedDates[i - 1];
    const curr = sortedDates[i];
    prev.setHours(0, 0, 0, 0);
    curr.setHours(0, 0, 0, 0);

    const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function updateStreakDirectly(
  userEmail: string,
  streakType: StreakType,
  currentDays: number,
  lastActivityDate: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const { data: existing } = await supabase
    .from('user_streaks')
    .select('personal_best, started_at')
    .eq('user_email', userEmail)
    .eq('streak_type', streakType)
    .single();

  const personalBest = Math.max(currentDays, existing?.personal_best || 0);
  const startDate = new Date(lastActivityDate);
  startDate.setDate(startDate.getDate() - currentDays + 1);

  await supabase
    .from('user_streaks')
    .upsert({
      user_email: userEmail,
      streak_type: streakType,
      current_days: currentDays,
      personal_best: personalBest,
      last_activity_date: lastActivityDate,
      started_at: existing?.started_at || startDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email,streak_type',
    });
}

// =============================================================================
// API HANDLERS
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');
    const refresh = searchParams.get('refresh') === 'true';

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Optionally refresh streaks from activity data
    if (refresh) {
      await calculateStreaksFromActivity(userEmail, supabase);
    }

    const streaks = await getStreaksFromDB(userEmail, supabase);
    const recentMilestones = await getRecentMilestones(userEmail, supabase);

    const activeStreaks = streaks.filter(s => s.currentDays > 0);
    const atRiskStreaks = streaks.filter(s => s.atRisk);
    const totalStreakDays = streaks.reduce((sum, s) => sum + s.currentDays, 0);
    const streakScore = calculateStreakScore(streaks);

    const longestCurrentStreak = activeStreaks.length > 0
      ? activeStreaks.reduce((max, s) => s.currentDays > max.currentDays ? s : max)
      : null;

    const dashboard: StreakDashboard = {
      activeStreaks,
      totalStreakDays,
      streakScore,
      longestCurrentStreak,
      atRiskStreaks,
      recentMilestones,
    };

    return NextResponse.json({
      success: true,
      dashboard,
    });
  } catch (error) {
    console.error('[Streaks API] GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get streaks',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email: userEmail, streakType, action } = body;

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (action === 'refresh') {
      // Recalculate all streaks from activity data
      await calculateStreaksFromActivity(userEmail, supabase);
      const streaks = await getStreaksFromDB(userEmail, supabase);

      return NextResponse.json({
        success: true,
        message: 'Streaks refreshed from activity data',
        streaks,
      });
    }

    if (action === 'log' && streakType) {
      // Log an activity for a streak
      const updatedStreak = await updateStreak(userEmail, streakType as StreakType, supabase);

      return NextResponse.json({
        success: true,
        streak: updatedStreak,
        milestoneReached: MILESTONES.includes(updatedStreak.currentDays)
          ? updatedStreak.currentDays
          : null,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "refresh" or "log" with streakType.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Streaks API] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update streaks',
      },
      { status: 500 }
    );
  }
}
