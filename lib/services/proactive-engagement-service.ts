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

import { createAdminClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import {
  fetchAllEcosystemData,
  EcosystemData,
} from './ecosystem-fetcher';
import { sendInsightNotification } from './onesignal-service';
import { getUserContext, UserContext } from './user-context-service';
import { getCombinedDeepAnalysis, DeepContentAnalysis } from './deep-content-analyzer';

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
  | 'mindfulness_prompt'
  | 'biomarker_reminder'
  | 'goal_progress';

/**
 * Enriched context combining ecosystem data, user profile, labs, and deep analysis
 */
export interface EnrichedContext {
  ecosystemData: EcosystemData;
  userContext: UserContext | null;
  deepAnalysis: DeepContentAnalysis | null;
}

export interface ProactiveNotification {
  type: EngagementType;
  title: string;
  message: string;
  context_data: Record<string, unknown>;
  // Rich content for notification detail screen
  category?: string;
  data_quote?: string;
  recommendation?: string;
  science_explanation?: string;
  action_steps?: string[];
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
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const ecosystemData = ctx.ecosystemData;
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

  // Build data quote from highlights and concerns
  const allMetrics = [...highlights, ...concerns];
  const dataQuote = allMetrics.length > 0
    ? allMetrics.slice(0, 3).join(' · ')
    : 'Your daily health snapshot';

  // Build recommendation based on balance of highlights vs concerns
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
    message,
    context_data: { highlights, concerns },
    category: 'CROSS_DOMAIN',
    data_quote: dataQuote,
    recommendation,
    science_explanation: 'Daily health monitoring helps identify patterns and trends before they become problems. Research shows that people who regularly review their health metrics are more likely to make positive lifestyle changes and catch issues early.',
    action_steps: highlights.length >= concerns.length
      ? [
          'Maintain your current sleep and exercise routines',
          'Note what you did well yesterday to repeat it',
          'Share your progress with an accountability partner',
        ]
      : [
          'Prioritize sleep tonight - aim for 7+ hours',
          'Take short breaks throughout the day',
          'Choose one small healthy habit to focus on today',
        ],
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
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const ecosystemData = ctx.ecosystemData;
  const userContext = ctx.userContext;
  const context: Record<string, unknown> = {};
  let prompt = 'Generate a warm, personalized morning message for the user. ';

  // Add user's goals to context
  if (userContext?.profile?.goals?.length) {
    context.goals = userContext.profile.goals;
    prompt += `Their current goals are: ${userContext.profile.goals.join(', ')}. Reference a goal if relevant. `;
  }

  // Add biomarker context if available
  if (userContext?.labResults?.length) {
    const lowBiomarkers = userContext.labResults.filter(l => l.status === 'low' || l.status === 'deficient');
    if (lowBiomarkers.length > 0) {
      context.biomarkerConcerns = lowBiomarkers.map(l => l.biomarker);
      prompt += `They have low ${lowBiomarkers.map(l => l.biomarker).join(', ')} - you could mention a food that helps with this. `;
    }
  }

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
  if (context.busyDay) {
    dataQuoteParts.push('busy calendar ahead');
  }

  // Build recommendation based on recovery
  let recommendation = 'Start your day with intention. ';
  const recovery = context.recovery as number | undefined;
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
    message,
    context_data: context,
    category: 'RECOVERY',
    data_quote: dataQuoteParts.length > 0
      ? dataQuoteParts.join(' · ')
      : 'Ready to start a new day',
    recommendation,
    science_explanation: 'Morning routines that align with your recovery state help optimize performance and prevent burnout. When recovery is high, your body can handle more stress. When it\'s low, pacing yourself helps maintain long-term health.',
    action_steps: [
      'Take a moment to set your top priority for today',
      'Hydrate well - your body needs water after sleep',
      'Get some natural light within the first hour of waking',
    ],
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
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const ecosystemData = ctx.ecosystemData;
  const deepAnalysis = ctx.deepAnalysis;
  const userContext = ctx.userContext;
  const stressSignals: string[] = [];
  const context: Record<string, unknown> = {};

  // Add deep analysis signals
  if (deepAnalysis) {
    if (deepAnalysis.pendingTasks?.filter(t => t.urgency === 'critical').length) {
      stressSignals.push('critical tasks pending');
      context.criticalTasks = deepAnalysis.pendingTasks.filter(t => t.urgency === 'critical').length;
    }
    if (deepAnalysis.urgentMessages?.length > 3) {
      stressSignals.push('multiple urgent messages');
      context.urgentMessageCount = deepAnalysis.urgentMessages.length;
    }
    if (deepAnalysis.interruptionScore && deepAnalysis.interruptionScore > 70) {
      stressSignals.push('high interruption day');
      context.interruptionScore = deepAnalysis.interruptionScore;
    }
  }

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

  // Format data quote from context
  const dataQuoteParts: string[] = [];
  if (context.criticalTasks) dataQuoteParts.push(`${context.criticalTasks} critical tasks pending`);
  if (context.urgentMessageCount) dataQuoteParts.push(`${context.urgentMessageCount} urgent messages`);
  if (context.messageVolume) dataQuoteParts.push(`${context.messageVolume} messages per day`);
  if (context.hrvDrop) dataQuoteParts.push(`HRV ${context.hrvDrop}% below your baseline`);
  if (context.recovery) dataQuoteParts.push(`Recovery at ${context.recovery}%`);

  return {
    type: 'stress_support',
    title: "Hey, checking in on you",
    message,
    context_data: context,
    category: 'STRESS',
    data_quote: dataQuoteParts.length > 0
      ? `I noticed: ${dataQuoteParts.join(', ')}. That's a lot to carry.`
      : undefined,
    action_steps: [
      'Take 3 deep breaths right now',
      'Pick your most important task and focus just on that',
      'Give yourself permission to say no to something today',
    ],
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
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const ecosystemData = ctx.ecosystemData;
  const userContext = ctx.userContext;
  const achievements: string[] = [];

  // Check goal-related achievements
  if (userContext?.profile?.goals?.length) {
    // Could add logic to check goal progress from database
  }
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

  // Build data quote from achievements
  const dataQuoteParts: string[] = [];
  if (context.recoveryStreak) {
    dataQuoteParts.push(`${context.recoveryStreak}-day recovery streak`);
  }
  if (context.recovery) {
    dataQuoteParts.push(`${Math.round(context.recovery as number)}% recovery`);
  }
  if (context.readiness) {
    dataQuoteParts.push(`${Math.round(context.readiness as number)}% readiness`);
  }
  if (context.sleepConsistency) {
    dataQuoteParts.push(`${Math.round(context.sleepConsistency as number)}% sleep consistency`);
  }
  if (context.glucoseInRange) {
    dataQuoteParts.push(`${Math.round(context.glucoseInRange as number)}% time in range`);
  }

  return {
    type: 'achievement_celebration',
    title: "You're crushing it!",
    message,
    context_data: context,
    category: 'ACTIVITY',
    data_quote: dataQuoteParts.length > 0
      ? dataQuoteParts.join(' · ')
      : achievements.join(', '),
    recommendation: 'Keep up the great work! Consistency is key to long-term health improvements.',
    science_explanation: 'Celebrating small wins reinforces positive behaviors and releases dopamine, making it easier to maintain healthy habits. Research shows that acknowledging progress, even incremental improvements, significantly increases the likelihood of sustained behavior change.',
    action_steps: [
      'Take a moment to appreciate your progress',
      'Share your achievement with someone who supports you',
      'Set your next small goal to keep the momentum going',
    ],
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
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const ecosystemData = ctx.ecosystemData;
  const deepAnalysis = ctx.deepAnalysis;
  const userContext = ctx.userContext;
  const context: Record<string, unknown> = {};

  // Add completed tasks for reflection
  if (deepAnalysis?.pendingTasks) {
    const completedToday = deepAnalysis.pendingTasks.filter(t => t.status === 'completed');
    const stillPending = deepAnalysis.pendingTasks.filter(t => t.status === 'pending');
    if (completedToday.length > 0) {
      context.tasksCompleted = completedToday.length;
    }
    if (stillPending.length > 0) {
      context.tasksPending = stillPending.length;
    }
  }

  // Add goals for evening reflection
  if (userContext?.profile?.goals?.length) {
    context.goals = userContext.profile.goals;
  }
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

  // Build data quote from context
  const dataQuoteParts: string[] = [];
  if (context.highStrain) {
    const strain = ecosystemData.whoop?.data?.avgStrainScore;
    dataQuoteParts.push(`strain score of ${strain?.toFixed(1) || 'high'} today`);
  }
  if (context.workingLate) {
    dataQuoteParts.push('working into the evening hours');
  }
  if (context.needsRest) {
    dataQuoteParts.push('some sleep debt to recover');
  }
  if (context.tasksCompleted) {
    dataQuoteParts.push(`${context.tasksCompleted} tasks completed today`);
  }
  if (context.tasksPending) {
    dataQuoteParts.push(`${context.tasksPending} tasks can wait until tomorrow`);
  }

  const dataQuote = dataQuoteParts.length > 0
    ? `${dataQuoteParts.join(', ')}. It's important to give yourself a break, too.`
    : "It sounds like you've been really dedicated this evening, but it's important to give yourself a break, too.";

  // Build recommendation based on context
  let recommendation = 'Consider starting your wind-down routine now. ';
  if (context.needsRest) {
    recommendation += 'An earlier bedtime tonight would help recover some sleep debt.';
  } else if (context.highStrain) {
    recommendation += 'After a demanding day, quality rest will help your body recover.';
  } else if (context.workingLate) {
    recommendation += 'Stepping away from work now will help your mind relax before sleep.';
  } else {
    recommendation += 'A peaceful night\'s rest will help you tackle tomorrow with fresh energy.';
  }

  return {
    type: 'evening_reflection',
    title: 'Time to Wind Down',
    message,
    context_data: context,
    category: 'SLEEP',
    data_quote: dataQuote,
    recommendation,
    science_explanation: 'Evening wind-down routines help activate your parasympathetic nervous system, lowering cortisol and preparing your body for restorative sleep. Research shows that a consistent pre-sleep routine can improve sleep quality by up to 30% and reduce the time it takes to fall asleep.',
    action_steps: [
      'Dim the lights and reduce screen brightness',
      'Take a few slow, deep breaths to release tension',
      'Reflect on one positive moment from today',
      'Set your intentions for tomorrow, then let go of work thoughts',
    ],
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
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const ecosystemData = ctx.ecosystemData;
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

  // Build data quote from context
  const dataQuoteParts: string[] = [];
  if (context.backToBackMeetings) {
    dataQuoteParts.push('back-to-back meetings detected');
  }
  if (context.lowRecovery) {
    dataQuoteParts.push(`recovery at ${Math.round(context.lowRecovery as number)}%`);
  }
  if (context.alwaysOn) {
    dataQuoteParts.push('constant availability pattern');
  }

  return {
    type: 'mindfulness_prompt',
    title: 'Quick Pause',
    message,
    context_data: context,
    category: 'STRESS',
    data_quote: dataQuoteParts.length > 0
      ? `I noticed: ${dataQuoteParts.join(', ')}. A brief pause can help.`
      : 'Taking a moment to breathe can reset your focus.',
    recommendation: 'Even 30 seconds of focused breathing can lower cortisol and improve focus. Try it now.',
    science_explanation: 'Brief mindfulness breaks activate your parasympathetic nervous system, reducing stress hormones and improving cognitive function. Studies show that even short breathing exercises can lower heart rate and improve decision-making.',
    action_steps: [
      'Close your eyes or soften your gaze',
      'Take 3 slow breaths: inhale for 4 counts, exhale for 6',
      'Notice how your body feels before continuing',
    ],
  };
}

// ============================================================================
// NEW: BIOMARKER, TASK & GOAL GENERATORS
// ============================================================================

/**
 * Generate biomarker-related reminders based on lab results
 */
async function generateBiomarkerReminder(
  email: string,
  ctx: EnrichedContext,
  timeOfDay: 'morning' | 'midday' | 'evening'
): Promise<ProactiveNotification | null> {
  const labResults = ctx.userContext?.labResults;
  if (!labResults?.length) return null;

  const context: Record<string, unknown> = {};
  const lowBiomarkers = labResults.filter(l => l.status === 'low' || l.status === 'deficient');

  if (lowBiomarkers.length === 0) return null;

  // Different reminders based on time of day
  let prompt = '';
  if (timeOfDay === 'morning') {
    const vitaminD = lowBiomarkers.find(b => b.biomarker.toLowerCase().includes('vitamin d'));
    const iron = lowBiomarkers.find(b => b.biomarker.toLowerCase().includes('iron') || b.biomarker.toLowerCase().includes('ferritin'));
    const b12 = lowBiomarkers.find(b => b.biomarker.toLowerCase().includes('b12'));

    if (vitaminD) {
      context.biomarker = 'Vitamin D';
      prompt = `Generate a brief morning reminder about vitamin D. The user has low vitamin D (${vitaminD.value} ${vitaminD.unit}). Suggest taking supplement with breakfast or getting morning sun. Keep it friendly and brief.`;
    } else if (iron) {
      context.biomarker = 'Iron';
      prompt = `Generate a brief morning reminder about iron. The user has low iron/ferritin (${iron.value} ${iron.unit}). Suggest iron-rich breakfast foods or taking supplement with vitamin C. Keep it friendly.`;
    } else if (b12) {
      context.biomarker = 'B12';
      prompt = `Generate a brief morning reminder about B12. The user has low B12 (${b12.value} ${b12.unit}). Suggest B12-rich foods or supplement. Keep it friendly.`;
    } else {
      context.biomarker = lowBiomarkers[0].biomarker;
      prompt = `Generate a brief, friendly reminder about their low ${lowBiomarkers[0].biomarker} (${lowBiomarkers[0].value} ${lowBiomarkers[0].unit}). Suggest one actionable thing they can do today.`;
    }
  } else {
    return null; // Only send biomarker reminders in morning for now
  }

  context.labResults = lowBiomarkers.map(l => ({ biomarker: l.biomarker, value: l.value, status: l.status }));

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  // Build data quote from lab results
  const biomarkerInfo = lowBiomarkers.find(b => b.biomarker === context.biomarker) || lowBiomarkers[0];
  const dataQuote = `Your ${biomarkerInfo.biomarker} is at ${biomarkerInfo.value} ${biomarkerInfo.unit || ''} (${biomarkerInfo.status})`;

  // Build science explanation based on biomarker type
  let scienceExplanation = '';
  const biomarkerLower = (context.biomarker as string).toLowerCase();
  if (biomarkerLower.includes('vitamin d')) {
    scienceExplanation = 'Vitamin D is essential for bone health, immune function, and mood regulation. Low levels are linked to fatigue, weakened immunity, and increased risk of depression. Morning sunlight and supplementation are effective ways to improve levels.';
  } else if (biomarkerLower.includes('iron') || biomarkerLower.includes('ferritin')) {
    scienceExplanation = 'Iron is crucial for oxygen transport in your blood and energy production. Low iron can cause fatigue, weakness, and difficulty concentrating. Pairing iron-rich foods with vitamin C enhances absorption.';
  } else if (biomarkerLower.includes('b12')) {
    scienceExplanation = 'Vitamin B12 is vital for nerve function, red blood cell formation, and DNA synthesis. Deficiency can cause fatigue, neurological issues, and mood changes. It\'s primarily found in animal products or supplements.';
  } else {
    scienceExplanation = 'Maintaining optimal biomarker levels supports your body\'s essential functions. Regular monitoring and targeted interventions can help you feel your best and prevent long-term health issues.';
  }

  // Build action steps based on biomarker
  let actionSteps: string[];
  if (biomarkerLower.includes('vitamin d')) {
    actionSteps = [
      'Take your vitamin D supplement with a fat-containing meal for better absorption',
      'Try to get 10-15 minutes of morning sunlight',
      'Consider foods fortified with vitamin D like milk or cereals',
    ];
  } else if (biomarkerLower.includes('iron') || biomarkerLower.includes('ferritin')) {
    actionSteps = [
      'Include iron-rich foods like spinach, legumes, or lean red meat today',
      'Pair iron-rich foods with vitamin C (citrus, bell peppers) to boost absorption',
      'Avoid coffee or tea with iron-rich meals as they inhibit absorption',
    ];
  } else if (biomarkerLower.includes('b12')) {
    actionSteps = [
      'Take your B12 supplement if prescribed',
      'Include B12-rich foods like eggs, fish, or fortified plant milks',
      'Consider a sublingual B12 for better absorption if you have digestive issues',
    ];
  } else {
    actionSteps = [
      'Follow your healthcare provider\'s recommendations',
      'Track your symptoms and energy levels',
      'Schedule a follow-up to monitor your progress',
    ];
  }

  return {
    type: 'biomarker_reminder',
    title: `${context.biomarker} Reminder`,
    message,
    context_data: context,
    category: 'BLOOD',
    data_quote: dataQuote,
    recommendation: `Supporting your ${context.biomarker} levels can improve your energy and overall wellbeing. Small daily actions add up.`,
    science_explanation: scienceExplanation,
    action_steps: actionSteps,
  };
}

/**
 * Generate task reminder based on deep content analysis
 */
async function generateTaskReminder(
  email: string,
  ctx: EnrichedContext,
  urgentTasks: Array<{ description: string; requester?: string; deadline?: string; urgency: string }>
): Promise<ProactiveNotification | null> {
  if (!urgentTasks.length) return null;

  const context: Record<string, unknown> = {
    taskCount: urgentTasks.length,
    tasks: urgentTasks.slice(0, 3).map(t => ({
      description: t.description.substring(0, 100),
      requester: t.requester,
      deadline: t.deadline,
    })),
    recovery: ctx.ecosystemData.whoop?.data?.avgRecoveryScore,
  };

  const prompt = `Generate a brief, supportive task reminder. The user has ${urgentTasks.length} urgent task(s):
${urgentTasks.slice(0, 3).map(t => `- ${t.description.substring(0, 80)}${t.requester ? ` (from ${t.requester})` : ''}${t.deadline ? ` due ${t.deadline}` : ''}`).join('\n')}

${ctx.ecosystemData.whoop?.data?.avgRecoveryScore && ctx.ecosystemData.whoop.data.avgRecoveryScore < 50 ? 'Note: Their recovery is low, so be gentle.' : ''}

Be supportive, not stressful. Help them prioritize if multiple tasks.`;

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  // Build data quote from tasks
  const dataQuoteParts: string[] = [];
  dataQuoteParts.push(`${urgentTasks.length} task${urgentTasks.length > 1 ? 's' : ''} needing attention`);
  if (context.recovery && (context.recovery as number) < 50) {
    dataQuoteParts.push(`recovery at ${Math.round(context.recovery as number)}%`);
  }
  const taskWithDeadline = urgentTasks.find(t => t.deadline);
  if (taskWithDeadline) {
    dataQuoteParts.push(`nearest deadline: ${taskWithDeadline.deadline}`);
  }

  // Build recommendation based on recovery and task count
  let recommendation: string;
  const recovery = context.recovery as number | undefined;
  if (recovery && recovery < 50) {
    recommendation = 'Your recovery is low today. Focus on your most critical task and give yourself permission to delegate or postpone the rest.';
  } else if (urgentTasks.length > 2) {
    recommendation = 'With multiple tasks, prioritize by impact. Start with the one that will create the most relief or progress when completed.';
  } else {
    recommendation = 'Block out focused time to tackle this task. You\'ve got this!';
  }

  return {
    type: 'challenge_encouragement',
    title: urgentTasks.length === 1 ? 'Task Reminder' : `${urgentTasks.length} Tasks Need Attention`,
    message,
    context_data: context,
    category: 'ACTIVITY',
    data_quote: dataQuoteParts.join(' · '),
    recommendation,
    science_explanation: 'Task completion triggers dopamine release, creating positive momentum. Breaking tasks into smaller steps and tackling the most important one first reduces cognitive load and stress. Research shows that acknowledging tasks explicitly increases completion rates.',
    action_steps: [
      'Pick the single most important task and commit to starting it',
      'Set a 25-minute focused work block (Pomodoro technique)',
      'Remove distractions - close unnecessary tabs and silence notifications',
      'Celebrate completing each task, no matter how small',
    ],
  };
}

/**
 * Generate goal progress update
 */
async function generateGoalProgress(
  email: string,
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const goals = ctx.userContext?.profile?.goals;
  if (!goals?.length) return null;

  const context: Record<string, unknown> = {
    goals,
    recovery: ctx.ecosystemData.whoop?.data?.avgRecoveryScore,
    sleepHours: ctx.ecosystemData.oura?.data?.avgSleepHours,
    strain: ctx.ecosystemData.whoop?.data?.avgStrainScore,
  };

  // Check if we have relevant data for their goals
  const healthGoals = goals.filter(g =>
    g.toLowerCase().includes('sleep') ||
    g.toLowerCase().includes('fitness') ||
    g.toLowerCase().includes('recovery') ||
    g.toLowerCase().includes('stress') ||
    g.toLowerCase().includes('weight') ||
    g.toLowerCase().includes('energy')
  );

  if (healthGoals.length === 0) return null;

  const prompt = `Generate a brief goal progress check-in. The user's goals include: ${healthGoals.join(', ')}.

Their current metrics:
- Sleep: ${ctx.ecosystemData.oura?.data?.avgSleepHours?.toFixed(1) || 'unknown'} hours
- Recovery: ${ctx.ecosystemData.whoop?.data?.avgRecoveryScore ? Math.round(ctx.ecosystemData.whoop.data.avgRecoveryScore) + '%' : 'unknown'}
- Strain: ${ctx.ecosystemData.whoop?.data?.avgStrainScore?.toFixed(1) || 'unknown'}

Connect their data to one of their goals. Be encouraging and specific. One sentence max.`;

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  // Build data quote from current metrics
  const dataQuoteParts: string[] = [];
  if (context.sleepHours) {
    dataQuoteParts.push(`${(context.sleepHours as number).toFixed(1)} hours sleep`);
  }
  if (context.recovery) {
    dataQuoteParts.push(`${Math.round(context.recovery as number)}% recovery`);
  }
  if (context.strain) {
    dataQuoteParts.push(`${(context.strain as number).toFixed(1)} strain`);
  }

  // Build recommendation based on goals
  let recommendation = 'Keep tracking your progress - consistency is key to reaching your goals. ';
  const goalsLower = healthGoals.map(g => g.toLowerCase()).join(' ');
  if (goalsLower.includes('sleep')) {
    recommendation += 'Prioritize your sleep routine tonight.';
  } else if (goalsLower.includes('fitness') || goalsLower.includes('energy')) {
    recommendation += 'Small daily efforts compound into big results.';
  } else if (goalsLower.includes('stress')) {
    recommendation += 'Remember to take breaks and breathe deeply.';
  } else {
    recommendation += 'Every positive choice moves you closer to your goals.';
  }

  // Build action steps based on goals
  const actionSteps: string[] = [];
  if (goalsLower.includes('sleep')) {
    actionSteps.push('Maintain a consistent bedtime tonight');
  }
  if (goalsLower.includes('fitness') || goalsLower.includes('energy')) {
    actionSteps.push('Schedule your next workout or movement session');
  }
  if (goalsLower.includes('stress') || goalsLower.includes('recovery')) {
    actionSteps.push('Take 5 minutes for deep breathing or meditation');
  }
  actionSteps.push('Review your goals and celebrate small wins');
  actionSteps.push('Identify one action you can take today toward your goal');

  return {
    type: 'goal_progress',
    title: 'Goal Check-in',
    message,
    context_data: context,
    category: 'ACTIVITY',
    data_quote: dataQuoteParts.length > 0
      ? `Current metrics: ${dataQuoteParts.join(' · ')}`
      : `Working toward: ${healthGoals.slice(0, 2).join(', ')}`,
    recommendation,
    science_explanation: 'Regular goal check-ins increase success rates by up to 40%. Connecting daily actions to larger goals creates meaning and motivation. Tracking progress, even when imperfect, builds self-awareness and helps identify what\'s working.',
    action_steps: actionSteps.slice(0, 4),
  };
}

// ============================================================================
// DAILY HEALTH SUMMARY (Always sends - not selective)
// ============================================================================

/**
 * Generate a daily health summary that ALWAYS sends regardless of thresholds.
 * This ensures users get at least one health insight per day.
 */
async function generateDailyHealthSummary(
  email: string,
  ctx: EnrichedContext
): Promise<ProactiveNotification | null> {
  const ecosystemData = ctx.ecosystemData;
  const userContext = ctx.userContext;
  const context: Record<string, unknown> = {};
  const metrics: string[] = [];
  const dataPoints: string[] = [];

  // Collect all available metrics
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
    if (whoop.avgHRV) {
      metrics.push(`HRV: ${Math.round(whoop.avgHRV)}ms`);
      context.hrv = Math.round(whoop.avgHRV);
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
    if (dexcom.avgGlucose) {
      metrics.push(`Avg glucose: ${Math.round(dexcom.avgGlucose)} mg/dL`);
      context.avgGlucose = Math.round(dexcom.avgGlucose);
    }
  }

  // If no metrics available, return null
  if (metrics.length === 0) {
    console.log(`[Proactive Engagement] No health metrics available for daily summary`);
    return null;
  }

  context.metrics = metrics;
  context.goals = userContext?.profile?.goals;

  // Generate a friendly summary message
  const prompt = `Generate a brief, friendly daily health summary. Here are today's metrics:
${metrics.join(', ')}

${userContext?.profile?.goals?.length ? `User's goals: ${userContext.profile.goals.join(', ')}` : ''}

Create a warm, conversational 1-2 sentence summary that:
- Mentions 1-2 key metrics naturally
- Feels like a friend checking in, not a medical report
- Includes one small actionable suggestion if relevant
- Stays positive but honest

Example tone: "Your body got ${context.sleepHours || 7} hours of rest and recovery is looking solid at ${context.recovery || 70}%. A good day to stay active!"`;

  const message = await generatePersonalizedMessage(prompt, context);
  if (!message) return null;

  // Build data quote from available metrics
  const dataQuote = dataPoints.length > 0
    ? dataPoints.slice(0, 3).join(' · ')
    : metrics.slice(0, 3).join(' · ');

  return {
    type: 'daily_digest',
    title: 'Your Daily Health Summary',
    message,
    context_data: context,
    category: 'HEALTH',
    data_quote: dataQuote,
    recommendation: context.recovery && (context.recovery as number) >= 70
      ? 'Great recovery - good day for a workout!'
      : context.recovery && (context.recovery as number) < 50
        ? 'Recovery is low - prioritize rest today'
        : 'Listen to your body and stay hydrated',
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
  const supabase = createAdminClient();

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
      // Rich content for notification detail screen
      category: notification.category,
      data_quote: notification.data_quote,
      recommendation: notification.recommendation,
      science_explanation: notification.science_explanation,
      action_steps: notification.action_steps,
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
  const supabase = createAdminClient();

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
  const supabase = createAdminClient();

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
/**
 * Get the user's local time of day based on their timezone
 */
function getUserLocalTimeOfDay(timezone: string | undefined): 'morning' | 'midday' | 'evening' | null {
  try {
    // Default to UTC if no timezone specified
    const tz = timezone || 'UTC';

    // Get current time in user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const localHour = parseInt(formatter.format(now), 10);

    // Determine time of day based on local hour
    // Morning: 6am - 10am
    // Midday: 11am - 5pm
    // Evening: 6pm - 10pm
    // Night (no notifications): 11pm - 5am
    if (localHour >= 6 && localHour < 11) {
      return 'morning';
    } else if (localHour >= 11 && localHour < 18) {
      return 'midday';
    } else if (localHour >= 18 && localHour < 23) {
      return 'evening';
    } else {
      // Night time - don't send notifications
      return null;
    }
  } catch (e) {
    console.error(`[Proactive Engagement] Error parsing timezone ${timezone}:`, e);
    return null;
  }
}

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

    // Fetch full user context (profile, labs, goals, conversation history) - MAX tier for full access
    let userContext: UserContext | null = null;
    let deepAnalysis: DeepContentAnalysis | null = null;

    try {
      userContext = await getUserContext(email, 'proactive engagement notification', {
        subscriptionTier: 'max',
        includeConversation: true,
      });
      console.log(`[Proactive Engagement] Got user context: profile=${!!userContext?.profile}, labs=${userContext?.labResults?.length || 0}, goals=${userContext?.profile?.goals?.length || 0}, timezone=${userContext?.profile?.timezone || 'not set'}`);
    } catch (e) {
      console.error(`[Proactive Engagement] Error fetching user context:`, e);
    }

    // Determine the ACTUAL time of day for this user based on their timezone
    // This overrides what the cron says - we send the right notification for their local time
    const userTimezone = userContext?.profile?.timezone;
    const userLocalTimeOfDay = getUserLocalTimeOfDay(userTimezone);

    if (userLocalTimeOfDay === null) {
      console.log(`[Proactive Engagement] It's nighttime for ${email} (timezone: ${userTimezone || 'UTC'}), skipping notifications`);
      return 0;
    }

    // Use the user's LOCAL time of day, not what the cron specified
    // This ensures users get morning notifications in their morning, etc.
    const effectiveTimeOfDay = userLocalTimeOfDay;
    console.log(`[Proactive Engagement] Using user's local time of day: ${effectiveTimeOfDay} (cron said: ${timeOfDay}, timezone: ${userTimezone || 'UTC'})`);

    // Fetch deep content analysis (tasks, urgency, interruptions) for work context
    try {
      deepAnalysis = await getCombinedDeepAnalysis(email);
      console.log(`[Proactive Engagement] Got deep analysis: tasks=${deepAnalysis?.pendingTasks?.length || 0}, urgent=${deepAnalysis?.urgentMessages?.length || 0}`);
    } catch (e) {
      console.error(`[Proactive Engagement] Error fetching deep analysis:`, e);
    }

    // Create enriched context
    const enrichedContext: EnrichedContext = {
      ecosystemData,
      userContext,
      deepAnalysis,
    };

    // Morning: Only send if there's something notable about their morning state
    if (effectiveTimeOfDay === 'morning') {
      // Only send morning motivation if recovery is notably good OR bad (not average)
      const recovery = ecosystemData.whoop?.data?.avgRecoveryScore;
      const readiness = ecosystemData.oura?.data?.avgReadinessScore;
      const hasNotableState = (recovery && (recovery >= 75 || recovery < 40)) ||
                              (readiness && (readiness >= 80 || readiness < 55));

      if (hasNotableState && await canSendNotificationType(email, 'morning_motivation', 24)) {
        const motivation = await generateMorningMotivation(email, enrichedContext);
        if (motivation && await sendProactiveNotification(email, motivation)) {
          notificationsSent++;
        }
      }

      // NEW: Check for biomarker-related morning reminders (e.g., vitamin D with breakfast)
      if (notificationsSent === 0 && userContext?.labResults?.length) {
        const biomarkerReminder = await generateBiomarkerReminder(email, enrichedContext, 'morning');
        if (biomarkerReminder && await canSendNotificationType(email, 'biomarker_reminder', 48)) {
          if (await sendProactiveNotification(email, biomarkerReminder)) {
            notificationsSent++;
          }
        }
      }
    }

    // Midday: Prioritize by importance, stop after sending one
    if (effectiveTimeOfDay === 'midday' && await canSendMoreToday(email)) {
      // Priority 0: Urgent tasks from deep analysis
      if (notificationsSent === 0 && deepAnalysis?.pendingTasks?.length) {
        const urgentTasks = deepAnalysis.pendingTasks.filter(t => t.urgency === 'critical' || t.urgency === 'high');
        if (urgentTasks.length > 0 && await canSendNotificationType(email, 'challenge_encouragement', 12)) {
          const taskReminder = await generateTaskReminder(email, enrichedContext, urgentTasks);
          if (taskReminder && await sendProactiveNotification(email, taskReminder)) {
            notificationsSent++;
          }
        }
      }

      // Priority 1: Stress support - only if multiple stress signals detected
      // (the function already requires 2+ signals to return a notification)
      if (notificationsSent === 0 && await canSendNotificationType(email, 'stress_support', 24)) {
        const support = await generateStressSupport(email, enrichedContext);
        if (support && await sendProactiveNotification(email, support)) {
          notificationsSent++;
        }
      }

      // Priority 2: Goal progress check - if user has goals
      if (notificationsSent === 0 && userContext?.profile?.goals?.length && await canSendNotificationType(email, 'goal_progress', 48)) {
        const goalProgress = await generateGoalProgress(email, enrichedContext);
        if (goalProgress && await sendProactiveNotification(email, goalProgress)) {
          notificationsSent++;
        }
      }

      // Priority 3: Achievement celebration - only if there's a real achievement
      // (the function already checks for actual achievements)
      if (notificationsSent === 0 && await canSendNotificationType(email, 'achievement_celebration', 48)) {
        const achievement = await generateAchievementCelebration(email, enrichedContext);
        if (achievement && await sendProactiveNotification(email, achievement)) {
          notificationsSent++;
        }
      }

      // Priority 4: Daily digest - only if there's noteworthy content
      // (the function returns null if nothing interesting)
      if (notificationsSent === 0 && await canSendNotificationType(email, 'daily_digest', 24)) {
        const digest = await generateDailyDigest(email, enrichedContext);
        if (digest && await sendProactiveNotification(email, digest)) {
          notificationsSent++;
        }
      }

      // Priority 5: Daily Health Summary - ALWAYS sends as fallback
      // This ensures users get at least one health insight per day
      if (notificationsSent === 0 && await canSendNotificationType(email, 'daily_digest', 24)) {
        console.log(`[Proactive Engagement] No selective notifications triggered, sending daily health summary to ${email}`);
        const healthSummary = await generateDailyHealthSummary(email, enrichedContext);
        if (healthSummary && await sendProactiveNotification(email, healthSummary)) {
          notificationsSent++;
        }
      }
    }

    // Evening: Only send if they had a demanding day or are working late
    if (effectiveTimeOfDay === 'evening' && await canSendMoreToday(email)) {
      const hadDemandingDay = ecosystemData.whoop?.data?.avgStrainScore &&
                              ecosystemData.whoop.data.avgStrainScore > 14;
      const workingLate = ecosystemData.gmail?.data?.emailVolume?.afterHoursPercentage &&
                          ecosystemData.gmail.data.emailVolume.afterHoursPercentage > 25;
      const hasUnfinishedTasks = deepAnalysis?.pendingTasks?.filter(t => t.status === 'pending').length || 0;

      if ((hadDemandingDay || workingLate || hasUnfinishedTasks > 0) && await canSendNotificationType(email, 'evening_reflection', 24)) {
        const reflection = await generateEveningReflection(email, enrichedContext);
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
  const supabase = createAdminClient();

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
