#!/usr/bin/env npx tsx
/**
 * Test Notification Services (Dry-Run Mode)
 *
 * This script tests notification services for a specific user WITHOUT sending
 * actual push notifications. It generates and logs what content each service
 * would produce.
 *
 * Usage:
 *   npx tsx scripts/test-notifications.ts
 *
 * Or with a specific email:
 *   npx tsx scripts/test-notifications.ts user@example.com
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables from .env.local manually
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Only set if not already in environment
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    console.warn('Warning: Could not load .env.local file');
  }
}

loadEnv();

import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CLIENT (standalone version for script)
// ============================================================================

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase credentials. Check .env.local file.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// TYPES
// ============================================================================

interface StreakStatus {
  type: string;
  displayName: string;
  currentDays: number;
  personalBest: number;
  lastActivityDate: string | null;
  isAtRisk: boolean;
  hoursUntilBroken: number;
  nextMilestone: number;
  daysToMilestone: number;
}

interface StreakAlert {
  id: string;
  userEmail: string;
  streakType: string;
  alertType: 'at_risk' | 'milestone_approaching' | 'milestone_achieved' | 'broken' | 'recovered';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  currentDays: number;
  scheduledFor: Date;
}

interface Achievement {
  id: string;
  userEmail: string;
  achievementType: string;
  title: string;
  description: string | null;
  emoji: string;
  streakDays: number | null;
  earnedAt: string;
}

interface ProactiveNotification {
  type: string;
  title: string;
  message: string;
  context_data: Record<string, unknown>;
  category?: string;
  data_quote?: string;
  recommendation?: string;
  science_explanation?: string;
  action_steps?: string[];
}

// ============================================================================
// CONSOLE OUTPUT HELPERS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function printHeader(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log('='.repeat(70));
}

function printSubheader(title: string) {
  console.log(`\n${colors.bright}${colors.yellow}${title}${colors.reset}`);
  console.log('-'.repeat(50));
}

function printNotification(notification: {
  type?: string;
  title: string;
  message?: string;
  body?: string;
  category?: string;
  theme?: string;
  severity?: string;
  data_quote?: string;
  recommendation?: string;
}) {
  console.log(`  ${colors.green}Type:${colors.reset} ${notification.type || 'N/A'}`);
  console.log(`  ${colors.green}Title:${colors.reset} ${notification.title}`);
  console.log(`  ${colors.green}Body:${colors.reset} ${notification.message || notification.body || 'N/A'}`);
  if (notification.category) {
    console.log(`  ${colors.green}Category:${colors.reset} ${notification.category}`);
  }
  if (notification.theme) {
    console.log(`  ${colors.green}Theme:${colors.reset} ${notification.theme}`);
  }
  if (notification.severity) {
    console.log(`  ${colors.green}Severity:${colors.reset} ${notification.severity}`);
  }
  if (notification.data_quote) {
    console.log(`  ${colors.green}Data Quote:${colors.reset} ${notification.data_quote}`);
  }
  if (notification.recommendation) {
    console.log(`  ${colors.green}Recommendation:${colors.reset} ${notification.recommendation}`);
  }
  console.log();
}

// ============================================================================
// STREAK STATUS (Replicated from streak-alert-service.ts)
// ============================================================================

const STREAK_DISPLAY_NAMES: Record<string, string> = {
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

async function getUserStreakStatus(
  userEmail: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<StreakStatus[]> {
  const { data: streaks, error } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_email', userEmail);

  if (error) {
    console.log(`  ${colors.dim}Error fetching streaks: ${error.message}${colors.reset}`);
    return [];
  }

  const streakList = (streaks as any[]) || [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return streakList.map(streak => {
    const lastActivity = streak.last_activity_date
      ? new Date(streak.last_activity_date)
      : null;

    let isAtRisk = false;
    let hoursUntilBroken = 24;

    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
      const daysSinceActivity = Math.floor(
        (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      isAtRisk = daysSinceActivity === 1;

      if (isAtRisk) {
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        hoursUntilBroken = Math.max(
          0,
          Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60))
        );
      }
    }

    const currentDays = streak.current_days || 0;
    let nextMilestone = MILESTONES.find(m => m > currentDays) || 365;
    if (currentDays >= 365) {
      nextMilestone = Math.ceil((currentDays + 1) / 365) * 365;
    }

    return {
      type: streak.streak_type as string,
      displayName: STREAK_DISPLAY_NAMES[streak.streak_type as string] || streak.streak_type,
      currentDays,
      personalBest: streak.personal_best || 0,
      lastActivityDate: streak.last_activity_date,
      isAtRisk,
      hoursUntilBroken,
      nextMilestone,
      daysToMilestone: nextMilestone - currentDays,
    };
  });
}

function getUrgency(hoursUntilBroken: number, streakDays: number): 'low' | 'medium' | 'high' | 'critical' {
  if (streakDays >= 30 && hoursUntilBroken <= 2) return 'critical';
  if (streakDays >= 14 && hoursUntilBroken <= 4) return 'critical';
  if (streakDays >= 7 && hoursUntilBroken <= 4) return 'high';
  if (streakDays >= 14) return 'high';
  if (streakDays >= 7) return 'medium';
  return 'low';
}

function generateStreakAlerts(
  userEmail: string,
  streaks: StreakStatus[]
): StreakAlert[] {
  const alerts: StreakAlert[] = [];

  for (const streak of streaks) {
    if (streak.currentDays < 3) continue;

    if (streak.isAtRisk) {
      const urgency = getUrgency(streak.hoursUntilBroken, streak.currentDays);
      const timeLeft = streak.hoursUntilBroken > 1
        ? `${streak.hoursUntilBroken} hours`
        : 'less than an hour';

      let title: string;
      let message: string;

      switch (urgency) {
        case 'critical':
          title = `${streak.currentDays}-day streak at risk!`;
          message = `Your ${streak.displayName} streak is about to break! Only ${timeLeft} left. Don't lose ${streak.currentDays} days of progress!`;
          break;
        case 'high':
          title = `Protect your ${streak.currentDays}-day streak`;
          message = `Your ${streak.displayName} streak needs attention. ${timeLeft} remaining today.`;
          break;
        case 'medium':
          title = `Don't forget your ${streak.displayName}`;
          message = `Keep your ${streak.currentDays}-day streak alive. Log your activity before midnight!`;
          break;
        default:
          title = `${streak.displayName} reminder`;
          message = `You haven't logged today. Keep your ${streak.currentDays}-day streak going!`;
      }

      alerts.push({
        id: crypto.randomUUID(),
        userEmail,
        streakType: streak.type,
        alertType: 'at_risk',
        urgency,
        title,
        message,
        currentDays: streak.currentDays,
        scheduledFor: new Date(),
      });
    }

    // Milestone approaching (1 day away)
    if (streak.daysToMilestone === 1 && !streak.isAtRisk) {
      alerts.push({
        id: crypto.randomUUID(),
        userEmail,
        streakType: streak.type,
        alertType: 'milestone_approaching',
        urgency: 'medium',
        title: `Almost at ${streak.nextMilestone} days!`,
        message: `One more day and you'll hit a ${streak.nextMilestone}-day ${streak.displayName} streak! You're doing great!`,
        currentDays: streak.currentDays,
        scheduledFor: new Date(),
      });
    }
  }

  return alerts;
}

// ============================================================================
// ACHIEVEMENTS (Replicated from achievements-service.ts)
// ============================================================================

async function getUserAchievements(
  email: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_email', email)
    .order('earned_at', { ascending: false });

  if (error) {
    console.log(`  ${colors.dim}Error fetching achievements: ${error.message}${colors.reset}`);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    userEmail: row.user_email,
    achievementType: row.achievement_type,
    title: row.title,
    description: row.description,
    emoji: row.emoji,
    streakDays: row.streak_days,
    earnedAt: row.earned_at,
  }));
}

async function checkEligibleAchievements(
  email: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ type: string; title: string; description: string; emoji: string }[]> {
  const eligible: { type: string; title: string; description: string; emoji: string }[] = [];

  // Check for first goal achievement
  const { data: existingFirstGoal } = await supabase
    .from('user_achievements')
    .select('id')
    .eq('user_email', email)
    .eq('achievement_type', 'first_goal')
    .single();

  if (!existingFirstGoal) {
    const { count } = await supabase
      .from('user_health_goals')
      .select('id', { count: 'exact', head: true })
      .eq('email', email);

    if (count && count > 0) {
      eligible.push({
        type: 'first_goal',
        title: 'First Steps',
        description: 'Created your first health goal',
        emoji: '🎯',
      });
    }
  }

  // Check for streak achievements
  const streaks = await getUserStreakStatus(email, supabase);
  const streakMilestones = [
    { days: 7, title: 'Week Warrior', description: '7-day consistency streak', emoji: '🔥' },
    { days: 14, title: 'Fortnight Fighter', description: '14-day consistency streak', emoji: '💪' },
    { days: 30, title: 'Monthly Master', description: '30-day consistency streak', emoji: '🌟' },
    { days: 60, title: 'Double Down', description: '60-day consistency streak', emoji: '⭐' },
    { days: 90, title: 'Legendary', description: '90-day consistency streak', emoji: '👑' },
  ];

  for (const streak of streaks) {
    for (const milestone of streakMilestones) {
      if (streak.currentDays >= milestone.days) {
        // Check if already earned
        const { data: existingMilestone } = await supabase
          .from('user_achievements')
          .select('id')
          .eq('user_email', email)
          .eq('achievement_type', 'streak_milestone')
          .eq('streak_days', milestone.days)
          .single();

        if (!existingMilestone) {
          eligible.push({
            type: `streak_milestone (${milestone.days} days)`,
            title: milestone.title,
            description: milestone.description,
            emoji: milestone.emoji,
          });
        }
      }
    }
  }

  return eligible;
}

// ============================================================================
// ECOSYSTEM DATA FETCHING (Simplified)
// ============================================================================

interface EcosystemData {
  oura: { available: boolean; data: any };
  whoop: { available: boolean; data: any };
  dexcom: { available: boolean; data: any };
  gmail: { available: boolean; data: any };
  slack: { available: boolean; data: any };
}

async function fetchEcosystemData(
  email: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<EcosystemData> {
  const result: EcosystemData = {
    oura: { available: false, data: null },
    whoop: { available: false, data: null },
    dexcom: { available: false, data: null },
    gmail: { available: false, data: null },
    slack: { available: false, data: null },
  };

  // Check which integrations are connected
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('provider, is_active')
    .eq('user_email', email)
    .eq('is_active', true);

  if (tokens) {
    for (const token of tokens) {
      const provider = token.provider.toLowerCase();
      if (provider === 'oura') result.oura.available = true;
      if (provider === 'whoop') result.whoop.available = true;
      if (provider === 'dexcom') result.dexcom.available = true;
      if (provider === 'gmail' || provider === 'google') result.gmail.available = true;
      if (provider === 'slack') result.slack.available = true;
    }
  }

  // Fetch Oura data if available
  if (result.oura.available) {
    const { data: ouraData } = await supabase
      .from('oura_sleep_data')
      .select('*')
      .eq('email', email)
      .order('date', { ascending: false })
      .limit(7);

    if (ouraData && ouraData.length > 0) {
      const avgSleep = ouraData.reduce((sum: number, d: any) => sum + (d.total_sleep || 0), 0) / ouraData.length;
      const avgReadiness = ouraData.reduce((sum: number, d: any) => sum + (d.readiness_score || 0), 0) / ouraData.length;
      const avgHRV = ouraData.reduce((sum: number, d: any) => sum + (d.average_hrv || 0), 0) / ouraData.length;

      result.oura.data = {
        avgSleepHours: avgSleep / 3600,
        avgReadinessScore: avgReadiness,
        avgHRV: avgHRV,
      };
    }
  }

  // Fetch Whoop data if available
  if (result.whoop.available) {
    const { data: whoopData } = await supabase
      .from('whoop_cycles')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(7);

    if (whoopData && whoopData.length > 0) {
      const avgRecovery = whoopData.reduce((sum: number, d: any) => sum + (d.recovery_score || 0), 0) / whoopData.length;
      const avgStrain = whoopData.reduce((sum: number, d: any) => sum + (d.strain || 0), 0) / whoopData.length;
      const avgHRV = whoopData.reduce((sum: number, d: any) => sum + (d.hrv_rmssd_milli || 0), 0) / whoopData.length;

      result.whoop.data = {
        avgRecoveryScore: avgRecovery,
        avgStrainScore: avgStrain,
        avgHRV: avgHRV,
      };
    }
  }

  // Fetch Dexcom data if available
  if (result.dexcom.available) {
    const { data: dexcomData } = await supabase
      .from('dexcom_readings')
      .select('*')
      .eq('email', email)
      .order('timestamp', { ascending: false })
      .limit(288); // ~24 hours of readings

    if (dexcomData && dexcomData.length > 0) {
      const avgGlucose = dexcomData.reduce((sum: number, d: any) => sum + (d.value || 0), 0) / dexcomData.length;
      const inRange = dexcomData.filter((d: any) => d.value >= 70 && d.value <= 180).length;
      const timeInRange = (inRange / dexcomData.length) * 100;

      result.dexcom.data = {
        avgGlucose,
        timeInRange,
      };
    }
  }

  return result;
}

// ============================================================================
// PROACTIVE ENGAGEMENT (Simplified generators without AI)
// ============================================================================

interface GeneratedNotification extends ProactiveNotification {
  wouldSend: boolean;
  reason?: string;
}

function generateMockMorningMotivation(
  email: string,
  ecosystemData: EcosystemData
): GeneratedNotification | null {
  const context: Record<string, unknown> = {};

  // Check recovery state
  if (ecosystemData.whoop?.data) {
    const recovery = ecosystemData.whoop.data.avgRecoveryScore;
    context.recovery = recovery;
  }

  // Check sleep
  if (ecosystemData.oura?.data) {
    context.sleepHours = ecosystemData.oura.data.avgSleepHours;
  }

  // Build data quote from context
  const dataQuoteParts: string[] = [];
  if (context.recovery !== undefined) {
    const recovery = context.recovery as number;
    if (recovery >= 67) {
      dataQuoteParts.push(`recovery at ${Math.round(recovery)}% (great!)`);
    } else if (recovery < 40) {
      dataQuoteParts.push(`recovery at ${Math.round(recovery)}% (take it easy)`);
    } else {
      dataQuoteParts.push(`recovery at ${Math.round(recovery)}%`);
    }
  }
  if (context.sleepHours !== undefined) {
    dataQuoteParts.push(`${(context.sleepHours as number).toFixed(1)} hours of sleep`);
  }

  // Only generate if there's notable state
  const recovery = context.recovery as number | undefined;
  const hasNotableState = (recovery && (recovery >= 75 || recovery < 40));

  if (!hasNotableState && !context.sleepHours) {
    return null;
  }

  let recommendation = 'Start your day with intention. ';
  if (recovery !== undefined && recovery >= 67) {
    recommendation += 'Your body is well-recovered - a great day for challenging work or exercise.';
  } else if (recovery !== undefined && recovery < 40) {
    recommendation += 'Consider lighter activities today and prioritize rest when possible.';
  } else {
    recommendation += 'Listen to your body and pace yourself throughout the day.';
  }

  return {
    type: 'morning_motivation',
    title: 'Good Morning',
    message: `[AI would generate personalized message based on: recovery=${context.recovery}, sleep=${context.sleepHours}]`,
    context_data: context,
    category: 'RECOVERY',
    data_quote: dataQuoteParts.length > 0 ? dataQuoteParts.join(' · ') : 'Ready to start a new day',
    recommendation,
    wouldSend: hasNotableState,
    reason: hasNotableState ? 'Notable recovery state detected' : 'No notable state to report',
  };
}

function generateMockDailyDigest(
  email: string,
  ecosystemData: EcosystemData
): GeneratedNotification | null {
  const highlights: string[] = [];
  const concerns: string[] = [];

  // Analyze sleep
  if (ecosystemData.oura?.available && ecosystemData.oura.data) {
    const oura = ecosystemData.oura.data;
    if (oura.avgReadinessScore >= 80) {
      highlights.push(`excellent sleep (readiness ${Math.round(oura.avgReadinessScore)})`);
    } else if (oura.avgReadinessScore < 60) {
      concerns.push(`low sleep quality (${Math.round(oura.avgReadinessScore)})`);
    }
  }

  // Analyze recovery
  if (ecosystemData.whoop?.available && ecosystemData.whoop.data) {
    const whoop = ecosystemData.whoop.data;
    if (whoop.avgRecoveryScore >= 67) {
      highlights.push(`green zone recovery (${Math.round(whoop.avgRecoveryScore)}%)`);
    } else if (whoop.avgRecoveryScore < 34) {
      concerns.push(`recovery in red zone (${Math.round(whoop.avgRecoveryScore)}%)`);
    }
  }

  // Analyze glucose
  if (ecosystemData.dexcom?.available && ecosystemData.dexcom.data) {
    const dexcom = ecosystemData.dexcom.data;
    if (dexcom.timeInRange >= 80) {
      highlights.push(`great glucose control (${Math.round(dexcom.timeInRange)}% in range)`);
    } else if (dexcom.timeInRange < 60) {
      concerns.push(`glucose needs attention (${Math.round(dexcom.timeInRange)}% in range)`);
    }
  }

  if (highlights.length === 0 && concerns.length === 0) {
    return null;
  }

  let title: string;
  if (concerns.length > highlights.length) {
    title = 'Your Daily Health Check-in';
  } else if (highlights.length > 0) {
    title = 'Your Body is Thriving Today';
  } else {
    title = 'Daily Health Update';
  }

  const allMetrics = [...highlights, ...concerns];
  const dataQuote = allMetrics.length > 0
    ? allMetrics.slice(0, 3).join(' · ')
    : 'Your daily health snapshot';

  let recommendation: string;
  if (concerns.length > highlights.length) {
    recommendation = 'Focus on rest and recovery today. Small improvements compound over time.';
  } else if (highlights.length > 0) {
    recommendation = 'You\'re on a great path! Keep up the healthy habits that got you here.';
  } else {
    recommendation = 'Steady progress is still progress. Stay consistent with your routines.';
  }

  return {
    type: 'daily_digest',
    title,
    message: `[AI would generate personalized message based on: highlights=${highlights.join(', ')}, concerns=${concerns.join(', ')}]`,
    context_data: { highlights, concerns },
    category: 'CROSS_DOMAIN',
    data_quote: dataQuote,
    recommendation,
    wouldSend: true,
    reason: `Found ${highlights.length} highlights and ${concerns.length} concerns`,
  };
}

function generateMockHealthSummary(
  email: string,
  ecosystemData: EcosystemData
): GeneratedNotification | null {
  const metrics: string[] = [];
  const dataPoints: string[] = [];
  const context: Record<string, unknown> = {};

  if (ecosystemData.whoop?.available && ecosystemData.whoop.data) {
    const whoop = ecosystemData.whoop.data;
    if (whoop.avgRecoveryScore) {
      metrics.push(`Recovery: ${Math.round(whoop.avgRecoveryScore)}%`);
      context.recovery = Math.round(whoop.avgRecoveryScore);
      dataPoints.push(`Your recovery is at ${Math.round(whoop.avgRecoveryScore)}%`);
    }
    if (whoop.avgStrainScore) {
      metrics.push(`Strain: ${whoop.avgStrainScore.toFixed(1)}`);
      context.strain = whoop.avgStrainScore;
    }
  }

  if (ecosystemData.oura?.available && ecosystemData.oura.data) {
    const oura = ecosystemData.oura.data;
    if (oura.avgReadinessScore) {
      metrics.push(`Readiness: ${Math.round(oura.avgReadinessScore)}`);
      context.readiness = Math.round(oura.avgReadinessScore);
      dataPoints.push(`Readiness score: ${Math.round(oura.avgReadinessScore)}`);
    }
    if (oura.avgSleepHours) {
      metrics.push(`Sleep: ${oura.avgSleepHours.toFixed(1)}h`);
      context.sleepHours = oura.avgSleepHours;
      dataPoints.push(`You slept ${oura.avgSleepHours.toFixed(1)} hours`);
    }
  }

  if (ecosystemData.dexcom?.available && ecosystemData.dexcom.data) {
    const dexcom = ecosystemData.dexcom.data;
    if (dexcom.timeInRange) {
      metrics.push(`Glucose in range: ${Math.round(dexcom.timeInRange)}%`);
      context.glucoseInRange = Math.round(dexcom.timeInRange);
      dataPoints.push(`Time in glucose range: ${Math.round(dexcom.timeInRange)}%`);
    }
  }

  if (metrics.length === 0) {
    return null;
  }

  const dataQuote = dataPoints.length > 0
    ? dataPoints.slice(0, 3).join(' · ')
    : metrics.slice(0, 3).join(' · ');

  const recovery = context.recovery as number | undefined;
  const recommendation = recovery && recovery >= 70
    ? 'Great recovery - good day for a workout!'
    : recovery && recovery < 50
      ? 'Recovery is low - prioritize rest today'
      : 'Listen to your body and stay hydrated';

  return {
    type: 'daily_digest',
    title: 'Your Daily Health Summary',
    message: `[AI would generate personalized summary based on: ${metrics.join(', ')}]`,
    context_data: context,
    category: 'HEALTH',
    data_quote: dataQuote,
    recommendation,
    wouldSend: true,
    reason: `${metrics.length} health metrics available`,
  };
}

// ============================================================================
// MAIN TEST FUNCTION
// ============================================================================

async function testNotifications(email: string): Promise<void> {
  console.log(`\n${colors.bright}${colors.magenta}╔══════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}║       NOTIFICATION SERVICES DRY-RUN TEST                             ║${colors.reset}`);
  console.log(`${colors.bright}${colors.magenta}╚══════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log(`\nUser: ${colors.cyan}${email}${colors.reset}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Mode: ${colors.yellow}DRY-RUN (no actual notifications sent)${colors.reset}`);

  const supabase = createAdminClient();

  // -------------------------------------------------------------------------
  // 1. FETCH USER DATA STATE
  // -------------------------------------------------------------------------
  printHeader('1. FETCHING USER DATA STATE');

  console.log('\n  Fetching ecosystem data...');
  const ecosystemData = await fetchEcosystemData(email, supabase);

  console.log('\n  Connected integrations:');
  console.log(`    Oura: ${ecosystemData.oura.available ? colors.green + '✓ Connected' : colors.red + '✗ Not connected'}${colors.reset}`);
  console.log(`    Whoop: ${ecosystemData.whoop.available ? colors.green + '✓ Connected' : colors.red + '✗ Not connected'}${colors.reset}`);
  console.log(`    Dexcom: ${ecosystemData.dexcom.available ? colors.green + '✓ Connected' : colors.red + '✗ Not connected'}${colors.reset}`);
  console.log(`    Gmail: ${ecosystemData.gmail.available ? colors.green + '✓ Connected' : colors.red + '✗ Not connected'}${colors.reset}`);
  console.log(`    Slack: ${ecosystemData.slack.available ? colors.green + '✓ Connected' : colors.red + '✗ Not connected'}${colors.reset}`);

  if (ecosystemData.oura.data) {
    console.log('\n  Oura data (7-day avg):');
    console.log(`    Sleep: ${ecosystemData.oura.data.avgSleepHours?.toFixed(1) || 'N/A'} hours`);
    console.log(`    Readiness: ${ecosystemData.oura.data.avgReadinessScore ? Math.round(ecosystemData.oura.data.avgReadinessScore) : 'N/A'}`);
    console.log(`    HRV: ${ecosystemData.oura.data.avgHRV ? Math.round(ecosystemData.oura.data.avgHRV) : 'N/A'}ms`);
  }

  if (ecosystemData.whoop.data) {
    console.log('\n  Whoop data (7-day avg):');
    console.log(`    Recovery: ${ecosystemData.whoop.data.avgRecoveryScore ? Math.round(ecosystemData.whoop.data.avgRecoveryScore) : 'N/A'}%`);
    console.log(`    Strain: ${ecosystemData.whoop.data.avgStrainScore?.toFixed(1) || 'N/A'}`);
    console.log(`    HRV: ${ecosystemData.whoop.data.avgHRV ? Math.round(ecosystemData.whoop.data.avgHRV) : 'N/A'}ms`);
  }

  if (ecosystemData.dexcom.data) {
    console.log('\n  Dexcom data (24h):');
    console.log(`    Avg Glucose: ${Math.round(ecosystemData.dexcom.data.avgGlucose)} mg/dL`);
    console.log(`    Time in Range: ${Math.round(ecosystemData.dexcom.data.timeInRange)}%`);
  }

  // -------------------------------------------------------------------------
  // 2. PROACTIVE ENGAGEMENT SERVICE
  // -------------------------------------------------------------------------
  printHeader('2. PROACTIVE ENGAGEMENT SERVICE');

  for (const timeOfDay of ['morning', 'midday', 'evening'] as const) {
    printSubheader(`Time Period: ${timeOfDay.toUpperCase()}`);

    if (timeOfDay === 'morning') {
      const motivation = generateMockMorningMotivation(email, ecosystemData);
      if (motivation) {
        console.log(`  ${colors.bright}Morning Motivation:${colors.reset}`);
        console.log(`  Would send: ${motivation.wouldSend ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
        console.log(`  Reason: ${motivation.reason}`);
        printNotification(motivation);
      } else {
        console.log(`  ${colors.dim}No morning motivation notification generated (insufficient data)${colors.reset}\n`);
      }
    }

    if (timeOfDay === 'midday') {
      const digest = generateMockDailyDigest(email, ecosystemData);
      if (digest) {
        console.log(`  ${colors.bright}Daily Digest:${colors.reset}`);
        console.log(`  Would send: ${digest.wouldSend ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
        console.log(`  Reason: ${digest.reason}`);
        printNotification(digest);
      }

      const summary = generateMockHealthSummary(email, ecosystemData);
      if (summary) {
        console.log(`  ${colors.bright}Daily Health Summary (Fallback):${colors.reset}`);
        console.log(`  Would send: ${summary.wouldSend ? colors.green + 'YES' : colors.red + 'NO'}${colors.reset}`);
        console.log(`  Reason: ${summary.reason}`);
        printNotification(summary);
      }

      if (!digest && !summary) {
        console.log(`  ${colors.dim}No midday notification generated (insufficient data)${colors.reset}\n`);
      }
    }

    if (timeOfDay === 'evening') {
      console.log(`  ${colors.dim}Evening reflection would be generated if:`);
      console.log(`    - High strain day detected (>14)`);
      console.log(`    - Working late (>25% after-hours email activity)`);
      console.log(`    - Unfinished tasks from deep analysis${colors.reset}\n`);

      if (ecosystemData.whoop?.data?.avgStrainScore > 14) {
        console.log(`  ${colors.yellow}High strain detected (${ecosystemData.whoop.data.avgStrainScore.toFixed(1)}) - would generate evening reflection${colors.reset}\n`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. STREAK ALERTS SERVICE
  // -------------------------------------------------------------------------
  printHeader('3. STREAK ALERTS SERVICE');

  console.log('\n  Fetching user streaks...');
  const streaks = await getUserStreakStatus(email, supabase);

  if (streaks.length === 0) {
    console.log(`\n  ${colors.dim}No streaks found for this user.${colors.reset}`);
  } else {
    console.log(`\n  Found ${streaks.length} streak(s):\n`);

    for (const streak of streaks) {
      const statusIcon = streak.isAtRisk
        ? streak.hoursUntilBroken <= 4 ? '🔴' : '🟡'
        : '🟢';

      console.log(`  ${statusIcon} ${colors.bright}${streak.displayName}${colors.reset}`);
      console.log(`     Current: ${streak.currentDays} days`);
      console.log(`     Personal Best: ${streak.personalBest} days`);
      console.log(`     Next Milestone: ${streak.nextMilestone} days (${streak.daysToMilestone} to go)`);
      console.log(`     At Risk: ${streak.isAtRisk ? colors.red + 'YES' : colors.green + 'NO'}${colors.reset}`);
      if (streak.isAtRisk) {
        console.log(`     Hours Until Broken: ${streak.hoursUntilBroken}h`);
      }
      console.log();
    }

    // Generate alerts
    printSubheader('Generated Streak Alerts');

    const alerts = generateStreakAlerts(email, streaks);
    const atRiskStreaks = streaks.filter(s => s.isAtRisk && s.currentDays >= 3);

    if (alerts.length === 0) {
      console.log(`  ${colors.dim}No streak alerts to send.${colors.reset}\n`);
    } else {
      console.log(`  At-risk streaks: ${atRiskStreaks.length}`);
      console.log(`  Alerts generated: ${alerts.length}\n`);

      for (let i = 0; i < alerts.length; i++) {
        const alert = alerts[i];
        const urgencyColor = alert.urgency === 'critical' ? colors.red
          : alert.urgency === 'high' ? colors.yellow
          : colors.white;

        console.log(`  [${i + 1}] ${colors.bright}${alert.streakType}${colors.reset} (${alert.currentDays} days)`);
        console.log(`      Alert Type: ${alert.alertType}`);
        console.log(`      Urgency: ${urgencyColor}${alert.urgency}${colors.reset}`);
        printNotification({
          title: alert.title,
          message: alert.message,
          severity: alert.urgency,
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. ACHIEVEMENTS SERVICE
  // -------------------------------------------------------------------------
  printHeader('4. ACHIEVEMENTS SERVICE');

  console.log('\n  Fetching user achievements...');
  const achievements = await getUserAchievements(email, supabase);

  if (achievements.length === 0) {
    console.log(`\n  ${colors.dim}No achievements earned yet.${colors.reset}`);
  } else {
    console.log(`\n  Earned ${achievements.length} achievement(s):\n`);

    for (const achievement of achievements.slice(0, 10)) {
      console.log(`  ${achievement.emoji} ${colors.bright}${achievement.title}${colors.reset}`);
      console.log(`     Type: ${achievement.achievementType}`);
      if (achievement.description) {
        console.log(`     Description: ${achievement.description}`);
      }
      if (achievement.streakDays) {
        console.log(`     Streak Days: ${achievement.streakDays}`);
      }
      console.log(`     Earned: ${new Date(achievement.earnedAt).toLocaleDateString()}`);
      console.log();
    }

    if (achievements.length > 10) {
      console.log(`  ${colors.dim}... and ${achievements.length - 10} more${colors.reset}\n`);
    }
  }

  // Check for eligible achievements
  printSubheader('Eligible (Unearned) Achievements');

  const eligible = await checkEligibleAchievements(email, supabase);

  if (eligible.length === 0) {
    console.log(`  ${colors.dim}No new achievements eligible at this time.${colors.reset}\n`);
  } else {
    console.log(`  Found ${eligible.length} eligible achievement(s):\n`);

    for (const elig of eligible) {
      console.log(`  ${elig.emoji} ${colors.bright}${elig.title}${colors.reset}`);
      console.log(`     Type: ${elig.type}`);
      console.log(`     Description: ${elig.description}`);
      console.log(`     Would send notification: ${colors.green}YES${colors.reset}`);
      console.log();
    }
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  printHeader('SUMMARY');

  const connectedSources = [
    ecosystemData.oura.available,
    ecosystemData.whoop.available,
    ecosystemData.dexcom.available,
    ecosystemData.gmail.available,
    ecosystemData.slack.available,
  ].filter(Boolean).length;

  const atRiskStreakCount = streaks.filter(s => s.isAtRisk && s.currentDays >= 3).length;

  console.log(`\n  ${colors.cyan}Data Sources Connected:${colors.reset} ${connectedSources}/5`);
  console.log(`  ${colors.cyan}Active Streaks:${colors.reset} ${streaks.length}`);
  console.log(`  ${colors.cyan}At-Risk Streaks:${colors.reset} ${atRiskStreakCount}`);
  console.log(`  ${colors.cyan}Achievements Earned:${colors.reset} ${achievements.length}`);
  console.log(`  ${colors.cyan}Achievements Eligible:${colors.reset} ${eligible.length}`);

  console.log(`\n  ${colors.yellow}NOTE: This was a dry-run. No actual push notifications were sent.${colors.reset}`);
  console.log(`  ${colors.dim}To see actual AI-generated messages, the proactive engagement service`);
  console.log(`  would call OpenAI GPT-4o-mini with the context data shown above.${colors.reset}\n`);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

const targetEmail = process.argv[2] || 'sofian@moccet.com';

testNotifications(targetEmail)
  .then(() => {
    console.log(`\n${colors.green}Test completed successfully!${colors.reset}\n`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n${colors.red}Error running test:${colors.reset}`, error);
    process.exit(1);
  });
