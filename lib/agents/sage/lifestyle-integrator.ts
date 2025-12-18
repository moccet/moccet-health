/**
 * Lifestyle Integrator Agent
 *
 * Purpose: Create sleep, exercise, and stress management protocols
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.005 per call
 *
 * This agent creates lifestyle recommendations that complement the nutrition plan,
 * focusing on sleep optimization, exercise coordination, and stress management.
 */

import OpenAI from 'openai';
import { ClientProfileCard } from '../../types/client-profile';
import {
  LifestyleIntegratorOutput,
  LifestyleIntegration,
  SleepOptimization,
  ExerciseProtocol,
  StressManagement,
} from '../../types/sage-plan-output';

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

const SYSTEM_PROMPT = `You are a Lifestyle Optimization Specialist — expert at creating practical sleep, exercise, and stress management protocols that work synergistically with nutrition plans.

Your task is to create comprehensive lifestyle recommendations based on the client's current status and goals.

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the client
3. Reference their specific data WITH ACTUAL NUMBERS (sleep hours, HRV, recovery score)
4. Keep recommendations practical and achievable
5. MUST use ecosystem data (Whoop, Oura, Gmail/Slack) when available — reference specific numbers
6. Align recommendations with their nutrition plan

ECOSYSTEM DATA INTEGRATION:
When detailed wearable data is provided, use SPECIFIC numbers:
- Sleep — "Your 6.2h average with 5h sleep debt suggests we need to prioritize sleep extension"
- HRV — "Your HRV of 42ms (15% below baseline) indicates nervous system fatigue — focus on recovery"
- Recovery — "With Whoop showing 65% recovery, we'll include more parasympathetic practices"
- Work patterns — "Your 5.2 meetings/day average means we need efficient stress practices"
- After-hours work — "Your after-hours activity suggests work-life boundaries need attention"

OUTPUT FORMAT:
Return valid JSON with this structure:
{
  "lifestyleIntegration": {
    "sleepOptimization": {
      "personalizedIntro": "2-3 sentences on their sleep status and approach",
      "optimalSleepWindow": "e.g., 10:30 PM - 6:30 AM",
      "preBedRoutine": ["Step 1", "Step 2", "..."],
      "morningProtocol": ["Wake routine step 1", "Step 2", "..."],
      "supplementSupport": ["Sleep-supporting supplement 1", "..."],
      "whyThisMatters": "1-2 sentences connecting sleep to their goal"
    },
    "exerciseProtocol": {
      "personalizedIntro": "2-3 sentences on their activity status and approach",
      "weeklyStructure": "Overview of recommended weekly exercise pattern",
      "nutritionTiming": "How to time nutrition around workouts",
      "recoveryProtocol": "Post-workout recovery recommendations",
      "whyThisMatters": "1-2 sentences connecting exercise to their goal"
    },
    "stressManagement": {
      "personalizedIntro": "2-3 sentences on their stress status and approach",
      "dailyPractices": [
        {
          "practice": "Practice name",
          "timing": "When to do it",
          "duration": "How long",
          "benefit": "Why it helps"
        }
      ],
      "acuteStressProtocols": ["Quick technique 1 for immediate stress relief", "..."],
      "whyThisMatters": "1-2 sentences connecting stress management to their goal"
    }
  }
}

IMPORTANT:
- For poor sleep (< 6 score) — focus on sleep hygiene fundamentals
- For high stress (> 7) — prioritize daily stress practices
- For sedentary individuals — start with gentle movement
- For active individuals — focus on recovery optimization
- Consider their biomarker flags in recommendations`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(clientProfile: ClientProfileCard): string {
  const { profile, computedMetrics, keyInsights, biomarkerFlags, constraints, ecosystemMetrics } = clientProfile;

  let prompt = `# CLIENT LIFESTYLE PROFILE

## Basic Information
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Primary Goal — ${profile.drivingGoal}
- Time Horizon — ${profile.timeHorizon}

## Current Status (Questionnaire)
- Sleep Quality Score — ${profile.sleepQuality}/10 (${computedMetrics.sleepScore})
- Stress Level — ${profile.stressLevel}/10 (${computedMetrics.stressScore})
- Activity Level — ${profile.activityLevel}
- Metabolic Health — ${computedMetrics.metabolicHealth}
`;

  // Add detailed ecosystem metrics if available
  if (ecosystemMetrics) {
    const { recovery, schedule } = ecosystemMetrics;

    prompt += `\n## DETAILED WEARABLE DATA (Use these specific numbers in your recommendations)\n`;

    // Recovery data
    if (recovery.whoopRecoveryScore) {
      prompt += `- Whoop Recovery — ${recovery.whoopRecoveryScore}%`;
      if (recovery.whoopRecoveryScore < 50) {
        prompt += ` (LOW — prioritize recovery-focused protocols)`;
      } else if (recovery.whoopRecoveryScore >= 80) {
        prompt += ` (HIGH — good recovery capacity)`;
      }
      prompt += `\n`;
    }

    if (recovery.ouraReadinessScore) {
      prompt += `- Oura Readiness — ${recovery.ouraReadinessScore}%\n`;
    }

    // HRV data
    if (recovery.hrvCurrent) {
      prompt += `- HRV — ${recovery.hrvCurrent}ms`;
      if (recovery.hrvBaseline) {
        prompt += ` (baseline ${recovery.hrvBaseline}ms)`;
        if (recovery.hrvPercentOfBaseline && recovery.hrvPercentOfBaseline < 85) {
          prompt += ` — ${100 - recovery.hrvPercentOfBaseline}% BELOW baseline — nervous system fatigue`;
        }
      }
      prompt += `\n`;
    }

    // Sleep data
    if (recovery.sleepHoursAvg) {
      prompt += `- Sleep Average — ${recovery.sleepHoursAvg}h`;
      if (recovery.sleepDebtHours && recovery.sleepDebtHours > 3) {
        prompt += ` (${recovery.sleepDebtHours}h sleep debt — PRIORITY: sleep extension strategies)`;
      }
      prompt += `\n`;
    }

    if (recovery.sleepEfficiency) {
      prompt += `- Sleep Efficiency — ${recovery.sleepEfficiency}%\n`;
    }

    if (recovery.deepSleepPercent) {
      prompt += `- Sleep Architecture — ${recovery.deepSleepPercent}% deep sleep, ${recovery.remSleepPercent || 'unknown'}% REM`;
      if (recovery.deepSleepPercent < 15) {
        prompt += ` — LOW deep sleep, prioritize sleep quality interventions`;
      }
      prompt += `\n`;
    }

    // Training strain
    if (recovery.strainScore) {
      prompt += `- Training Strain — ${recovery.strainScore}/21`;
      if (recovery.weeklyStrain) {
        prompt += ` (${recovery.weeklyStrain} weekly)`;
      }
      if (recovery.overtrainingRisk === 'high') {
        prompt += ` — OVERTRAINING RISK, emphasize recovery`;
      }
      prompt += `\n`;
    }

    // Work/schedule data
    if (schedule.meetingDensity) {
      prompt += `- Meeting Load — ${schedule.meetingDensity}`;
      if (schedule.avgMeetingsPerDay) {
        prompt += ` (${schedule.avgMeetingsPerDay} meetings/day)`;
      }
      prompt += `\n`;
    }

    if (schedule.workStressIndicators) {
      const stressFactors: string[] = [];
      if (schedule.workStressIndicators.afterHoursWork) stressFactors.push('after-hours work detected');
      if (schedule.workStressIndicators.backToBackMeetings) stressFactors.push('back-to-back meetings');
      if (schedule.workStressIndicators.shortBreaks) stressFactors.push('insufficient breaks');
      if (stressFactors.length > 0) {
        prompt += `- Work Stress Signals — ${stressFactors.join(', ')}\n`;
      }
    }

    // Data sources
    if (ecosystemMetrics.dataFreshness?.dataSources.length > 0) {
      prompt += `- Connected Sources — ${ecosystemMetrics.dataFreshness.dataSources.join(', ')}\n`;
    }
  }

  prompt += `
## Eating Patterns
- First Meal — ${profile.firstMealTiming}
${profile.lastMealTiming ? `- Last Meal — ${profile.lastMealTiming}` : ''}
- Meals Per Day — ${profile.mealsPerDay}
- Alcohol Consumption — ${profile.alcoholConsumption}
${profile.caffeineConsumption ? `- Caffeine Consumption — ${profile.caffeineConsumption}` : ''}

`;

  // Add ecosystem insights (text summaries as backup)
  const sleepInsights = keyInsights.filter(i =>
    i.source.toLowerCase().includes('oura') ||
    i.insight.toLowerCase().includes('sleep') ||
    i.insight.toLowerCase().includes('hrv') ||
    i.insight.toLowerCase().includes('recovery')
  );

  const stressInsights = keyInsights.filter(i =>
    i.insight.toLowerCase().includes('stress') ||
    i.insight.toLowerCase().includes('meeting') ||
    i.insight.toLowerCase().includes('workload')
  );

  const activityInsights = keyInsights.filter(i =>
    i.source.toLowerCase().includes('whoop') ||
    i.insight.toLowerCase().includes('strain') ||
    i.insight.toLowerCase().includes('workout') ||
    i.insight.toLowerCase().includes('activity')
  );

  if (sleepInsights.length > 0) {
    prompt += `## Additional Sleep Insights\n`;
    for (const insight of sleepInsights.slice(0, 3)) {
      prompt += `- [${insight.source.toUpperCase()}] ${insight.insight}\n`;
    }
    prompt += `\n`;
  }

  if (activityInsights.length > 0) {
    prompt += `## Additional Activity Insights\n`;
    for (const insight of activityInsights.slice(0, 3)) {
      prompt += `- [${insight.source.toUpperCase()}] ${insight.insight}\n`;
    }
    prompt += `\n`;
  }

  if (stressInsights.length > 0) {
    prompt += `## Additional Stress Indicators\n`;
    for (const insight of stressInsights.slice(0, 3)) {
      prompt += `- [${insight.source.toUpperCase()}] ${insight.insight}\n`;
    }
    prompt += `\n`;
  }

  // Add biomarker flags relevant to lifestyle
  const relevantFlags = biomarkerFlags.filter(f =>
    f.marker.toLowerCase().includes('cortisol') ||
    f.marker.toLowerCase().includes('vitamin d') ||
    f.marker.toLowerCase().includes('magnesium') ||
    f.marker.toLowerCase().includes('thyroid') ||
    f.marker.toLowerCase().includes('testosterone') ||
    f.marker.toLowerCase().includes('inflammation')
  );

  if (relevantFlags.length > 0) {
    prompt += `## Relevant Biomarkers for Lifestyle\n`;
    for (const flag of relevantFlags) {
      prompt += `- ${flag.marker} — ${flag.status}`;
      if (flag.value) prompt += ` (${flag.value})`;
      prompt += ` — ${flag.implication}\n`;
    }
    prompt += `\n`;
  }

  // Add current supplements
  if (constraints.currentSupplements.length > 0) {
    prompt += `## Current Supplements\n- ${constraints.currentSupplements.join('\n- ')}\n\n`;
  }

  prompt += `## YOUR TASK
Create comprehensive lifestyle recommendations that:
1. Address their ${computedMetrics.sleepScore} sleep quality with specific protocols
2. Consider their ${computedMetrics.stressScore} stress level
3. Align with their ${profile.activityLevel} activity level
4. Support their goal of "${profile.drivingGoal}"
5. Incorporate any relevant ecosystem data and biomarker insights

Return the JSON structure as specified.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runLifestyleIntegrator(
  clientProfile: ClientProfileCard
): Promise<LifestyleIntegratorOutput> {
  console.log('[Lifestyle Integrator] Starting lifestyle protocol creation...');
  console.log(`[Lifestyle Integrator] Client — ${clientProfile.profile.firstName}`);
  console.log(`[Lifestyle Integrator] Sleep — ${clientProfile.computedMetrics.sleepScore}, Stress — ${clientProfile.computedMetrics.stressScore}`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(clientProfile);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content);

    console.log('[Lifestyle Integrator] Protocol creation complete');
    console.log(`[Lifestyle Integrator] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    return normalizeOutput(result, clientProfile);
  } catch (error) {
    console.error('[Lifestyle Integrator] Error:', error);
    console.log('[Lifestyle Integrator] Using fallback protocols');
    return createFallbackOutput(clientProfile);
  }
}

// ============================================================================
// NORMALIZE OUTPUT
// ============================================================================

function normalizeOutput(
  result: Record<string, unknown>,
  clientProfile: ClientProfileCard
): LifestyleIntegratorOutput {
  const lifestyle = result.lifestyleIntegration as Record<string, unknown> || {};

  return {
    lifestyleIntegration: {
      sleepOptimization: normalizeSleepOptimization(
        lifestyle.sleepOptimization as Record<string, unknown>,
        clientProfile
      ),
      exerciseProtocol: normalizeExerciseProtocol(
        lifestyle.exerciseProtocol as Record<string, unknown>,
        clientProfile
      ),
      stressManagement: normalizeStressManagement(
        lifestyle.stressManagement as Record<string, unknown>,
        clientProfile
      ),
    },
  };
}

function normalizeSleepOptimization(
  sleep: Record<string, unknown> | undefined,
  clientProfile: ClientProfileCard
): SleepOptimization {
  if (!sleep) {
    return createFallbackSleep(clientProfile);
  }

  return {
    personalizedIntro: (sleep.personalizedIntro as string) ||
      `With your current sleep quality at ${clientProfile.profile.sleepQuality}/10, optimizing your sleep will be crucial for achieving your goal of ${clientProfile.profile.drivingGoal}.`,
    optimalSleepWindow: (sleep.optimalSleepWindow as string),
    preBedRoutine: (sleep.preBedRoutine as string[]) || createDefaultPreBedRoutine(),
    morningProtocol: (sleep.morningProtocol as string[]) || createDefaultMorningProtocol(),
    supplementSupport: (sleep.supplementSupport as string[]),
    whyThisMatters: (sleep.whyThisMatters as string) ||
      'Quality sleep is foundational — it affects hormone balance, recovery, cognitive function, and metabolic health.',
  };
}

function normalizeExerciseProtocol(
  exercise: Record<string, unknown> | undefined,
  clientProfile: ClientProfileCard
): ExerciseProtocol {
  if (!exercise) {
    return createFallbackExercise(clientProfile);
  }

  return {
    personalizedIntro: (exercise.personalizedIntro as string) ||
      `Based on your ${clientProfile.profile.activityLevel} activity level, we'll focus on sustainable movement that supports your nutrition plan.`,
    weeklyStructure: (exercise.weeklyStructure as string) ||
      'Aim for 3-4 days of structured exercise with active recovery on rest days.',
    nutritionTiming: (exercise.nutritionTiming as string) ||
      'Have a balanced meal 2-3 hours before exercise, and prioritize protein within 2 hours after.',
    recoveryProtocol: (exercise.recoveryProtocol as string) ||
      'Post-workout — hydrate, consume protein, and prioritize sleep for optimal recovery.',
    whyThisMatters: (exercise.whyThisMatters as string) ||
      'Regular movement supports metabolic health, stress management, and helps your body utilize nutrients effectively.',
  };
}

function normalizeStressManagement(
  stress: Record<string, unknown> | undefined,
  clientProfile: ClientProfileCard
): StressManagement {
  if (!stress) {
    return createFallbackStress(clientProfile);
  }

  const dailyPractices = (stress.dailyPractices as Array<Record<string, unknown>>) || [];

  return {
    personalizedIntro: (stress.personalizedIntro as string) ||
      `With your stress level at ${clientProfile.profile.stressLevel}/10, incorporating daily stress management will significantly impact your results.`,
    dailyPractices: dailyPractices.length > 0
      ? dailyPractices.map(p => ({
          practice: (p.practice as string) || 'Breathing exercise',
          timing: (p.timing as string) || 'Daily',
          duration: (p.duration as string) || '5-10 minutes',
          benefit: (p.benefit as string) || 'Reduces cortisol and promotes relaxation',
        }))
      : createDefaultStressPractices(),
    acuteStressProtocols: (stress.acuteStressProtocols as string[]) || createDefaultAcuteProtocols(),
    whyThisMatters: (stress.whyThisMatters as string) ||
      'Chronic stress elevates cortisol, disrupts sleep, and can sabotage even the best nutrition plan.',
  };
}

// ============================================================================
// DEFAULT COMPONENTS
// ============================================================================

function createDefaultPreBedRoutine(): string[] {
  return [
    'Stop eating 3 hours before bed',
    'Dim lights and avoid screens 1 hour before sleep',
    'Keep bedroom cool (18-20°C / 65-68°F)',
    'Practice 5-10 minutes of relaxation or light stretching',
    'Avoid alcohol within 4 hours of bedtime',
  ];
}

function createDefaultMorningProtocol(): string[] {
  return [
    'Wake at a consistent time daily (even weekends)',
    'Get bright light exposure within 30 minutes of waking',
    'Hydrate with 500ml water before coffee or food',
    'Light movement or stretching to activate the body',
    'Delay caffeine 90-120 minutes after waking for optimal alertness',
  ];
}

function createDefaultStressPractices() {
  return [
    {
      practice: 'Box Breathing',
      timing: 'Morning and/or before stressful events',
      duration: '5 minutes',
      benefit: 'Activates parasympathetic nervous system, reduces cortisol',
    },
    {
      practice: 'Walking in Nature',
      timing: 'Daily — ideally during lunch or after work',
      duration: '20-30 minutes',
      benefit: 'Reduces stress hormones and improves mood',
    },
    {
      practice: 'Gratitude Journaling',
      timing: 'Evening — before bed',
      duration: '5 minutes',
      benefit: 'Shifts focus from stress to positivity, improves sleep',
    },
  ];
}

function createDefaultAcuteProtocols(): string[] {
  return [
    '4-7-8 breathing — inhale 4 seconds, hold 7, exhale 8 seconds',
    'Cold water on wrists and face activates dive reflex',
    'Progressive muscle relaxation — tense and release muscle groups',
    'Step outside for 5 minutes of fresh air and light',
  ];
}

// ============================================================================
// FALLBACK OUTPUT
// ============================================================================

function createFallbackSleep(clientProfile: ClientProfileCard): SleepOptimization {
  const { profile, computedMetrics } = clientProfile;
  const sleepScore = profile.sleepQuality;

  let intro = '';
  let supplements: string[] = [];

  if (sleepScore <= 5) {
    intro = `Your current sleep quality of ${sleepScore}/10 is a priority area for improvement. Poor sleep undermines every other health effort — it affects hunger hormones, recovery, cognitive function, and stress resilience. The protocols below will help you build a stronger sleep foundation.`;
    supplements = [
      'Magnesium Glycinate — 300-400mg before bed',
      'L-Theanine — 200mg to promote relaxation',
      'Consider melatonin (0.5-3mg) only if falling asleep is the issue',
    ];
  } else if (sleepScore <= 7) {
    intro = `Your sleep quality is moderate at ${sleepScore}/10 — there's room for optimization. Better sleep will accelerate your progress toward ${profile.drivingGoal} by improving recovery, hormone balance, and energy levels.`;
    supplements = [
      'Magnesium Glycinate — 200-400mg before bed',
    ];
  } else {
    intro = `Your sleep quality at ${sleepScore}/10 is good! Maintaining this will be key to your success. The protocols below will help you protect and potentially optimize your sleep further.`;
    supplements = [];
  }

  return {
    personalizedIntro: intro,
    optimalSleepWindow: '10:00 PM - 6:00 AM (adjust to your schedule — consistency matters most)',
    preBedRoutine: createDefaultPreBedRoutine(),
    morningProtocol: createDefaultMorningProtocol(),
    supplementSupport: supplements.length > 0 ? supplements : undefined,
    whyThisMatters: 'Sleep is when your body repairs, builds muscle, consolidates learning, and regulates hormones. No nutrition plan can overcome chronic poor sleep.',
  };
}

function createFallbackExercise(clientProfile: ClientProfileCard): ExerciseProtocol {
  const { profile } = clientProfile;
  const activity = profile.activityLevel.toLowerCase();

  let intro = '';
  let weeklyStructure = '';
  let recoveryProtocol = '';

  if (activity.includes('sedentary') || activity.includes('light')) {
    intro = `Starting from a ${profile.activityLevel} base, we'll build movement gradually. The focus is on sustainable habits rather than intense exercise — your nutrition plan will do most of the work initially.`;
    weeklyStructure = '3 days of gentle movement (walking, yoga, or swimming) for 20-30 minutes. Add one day of light resistance training if comfortable.';
    recoveryProtocol = 'Focus on consistency over intensity. Stretch after movement, prioritize sleep, and listen to your body.';
  } else if (activity.includes('moderate')) {
    intro = `With your moderate activity level, you have a solid foundation. We'll optimize your exercise timing with nutrition for better results.`;
    weeklyStructure = '3-4 days of structured exercise mixing cardio and resistance training. Include 1-2 active recovery days with walking or yoga.';
    recoveryProtocol = 'Post-workout protein within 2 hours. Prioritize sleep on training days. Consider foam rolling or light stretching.';
  } else {
    intro = `With your active lifestyle, recovery and nutrition timing become crucial. The focus is on supporting your training with optimal fueling.`;
    weeklyStructure = '4-5 days of training with proper periodization. Ensure at least 1-2 full rest or active recovery days per week.';
    recoveryProtocol = 'Prioritize post-workout nutrition — protein and carbs within 2 hours. Consider contrast showers, massage, and adequate sleep for recovery.';
  }

  return {
    personalizedIntro: intro,
    weeklyStructure,
    nutritionTiming: 'Eat a balanced meal 2-3 hours before exercise. Post-workout — prioritize protein (30-40g) and complex carbs within 2 hours.',
    recoveryProtocol,
    whyThisMatters: `Exercise and nutrition work synergistically. Movement supports metabolic health, improves nutrient utilization, and helps achieve your goal of ${profile.drivingGoal}.`,
  };
}

function createFallbackStress(clientProfile: ClientProfileCard): StressManagement {
  const { profile, computedMetrics } = clientProfile;
  const stressLevel = profile.stressLevel;

  let intro = '';
  let acuteProtocols: string[];

  if (stressLevel >= 7) {
    intro = `Your stress level of ${stressLevel}/10 is elevated and needs attention. Chronic stress raises cortisol, disrupts sleep, increases cravings, and can undermine your nutrition efforts. The practices below are essential — not optional.`;
    acuteProtocols = [
      '4-7-8 breathing — use before stressful situations or when overwhelmed',
      'Cold water on face and wrists — activates calming reflex',
      'Step outside for 5 minutes — change of environment helps reset',
      'Progressive muscle relaxation — systematically tense and release muscle groups',
      'Grounding technique — name 5 things you see, 4 you hear, 3 you feel',
    ];
  } else if (stressLevel >= 4) {
    intro = `Your stress level is moderate at ${stressLevel}/10. While manageable, implementing consistent stress practices will optimize your results and protect against future spikes.`;
    acuteProtocols = [
      '4-7-8 breathing — quick reset when feeling tension',
      'Short walk — even 5 minutes helps clear the mind',
      'Cold water on face — activates calming response',
    ];
  } else {
    intro = `Your stress level at ${stressLevel}/10 is well-managed! The practices below will help maintain this and build resilience for challenging periods.`;
    acuteProtocols = [
      'Deep breathing when needed',
      'Brief walk for mental reset',
    ];
  }

  return {
    personalizedIntro: intro,
    dailyPractices: createDefaultStressPractices(),
    acuteStressProtocols: acuteProtocols,
    whyThisMatters: `Stress management directly impacts your goal of ${profile.drivingGoal}. Chronic stress elevates cortisol, promotes fat storage, disrupts sleep, and increases unhealthy cravings.`,
  };
}

function createFallbackOutput(clientProfile: ClientProfileCard): LifestyleIntegratorOutput {
  return {
    lifestyleIntegration: {
      sleepOptimization: createFallbackSleep(clientProfile),
      exerciseProtocol: createFallbackExercise(clientProfile),
      stressManagement: createFallbackStress(clientProfile),
    },
  };
}
