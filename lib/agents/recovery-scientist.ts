/**
 * Recovery Scientist Agent
 *
 * Purpose: Generate recovery protocols, injury prevention, and progress tracking
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.005 per call
 *
 * Creates comprehensive recovery guidance tailored to the athlete's
 * sleep quality, stress levels, training load, and injury history.
 */

import OpenAI from 'openai';
import { AthleteProfileCard } from '../types/athlete-profile';
import {
  RecoveryProtocol,
  InjuryPrevention,
  ProgressTracking,
  AdaptiveFeatures,
  RecoveryScientistOutput,
} from '../types/plan-output';

// ============================================================================
// OPENAI CLIENT
// ============================================================================

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a recovery and regeneration specialist with expertise in sleep optimization, stress management, and injury prevention for athletes.

Your task is to create personalized recovery protocols based on the athlete's:
- Sleep quality and patterns
- Stress levels
- Training load
- Injury history
- Recovery capacity

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the athlete
3. Reference specific data from their profile
4. Keep recommendations practical and actionable
5. All text should be warm, encouraging, and professional

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "recoveryProtocol": {
    "personalizedIntro": "2-3 sentences introducing recovery approach",
    "dailyPractices": ["Practice 1", "Practice 2", ...],
    "weeklyPractices": ["Practice 1", "Practice 2", ...],
    "sleepOptimization": "2-3 paragraphs on sleep improvement",
    "stressManagement": "2-3 paragraphs on stress techniques",
    "mobilityWork": "2-3 paragraphs on mobility routine"
  },
  "injuryPrevention": {
    "personalizedRiskAssessment": "2-3 paragraphs on their specific risks",
    "commonRisks": ["Risk 1", "Risk 2", ...],
    "preventionStrategies": ["Strategy 1", "Strategy 2", ...],
    "warningSignals": ["Signal 1", "Signal 2", ...],
    "injuryProtocol": "What to do if injury occurs",
    "mobilityPrescription": "Daily mobility routine"
  },
  "progressTracking": {
    "metricsOverview": "2 paragraphs on tracking approach",
    "weeklyMetrics": ["Metric 1", "Metric 2", ...],
    "monthlyMetrics": ["Metric 1", "Metric 2", ...],
    "performanceBenchmarks": ["Benchmark 1", "Benchmark 2", ...],
    "biometricTargets": "1-2 paragraphs on health markers",
    "reassessmentSchedule": "When to reassess"
  },
  "adaptiveReadiness": {
    "readinessIndicators": "How to assess daily readiness",
    "lowReadinessProtocol": "What to do on low energy days"
  }
}`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(athleteProfile: AthleteProfileCard): string {
  const { profile, computedMetrics, constraints, biomarkerFlags, keyInsights } = athleteProfile;

  let prompt = `# ATHLETE RECOVERY PROFILE

## Basic Info
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Training Days — ${profile.trainingDays} per week
- Primary Goal — ${profile.primaryGoal}

## Recovery Metrics
- Sleep Quality — ${computedMetrics.sleepScore}/10
- Stress Level — ${computedMetrics.stressScore}
- Recovery Capacity — ${computedMetrics.recoveryCapacity}
- HRV Trend — ${computedMetrics.hrvTrend}
- Overtraining Risk — ${computedMetrics.overtrainingRisk}

## Constraints
`;

  if (constraints.injuries.length > 0) {
    prompt += `### Injuries\n`;
    for (const injury of constraints.injuries) {
      prompt += `- ${injury.area} (${injury.severity})\n`;
    }
  }

  if (constraints.medicalConditions.length > 0) {
    prompt += `### Medical Conditions\n- ${constraints.medicalConditions.join('\n- ')}\n`;
  }

  // Add ecosystem insights related to recovery
  const recoveryInsights = keyInsights.filter(i => i.impact === 'recovery' || i.impact === 'general');
  if (recoveryInsights.length > 0) {
    prompt += `\n## Ecosystem Insights\n`;
    for (const insight of recoveryInsights) {
      prompt += `- [${insight.source.toUpperCase()}] ${insight.insight}\n`;
    }
  }

  // Add biomarker flags
  if (biomarkerFlags.length > 0) {
    prompt += `\n## Biomarker Considerations\n`;
    for (const flag of biomarkerFlags) {
      prompt += `- ${flag.marker} — ${flag.status}\n`;
    }
  }

  prompt += `
## Your Task
Create a comprehensive recovery plan that:
1. Addresses their ${computedMetrics.stressScore} stress level
2. Improves their ${computedMetrics.sleepScore}/10 sleep quality
3. Works around any injuries or limitations
4. Matches their ${computedMetrics.recoveryCapacity} recovery capacity

Return the JSON structure as specified.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runRecoveryScientist(
  athleteProfile: AthleteProfileCard
): Promise<RecoveryScientistOutput> {
  console.log('[Recovery Scientist] Starting recovery protocol generation...');
  console.log(`[Recovery Scientist] Sleep — ${athleteProfile.computedMetrics.sleepScore}/10, Stress — ${athleteProfile.computedMetrics.stressScore}`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(athleteProfile);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content);

    console.log('[Recovery Scientist] Recovery protocol complete');
    console.log(`[Recovery Scientist] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    return {
      recoveryProtocol: result.recoveryProtocol,
      injuryPrevention: result.injuryPrevention,
      progressTracking: result.progressTracking,
      adaptiveReadiness: result.adaptiveReadiness,
    };
  } catch (error) {
    console.error('[Recovery Scientist] Error:', error);
    console.log('[Recovery Scientist] Using fallback recovery protocol');
    return createFallbackRecovery(athleteProfile);
  }
}

// ============================================================================
// FALLBACK RECOVERY PROTOCOL
// ============================================================================

function createFallbackRecovery(athleteProfile: AthleteProfileCard): RecoveryScientistOutput {
  const { profile, computedMetrics, constraints } = athleteProfile;
  const sleepScore = computedMetrics.sleepScore;
  const stressLevel = computedMetrics.stressScore;

  const recoveryProtocol: RecoveryProtocol = {
    personalizedIntro: `Based on your current sleep quality of ${sleepScore}/10 and ${stressLevel} stress levels, we've designed a recovery protocol that prioritizes restoration and sustainable progress. Recovery is where your body adapts and grows stronger — it's not optional, it's essential.`,

    dailyPractices: [
      'Morning sunlight exposure within 30 minutes of waking',
      '10-minute mobility routine before training',
      'Post-workout stretching for 5-8 minutes',
      'Evening wind-down routine starting 1 hour before bed',
      'Consistent sleep and wake times, even on weekends',
    ],

    weeklyPractices: [
      'One dedicated active recovery session — light movement, stretching, or yoga',
      'Weekly self-assessment of energy, motivation, and soreness',
      'Review training log and adjust intensity if needed',
      'One longer sleep night — aim for 9+ hours',
    ],

    sleepOptimization: sleepScore < 7
      ? `Your sleep quality of ${sleepScore}/10 is an area for improvement. Focus on creating a consistent bedtime routine — dim lights 1-2 hours before bed, avoid screens in the bedroom, and keep your room cool (18-20°C). Consider a 10-minute relaxation practice before sleep, such as deep breathing or gentle stretching.\n\nQuality sleep is when your muscles repair and hormones rebalance. Prioritizing sleep will accelerate your progress more than any supplement or training trick.`
      : `Your sleep quality is good at ${sleepScore}/10. Maintain your current habits and focus on consistency. Small optimizations like avoiding caffeine after 2pm and keeping a regular sleep schedule will help maintain this quality.\n\nAs your training intensity increases, you may need more sleep — listen to your body and don't sacrifice rest for extra training sessions.`,

    stressManagement: stressLevel === 'high' || stressLevel === 'very-high'
      ? `Your ${stressLevel} stress levels require active management. Chronic stress elevates cortisol, which can impair recovery and muscle growth. Consider implementing a daily 5-10 minute breathing practice — box breathing (4 seconds in, 4 hold, 4 out, 4 hold) is highly effective.\n\nTraining itself is a stressor, so on high-stress days, consider reducing workout intensity by 10-20% rather than pushing through. Your body can only handle so much total stress before progress stalls.`
      : `Your stress levels appear manageable, which is excellent for recovery. Continue with whatever stress management practices are working for you. If you notice stress creeping up, have a go-to practice ready — even 5 deep breaths can help reset your nervous system.\n\nRemember that training adds to your total stress load. If life gets hectic, it's okay to dial back training intensity temporarily.`,

    mobilityWork: `Daily mobility work is essential for longevity and injury prevention. Focus on areas relevant to your training — hip flexors, thoracic spine, and shoulders for most people. A 10-minute routine before training prepares your joints for load, while post-workout stretching helps maintain range of motion.\n\nConsider foam rolling for 5 minutes on rest days, targeting any areas that feel tight or restricted. This isn't about inflicting pain — moderate pressure is more effective than aggressive rolling.`,
  };

  const injuryPrevention: InjuryPrevention = {
    personalizedRiskAssessment: constraints.injuries.length > 0
      ? `Given your history with ${constraints.injuries.map(i => i.area).join(' and ')}, injury prevention is a top priority. We've designed your program to strengthen supporting muscles and avoid aggravating movements. However, some discomfort during training is normal — the key is distinguishing between productive discomfort and warning signals.\n\nPay extra attention to warm-ups for affected areas, and don't hesitate to modify or skip exercises that cause sharp or unusual pain.`
      : `While you don't report current injuries, prevention is always better than cure. The most common training injuries come from overuse, poor form, or progressing too quickly. Your program includes built-in progression guidelines to help you advance safely.\n\nListen to your body — persistent soreness, joint pain, or movement that feels "off" are signals to investigate, not ignore.`,

    commonRisks: [
      'Overuse injuries from too much volume too soon',
      'Form breakdown when fatigued — especially on compound lifts',
      'Insufficient warm-up before heavy lifting',
      'Ignoring early warning signs of strain',
    ],

    preventionStrategies: [
      'Always warm up — 8-10 minutes of progressive movement',
      'Stop sets 1-2 reps before failure on compound exercises',
      'Increase weight only when form is solid on all reps',
      'Include mobility work for tight or restricted areas',
      'Take deload weeks every 4-6 weeks of hard training',
    ],

    warningSignals: [
      'Sharp pain during any movement — stop immediately',
      'Joint pain that persists after warming up',
      'Muscle soreness lasting more than 72 hours',
      'Decreased performance over multiple sessions',
      'Persistent fatigue despite adequate sleep',
    ],

    injuryProtocol: `If you experience a potential injury — stop the exercise immediately, apply ice if there's swelling, and avoid aggravating movements for 48-72 hours. Most minor strains resolve with rest and gentle movement. If pain persists beyond a week or is severe, consult a healthcare professional before returning to training.`,

    mobilityPrescription: `Daily — 10 minutes of targeted mobility work focusing on hips, thoracic spine, and shoulders. Include hip circles, cat-cow stretches, and shoulder dislocates with a band. This routine maintains range of motion and identifies potential problem areas before they become injuries.`,
  };

  const progressTracking: ProgressTracking = {
    metricsOverview: `Tracking progress keeps you motivated and ensures your program is working. We recommend a balance of performance metrics (what you can do), body metrics (how you look and feel), and subjective metrics (energy, mood, motivation).\n\nDon't obsess over daily fluctuations — look for trends over weeks and months. Progress isn't always linear, and plateaus are a normal part of training.`,

    weeklyMetrics: [
      'Training volume — total sets and reps completed',
      'Key lift progress — weight increases on main exercises',
      'Energy levels — rate 1-10 before each session',
      'Sleep quality — average hours and subjective quality',
      'Soreness levels — general recovery status',
    ],

    monthlyMetrics: [
      'Body measurements — if relevant to your goals',
      'Progress photos — same lighting, time, and poses',
      'Performance benchmarks — test exercises from the list below',
      'Training consistency — percentage of planned sessions completed',
    ],

    performanceBenchmarks: [
      'Push-ups to failure — test every 4 weeks',
      'Max weight for 5 reps on main lifts — test monthly',
      'Plank hold time — test every 4 weeks',
      '1-mile run or row time — test every 6-8 weeks if cardio is a goal',
    ],

    biometricTargets: `Beyond performance, consider tracking resting heart rate (should decrease with fitness) and body composition if relevant to your goals. If you have wearables like Oura or Whoop, HRV trends provide insight into your recovery status — rising HRV generally indicates good adaptation to training.`,

    reassessmentSchedule: `Full program reassessment every 8-12 weeks. At this point, we'll review your progress, adjust training variables, and potentially introduce new exercises or rep schemes. Between assessments, make small adjustments based on weekly feedback — if something isn't working, don't wait 12 weeks to change it.`,
  };

  return {
    recoveryProtocol,
    injuryPrevention,
    progressTracking,
    adaptiveReadiness: {
      readinessIndicators: 'Check sleep quality, energy level, and motivation before training',
      lowReadinessProtocol: 'Reduce volume by 30-50%, focus on movement quality over intensity',
    },
  };
}
