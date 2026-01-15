/**
 * Leaderboard API Route
 *
 * Provides social competition features with weekly/monthly leaderboards
 * for various health metrics like steps, sleep consistency, glucose control, etc.
 *
 * GET /api/leaderboard?type=weekly_steps&email=user@example.com
 * POST /api/leaderboard - Update user's leaderboard score
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type LeaderboardType =
  | 'weekly_steps'
  | 'weekly_active_minutes'
  | 'sleep_consistency'
  | 'glucose_control'
  | 'streak_champion'
  | 'goal_completion'
  | 'check_in_consistency'
  | 'overall_wellness';

export type LeaderboardScope = 'global' | 'friends' | 'group';
export type TimeFrame = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  scoreFormatted: string;
  streak?: number;
  trend: 'up' | 'down' | 'stable';
  previousRank?: number;
  isFriend: boolean;
  isCurrentUser: boolean;
  badges?: string[];
}

export interface LeaderboardResponse {
  type: LeaderboardType;
  scope: LeaderboardScope;
  timeFrame: TimeFrame;
  periodStart: string;
  periodEnd: string;
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry;
  totalParticipants: number;
  lastUpdated: string;
  nextUpdateAt: string;
}

export interface UserLeaderboardStats {
  userEmail: string;
  currentRanks: Record<LeaderboardType, number | null>;
  bestRanks: Record<LeaderboardType, number | null>;
  totalPoints: number;
  percentile: number;
  topLeaderboards: Array<{
    type: LeaderboardType;
    rank: number;
    score: number;
  }>;
}

// ============================================================================
// Configuration
// ============================================================================

const LEADERBOARD_CONFIG: Record<LeaderboardType, {
  name: string;
  description: string;
  scoreUnit: string;
  higherIsBetter: boolean;
  minParticipants: number;
  refreshIntervalMinutes: number;
}> = {
  weekly_steps: {
    name: 'Weekly Steps',
    description: 'Total steps walked this week',
    scoreUnit: 'steps',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 60,
  },
  weekly_active_minutes: {
    name: 'Active Minutes',
    description: 'Total active minutes this week',
    scoreUnit: 'minutes',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 60,
  },
  sleep_consistency: {
    name: 'Sleep Consistency',
    description: 'How consistent your sleep schedule is',
    scoreUnit: '%',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 360,
  },
  glucose_control: {
    name: 'Glucose Control',
    description: 'Time in healthy glucose range',
    scoreUnit: '%',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 360,
  },
  streak_champion: {
    name: 'Streak Champion',
    description: 'Combined streak days across all categories',
    scoreUnit: 'days',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 60,
  },
  goal_completion: {
    name: 'Goal Crusher',
    description: 'Percentage of goals completed',
    scoreUnit: '%',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 360,
  },
  check_in_consistency: {
    name: 'Check-in Champion',
    description: 'Consistency in daily check-ins',
    scoreUnit: '%',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 360,
  },
  overall_wellness: {
    name: 'Wellness Leader',
    description: 'Combined score across all metrics',
    scoreUnit: 'points',
    higherIsBetter: true,
    minParticipants: 3,
    refreshIntervalMinutes: 60,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getWeekBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getMonthBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function formatScore(score: number, unit: string): string {
  if (unit === 'steps') {
    return score >= 1000 ? `${(score / 1000).toFixed(1)}k` : score.toString();
  }
  if (unit === '%') {
    return `${Math.round(score)}%`;
  }
  if (unit === 'minutes') {
    if (score >= 60) {
      const hours = Math.floor(score / 60);
      const mins = score % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${score}m`;
  }
  if (unit === 'days') {
    return `${score} days`;
  }
  if (unit === 'points') {
    return score.toLocaleString();
  }
  return score.toString();
}

function calculateTrend(currentRank: number, previousRank: number | null): 'up' | 'down' | 'stable' {
  if (previousRank === null) return 'stable';
  if (currentRank < previousRank) return 'up';
  if (currentRank > previousRank) return 'down';
  return 'stable';
}

function getNextUpdateTime(refreshIntervalMinutes: number): Date {
  const now = new Date();
  const minutesSinceHour = now.getMinutes();
  const intervalsPassed = Math.floor(minutesSinceHour / refreshIntervalMinutes);
  const nextIntervalMinute = (intervalsPassed + 1) * refreshIntervalMinutes;

  const next = new Date(now);
  if (nextIntervalMinute >= 60) {
    next.setHours(next.getHours() + 1);
    next.setMinutes(nextIntervalMinute - 60);
  } else {
    next.setMinutes(nextIntervalMinute);
  }
  next.setSeconds(0);
  next.setMilliseconds(0);

  return next;
}

async function getUserFriends(
  userEmail: string,
  supabase: any
): Promise<string[]> {
  const { data } = await supabase
    .from('social_connections')
    .select('friend_email')
    .eq('user_email', userEmail)
    .eq('status', 'accepted');

  if (!data) return [];

  type FriendRow = { friend_email: string };
  return (data as FriendRow[]).map(row => row.friend_email);
}

async function getUserDisplayInfo(
  userEmail: string,
  supabase: any
): Promise<{ displayName: string; avatarUrl?: string }> {
  const { data } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('email', userEmail)
    .single();

  if (!data) {
    return { displayName: userEmail.split('@')[0] };
  }

  type UserRow = { name?: string; avatar_url?: string };
  const user = data as UserRow;

  return {
    displayName: user.name || userEmail.split('@')[0],
    avatarUrl: user.avatar_url,
  };
}

async function getUserBadges(
  userEmail: string,
  supabase: any
): Promise<string[]> {
  const { data } = await supabase
    .from('achievements')
    .select('badge_id')
    .eq('user_email', userEmail)
    .eq('is_displayed', true)
    .order('earned_at', { ascending: false })
    .limit(3);

  if (!data) return [];

  type AchievementRow = { badge_id: string };
  return (data as AchievementRow[]).map(row => row.badge_id);
}

// ============================================================================
// Score Calculation Functions
// ============================================================================

async function calculateWeeklySteps(
  userEmail: string,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const { data } = await supabase
    .from('daily_metrics')
    .select('steps')
    .eq('user_email', userEmail)
    .gte('date', periodStart.toISOString().split('T')[0])
    .lte('date', periodEnd.toISOString().split('T')[0]);

  if (!data) return 0;

  type MetricRow = { steps?: number };
  return (data as MetricRow[]).reduce((sum, row) => sum + (row.steps || 0), 0);
}

async function calculateActiveMinutes(
  userEmail: string,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const { data } = await supabase
    .from('daily_metrics')
    .select('active_minutes')
    .eq('user_email', userEmail)
    .gte('date', periodStart.toISOString().split('T')[0])
    .lte('date', periodEnd.toISOString().split('T')[0]);

  if (!data) return 0;

  type MetricRow = { active_minutes?: number };
  return (data as MetricRow[]).reduce((sum, row) => sum + (row.active_minutes || 0), 0);
}

async function calculateSleepConsistency(
  userEmail: string,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const { data } = await supabase
    .from('sleep_logs')
    .select('bedtime, wake_time')
    .eq('user_email', userEmail)
    .gte('date', periodStart.toISOString().split('T')[0])
    .lte('date', periodEnd.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (!data || data.length < 3) return 0;

  type SleepRow = { bedtime?: string; wake_time?: string };
  const sleepData = data as SleepRow[];

  // Calculate standard deviation of bedtimes
  const bedtimeMinutes = sleepData
    .filter(row => row.bedtime)
    .map(row => {
      const [hours, minutes] = (row.bedtime || '').split(':').map(Number);
      return hours * 60 + minutes;
    });

  if (bedtimeMinutes.length < 3) return 0;

  const avgBedtime = bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length;
  const variance = bedtimeMinutes.reduce((sum, bt) => sum + Math.pow(bt - avgBedtime, 2), 0) / bedtimeMinutes.length;
  const stdDev = Math.sqrt(variance);

  // Convert to consistency score (lower std dev = higher consistency)
  // Perfect consistency (stdDev=0) = 100%, 60min stdDev = ~50%
  const consistencyScore = Math.max(0, 100 - (stdDev / 60) * 50);

  return Math.round(consistencyScore);
}

async function calculateGlucoseControl(
  userEmail: string,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const { data } = await supabase
    .from('glucose_readings')
    .select('value')
    .eq('user_email', userEmail)
    .gte('timestamp', periodStart.toISOString())
    .lte('timestamp', periodEnd.toISOString());

  if (!data || data.length === 0) return 0;

  type GlucoseRow = { value: number };
  const readings = data as GlucoseRow[];

  // Time in range: 70-140 mg/dL is healthy
  const inRangeCount = readings.filter(r => r.value >= 70 && r.value <= 140).length;
  const tirPercentage = (inRangeCount / readings.length) * 100;

  return Math.round(tirPercentage);
}

async function calculateStreakScore(
  userEmail: string,
  supabase: any
): Promise<number> {
  const { data } = await supabase
    .from('user_streaks')
    .select('current_days')
    .eq('user_email', userEmail);

  if (!data) return 0;

  type StreakRow = { current_days?: number };
  return (data as StreakRow[]).reduce((sum, row) => sum + (row.current_days || 0), 0);
}

async function calculateGoalCompletion(
  userEmail: string,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const { data } = await supabase
    .from('goals')
    .select('status')
    .eq('user_email', userEmail)
    .gte('target_date', periodStart.toISOString().split('T')[0])
    .lte('target_date', periodEnd.toISOString().split('T')[0]);

  if (!data || data.length === 0) return 0;

  type GoalRow = { status: string };
  const goals = data as GoalRow[];
  const completed = goals.filter(g => g.status === 'completed').length;

  return Math.round((completed / goals.length) * 100);
}

async function calculateCheckInConsistency(
  userEmail: string,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const { data } = await supabase
    .from('daily_checkins')
    .select('date')
    .eq('user_email', userEmail)
    .gte('date', periodStart.toISOString().split('T')[0])
    .lte('date', periodEnd.toISOString().split('T')[0]);

  if (!data) return 0;

  const daysDiff = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysUntilToday = Math.min(daysDiff, Math.ceil((Date.now() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));

  return Math.round((data.length / daysUntilToday) * 100);
}

async function calculateOverallWellness(
  userEmail: string,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  // Weighted combination of all scores
  const [steps, active, sleep, glucose, streaks, goals, checkIns] = await Promise.all([
    calculateWeeklySteps(userEmail, supabase, periodStart, periodEnd),
    calculateActiveMinutes(userEmail, supabase, periodStart, periodEnd),
    calculateSleepConsistency(userEmail, supabase, periodStart, periodEnd),
    calculateGlucoseControl(userEmail, supabase, periodStart, periodEnd),
    calculateStreakScore(userEmail, supabase),
    calculateGoalCompletion(userEmail, supabase, periodStart, periodEnd),
    calculateCheckInConsistency(userEmail, supabase, periodStart, periodEnd),
  ]);

  // Normalize and weight
  const stepsNorm = Math.min(100, (steps / 70000) * 100); // 10k/day = 100%
  const activeNorm = Math.min(100, (active / 210) * 100); // 30min/day = 100%
  const streakNorm = Math.min(100, (streaks / 50) * 100); // 50 total streak days = 100%

  const overallScore =
    stepsNorm * 0.15 +
    activeNorm * 0.15 +
    sleep * 0.20 +
    glucose * 0.15 +
    streakNorm * 0.15 +
    goals * 0.10 +
    checkIns * 0.10;

  return Math.round(overallScore * 10); // Scale to 0-1000 points
}

async function calculateUserScore(
  userEmail: string,
  leaderboardType: LeaderboardType,
  supabase: any,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  switch (leaderboardType) {
    case 'weekly_steps':
      return calculateWeeklySteps(userEmail, supabase, periodStart, periodEnd);
    case 'weekly_active_minutes':
      return calculateActiveMinutes(userEmail, supabase, periodStart, periodEnd);
    case 'sleep_consistency':
      return calculateSleepConsistency(userEmail, supabase, periodStart, periodEnd);
    case 'glucose_control':
      return calculateGlucoseControl(userEmail, supabase, periodStart, periodEnd);
    case 'streak_champion':
      return calculateStreakScore(userEmail, supabase);
    case 'goal_completion':
      return calculateGoalCompletion(userEmail, supabase, periodStart, periodEnd);
    case 'check_in_consistency':
      return calculateCheckInConsistency(userEmail, supabase, periodStart, periodEnd);
    case 'overall_wellness':
      return calculateOverallWellness(userEmail, supabase, periodStart, periodEnd);
    default:
      return 0;
  }
}

// ============================================================================
// Main Leaderboard Functions
// ============================================================================

async function getLeaderboard(
  type: LeaderboardType,
  scope: LeaderboardScope,
  timeFrame: TimeFrame,
  userEmail: string,
  supabase: any
): Promise<LeaderboardResponse> {
  const config = LEADERBOARD_CONFIG[type];

  // Get period boundaries
  const { start: periodStart, end: periodEnd } =
    timeFrame === 'weekly' ? getWeekBoundaries() : getMonthBoundaries();

  // Get cached leaderboard or calculate fresh
  const { data: cachedData } = await supabase
    .from('leaderboard_cache')
    .select('*')
    .eq('leaderboard_type', type)
    .eq('week_start', periodStart.toISOString().split('T')[0])
    .order('rank', { ascending: true });

  type CacheRow = {
    user_email: string;
    score: number;
    rank: number;
    previous_rank?: number;
    updated_at: string;
  };

  const cached = cachedData as CacheRow[] | null;

  // Check if cache is fresh
  const cacheAge = cached && cached[0]
    ? Date.now() - new Date(cached[0].updated_at).getTime()
    : Infinity;
  const cacheFresh = cacheAge < config.refreshIntervalMinutes * 60 * 1000;

  let leaderboardData: CacheRow[];

  if (cached && cacheFresh) {
    leaderboardData = cached;
  } else {
    // Calculate fresh leaderboard
    leaderboardData = await refreshLeaderboard(type, periodStart, periodEnd, supabase);
  }

  // Filter by scope
  let filteredData = leaderboardData;
  if (scope === 'friends') {
    const friends = await getUserFriends(userEmail, supabase);
    friends.push(userEmail); // Include self
    filteredData = leaderboardData.filter(row => friends.includes(row.user_email));
    // Re-rank within friends
    filteredData = filteredData.map((row, idx) => ({ ...row, rank: idx + 1 }));
  }

  // Build entries with user info
  const entries: LeaderboardEntry[] = await Promise.all(
    filteredData.slice(0, 100).map(async (row, idx) => {
      const { displayName, avatarUrl } = await getUserDisplayInfo(row.user_email, supabase);
      const badges = await getUserBadges(row.user_email, supabase);
      const friends = await getUserFriends(userEmail, supabase);

      return {
        rank: idx + 1,
        userId: row.user_email,
        displayName,
        avatarUrl,
        score: row.score,
        scoreFormatted: formatScore(row.score, config.scoreUnit),
        trend: calculateTrend(idx + 1, row.previous_rank || null),
        previousRank: row.previous_rank,
        isFriend: friends.includes(row.user_email),
        isCurrentUser: row.user_email === userEmail,
        badges,
      };
    })
  );

  // Find current user's entry
  const currentUserEntry = entries.find(e => e.isCurrentUser);

  // If user not in top 100, fetch their position
  let userEntryToReturn = currentUserEntry;
  if (!userEntryToReturn) {
    const userRow = filteredData.find(row => row.user_email === userEmail);
    if (userRow) {
      const { displayName, avatarUrl } = await getUserDisplayInfo(userEmail, supabase);
      const badges = await getUserBadges(userEmail, supabase);
      userEntryToReturn = {
        rank: userRow.rank,
        userId: userEmail,
        displayName,
        avatarUrl,
        score: userRow.score,
        scoreFormatted: formatScore(userRow.score, config.scoreUnit),
        trend: calculateTrend(userRow.rank, userRow.previous_rank || null),
        previousRank: userRow.previous_rank,
        isFriend: false,
        isCurrentUser: true,
        badges,
      };
    }
  }

  return {
    type,
    scope,
    timeFrame,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    entries,
    currentUserEntry: userEntryToReturn,
    totalParticipants: filteredData.length,
    lastUpdated: new Date().toISOString(),
    nextUpdateAt: getNextUpdateTime(config.refreshIntervalMinutes).toISOString(),
  };
}

async function refreshLeaderboard(
  type: LeaderboardType,
  periodStart: Date,
  periodEnd: Date,
  supabase: any
): Promise<Array<{
  user_email: string;
  score: number;
  rank: number;
  previous_rank?: number;
  updated_at: string;
}>> {
  const config = LEADERBOARD_CONFIG[type];

  // Get all active users
  const { data: users } = await supabase
    .from('users')
    .select('email')
    .eq('is_active', true);

  if (!users) return [];

  type UserRow = { email: string };
  const userList = users as UserRow[];

  // Calculate scores for all users
  const scores = await Promise.all(
    userList.map(async (user) => {
      const score = await calculateUserScore(user.email, type, supabase, periodStart, periodEnd);
      return { email: user.email, score };
    })
  );

  // Sort by score
  const sorted = scores
    .filter(s => s.score > 0)
    .sort((a, b) => config.higherIsBetter ? b.score - a.score : a.score - b.score);

  // Get previous ranks
  const { data: previousRanks } = await supabase
    .from('leaderboard_cache')
    .select('user_email, rank')
    .eq('leaderboard_type', type)
    .eq('week_start', new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  type PrevRankRow = { user_email: string; rank: number };
  const prevRankMap = new Map(
    ((previousRanks || []) as PrevRankRow[]).map(r => [r.user_email, r.rank])
  );

  // Build ranked data
  const rankedData = sorted.map((item, idx) => ({
    user_email: item.email,
    score: item.score,
    rank: idx + 1,
    previous_rank: prevRankMap.get(item.email),
    updated_at: new Date().toISOString(),
  }));

  // Update cache
  const weekStart = periodStart.toISOString().split('T')[0];

  // Delete old cache entries for this leaderboard
  await supabase
    .from('leaderboard_cache')
    .delete()
    .eq('leaderboard_type', type)
    .eq('week_start', weekStart);

  // Insert new entries
  if (rankedData.length > 0) {
    const insertData = rankedData.map(row => ({
      leaderboard_type: type,
      user_email: row.user_email,
      score: row.score,
      rank: row.rank,
      week_start: weekStart,
      updated_at: row.updated_at,
    }));
    await (supabase.from('leaderboard_cache') as any).insert(insertData);
  }

  return rankedData;
}

async function getUserLeaderboardStats(
  userEmail: string,
  supabase: any
): Promise<UserLeaderboardStats> {
  const { start: periodStart } = getWeekBoundaries();

  // Get ranks for all leaderboard types
  const currentRanks: Record<LeaderboardType, number | null> = {} as Record<LeaderboardType, number | null>;
  const bestRanks: Record<LeaderboardType, number | null> = {} as Record<LeaderboardType, number | null>;
  const topLeaderboards: Array<{ type: LeaderboardType; rank: number; score: number }> = [];

  for (const type of Object.keys(LEADERBOARD_CONFIG) as LeaderboardType[]) {
    // Current rank
    const { data: current } = await supabase
      .from('leaderboard_cache')
      .select('rank, score')
      .eq('leaderboard_type', type)
      .eq('user_email', userEmail)
      .eq('week_start', periodStart.toISOString().split('T')[0])
      .single();

    type RankRow = { rank: number; score: number };
    const currentData = current as RankRow | null;
    currentRanks[type] = currentData?.rank || null;

    if (currentData) {
      topLeaderboards.push({ type, rank: currentData.rank, score: currentData.score });
    }

    // Best rank ever
    const { data: best } = await supabase
      .from('leaderboard_cache')
      .select('rank')
      .eq('leaderboard_type', type)
      .eq('user_email', userEmail)
      .order('rank', { ascending: true })
      .limit(1)
      .single();

    type BestRankRow = { rank: number };
    const bestData = best as BestRankRow | null;
    bestRanks[type] = bestData?.rank || null;
  }

  // Sort by rank to get top leaderboards
  topLeaderboards.sort((a, b) => a.rank - b.rank);

  // Calculate total points (inverse of rank across all leaderboards)
  let totalPoints = 0;
  let percentileSum = 0;
  let validRankCount = 0;

  for (const type of Object.keys(currentRanks) as LeaderboardType[]) {
    const rank = currentRanks[type];
    if (rank) {
      totalPoints += Math.max(0, 100 - rank + 1); // Top 100 get points

      // Get total participants for percentile
      const { count } = await supabase
        .from('leaderboard_cache')
        .select('*', { count: 'exact', head: true })
        .eq('leaderboard_type', type)
        .eq('week_start', periodStart.toISOString().split('T')[0]);

      if (count) {
        percentileSum += ((count - rank + 1) / count) * 100;
        validRankCount++;
      }
    }
  }

  const percentile = validRankCount > 0 ? percentileSum / validRankCount : 0;

  return {
    userEmail,
    currentRanks,
    bestRanks,
    totalPoints,
    percentile: Math.round(percentile),
    topLeaderboards: topLeaderboards.slice(0, 3),
  };
}

// ============================================================================
// API Route Handlers
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const type = searchParams.get('type') as LeaderboardType || 'overall_wellness';
    const scope = searchParams.get('scope') as LeaderboardScope || 'global';
    const timeFrame = searchParams.get('timeFrame') as TimeFrame || 'weekly';
    const statsOnly = searchParams.get('stats') === 'true';

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    if (!LEADERBOARD_CONFIG[type]) {
      return NextResponse.json(
        { error: `Invalid leaderboard type. Valid types: ${Object.keys(LEADERBOARD_CONFIG).join(', ')}` },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (statsOnly) {
      const stats = await getUserLeaderboardStats(email, supabase);
      return NextResponse.json(stats);
    }

    const leaderboard = await getLeaderboard(type, scope, timeFrame, email, supabase);
    return NextResponse.json(leaderboard);

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, type, action } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'refresh') {
      // Force refresh a specific leaderboard
      if (!type || !LEADERBOARD_CONFIG[type as LeaderboardType]) {
        return NextResponse.json(
          { error: 'Valid leaderboard type required for refresh' },
          { status: 400 }
        );
      }

      const { start: periodStart, end: periodEnd } = getWeekBoundaries();
      await refreshLeaderboard(type as LeaderboardType, periodStart, periodEnd, supabase);

      return NextResponse.json({ success: true, message: `Leaderboard ${type} refreshed` });
    }

    if (action === 'refresh_all') {
      // Refresh all leaderboards
      const { start: periodStart, end: periodEnd } = getWeekBoundaries();

      for (const lbType of Object.keys(LEADERBOARD_CONFIG) as LeaderboardType[]) {
        await refreshLeaderboard(lbType, periodStart, periodEnd, supabase);
      }

      return NextResponse.json({ success: true, message: 'All leaderboards refreshed' });
    }

    return NextResponse.json(
      { error: 'Invalid action. Valid actions: refresh, refresh_all' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error updating leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to update leaderboard', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Exports for other services
// ============================================================================

export {
  getLeaderboard,
  refreshLeaderboard,
  getUserLeaderboardStats,
  calculateUserScore,
  LEADERBOARD_CONFIG,
};
