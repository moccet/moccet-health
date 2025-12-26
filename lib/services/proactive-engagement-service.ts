/**
 * Proactive Engagement Service
 *
 * Sends personalized, supportive notifications to users based on their full context:
 * - Daily insight digests
 * - Motivational messages & manifestations
 * - Contextual support for work challenges
 * - Recovery encouragement
 * - Achievement celebrations
 */

import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import {
  fetchAllEcosystemData,
  EcosystemData,
} from './ecosystem-fetcher';
import { sendInsightNotification } from './onesignal-service';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================================================
// TYPES
// ============================================================================

export type EngagementType =
  | 'daily_digest'
  | 'morning_motivation'
  | 'recovery_reminder'
  | 'stress_support'
  | 'achievement_celebration'
  | 'evening_reflection'
  | 'challenge_encouragement'
  | 'health_tip'
  | 'mindfulness_prompt';

export interface ProactiveNotification {
  type: EngagementType;
  title: string;
  message: string;
  context_data: Record<string, unknown>;
}

// ============================================================================
// AI MESSAGE GENERATION
// ============================================================================

/**
 * Generate a personalized message using AI based on user context
 */
async function generatePersonalizedMessage(
  prompt: string,
  context: Record<string, unknown>
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a supportive, warm health companion. Generate short, personalized messages (max 2 sentences) that are:
- Encouraging and positive, never judgmental
- Specific to the user's actual data/situation
- Actionable when appropriate
- Warm but not overly effusive
- Natural and conversational, like a supportive friend

Never use generic platitudes. Always reference specific details from the context provided.`,
        },
        {
          role: 'user',
          content: `${prompt}\n\nContext: ${JSON.stringify(context, null, 2)}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.8,
    });

    return response.choices[0]?.message?.content?.trim() || '';
  } catch (error) {
    console.error('[Proactive Engagement] Error generating message:', error);
    return '';
  }
}

// ============================================================================
// DAILY DIGEST
// ============================================================================

/**
 * Generate a daily insight digest summarizing the most important insights
 */
async function generateDailyDigest(
  email: string,
  ecosystemData: EcosystemData
): Promise<ProactiveNotification | null> {
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

  // Analyze work stress
  if (ecosystemData.gmail?.available && ecosystemData.gmail.data) {
    const gmail = ecosystemData.gmail.data;
    if (gmail.stressIndicators?.frequentAfterHoursWork) {
      concerns.push('high after-hours work activity');
    }
    if (gmail.focusTime?.focusScore === 'excellent') {
      highlights.push('good focus time protected');
    }
  }

  // Only send if there's something noteworthy
  if (highlights.length === 0 && concerns.length === 0) {
    return null;
  }

  // Generate personalized summary
  let title: string;
  let messagePrompt: string;

  if (concerns.length > highlights.length) {
    title = 'Your Daily Health Check-in';
    messagePrompt = `Generate a supportive daily check-in message. The user has some areas needing attention: ${concerns.join(', ')}. But also acknowledge positives if any: ${highlights.join(', ') || 'none today'}. Be encouraging, not alarming.`;
  } else if (highlights.length > 0) {
    title = 'Your Body is Thriving Today';
    messagePrompt = `Generate a celebratory daily digest. The user is doing great with: ${highlights.join(', ')}. Acknowledge their progress warmly.`;
  } else {
    title = 'Daily Health Update';
    messagePrompt = `Generate a neutral daily check-in. Mixed signals today - positives: ${highlights.join(', ') || 'steady'}. Areas to watch: ${concerns.join(', ') || 'all good'}.`;
  }

  const message = await generatePersonalizedMessage(messagePrompt, {
    highlights,
    concerns,
    sleepScore: ecosystemData.oura?.data?.avgReadinessScore,
    recoveryScore: ecosystemData.whoop?.data?.avgRecoveryScore,
    glucoseInRange: ecosystemData.dexcom?.data?.timeInRange,
  });

  if (!message) return null;

  return {
    type: 'daily_digest',
    title,
    message,
    context_data: { highlights, concerns },
  };
}

// ============================================================================
// MORNING MOTIVATION
// ============================================================================

/**
 * Generate a morning motivational message based on their current state
 */
async function generateMorningMotivation(
  email: string,
  ecosystemData: EcosystemData
): Promise<ProactiveNotification | null> {
  const context: Record<string, unknown> = {};
  let prompt = 'Generate a warm, personalized morning message for the user. ';

  // Check recovery state
  if (ecosystemData.whoop?.data) {
    const recovery = ecosystemData.whoop.data.avgRecoveryScore;
    context.recovery = recovery;

    if (recovery >= 67) {
      prompt += `They woke up with great recovery (${Math.round(recovery)}%) - encourage them to make the most of their energy. `;
    } else if (recovery < 40) {
      prompt += `Their recovery is low today (${Math.round(recovery)}%) - encourage gentle self-care and not overexerting. `;
    }
  }

  // Check sleep
  if (ecosystemData.oura?.data) {
    const sleepHours = ecosystemData.oura.data.avgSleepHours;
    context.sleepHours = sleepHours;

    if (sleepHours >= 7.5) {
      prompt += `They got good sleep (${sleepHours.toFixed(1)} hours). `;
    } else if (sleepHours < 6) {
      prompt += `They're running on little sleep (${sleepHours.toFixed(1)} hours) - acknowledge this gently. `;
    }
  }

  // Check calendar load
  if (ecosystemData.gmail?.data) {
    const meetings = ecosystemData.gmail.data.meetingDensity?.avgMeetingsPerDay;
    if (meetings && meetings > 5) {
      context.busyDay = true;
      prompt += `They have a busy day ahead with many meetings - wish them well. `;
    }
  }

  prompt += 'Keep it brief, warm, and specific to their situation.';

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  return {
    type: 'morning_motivation',
    title: 'Good Morning',
    message,
    context_data: context,
  };
}

// ============================================================================
// STRESS SUPPORT & CHALLENGE ENCOURAGEMENT
// ============================================================================

/**
 * Detect work challenges and generate supportive messages
 */
async function generateStressSupport(
  email: string,
  ecosystemData: EcosystemData
): Promise<ProactiveNotification | null> {
  const stressSignals: string[] = [];
  const context: Record<string, unknown> = {};

  // Check Slack patterns for stress indicators
  if (ecosystemData.slack?.available && ecosystemData.slack.data) {
    const slack = ecosystemData.slack.data;

    if (slack.stressIndicators?.constantAvailability) {
      stressSignals.push('always-on communication pattern');
    }
    if (slack.stressIndicators?.lateNightMessages) {
      stressSignals.push('late night messages');
    }
    if (slack.messageVolume?.avgPerDay > 100) {
      stressSignals.push('high message volume');
      context.messageVolume = slack.messageVolume.avgPerDay;
    }
  }

  // Check Gmail for work overload
  if (ecosystemData.gmail?.available && ecosystemData.gmail.data) {
    const gmail = ecosystemData.gmail.data;

    if (gmail.stressIndicators?.highEmailVolume && gmail.stressIndicators?.frequentAfterHoursWork) {
      stressSignals.push('high email load with after-hours work');
    }
    if (gmail.meetingDensity?.backToBackPercentage > 60) {
      stressSignals.push('back-to-back meetings');
      context.backToBack = gmail.meetingDensity.backToBackPercentage;
    }
  }

  // Check physiological stress markers
  if (ecosystemData.oura?.data) {
    const oura = ecosystemData.oura.data;
    if (oura.avgHRV && oura.hrvBaseline && oura.avgHRV < oura.hrvBaseline * 0.8) {
      stressSignals.push('HRV below baseline');
      context.hrvDrop = Math.round((1 - oura.avgHRV / oura.hrvBaseline) * 100);
    }
  }

  if (ecosystemData.whoop?.data && ecosystemData.whoop.data.avgRecoveryScore < 40) {
    stressSignals.push('low recovery');
    context.recovery = ecosystemData.whoop.data.avgRecoveryScore;
  }

  // Only send if multiple stress signals detected
  if (stressSignals.length < 2) {
    return null;
  }

  context.stressSignals = stressSignals;

  const prompt = `Generate a supportive, compassionate message for someone showing signs of stress: ${stressSignals.join(', ')}.
Don't lecture them or tell them what to do. Instead, acknowledge what they're going through, remind them they're doing their best, and offer one gentle suggestion.
Be like a caring friend checking in, not a health app.`;

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  return {
    type: 'stress_support',
    title: "Hey, checking in on you",
    message,
    context_data: context,
  };
}

// ============================================================================
// ACHIEVEMENT CELEBRATION
// ============================================================================

/**
 * Celebrate user achievements and progress
 */
async function generateAchievementCelebration(
  email: string,
  ecosystemData: EcosystemData
): Promise<ProactiveNotification | null> {
  const achievements: string[] = [];
  const context: Record<string, unknown> = {};

  // Check for streaks and milestones
  if (ecosystemData.whoop?.data) {
    const whoop = ecosystemData.whoop.data;
    if (whoop.recoveryPatterns?.optimalRecoveryStreak && whoop.recoveryPatterns.optimalRecoveryStreak >= 3) {
      achievements.push(`${whoop.recoveryPatterns.optimalRecoveryStreak}-day recovery streak`);
      context.recoveryStreak = whoop.recoveryPatterns.optimalRecoveryStreak;
    }
    if (whoop.avgRecoveryScore >= 80) {
      achievements.push('exceptional recovery today');
      context.recovery = whoop.avgRecoveryScore;
    }
  }

  if (ecosystemData.oura?.data) {
    const oura = ecosystemData.oura.data;
    if (oura.avgReadinessScore >= 85) {
      achievements.push('peak readiness');
      context.readiness = oura.avgReadinessScore;
    }
    if (oura.sleepConsistency?.score && oura.sleepConsistency.score >= 90) {
      achievements.push('excellent sleep consistency');
      context.sleepConsistency = oura.sleepConsistency.score;
    }
  }

  if (ecosystemData.dexcom?.data) {
    const dexcom = ecosystemData.dexcom.data;
    if (dexcom.timeInRange >= 85) {
      achievements.push('outstanding glucose control');
      context.glucoseInRange = dexcom.timeInRange;
    }
  }

  // Only celebrate if there's something notable
  if (achievements.length === 0) {
    return null;
  }

  context.achievements = achievements;

  const prompt = `Generate a celebration message for these achievements: ${achievements.join(', ')}.
Be genuinely excited but not over the top. Acknowledge their effort and consistency.
Make them feel proud of their progress.`;

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  return {
    type: 'achievement_celebration',
    title: "You're crushing it!",
    message,
    context_data: context,
  };
}

// ============================================================================
// EVENING REFLECTION
// ============================================================================

/**
 * Generate an evening reflection/wind-down message
 */
async function generateEveningReflection(
  email: string,
  ecosystemData: EcosystemData
): Promise<ProactiveNotification | null> {
  const context: Record<string, unknown> = {};
  let prompt = 'Generate a calming evening reflection message. ';

  // Check how their day went
  if (ecosystemData.whoop?.data) {
    const strain = ecosystemData.whoop.data.avgStrainScore;
    if (strain > 15) {
      context.highStrain = true;
      prompt += `They had a demanding day (strain ${strain.toFixed(1)}). Acknowledge their effort. `;
    }
  }

  // Check work patterns
  if (ecosystemData.gmail?.data) {
    const gmail = ecosystemData.gmail.data;
    if (gmail.emailVolume?.afterHoursPercentage > 20) {
      context.workingLate = true;
      prompt += 'They\'ve been working into the evening. Gently encourage them to wind down. ';
    }
  }

  // Recommend based on tomorrow's needs
  if (ecosystemData.oura?.data && ecosystemData.oura.data.sleepDebt?.recoveryNeeded) {
    context.needsRest = true;
    prompt += 'They have some sleep debt to recover. Suggest an early bedtime. ';
  }

  prompt += 'Keep it peaceful and encourage good rest.';

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  return {
    type: 'evening_reflection',
    title: 'Time to Wind Down',
    message,
    context_data: context,
  };
}

// ============================================================================
// MINDFULNESS PROMPTS
// ============================================================================

/**
 * Generate a mindfulness or breathing prompt based on current state
 */
async function generateMindfulnessPrompt(
  email: string,
  ecosystemData: EcosystemData
): Promise<ProactiveNotification | null> {
  const context: Record<string, unknown> = {};

  // Check if they could benefit from a pause
  let shouldSend = false;

  if (ecosystemData.gmail?.data?.meetingDensity?.backToBackPercentage > 50) {
    shouldSend = true;
    context.backToBackMeetings = true;
  }

  if (ecosystemData.whoop?.data?.avgRecoveryScore < 50) {
    shouldSend = true;
    context.lowRecovery = ecosystemData.whoop.data.avgRecoveryScore;
  }

  if (ecosystemData.slack?.data?.stressIndicators?.constantAvailability) {
    shouldSend = true;
    context.alwaysOn = true;
  }

  if (!shouldSend) {
    return null;
  }

  const prompt = `Generate a brief, gentle mindfulness reminder. The user seems busy/stressed.
Suggest a simple 30-second breathing exercise or moment of pause.
Don't be preachy - just offer a gentle invitation to take a breath.`;

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  return {
    type: 'mindfulness_prompt',
    title: 'Quick Pause',
    message,
    context_data: context,
  };
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

/**
 * Store and send a proactive notification
 */
async function sendProactiveNotification(
  email: string,
  notification: ProactiveNotification
): Promise<boolean> {
  const supabase = await createClient();

  // Store in real_time_insights
  const { data, error } = await supabase
    .from('real_time_insights')
    .insert({
      email,
      insight_type: notification.type,
      title: notification.title,
      message: notification.message,
      severity: 'info',
      actionable_recommendation: '',
      source_provider: 'proactive_engagement',
      source_data_type: notification.type,
      context_data: notification.context_data,
      notification_sent: false,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[Proactive Engagement] Error storing notification:', error);
    return false;
  }

  // Send push notification
  try {
    const sentCount = await sendInsightNotification(email, {
      id: data.id,
      title: notification.title,
      message: notification.message,
      insight_type: notification.type,
      severity: 'info',
    });

    if (sentCount > 0) {
      await supabase
        .from('real_time_insights')
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
          notification_channel: 'push',
        })
        .eq('id', data.id);
      return true;
    }
  } catch (pushError) {
    console.error('[Proactive Engagement] Error sending push:', pushError);
  }

  return false;
}

/**
 * Check when the last notification of a type was sent to avoid spamming
 */
async function canSendNotificationType(
  email: string,
  type: EngagementType,
  minHoursBetween: number
): Promise<boolean> {
  const supabase = await createClient();

  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - minHoursBetween);

  const { data } = await supabase
    .from('real_time_insights')
    .select('id')
    .eq('email', email)
    .eq('insight_type', type)
    .gte('created_at', cutoffTime.toISOString())
    .limit(1);

  return !data || data.length === 0;
}

/**
 * Check daily notification limit to avoid overwhelming users
 * Max 2 proactive notifications per day
 */
async function canSendMoreToday(email: string): Promise<boolean> {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('real_time_insights')
    .select('id')
    .eq('email', email)
    .eq('source_provider', 'proactive_engagement')
    .gte('created_at', todayStart.toISOString());

  return !data || data.length < 2; // Max 2 per day
}

/**
 * Check if user has enough data connected to justify notifications
 */
function hasEnoughData(ecosystemData: EcosystemData): boolean {
  let connectedSources = 0;

  if (ecosystemData.oura?.available && ecosystemData.oura.data) connectedSources++;
  if (ecosystemData.whoop?.available && ecosystemData.whoop.data) connectedSources++;
  if (ecosystemData.dexcom?.available && ecosystemData.dexcom.data) connectedSources++;
  if (ecosystemData.gmail?.available && ecosystemData.gmail.data) connectedSources++;
  if (ecosystemData.slack?.available && ecosystemData.slack.data) connectedSources++;

  return connectedSources >= 1; // Need at least 1 data source
}

/**
 * Process proactive engagement for a user
 * Returns the number of notifications sent
 *
 * IMPORTANT: We are very selective about sending notifications.
 * Only send when there's genuinely meaningful content to share.
 * Max 2 notifications per day per user.
 */
export async function processProactiveEngagement(
  email: string,
  timeOfDay: 'morning' | 'midday' | 'evening'
): Promise<number> {
  console.log(`[Proactive Engagement] Processing ${timeOfDay} engagement for ${email}`);

  let notificationsSent = 0;

  try {
    // Check daily limit first - max 2 proactive notifications per day
    if (!(await canSendMoreToday(email))) {
      console.log(`[Proactive Engagement] Daily limit reached for ${email}, skipping`);
      return 0;
    }

    // Fetch ecosystem data
    const ecosystemData = await fetchAllEcosystemData(email);

    // Don't send anything if user has no data connected
    if (!hasEnoughData(ecosystemData)) {
      console.log(`[Proactive Engagement] Insufficient data for ${email}, skipping`);
      return 0;
    }

    // Morning: Only send if there's something notable about their morning state
    if (timeOfDay === 'morning') {
      // Only send morning motivation if recovery is notably good OR bad (not average)
      const recovery = ecosystemData.whoop?.data?.avgRecoveryScore;
      const readiness = ecosystemData.oura?.data?.avgReadinessScore;
      const hasNotableState = (recovery && (recovery >= 75 || recovery < 40)) ||
                              (readiness && (readiness >= 80 || readiness < 55));

      if (hasNotableState && await canSendNotificationType(email, 'morning_motivation', 24)) {
        const motivation = await generateMorningMotivation(email, ecosystemData);
        if (motivation && await sendProactiveNotification(email, motivation)) {
          notificationsSent++;
        }
      }
    }

    // Midday: Prioritize by importance, stop after sending one
    if (timeOfDay === 'midday' && await canSendMoreToday(email)) {
      // Priority 1: Stress support - only if multiple stress signals detected
      // (the function already requires 2+ signals to return a notification)
      if (notificationsSent === 0 && await canSendNotificationType(email, 'stress_support', 24)) {
        const support = await generateStressSupport(email, ecosystemData);
        if (support && await sendProactiveNotification(email, support)) {
          notificationsSent++;
        }
      }

      // Priority 2: Achievement celebration - only if there's a real achievement
      // (the function already checks for actual achievements)
      if (notificationsSent === 0 && await canSendNotificationType(email, 'achievement_celebration', 48)) {
        const achievement = await generateAchievementCelebration(email, ecosystemData);
        if (achievement && await sendProactiveNotification(email, achievement)) {
          notificationsSent++;
        }
      }

      // Priority 3: Daily digest - only if there's noteworthy content
      // (the function returns null if nothing interesting)
      if (notificationsSent === 0 && await canSendNotificationType(email, 'daily_digest', 24)) {
        const digest = await generateDailyDigest(email, ecosystemData);
        if (digest && await sendProactiveNotification(email, digest)) {
          notificationsSent++;
        }
      }

      // Skip mindfulness - too generic, remove from regular rotation
      // Only send mindfulness prompts in response to specific detected stress
    }

    // Evening: Only send if they had a demanding day or are working late
    if (timeOfDay === 'evening' && await canSendMoreToday(email)) {
      const hadDemandingDay = ecosystemData.whoop?.data?.avgStrainScore &&
                              ecosystemData.whoop.data.avgStrainScore > 14;
      const workingLate = ecosystemData.gmail?.data?.emailVolume?.afterHoursPercentage &&
                          ecosystemData.gmail.data.emailVolume.afterHoursPercentage > 25;

      if ((hadDemandingDay || workingLate) && await canSendNotificationType(email, 'evening_reflection', 24)) {
        const reflection = await generateEveningReflection(email, ecosystemData);
        if (reflection && await sendProactiveNotification(email, reflection)) {
          notificationsSent++;
        }
      }
    }

    console.log(`[Proactive Engagement] Sent ${notificationsSent} notifications to ${email}`);
    return notificationsSent;
  } catch (error) {
    console.error(`[Proactive Engagement] Error processing ${email}:`, error);
    return 0;
  }
}

/**
 * Get all users who have opted into proactive notifications
 */
export async function getUsersForProactiveEngagement(): Promise<string[]> {
  const supabase = await createClient();

  // Get users with active integrations
  // In the future, could add a user preference table for notification settings
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('user_email')
    .eq('is_active', true);

  if (error) {
    console.error('[Proactive Engagement] Error fetching users:', error);
    return [];
  }

  const emails = [...new Set(data?.map((row) => row.user_email).filter(Boolean) as string[])];
  return emails;
}
