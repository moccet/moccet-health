import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendPushNotification, markThemeNotified } from '@/lib/services/onesignal-service';

/**
 * Health Achievements Cron Job
 *
 * Analyzes user health data and grants achievements for milestones:
 * - Step milestones (5k, 10k, 15k, 20k daily steps)
 * - Sleep streaks (7+ hours for X consecutive days)
 * - Activity streaks (meeting step goal X days in a row)
 * - Recovery milestones (80+ recovery score)
 * - Meal logging streaks (logged meals X days in a row)
 *
 * Configure in vercel.json:
 * - { "path": "/api/cron/health-achievements", "schedule": "0 8 * * *" }
 * (Runs daily at 8am UTC)
 */

export const maxDuration = 300;

// Achievement definitions for health milestones
const HEALTH_ACHIEVEMENTS = {
  // Step achievements
  steps_5k: { title: 'First 5K Steps', emoji: '👟', description: 'Walked 5,000 steps in a day' },
  steps_10k: { title: '10K Steps Day', emoji: '🚶', description: 'Hit 10,000 steps in a day' },
  steps_15k: { title: 'Step Master', emoji: '🏃', description: 'Crushed 15,000 steps in a day' },
  steps_20k: { title: 'Marathon Walker', emoji: '🏅', description: 'Epic 20,000 steps in a day' },

  // Sleep achievements
  sleep_7hrs: { title: 'Good Night', emoji: '😴', description: 'Got 7+ hours of sleep' },
  sleep_streak_3: { title: '3-Day Sleep Streak', emoji: '🌙', description: '7+ hours for 3 days straight' },
  sleep_streak_7: { title: 'Week of Rest', emoji: '⭐', description: '7+ hours for 7 days straight' },
  sleep_streak_14: { title: 'Sleep Champion', emoji: '🏆', description: '7+ hours for 2 weeks straight' },

  // Activity streaks
  activity_streak_3: { title: '3-Day Active', emoji: '💪', description: 'Met step goal 3 days in a row' },
  activity_streak_7: { title: 'Week Warrior', emoji: '🔥', description: 'Met step goal for a full week' },
  activity_streak_14: { title: 'Fortnight Fighter', emoji: '⚡', description: 'Met step goal for 2 weeks' },
  activity_streak_30: { title: 'Monthly Master', emoji: '🌟', description: 'Met step goal for a full month' },

  // Recovery achievements
  recovery_80: { title: 'Well Recovered', emoji: '💚', description: 'Achieved 80+ recovery score' },
  recovery_90: { title: 'Peak Recovery', emoji: '🎯', description: 'Achieved 90+ recovery score' },

  // Meal logging achievements
  meal_streak_3: { title: '3-Day Tracker', emoji: '🥗', description: 'Logged meals 3 days in a row' },
  meal_streak_7: { title: 'Nutrition Week', emoji: '📊', description: 'Logged meals for a full week' },
  meal_streak_14: { title: 'Logging Pro', emoji: '🏅', description: 'Logged meals for 2 weeks straight' },
  meal_streak_30: { title: 'Meal Master', emoji: '👑', description: 'Logged meals for a full month' },
};

function isVercelCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  const vercelCron = request.headers.get('x-vercel-cron');
  return vercelCron === '1';
}

interface UserHealthData {
  email: string;
  daily_steps: number | null;
  sleep_duration_hours: number | null;
  recovery_score: number | null;
}

export async function GET(request: NextRequest) {
  if (!isVercelCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Health Achievements] Starting cron job');
  const startTime = Date.now();

  try {
    const supabase = createAdminClient();
    const stats = {
      users_processed: 0,
      achievements_granted: 0,
      feed_items_created: 0,
      notifications_sent: 0,
    };

    // Get users with health data
    const { data: users, error: usersError } = await supabase
      .from('user_health_baselines')
      .select('email')
      .order('last_updated', { ascending: false });

    if (usersError) {
      console.error('[Health Achievements] Error fetching users:', usersError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const uniqueEmails = [...new Set(users?.map(u => u.email) || [])];
    console.log(`[Health Achievements] Processing ${uniqueEmails.length} users`);

    for (const email of uniqueEmails) {
      try {
        const achievements = await processUserAchievements(supabase, email);
        stats.users_processed++;
        stats.achievements_granted += achievements.length;

        // For each achievement, generate feed items for friends
        for (const achievement of achievements) {
          const feedResult = await generateFeedForFriends(supabase, email, achievement);
          stats.feed_items_created += feedResult.count;

          // Send notification to the user (achievements bypass daily limit)
          const sent = await sendPushNotification(email, {
            title: `Achievement Unlocked! ${achievement.emoji}`,
            body: achievement.title,
            data: {
              type: 'achievement',
              achievement_type: achievement.type,
            },
          });
          if (sent > 0) {
            stats.notifications_sent++;
            // Track achievement notification (bypasses limit but still counted for monitoring)
            await markThemeNotified(email, 'achievement', 'achievement');
          }
        }
      } catch (err) {
        console.error(`[Health Achievements] Error processing ${email}:`, err);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Health Achievements] Complete in ${duration}ms:`, stats);

    return NextResponse.json({
      success: true,
      ...stats,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Health Achievements] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

async function processUserAchievements(
  supabase: ReturnType<typeof createAdminClient>,
  email: string
): Promise<Array<{ type: string; title: string; emoji: string; description: string }>> {
  const achievements: Array<{ type: string; title: string; emoji: string; description: string }> = [];

  // Get user's existing achievements to avoid duplicates
  const { data: existingAchievements } = await supabase
    .from('health_achievements')
    .select('achievement_type')
    .eq('user_email', email);

  const earned = new Set(existingAchievements?.map(a => a.achievement_type) || []);

  // Get user's health baselines
  const { data: baselines } = await supabase
    .from('user_health_baselines')
    .select('metric_type, baseline_value')
    .eq('email', email);

  const metrics: Record<string, number> = {};
  for (const b of baselines || []) {
    metrics[b.metric_type] = Number(b.baseline_value);
  }

  // Check step achievements
  const steps = metrics['daily_steps'] || 0;
  if (steps >= 5000 && !earned.has('steps_5k')) {
    achievements.push({ type: 'steps_5k', ...HEALTH_ACHIEVEMENTS.steps_5k });
  }
  if (steps >= 10000 && !earned.has('steps_10k')) {
    achievements.push({ type: 'steps_10k', ...HEALTH_ACHIEVEMENTS.steps_10k });
  }
  if (steps >= 15000 && !earned.has('steps_15k')) {
    achievements.push({ type: 'steps_15k', ...HEALTH_ACHIEVEMENTS.steps_15k });
  }
  if (steps >= 20000 && !earned.has('steps_20k')) {
    achievements.push({ type: 'steps_20k', ...HEALTH_ACHIEVEMENTS.steps_20k });
  }

  // Check sleep achievements
  const sleepHours = metrics['sleep_duration_hours'] || 0;
  if (sleepHours >= 7 && !earned.has('sleep_7hrs')) {
    achievements.push({ type: 'sleep_7hrs', ...HEALTH_ACHIEVEMENTS.sleep_7hrs });
  }

  // Check recovery achievements
  const recovery = metrics['recovery_score'] || 0;
  if (recovery >= 80 && !earned.has('recovery_80')) {
    achievements.push({ type: 'recovery_80', ...HEALTH_ACHIEVEMENTS.recovery_80 });
  }
  if (recovery >= 90 && !earned.has('recovery_90')) {
    achievements.push({ type: 'recovery_90', ...HEALTH_ACHIEVEMENTS.recovery_90 });
  }

  // Check sleep streaks (from oura_data)
  const sleepStreak = await calculateSleepStreak(supabase, email);
  if (sleepStreak >= 3 && !earned.has('sleep_streak_3')) {
    achievements.push({ type: 'sleep_streak_3', ...HEALTH_ACHIEVEMENTS.sleep_streak_3 });
  }
  if (sleepStreak >= 7 && !earned.has('sleep_streak_7')) {
    achievements.push({ type: 'sleep_streak_7', ...HEALTH_ACHIEVEMENTS.sleep_streak_7 });
  }
  if (sleepStreak >= 14 && !earned.has('sleep_streak_14')) {
    achievements.push({ type: 'sleep_streak_14', ...HEALTH_ACHIEVEMENTS.sleep_streak_14 });
  }

  // Check activity streaks (from oura_data or apple_health)
  const activityStreak = await calculateActivityStreak(supabase, email);
  if (activityStreak >= 3 && !earned.has('activity_streak_3')) {
    achievements.push({ type: 'activity_streak_3', ...HEALTH_ACHIEVEMENTS.activity_streak_3 });
  }
  if (activityStreak >= 7 && !earned.has('activity_streak_7')) {
    achievements.push({ type: 'activity_streak_7', ...HEALTH_ACHIEVEMENTS.activity_streak_7 });
  }
  if (activityStreak >= 14 && !earned.has('activity_streak_14')) {
    achievements.push({ type: 'activity_streak_14', ...HEALTH_ACHIEVEMENTS.activity_streak_14 });
  }
  if (activityStreak >= 30 && !earned.has('activity_streak_30')) {
    achievements.push({ type: 'activity_streak_30', ...HEALTH_ACHIEVEMENTS.activity_streak_30 });
  }

  // Check meal logging streaks
  const mealStreak = await calculateMealLoggingStreak(supabase, email);
  if (mealStreak >= 3 && !earned.has('meal_streak_3')) {
    achievements.push({ type: 'meal_streak_3', ...HEALTH_ACHIEVEMENTS.meal_streak_3 });
  }
  if (mealStreak >= 7 && !earned.has('meal_streak_7')) {
    achievements.push({ type: 'meal_streak_7', ...HEALTH_ACHIEVEMENTS.meal_streak_7 });
  }
  if (mealStreak >= 14 && !earned.has('meal_streak_14')) {
    achievements.push({ type: 'meal_streak_14', ...HEALTH_ACHIEVEMENTS.meal_streak_14 });
  }
  if (mealStreak >= 30 && !earned.has('meal_streak_30')) {
    achievements.push({ type: 'meal_streak_30', ...HEALTH_ACHIEVEMENTS.meal_streak_30 });
  }

  // Save new achievements
  if (achievements.length > 0) {
    const inserts = achievements.map(a => ({
      user_email: email,
      achievement_type: a.type,
      title: a.title,
      emoji: a.emoji,
      description: a.description,
      earned_at: new Date().toISOString(),
    }));

    await supabase.from('health_achievements').insert(inserts);
    console.log(`[Health Achievements] Granted ${achievements.length} achievements to ${email}`);
  }

  return achievements;
}

async function calculateSleepStreak(
  supabase: ReturnType<typeof createAdminClient>,
  email: string
): Promise<number> {
  // Check Oura data for sleep streak
  const { data: ouraData } = await supabase
    .from('oura_data')
    .select('sleep_data')
    .eq('email', email)
    .order('sync_date', { ascending: false })
    .limit(1)
    .single();

  if (!ouraData?.sleep_data) {
    // Fall back to Apple Health data
    const { data: onboardingData } = await supabase
      .from('sage_onboarding_data')
      .select('apple_health_data')
      .eq('email', email)
      .single();

    const healthData = onboardingData?.apple_health_data as any;
    if (!healthData?.sleep) return 0;

    // Count consecutive days with 7+ hours sleep
    let streak = 0;
    const sleepRecords = healthData.sleep || [];
    for (const record of sleepRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())) {
      if (record.duration_hours >= 7) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  // Parse Oura sleep data
  const sleepRecords = Array.isArray(ouraData.sleep_data) ? ouraData.sleep_data : [];
  let streak = 0;

  // Sort by date descending and count consecutive 7+ hour nights
  const sortedRecords = sleepRecords.sort((a: any, b: any) =>
    new Date(b.day || b.date).getTime() - new Date(a.day || a.date).getTime()
  );

  for (const record of sortedRecords) {
    const duration = record.total_sleep_duration ? record.total_sleep_duration / 3600 : record.duration_hours || 0;
    if (duration >= 7) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function calculateActivityStreak(
  supabase: ReturnType<typeof createAdminClient>,
  email: string
): Promise<number> {
  // Get user's step goal (default 8000)
  const { data: goalData } = await supabase
    .from('user_health_goals')
    .select('target_value')
    .eq('user_email', email)
    .eq('goal_category', 'ACTIVITY')
    .eq('metric_type', 'daily_steps')
    .eq('status', 'active')
    .single();

  const stepGoal = goalData?.target_value || 8000;

  // Check Oura data for activity streak
  const { data: ouraData } = await supabase
    .from('oura_data')
    .select('activity_data')
    .eq('email', email)
    .order('sync_date', { ascending: false })
    .limit(1)
    .single();

  let activityRecords: any[] = [];

  if (ouraData?.activity_data && Array.isArray(ouraData.activity_data)) {
    activityRecords = ouraData.activity_data;
  } else {
    // Fall back to Apple Health data
    const { data: onboardingData } = await supabase
      .from('sage_onboarding_data')
      .select('apple_health_data')
      .eq('email', email)
      .single();

    const healthData = onboardingData?.apple_health_data as any;
    if (healthData?.steps) {
      activityRecords = healthData.steps;
    }
  }

  if (activityRecords.length === 0) return 0;

  // Sort by date descending and count consecutive days meeting step goal
  const sortedRecords = activityRecords.sort((a: any, b: any) =>
    new Date(b.day || b.date).getTime() - new Date(a.day || a.date).getTime()
  );

  let streak = 0;
  for (const record of sortedRecords) {
    const steps = record.steps || record.total_steps || 0;
    if (steps >= stepGoal) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

async function calculateMealLoggingStreak(
  supabase: ReturnType<typeof createAdminClient>,
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

  // Count consecutive days
  let streak = 0;
  let expectedDate = new Date();
  expectedDate.setHours(0, 0, 0, 0);

  for (const dateStr of dates) {
    const logDate = new Date(dateStr);
    const diffDays = Math.floor((expectedDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      expectedDate = logDate;
    } else {
      break;
    }
  }

  return streak;
}

async function generateFeedForFriends(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  achievement: { type: string; title: string; emoji: string; description: string }
): Promise<{ count: number }> {
  // Get user's friends
  const { data: connections } = await supabase
    .from('user_connections')
    .select('requester_email, addressee_email')
    .eq('status', 'accepted')
    .or(`requester_email.eq.${email},addressee_email.eq.${email}`);

  if (!connections || connections.length === 0) {
    return { count: 0 };
  }

  // Get friend emails
  const friendEmails = connections.map(c =>
    c.requester_email === email ? c.addressee_email : c.requester_email
  );

  // Create feed items for each friend
  const feedItems = friendEmails.map(friendEmail => ({
    user_email: friendEmail,
    friend_email: email,
    activity_type: 'achievement_earned',
    title: `Earned: ${achievement.title}`,
    subtitle: achievement.description,
    emoji: achievement.emoji,
    activity_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  const { error } = await supabase.from('friend_activity_feed').insert(feedItems);

  if (error) {
    console.error('[Health Achievements] Error creating feed items:', error);
    return { count: 0 };
  }

  return { count: feedItems.length };
}

// Manual trigger
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return GET(request);
}
