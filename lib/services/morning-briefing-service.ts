/**
 * Morning Briefing Service
 *
 * Generates and sends proactive morning briefings that combine:
 * - AI-generated personalized affirmations based on goals, health, and context
 * - Aggregated tasks from Slack, Linear, Notion, Gmail
 *
 * @module lib/services/morning-briefing-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { sendPushNotification } from './onesignal-service';
import { analyzeHealthContext, HealthContext } from './daily-digest-service';
import {
  aggregateAllPlatforms,
  SlackBriefingData,
  LinearBriefingData,
  NotionBriefingData,
  GmailBriefingData,
} from './morning-briefing-aggregators';
import OpenAI from 'openai';

const openai = new OpenAI();

const logger = createLogger('MorningBriefingService');

// Base URL for internal API calls
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

// Studio images for notification headers
const STUDIO_IMAGES = [
  'studiosiraj_2d_drawing_of_crescent_moon_no_other_elements_--c_dc4e3ed1-248f-4b6e-8208-124075ff0830_0.png',
  'studiosiraj_circles_--chaos_20_--ar_32_--raw_--sref_httpss.mj_6475d1c3-9cfb-4602-bdbd-64909e311260_1.png',
  'studiosiraj_circles_--chaos_20_--ar_32_--raw_--sref_httpss.mj_6475d1c3-9cfb-4602-bdbd-64909e311260_3.png',
  'studiosiraj_clouds_on_white_background_--chaos_20_--ar_32_--r_2308fe4f-b0fb-4aa8-8f91-5e8e527a152d_2.png',
  'studiosiraj_minimalist_surreal_symbol_icon_of_an_eye_made_fro_4d70155e-1eb9-4024-9130-3117db073881_0.png',
  'studiosiraj_minimalist_surreal_symbol_of_a_single_human_silho_5c454b7f-39eb-442f-8008-296fd434cd12_0.png',
  'studiosiraj_one_cloud_--chaos_20_--ar_32_--raw_--sref_httpss._ecfaa726-f282-4220-b672-f3006b518e14_3.png',
  'studiosiraj_star_--chaos_20_--ar_32_--raw_--sref_httpss.mj.ru_fb276b5b-7fcc-4f1a-9a0a-d24725a2c906_2.png',
  'studiosiraj_surreal_atmospheric_illustration_of_a_solitary_huma_0efb7b95-037c-479f-92f6-3c531a60401a.png',
  'studiosiraj_surreal_atmospheric_illustration_of_a_solitary_huma_152d3fef-f7eb-4e26-95fd-3f5fa33faad6.png',
  'studiosiraj_surreal_atmospheric_illustration_of_a_solitary_huma_2a4300f3-c0d5-4815-99eb-99fd1f4c64d3.png',
  'studiosiraj_surreal_atmospheric_illustration_of_a_solitary_huma_9f43b3a7-3d13-4dc5-bc34-5490768a6438.png',
  'studiosiraj_surreal_atmospheric_illustration_of_a_solitary_huma_a0e65295-5b03-4bd9-9d60-7b5d428cca9f.png',
  'studiosiraj_surreal_atmospheric_illustration_of_a_solitary_huma_fa8d1d6c-0e6f-451a-a591-3a0034638eba.png',
  'studiosiraj_surreal_atmospheric_illustration_of_a_solitary_seat_41c09641-3b48-44f5-999f-cb4195b247c6.png',
];

// Varied wellness recommendations for when no health data is available
const DEFAULT_RECOMMENDATIONS = [
  "Start your day with intention. A few deep breaths can center your focus before diving in.",
  "Morning light exposure helps regulate your energy. Step outside briefly before opening your inbox.",
  "Hydration first - a glass of water kickstarts your metabolism and mental clarity.",
  "Consider a 5-minute stretch to wake up your body before tackling today's tasks.",
  "Music can shape your mood. Put on something uplifting as you begin your morning routine.",
  "Write down your top 3 priorities before getting pulled into reactive work.",
  "A mindful breakfast fuels better decisions. Don't skip it if you can.",
  "The first hour sets the tone. Protect it for your most important work.",
  "Step outside for fresh air - even 2 minutes can boost your alertness.",
  "Your morning routine is your foundation. Build it with care.",
  "A clear workspace often means a clearer mind. Quick tidy before you start?",
  "Connect with your breath. Three slow inhales before you open Slack.",
];

// ============================================================================
// VARIED RECOMMENDATIONS BY HEALTH STATE
// Each state has multiple options to prevent repetition
// ============================================================================

const RECOMMENDATIONS_BY_STATE: Record<string, string[]> = {
  // Low recovery (< 50)
  low_recovery: [
    "Your recovery is on the lower side today. Consider a gentle start - a short walk and some deep breaths before diving into tasks.",
    "Recovery is below optimal. Start with lighter tasks and save demanding work for later when you've built momentum.",
    "Your body needs some TLC today. A slower morning with extra hydration will help you perform better later.",
    "Low recovery detected. Focus on one priority this morning instead of multitasking.",
    "Recovery is rebuilding. Some morning sunlight and a calm breakfast can help reset your energy.",
    "Take it slow this morning. Your body is still recuperating - schedule your toughest tasks for tomorrow.",
  ],

  // Low HRV (< 40)
  low_hrv: [
    "Your HRV suggests some stress. A 10-minute walk or light stretch before opening Slack could help you focus.",
    "HRV is lower than usual. Try box breathing (4 counts in, hold, out, hold) before your first meeting.",
    "Stress signals detected in your HRV. Consider starting with a grounding activity like journaling or tea.",
    "Your nervous system could use some support. A brief meditation or gentle movement will help you focus.",
    "HRV indicates your body is working hard. Protect your morning energy with a calm, intentional start.",
    "Lower HRV today. Avoid coffee overload - opt for green tea and start with creative work first.",
  ],

  // Poor sleep (< 6 hours)
  poor_sleep: [
    "You had a shorter night. Be kind to yourself - tackle your most important task first while energy is fresh.",
    "Sleep was limited. Front-load your priorities and schedule a brief afternoon rest if possible.",
    "Short sleep detected. Avoid complex decisions early - start with routine tasks to build momentum.",
    "You're running on less sleep. Stay hydrated and take a short walk mid-morning to boost alertness.",
    "Limited rest last night. Focus on your #1 priority and delegate what you can today.",
    "Sleep deficit noted. A protein-rich breakfast will help sustain your energy through the morning.",
  ],

  // High recovery (>= 70)
  high_recovery: [
    "Great recovery! You're primed for a productive day. Perfect time to tackle challenging tasks.",
    "Excellent recovery scores! Your body is ready for high performance. Take on that challenging project.",
    "You're well-recovered. This is a great day for creative work, strategic thinking, or tough conversations.",
    "Recovery is optimal! Capitalize on this energy with your most demanding priorities.",
    "Top recovery today. Use this energy wisely - schedule your hardest tasks for this morning.",
    "Your body bounced back well. Perfect day for that workout you've been planning or a big initiative.",
  ],

  // High energy level
  high_energy: [
    "Your body is well-rested. A brief energizing stretch will have you ready to crush your tasks.",
    "Energy levels are up! Channel this into focused work - protect your first 2 hours for deep work.",
    "You're charged up today. Perfect time for that challenging project or creative brainstorm.",
    "High energy detected. Don't waste it on emails first - dive into meaningful work right away.",
    "Your vitals show you're ready to perform. Make the most of this with your highest-impact tasks.",
    "Energy is flowing well. Start with something ambitious while your reserves are full.",
    "Clear day ahead! Great time for deep work.",
    "Strong start to your day. Use this momentum for your most important priorities.",
  ],

  // Low energy level
  low_energy: [
    "Take it easy this morning. A gentle walk and some water will help you find your rhythm.",
    "Energy is lower today. Start with simpler tasks and build momentum gradually.",
    "Ease into your day. A short walk and healthy breakfast will help lift your energy naturally.",
    "Lower energy this morning. Be selective with your commitments and protect time for rest later.",
    "Your body needs a gentler start. Prioritize essentials and postpone what can wait.",
    "Energy reserves are low. Focus on just 2-3 must-do items today.",
  ],

  // Moderate/default
  moderate: [
    "A quick 5-10 minute walk before work can boost your focus and set a productive tone.",
    "Balanced start today. Set clear intentions and tackle your priorities in order of importance.",
    "Steady energy levels. Perfect for a structured, focused morning routine.",
    "Moderate readiness today. A bit of movement and your usual coffee will get you in the zone.",
    "Your metrics look stable. A normal productive day ahead - start with what matters most.",
    "Average energy today. Make it count by eliminating distractions for your first deep work block.",
    "Good foundation for today. Start with intention and build momentum from there.",
    "Solid baseline this morning. A brief stretch and your priorities list will set you up well.",
  ],
};

/**
 * Get a random studio image path
 */
function getRandomStudioImage(): string {
  const index = Math.floor(Math.random() * STUDIO_IMAGES.length);
  return `assets/studios/${STUDIO_IMAGES[index]}`;
}

/**
 * Get a random default recommendation
 */
function getRandomDefaultRecommendation(): string {
  const index = Math.floor(Math.random() * DEFAULT_RECOMMENDATIONS.length);
  return DEFAULT_RECOMMENDATIONS[index];
}

// ============================================================================
// PERSONALIZED AFFIRMATION SYSTEM
// ============================================================================

/**
 * Context for generating personalized affirmations
 */
interface AffirmationContext {
  health: {
    hrv?: number;
    recovery?: number;
    sleepHours?: number;
    sleepQuality?: string;
    energyLevel: string;
    stressLevel?: string;
  };
  goals: {
    active: Array<{ title: string; progress: number; category: string; daysActive?: number }>;
    recentlyCompleted: Array<{ title: string; completedDaysAgo: number }>;
  };
  today: {
    meetingCount: number;
    firstMeetingTime?: string;
    hasClearMorning: boolean;
    urgentTasks: number;
    totalTasks: number;
  };
  learnedFacts: string[];
  userName?: string;
  dayOfWeek: string;
}

/**
 * Build the context for generating a personalized affirmation
 */
async function buildAffirmationContext(
  email: string,
  health: HealthContext | null,
  platformData: {
    slack: SlackBriefingData | null;
    linear: LinearBriefingData | null;
    notion: NotionBriefingData | null;
    gmail: GmailBriefingData | null;
    totals: { actionItems: number; urgentItems: number };
  }
): Promise<AffirmationContext> {
  const supabase = createAdminClient();

  // Get user's name from profile
  const { data: profile } = await supabase
    .from('sage_onboarding_data')
    .select('name')
    .eq('email', email)
    .maybeSingle();

  // Get active goals with progress
  const { data: goalsData } = await supabase
    .from('user_health_goals')
    .select('title, category, current_value, target_value, progress_pct, status, created_at')
    .eq('user_email', email)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(10);

  const activeGoals: AffirmationContext['goals']['active'] = [];
  const completedGoals: AffirmationContext['goals']['recentlyCompleted'] = [];

  for (const goal of goalsData || []) {
    const daysActive = Math.floor((Date.now() - new Date(goal.created_at).getTime()) / (1000 * 60 * 60 * 24));

    if (goal.status === 'active') {
      activeGoals.push({
        title: goal.title,
        progress: goal.progress_pct || 0,
        category: goal.category,
        daysActive,
      });
    } else if (goal.status === 'completed') {
      completedGoals.push({
        title: goal.title,
        completedDaysAgo: daysActive,
      });
    }
  }

  // Get learned facts (preferences, lifestyle, etc.)
  const { data: factsData } = await supabase
    .from('user_learned_facts')
    .select('fact_value, category')
    .eq('user_email', email)
    .gte('confidence', 0.6)
    .in('category', ['preference', 'lifestyle', 'goal', 'schedule'])
    .order('learned_at', { ascending: false })
    .limit(5);

  const learnedFacts = (factsData || []).map(f => f.fact_value);

  // Calculate today's overview from platform data
  const meetingCount = platformData.gmail?.pendingEmails || 0;
  const urgentTasks = platformData.totals.urgentItems;
  const totalTasks = platformData.totals.actionItems;

  // Check if morning is clear (before 11am)
  const hasClearMorning = totalTasks < 3 && urgentTasks === 0;

  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return {
    health: {
      hrv: health?.hrv,
      recovery: health?.recovery,
      sleepHours: health?.sleepHours,
      energyLevel: health?.energyLevel || 'moderate',
      stressLevel: health?.stressLevel,
    },
    goals: {
      active: activeGoals.slice(0, 3),
      recentlyCompleted: completedGoals.filter(g => g.completedDaysAgo <= 7).slice(0, 2),
    },
    today: {
      meetingCount,
      hasClearMorning,
      urgentTasks,
      totalTasks,
    },
    learnedFacts,
    userName: profile?.name || undefined,
    dayOfWeek,
  };
}

/**
 * Generate a personalized affirmation using AI
 */
async function generateAIAffirmation(context: AffirmationContext): Promise<string | null> {
  try {
    // Build the context summary for the prompt
    const healthSummary = buildHealthSummary(context.health);
    const goalsSummary = buildGoalsSummary(context.goals);
    const todaySummary = buildTodaySummary(context.today, context.dayOfWeek);
    const factsSummary = context.learnedFacts.length > 0
      ? `Known about them: ${context.learnedFacts.join('; ')}`
      : '';

    const prompt = `Generate a personalized morning affirmation for ${context.userName || 'the user'}.

CONTEXT:
${healthSummary}
${goalsSummary}
${todaySummary}
${factsSummary}

Generate a 1-2 sentence morning affirmation that:
1. References specific data when available (numbers, progress, metrics)
2. Connects to their goals or recent achievements if relevant
3. Acknowledges today's context (busy day, clear day, Monday energy, etc.)
4. Is encouraging and specific - NOT generic fluff
5. Sounds natural and conversational

BAD examples (too generic):
- "Have a great day! Remember to stay hydrated!"
- "You've got this! Make today count!"

GOOD examples:
- "HRV is strong at 62ms. Your 3 workouts this week are building momentum toward your fitness goal."
- "Sleep was short but recovery is solid. Light task load today - good day to tackle that creative project."
- "Monday energy: your weekend recovery was excellent. Channel that into your top priority this morning."

Return ONLY the affirmation text (1-2 sentences max), nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });

    const affirmation = response.choices[0]?.message?.content?.trim();

    if (affirmation && affirmation.length > 10 && affirmation.length < 300) {
      logger.info('Generated AI affirmation', { email: context.userName, length: affirmation.length });
      return affirmation;
    }

    return null;
  } catch (error) {
    logger.error('Error generating AI affirmation', error);
    return null;
  }
}

/**
 * Build health summary for the AI prompt
 */
function buildHealthSummary(health: AffirmationContext['health']): string {
  const parts: string[] = [];

  if (health.hrv !== undefined) {
    parts.push(`HRV: ${health.hrv}ms`);
  }
  if (health.recovery !== undefined) {
    parts.push(`Recovery: ${health.recovery}%`);
  }
  if (health.sleepHours !== undefined) {
    parts.push(`Sleep: ${health.sleepHours.toFixed(1)} hours`);
  }
  if (health.energyLevel) {
    parts.push(`Energy: ${health.energyLevel}`);
  }
  if (health.stressLevel) {
    parts.push(`Stress: ${health.stressLevel}`);
  }

  return parts.length > 0 ? `Health: ${parts.join(', ')}` : 'Health data: not available';
}

/**
 * Build goals summary for the AI prompt
 */
function buildGoalsSummary(goals: AffirmationContext['goals']): string {
  const parts: string[] = [];

  if (goals.active.length > 0) {
    const goalStrings = goals.active.map(g =>
      `"${g.title}" (${g.progress}% complete, ${g.daysActive} days active)`
    );
    parts.push(`Active goals: ${goalStrings.join('; ')}`);
  }

  if (goals.recentlyCompleted.length > 0) {
    const completedStrings = goals.recentlyCompleted.map(g =>
      `"${g.title}" (completed ${g.completedDaysAgo} days ago)`
    );
    parts.push(`Recently completed: ${completedStrings.join('; ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'Goals: none set';
}

/**
 * Build today's overview for the AI prompt
 */
function buildTodaySummary(today: AffirmationContext['today'], dayOfWeek: string): string {
  const parts: string[] = [`Day: ${dayOfWeek}`];

  if (today.totalTasks > 0) {
    parts.push(`Tasks: ${today.totalTasks} items (${today.urgentTasks} urgent)`);
  } else {
    parts.push('Tasks: clear schedule');
  }

  if (today.hasClearMorning) {
    parts.push('Morning: light workload, good for focused work');
  }

  return `Today: ${parts.join(', ')}`;
}

// ============================================================================
// RECOMMENDATION TRACKING - Prevent repetition
// ============================================================================

/**
 * Get recently shown recommendations for a user (last 7 days)
 */
async function getRecentRecommendations(email: string): Promise<string[]> {
  const supabase = createAdminClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    // First try to get from the dedicated column
    const { data, error } = await supabase
      .from('morning_briefings')
      .select('wellness_recommendation, wellness_data')
      .eq('user_email', email)
      .gte('generated_at', sevenDaysAgo.toISOString())
      .order('generated_at', { ascending: false })
      .limit(7);

    if (error || !data) {
      return [];
    }

    // Extract recommendations from either the dedicated column or JSONB
    return data
      .map(row => row.wellness_recommendation || (row.wellness_data as Record<string, unknown>)?.recommendation as string)
      .filter((rec): rec is string => !!rec);
  } catch {
    // Table might not exist yet
    return [];
  }
}

/**
 * Pick a recommendation from a pool that hasn't been shown recently
 */
function pickUnseenRecommendation(
  pool: string[],
  recentRecommendations: string[]
): string {
  // Filter out recently shown recommendations
  const unseen = pool.filter(rec => !recentRecommendations.includes(rec));

  // If all have been shown, just pick randomly from the pool
  const availablePool = unseen.length > 0 ? unseen : pool;

  // Pick a random one
  const index = Math.floor(Math.random() * availablePool.length);
  return availablePool[index];
}

/**
 * Determine the health state category based on metrics
 */
function determineHealthState(health: HealthContext | null): string {
  if (!health) {
    return 'default';
  }

  const { recovery, hrv, sleepHours, energyLevel } = health;

  // Priority order: critical states first, then positive states
  if (recovery !== undefined && recovery < 50) {
    return 'low_recovery';
  }

  if (hrv !== undefined && hrv < 40) {
    return 'low_hrv';
  }

  if (sleepHours !== undefined && sleepHours < 6) {
    return 'poor_sleep';
  }

  if (recovery !== undefined && recovery >= 70) {
    return 'high_recovery';
  }

  if (energyLevel === 'high') {
    return 'high_energy';
  }

  if (energyLevel === 'low') {
    return 'low_energy';
  }

  return 'moderate';
}

// ============================================================================
// TYPES
// ============================================================================

export interface MorningBriefing {
  wellness: {
    available: boolean;
    hrv?: number;
    recovery?: number;
    sleepHours?: number;
    energyLevel: 'low' | 'moderate' | 'high';
    recommendation: string;
    dataPoints: string[];
  };
  slack: SlackBriefingData | null;
  linear: LinearBriefingData | null;
  notion: NotionBriefingData | null;
  gmail: GmailBriefingData | null;
  totals: {
    actionItems: number;
    urgentItems: number;
  };
  generatedAt: string;
}

export interface BriefingDeliveryResult {
  email: string;
  success: boolean;
  actionItems: number;
  notificationSent: boolean;
  error?: string;
}

// ============================================================================
// WELLNESS RECOMMENDATIONS
// ============================================================================

/**
 * Generate a personalized morning affirmation
 * Uses AI to create context-aware affirmations based on goals, health, and daily context
 * Falls back to static recommendations if AI fails
 */
async function generatePersonalizedAffirmation(
  health: HealthContext | null,
  email: string,
  platformData: {
    slack: SlackBriefingData | null;
    linear: LinearBriefingData | null;
    notion: NotionBriefingData | null;
    gmail: GmailBriefingData | null;
    totals: { actionItems: number; urgentItems: number };
  }
): Promise<string> {
  // Try AI-generated personalized affirmation first
  try {
    const context = await buildAffirmationContext(email, health, platformData);
    const aiAffirmation = await generateAIAffirmation(context);

    if (aiAffirmation) {
      logger.info('Using AI-generated affirmation', { email });
      return aiAffirmation;
    }
  } catch (error) {
    logger.warn('AI affirmation generation failed, using fallback', { error, email });
  }

  // Fallback to static recommendations with deduplication
  return generateStaticRecommendation(health, email);
}

/**
 * Generate a static recommendation (fallback when AI fails)
 */
async function generateStaticRecommendation(
  health: HealthContext | null,
  email: string
): Promise<string> {
  // Get recently shown recommendations to avoid repetition
  const recentRecommendations = await getRecentRecommendations(email);

  if (!health) {
    return pickUnseenRecommendation(DEFAULT_RECOMMENDATIONS, recentRecommendations);
  }

  // Determine health state category
  const healthState = determineHealthState(health);

  // Get the appropriate recommendation pool
  const pool = RECOMMENDATIONS_BY_STATE[healthState] || RECOMMENDATIONS_BY_STATE.moderate;

  // Pick a recommendation that hasn't been shown recently
  const recommendation = pickUnseenRecommendation(pool, recentRecommendations);

  logger.info('Generated static recommendation (fallback)', {
    email,
    healthState,
    poolSize: pool.length,
    recentCount: recentRecommendations.length,
  });

  return recommendation;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

class MorningBriefingServiceClass {
  private supabase = createAdminClient();

  /**
   * Refresh platform data by triggering fresh fetches for Slack and Gmail
   * This ensures we have the latest messages/tasks before aggregating
   */
  private async refreshPlatformData(email: string): Promise<void> {
    logger.info('Refreshing platform data before briefing', { email });

    // Check which platforms are connected
    const { data: tokens } = await this.supabase
      .from('integration_tokens')
      .select('provider')
      .eq('user_email', email)
      .eq('is_active', true);

    const connectedProviders = new Set((tokens || []).map(t => t.provider));

    // Trigger fetches in parallel for connected platforms
    const fetchPromises: Promise<void>[] = [];

    if (connectedProviders.has('slack')) {
      fetchPromises.push(this.triggerFetch('slack', email));
    }

    if (connectedProviders.has('gmail')) {
      fetchPromises.push(this.triggerFetch('gmail', email));
    }

    // Wait for all fetches with a timeout
    try {
      await Promise.race([
        Promise.allSettled(fetchPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 30000)),
      ]);
      logger.info('Platform data refresh completed', { email });
    } catch (error) {
      logger.warn('Platform data refresh timed out or failed', { error, email });
      // Continue anyway - we'll use whatever data we have
    }
  }

  /**
   * Trigger a fetch for a specific platform
   */
  private async triggerFetch(platform: 'slack' | 'gmail', email: string): Promise<void> {
    try {
      const url = `${BASE_URL}/api/${platform}/fetch-data`;
      logger.info(`Triggering ${platform} fetch`, { email, url });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn(`${platform} fetch failed`, { status: response.status, text, email });
      } else {
        logger.info(`${platform} fetch completed`, { email });
      }
    } catch (error) {
      logger.warn(`${platform} fetch error`, { error, email });
    }
  }

  /**
   * Generate a morning briefing for a user
   */
  async generateBriefing(email: string): Promise<MorningBriefing> {
    logger.info('Generating morning briefing', { email });

    // First, refresh platform data to get latest messages/tasks
    await this.refreshPlatformData(email);

    // Fetch health context and platform data in parallel
    const [healthContext, platformData] = await Promise.all([
      analyzeHealthContext(email),
      aggregateAllPlatforms(email),
    ]);

    // Generate personalized AI affirmation (with fallback to static recommendations)
    const recommendation = await generatePersonalizedAffirmation(healthContext, email, platformData);

    const briefing: MorningBriefing = {
      wellness: {
        available: !!healthContext,
        hrv: healthContext?.hrv,
        recovery: healthContext?.recovery,
        sleepHours: healthContext?.sleepHours,
        energyLevel: healthContext?.energyLevel || 'moderate',
        recommendation,
        dataPoints: healthContext?.dataPoints || [],
      },
      slack: platformData.slack,
      linear: platformData.linear,
      notion: platformData.notion,
      gmail: platformData.gmail,
      totals: platformData.totals,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Generated morning briefing', {
      email,
      hasWellness: briefing.wellness.available,
      hasSlack: !!briefing.slack,
      hasLinear: !!briefing.linear,
      hasNotion: !!briefing.notion,
      hasGmail: !!briefing.gmail,
      actionItems: briefing.totals.actionItems,
      urgentItems: briefing.totals.urgentItems,
    });

    return briefing;
  }

  /**
   * Format the notification title based on available wellness data
   */
  private formatTitle(briefing: MorningBriefing): string {
    const { wellness } = briefing;

    if (wellness.hrv) {
      return `Good morning! HRV: ${wellness.hrv}ms`;
    }

    if (wellness.recovery) {
      return `Good morning! Recovery: ${wellness.recovery}%`;
    }

    if (wellness.sleepHours) {
      return `Good morning! Sleep: ${wellness.sleepHours.toFixed(1)}h`;
    }

    return 'Good morning!';
  }

  /**
   * Format the notification body with wellness + task summary
   */
  private formatBody(briefing: MorningBriefing): string {
    const parts: string[] = [];

    // Add wellness recommendation
    parts.push(briefing.wellness.recommendation);
    parts.push('');

    // Check if there are any action items
    if (briefing.totals.actionItems === 0) {
      parts.push('Clear day ahead! Great time for deep work.');
      return parts.join('\n');
    }

    parts.push('Waiting for you:');

    // Slack - show top person if available
    if (briefing.slack && briefing.slack.totalPending > 0) {
      if (briefing.slack.byPerson.length > 0) {
        const topPerson = briefing.slack.byPerson[0];
        if (briefing.slack.byPerson.length > 1) {
          parts.push(`• ${topPerson.name} (Slack): ${topPerson.count} requests +${briefing.slack.byPerson.length - 1} others`);
        } else {
          parts.push(`• ${topPerson.name} (Slack): ${topPerson.count} requests`);
        }
      } else {
        parts.push(`• Slack: ${briefing.slack.totalPending} pending`);
      }
    }

    // Linear - show urgent/high priority
    if (briefing.linear) {
      const { urgentCount, highPriorityCount } = briefing.linear;
      const total = urgentCount + highPriorityCount;
      if (total > 0) {
        if (urgentCount > 0) {
          parts.push(`• Linear: ${urgentCount} urgent${highPriorityCount > 0 ? `, ${highPriorityCount} high priority` : ''}`);
        } else {
          parts.push(`• Linear: ${highPriorityCount} high priority issues`);
        }
      }
    }

    // Notion - show due today/overdue
    if (briefing.notion) {
      const { dueToday, overdue } = briefing.notion;
      const total = dueToday + overdue;
      if (total > 0) {
        if (overdue > 0) {
          parts.push(`• Notion: ${overdue} overdue${dueToday > 0 ? `, ${dueToday} due today` : ''}`);
        } else {
          parts.push(`• Notion: ${dueToday} due today`);
        }
      }
    }

    // Gmail - show needs response
    if (briefing.gmail && briefing.gmail.needsResponse > 0) {
      const { needsResponse, highPriority } = briefing.gmail;
      if (highPriority > 0) {
        parts.push(`• Gmail: ${needsResponse} need response (${highPriority} urgent)`);
      } else {
        parts.push(`• Gmail: ${needsResponse} need response`);
      }
    }

    parts.push('');
    parts.push('Tap to view your priorities.');

    return parts.join('\n');
  }

  /**
   * Store briefing in database
   */
  private async storeBriefing(email: string, briefing: MorningBriefing): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('morning_briefings')
        .insert({
          user_email: email,
          wellness_data: briefing.wellness,
          wellness_recommendation: briefing.wellness.recommendation, // Store separately for deduplication
          slack_summary: briefing.slack || {},
          linear_summary: briefing.linear || {},
          notion_summary: briefing.notion || {},
          gmail_summary: briefing.gmail || {},
          total_action_items: briefing.totals.actionItems,
          urgent_items: briefing.totals.urgentItems,
          notification_sent: false,
          generated_at: briefing.generatedAt,
        })
        .select('id')
        .single();

      if (error) {
        // Table might not exist yet
        logger.warn('Could not store briefing', { error: error.message });
        return null;
      }

      return data?.id || null;
    } catch (error) {
      logger.warn('Error storing briefing', { error });
      return null;
    }
  }

  /**
   * Update briefing as sent
   */
  private async markBriefingSent(briefingId: string): Promise<void> {
    try {
      await this.supabase
        .from('morning_briefings')
        .update({
          notification_sent: true,
          sent_at: new Date().toISOString(),
        })
        .eq('id', briefingId);
    } catch (error) {
      logger.warn('Error marking briefing as sent', { error });
    }
  }

  /**
   * Check if user already received a briefing today
   */
  async alreadySentToday(email: string): Promise<boolean> {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data } = await this.supabase
        .from('morning_briefings')
        .select('id')
        .eq('user_email', email)
        .eq('notification_sent', true)
        .gte('generated_at', todayStart.toISOString())
        .limit(1);

      return data && data.length > 0;
    } catch (error) {
      // If table doesn't exist, allow sending
      return false;
    }
  }

  /**
   * Send morning briefing to a user
   */
  async sendBriefing(email: string, options?: { force?: boolean }): Promise<BriefingDeliveryResult> {
    try {
      // Check if already sent today (skip if force=true)
      if (!options?.force && await this.alreadySentToday(email)) {
        logger.info('Briefing already sent today', { email });
        return {
          email,
          success: true,
          actionItems: 0,
          notificationSent: false,
          error: 'Already sent today',
        };
      }

      // Generate briefing
      const briefing = await this.generateBriefing(email);

      // Store in database
      const briefingId = await this.storeBriefing(email, briefing);

      // Format notification
      const title = this.formatTitle(briefing);
      let body = this.formatBody(briefing);

      // Truncate body if too long
      if (body.length > 250) {
        body = body.substring(0, 247) + '...';
      }

      // Send notification with random header image and full task details
      const headerImage = getRandomStudioImage();

      // Build action items list for display
      const actionItems: string[] = [];

      // Add Slack tasks by person
      if (briefing.slack && briefing.slack.byPerson.length > 0) {
        for (const person of briefing.slack.byPerson.slice(0, 3)) {
          actionItems.push(`${person.name} (Slack): ${person.count} ${person.count === 1 ? 'request' : 'requests'}`);
        }
      }

      // Add Linear issues
      if (briefing.linear && briefing.linear.issues.length > 0) {
        for (const issue of briefing.linear.issues.slice(0, 3)) {
          const priority = issue.priority === 1 ? '🔴 Urgent' : issue.priority === 2 ? '🟠 High' : '';
          actionItems.push(`Linear: ${issue.title}${priority ? ` (${priority})` : ''}`);
        }
      }

      // Add Notion tasks
      if (briefing.notion && briefing.notion.tasks.length > 0) {
        for (const task of briefing.notion.tasks.slice(0, 3)) {
          const dueText = task.dueDate ? ` - due ${new Date(task.dueDate).toLocaleDateString()}` : '';
          actionItems.push(`Notion: ${task.title}${dueText}`);
        }
      }

      // Add Gmail emails
      if (briefing.gmail && briefing.gmail.emails.length > 0) {
        for (const email of briefing.gmail.emails.slice(0, 3)) {
          actionItems.push(`Gmail from ${email.from}: ${email.summary}`);
        }
      }

      const sent = await sendPushNotification(email, {
        title,
        body,
        data: {
          type: 'morning_briefing',
          header_image: headerImage,
          recommendation: briefing.wellness.recommendation,
          action_steps: JSON.stringify(actionItems),
          slack_count: String(briefing.slack?.totalPending || 0),
          linear_count: String((briefing.linear?.urgentCount || 0) + (briefing.linear?.highPriorityCount || 0)),
          notion_count: String((briefing.notion?.dueToday || 0) + (briefing.notion?.overdue || 0)),
          gmail_count: String(briefing.gmail?.needsResponse || 0),
          total_urgent: String(briefing.totals.urgentItems),
          total_action_items: String(briefing.totals.actionItems),
          wellness_available: String(briefing.wellness.available),
          hrv: String(briefing.wellness.hrv || ''),
          recovery: String(briefing.wellness.recovery || ''),
          action_url: '/home',
        },
      });

      // Mark as sent
      if (briefingId && sent > 0) {
        await this.markBriefingSent(briefingId);
      }

      logger.info('Sent morning briefing', {
        email,
        actionItems: briefing.totals.actionItems,
        notificationSent: sent > 0,
      });

      return {
        email,
        success: true,
        actionItems: briefing.totals.actionItems,
        notificationSent: sent > 0,
      };
    } catch (error) {
      logger.error('Error sending briefing', { error, email });
      return {
        email,
        success: false,
        actionItems: 0,
        notificationSent: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get users eligible for morning briefing
   * Checks user's local time against their preferred notification time
   */
  async getUsersForBriefing(): Promise<{ email: string; timezone: string }[]> {
    try {
      // Get users with active integrations
      const { data: integratedUsers, error } = await this.supabase
        .from('integration_tokens')
        .select('user_email')
        .eq('is_active', true);

      if (error) {
        logger.error('Error fetching users for briefing', { error });
        return [];
      }

      // Get unique emails
      const uniqueEmails = [...new Set(
        (integratedUsers || [])
          .map(u => u.user_email)
          .filter(Boolean) as string[]
      )];

      if (uniqueEmails.length === 0) {
        return [];
      }

      // Get user preferences for timing
      const { data: prefs } = await this.supabase
        .from('user_content_preferences')
        .select('user_email, preferred_time, timezone, morning_briefing_enabled')
        .in('user_email', uniqueEmails);

      // Get timezone from user_travel_context (set by location API)
      const { data: travelData } = await this.supabase
        .from('user_travel_context')
        .select('email, current_timezone, timezone_offset_change')
        .in('email', uniqueEmails);

      // Get timezone from user_device_context as fallback (set by location API)
      const { data: deviceData } = await this.supabase
        .from('user_device_context')
        .select('email, timezone')
        .in('email', uniqueEmails);

      const prefMap = new Map(
        (prefs || []).map(p => [p.user_email, p])
      );
      const travelMap = new Map(
        (travelData || []).map(t => [t.email, t])
      );
      const deviceMap = new Map(
        (deviceData || []).map(d => [d.email, d])
      );

      // Filter users by their local time
      const eligibleUsers: { email: string; timezone: string }[] = [];

      for (const email of uniqueEmails) {
        const userPref = prefMap.get(email);
        const userTravel = travelMap.get(email);
        const userDevice = deviceMap.get(email);

        // Check if briefing is enabled (default: true)
        if (userPref?.morning_briefing_enabled === false) {
          continue;
        }

        // Get timezone from multiple sources (preference > travel > device > UTC)
        let timezone = userPref?.timezone;
        if (!timezone || timezone === 'UTC') {
          timezone = userTravel?.current_timezone;
        }
        if (!timezone || timezone === 'UTC') {
          timezone = userDevice?.timezone;
        }
        if (!timezone) {
          timezone = 'UTC';
        }

        // Convert short timezone names to IANA format for reliable parsing
        timezone = this.normalizeTimezone(timezone, userTravel?.timezone_offset_change);

        const preferredTime = userPref?.preferred_time || '08:00';

        // Get user's local time
        const userLocalTime = this.getUserLocalTime(timezone);
        const userHour = userLocalTime.getHours();
        const userMinute = userLocalTime.getMinutes();

        // Parse preferred time
        const [prefHour, prefMinute] = preferredTime.split(':').map(Number);

        // Check if within 15-minute window
        const prefTotalMinutes = prefHour * 60 + prefMinute;
        const currentTotalMinutes = userHour * 60 + userMinute;
        const diff = Math.abs(prefTotalMinutes - currentTotalMinutes);

        if (diff <= 15 || diff >= (24 * 60 - 15)) {
          eligibleUsers.push({ email, timezone });
          logger.debug('User eligible for briefing', { email, timezone, preferredTime, userHour, userMinute });
        }
      }

      logger.info('Found eligible users for briefing', { count: eligibleUsers.length });
      return eligibleUsers;
    } catch (error) {
      logger.error('Error getting users for briefing', { error });
      return [];
    }
  }

  /**
   * Normalize timezone string to IANA format
   * Converts short names like "EST", "PST" to proper IANA timezones
   */
  private normalizeTimezone(tz: string, offsetHours?: number): string {
    // Map common abbreviations to IANA timezones
    const timezoneMap: Record<string, string> = {
      'EST': 'America/New_York',
      'EDT': 'America/New_York',
      'CST': 'America/Chicago',
      'CDT': 'America/Chicago',
      'MST': 'America/Denver',
      'MDT': 'America/Denver',
      'PST': 'America/Los_Angeles',
      'PDT': 'America/Los_Angeles',
      'GMT': 'Europe/London',
      'BST': 'Europe/London',
      'CET': 'Europe/Paris',
      'CEST': 'Europe/Paris',
      'AST': 'Asia/Riyadh',
      'GST': 'Asia/Dubai',
      'IST': 'Asia/Kolkata',
      'JST': 'Asia/Tokyo',
      'AEST': 'Australia/Sydney',
      'AEDT': 'Australia/Sydney',
    };

    // If it's already an IANA timezone, return as is
    if (tz.includes('/')) {
      return tz;
    }

    // Try to map the abbreviation
    const mapped = timezoneMap[tz.toUpperCase()];
    if (mapped) {
      return mapped;
    }

    // If we have an offset, try to derive timezone
    if (offsetHours !== undefined) {
      // Common offset mappings
      const offsetMap: Record<number, string> = {
        '-5': 'America/New_York',
        '-6': 'America/Chicago',
        '-7': 'America/Denver',
        '-8': 'America/Los_Angeles',
        '0': 'Europe/London',
        '1': 'Europe/Paris',
        '3': 'Asia/Riyadh',
        '4': 'Asia/Dubai',
        '5.5': 'Asia/Kolkata',
        '9': 'Asia/Tokyo',
        '10': 'Australia/Sydney',
      };
      const offsetKey = String(offsetHours);
      if (offsetMap[offsetKey]) {
        return offsetMap[offsetKey];
      }
    }

    // Default to UTC if we can't determine
    return 'UTC';
  }

  /**
   * Get current time in a specific timezone
   */
  private getUserLocalTime(timezone: string): Date {
    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);

      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

      const localDate = new Date();
      localDate.setHours(hour, minute, 0, 0);
      return localDate;
    } catch {
      return new Date();
    }
  }

  /**
   * Run the morning briefing job for all eligible users
   */
  async runBriefingJob(): Promise<{
    processed: number;
    sent: number;
    results: BriefingDeliveryResult[];
  }> {
    logger.info('Starting morning briefing job');

    try {
      const users = await this.getUsersForBriefing();

      if (users.length === 0) {
        logger.info('No users eligible for briefing at this time');
        return { processed: 0, sent: 0, results: [] };
      }

      logger.info('Processing briefings', { userCount: users.length });

      const results: BriefingDeliveryResult[] = [];
      let sent = 0;

      for (const user of users) {
        const result = await this.sendBriefing(user.email);
        results.push(result);

        if (result.notificationSent) sent++;

        // Small delay between users
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info('Morning briefing job completed', {
        processed: users.length,
        sent,
      });

      return { processed: users.length, sent, results };
    } catch (error) {
      logger.error('Error running briefing job', { error });
      throw error;
    }
  }

  /**
   * Send briefing to a specific user (manual trigger)
   */
  async sendBriefingNow(email: string, options?: { force?: boolean }): Promise<BriefingDeliveryResult> {
    logger.info('Manual briefing trigger', { email, force: options?.force });
    return this.sendBriefing(email, options);
  }
}

// Export singleton instance
export const MorningBriefingService = new MorningBriefingServiceClass();
