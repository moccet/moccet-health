/**
 * Program Designer Agent
 *
 * Purpose: Design high-level program architecture using full ecosystem context
 * Model: GPT-4o (requires reasoning for optimal program design)
 * Cost: ~$0.03 per call
 *
 * This agent analyzes training history, recovery patterns, schedule constraints
 * and designs the weekly split, volume/intensity distribution, and day assignments.
 */

import OpenAI from 'openai';
import { AthleteProfileCard } from '../../types/athlete-profile';
import { TrainingPhilosophy, WeeklyStructure, ProgramDesignerOutput } from '../../types/plan-output';

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

const SYSTEM_PROMPT = `You are an elite strength and conditioning coach with 20+ years of experience designing personalized training programs. You have worked with everyone from beginners to Olympic athletes.

Your task is to design the HIGH-LEVEL ARCHITECTURE of a training program. You will NOT specify individual exercises - that comes later. Your job is to:

1. Design the optimal weekly training split based on the athlete's:
   - Available training days
   - Recovery capacity
   - Primary goal
   - Schedule constraints from their ecosystem data

2. Determine volume and intensity distribution
3. Assign focus areas to each day (e.g., "Lower Body Strength", "Upper Push", "Rest & Recovery")

ECOSYSTEM DATA INTEGRATION:
When ecosystem data is provided, use it to inform your decisions:
- Recovery Score < 50: Reduce weekly volume by 20-30%, add extra rest day
- HRV below baseline (< 85%): Keep intensity moderate, avoid max efforts
- Sleep debt > 5 hours: Prioritize sleep-promoting session timing (not too late)
- High meeting density: Place training sessions in identified optimal windows
- Overtraining risk HIGH: Include deload protocol, reduce training days by 1

Always explain HOW the ecosystem data influenced your programming decisions in the trainingPhilosophy.approach section.

CRITICAL RULES:
- Write in a warm, encouraging but professional tone
- Use "you" and "your" when addressing the athlete
- Reference specific data from their profile (e.g., "Based on your 4 available training days...")
- NEVER use colons (:) in your text - never use em dashes (—)
- Keep all text concise and actionable

OUTPUT FORMAT:
You must return valid JSON matching this structure exactly:
{
  "trainingPhilosophy": {
    "approach": "2-3 paragraphs explaining the overall training approach",
    "keyPrinciples": [
      { "principle": "Principle name", "description": "1-2 sentence description" }
    ],
    "progressionStrategy": "2-3 paragraphs on how to progress"
  },
  "weeklyStructure": {
    "overview": "2-3 paragraphs describing the weekly split",
    "trainingDays": 4,
    "focusAreas": ["Monday — Lower Body Strength", "Tuesday — Rest", ...],
    "rationale": "Why this split is optimal for this athlete",
    "volumeDistribution": "How volume is spread across the week",
    "intensityFramework": "How intensity is managed"
  },
  "dayFocusAssignments": {
    "monday": "Lower Body Strength",
    "tuesday": "Rest & Recovery",
    "wednesday": "Upper Body Push",
    "thursday": "Active Recovery",
    "friday": "Lower Body Power",
    "saturday": "Upper Body Pull",
    "sunday": "Rest & Recovery"
  }
}`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(athleteProfile: AthleteProfileCard): string {
  const { profile, computedMetrics, constraints, biomarkerFlags, keyInsights, trainingHistory, ecosystemMetrics } = athleteProfile;

  let prompt = `# ATHLETE PROFILE

## Basic Information
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Gender — ${profile.gender}
- Weight — ${profile.weightKg} kg
- Height — ${profile.heightCm} cm
- BMI — ${profile.bmi}

## Training Background
- Experience Level — ${profile.trainingAge}
- Primary Goal — ${profile.primaryGoal}
- Available Training Days — ${profile.trainingDays} days per week
- Session Length — ${profile.sessionLengthMinutes} minutes
- Preferred Training Time — ${profile.preferredExerciseTime}
- Time Horizon — ${profile.timeHorizon}

## Recovery & Readiness (Computed)
- Sleep Score — ${computedMetrics.sleepScore}/10
- Stress Level — ${computedMetrics.stressScore}
- Recovery Capacity — ${computedMetrics.recoveryCapacity}
- Overtraining Risk — ${computedMetrics.overtrainingRisk}
- Recommended Intensity — ${computedMetrics.recommendedIntensity}
`;

  // Add detailed ecosystem metrics if available
  if (ecosystemMetrics) {
    const { recovery, schedule } = ecosystemMetrics;

    if (recovery.combinedRecoveryScore || recovery.hrvCurrent || recovery.sleepHoursAvg) {
      prompt += `\n## Wearable Recovery Data (Real-time)\n`;

      if (recovery.combinedRecoveryScore) {
        prompt += `- Recovery Score — ${recovery.combinedRecoveryScore}/100`;
        if (recovery.combinedRecoveryScore < 50) {
          prompt += ` (LOW — reduce volume/intensity)`;
        } else if (recovery.combinedRecoveryScore >= 80) {
          prompt += ` (HIGH — can push harder)`;
        }
        prompt += `\n`;
      }

      if (recovery.hrvCurrent && recovery.hrvBaseline) {
        prompt += `- HRV — ${recovery.hrvCurrent}ms (baseline ${recovery.hrvBaseline}ms, ${recovery.hrvTrend || 'unknown'})\n`;
        if (recovery.hrvPercentOfBaseline && recovery.hrvPercentOfBaseline < 85) {
          prompt += `  * HRV is ${100 - recovery.hrvPercentOfBaseline}% below baseline — nervous system fatigue detected\n`;
        }
      } else if (recovery.hrvCurrent) {
        prompt += `- HRV — ${recovery.hrvCurrent}ms\n`;
      }

      if (recovery.restingHRElevated) {
        prompt += `- Resting HR — ELEVATED at ${recovery.restingHR}bpm (baseline ${recovery.restingHRBaseline}bpm) — incomplete recovery\n`;
      }

      if (recovery.sleepHoursAvg) {
        prompt += `- Sleep — ${recovery.sleepHoursAvg}h average`;
        if (recovery.sleepDebtHours && recovery.sleepDebtHours > 3) {
          prompt += ` (${recovery.sleepDebtHours}h sleep debt accumulated)`;
        }
        prompt += `\n`;

        if (recovery.deepSleepPercent) {
          prompt += `- Sleep Architecture — ${recovery.deepSleepPercent}% deep, ${recovery.remSleepPercent || 'unknown'}% REM\n`;
          if (recovery.deepSleepPercent < 15) {
            prompt += `  * Low deep sleep — physical recovery compromised\n`;
          }
        }
      }

      if (recovery.strainScore) {
        prompt += `- Training Strain — ${recovery.strainScore}/21 daily`;
        if (recovery.weeklyStrain) {
          prompt += ` (${recovery.weeklyStrain} weekly)`;
        }
        prompt += `\n`;
        if (recovery.overtrainingRisk === 'high') {
          prompt += `  * OVERTRAINING RISK HIGH — ${recovery.recommendedRestDays || 2} extra rest days recommended\n`;
        }
      }
    }

    if (schedule.meetingDensity || schedule.workStressIndicators) {
      prompt += `\n## Work/Schedule Patterns\n`;

      if (schedule.meetingDensity) {
        prompt += `- Meeting Load — ${schedule.meetingDensity}`;
        if (schedule.avgMeetingsPerDay) {
          prompt += ` (${schedule.avgMeetingsPerDay} meetings/day avg)`;
        }
        prompt += `\n`;
      }

      if (schedule.workStressIndicators) {
        const stressFactors: string[] = [];
        if (schedule.workStressIndicators.afterHoursWork) stressFactors.push('after-hours work');
        if (schedule.workStressIndicators.backToBackMeetings) stressFactors.push('back-to-back meetings');
        if (stressFactors.length > 0) {
          prompt += `- Work Stress Signals — ${stressFactors.join(', ')}\n`;
        }
      }

      if (schedule.optimalTrainingWindows && schedule.optimalTrainingWindows.length > 0) {
        prompt += `- Optimal Training Windows — ${schedule.optimalTrainingWindows.join(', ')}\n`;
      }

      if (schedule.busyDays && schedule.busyDays.length > 0) {
        prompt += `- High-Commitment Days — ${schedule.busyDays.join(', ')} (consider rest/lighter sessions)\n`;
      }
    }
  }

  prompt += `\n## Constraints
- Training Location — ${constraints.trainingLocation}
- Available Equipment — ${constraints.equipment.join(', ')}
`;

  if (constraints.injuries.length > 0) {
    prompt += `- Injuries/Limitations — ${constraints.injuries.map(i => i.area).join(', ')}\n`;
  }

  if (constraints.medicalConditions.length > 0) {
    prompt += `- Medical Conditions — ${constraints.medicalConditions.join(', ')}\n`;
  }

  // Add ecosystem insights (text summaries)
  if (keyInsights.length > 0) {
    prompt += `\n## Additional Ecosystem Insights\n`;
    for (const insight of keyInsights) {
      prompt += `- [${insight.source.toUpperCase()}] ${insight.insight}\n`;
    }
  }

  // Add biomarker flags
  if (biomarkerFlags.length > 0) {
    prompt += `\n## Biomarker Flags (from blood work)\n`;
    for (const flag of biomarkerFlags) {
      prompt += `- ${flag.marker} — ${flag.status} ${flag.value ? `(${flag.value})` : ''}\n`;
    }
  }

  // Add training history
  if (trainingHistory) {
    prompt += `\n## Recent Training History
- Weekly Training — ${trainingHistory.weeklyMinutes} minutes
- Dominant Type — ${trainingHistory.dominantWorkoutType}
- Trend — ${trainingHistory.recentTrend}
`;
  }

  prompt += `
## Your Task
Design a ${profile.trainingDays}-day per week training program that:
1. Aligns with their primary goal of "${profile.primaryGoal}"
2. Respects their ${computedMetrics.recoveryCapacity} recovery capacity`;

  // Add ecosystem-informed instructions
  if (ecosystemMetrics?.recovery.combinedRecoveryScore && ecosystemMetrics.recovery.combinedRecoveryScore < 50) {
    prompt += `\n3. IMPORTANT — Current recovery score is LOW (${ecosystemMetrics.recovery.combinedRecoveryScore}/100) — design a conservative volume week with built-in deload options`;
  } else if (ecosystemMetrics?.recovery.overtrainingRisk === 'high') {
    prompt += `\n3. IMPORTANT — Overtraining risk is HIGH — include ${ecosystemMetrics.recovery.recommendedRestDays || 2} rest days and reduce weekly volume by 20-30%`;
  } else if (ecosystemMetrics?.recovery.hrvPercentOfBaseline && ecosystemMetrics.recovery.hrvPercentOfBaseline < 85) {
    prompt += `\n3. IMPORTANT — HRV is ${100 - ecosystemMetrics.recovery.hrvPercentOfBaseline}% below baseline — prioritize recovery and keep intensity moderate`;
  }

  if (ecosystemMetrics?.schedule.meetingDensity === 'very-high') {
    prompt += `\n4. Work schedule is extremely demanding — prioritize shorter, efficient sessions and strategic rest day placement`;
  }

  prompt += `
5. Fits within ${profile.sessionLengthMinutes}-minute sessions
6. Works around any injuries or limitations
7. Considers insights from their ecosystem data

Return the JSON structure as specified in the system prompt.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runProgramDesigner(
  athleteProfile: AthleteProfileCard
): Promise<ProgramDesignerOutput> {
  console.log('[Program Designer] Starting program design...');
  console.log(`[Program Designer] Athlete — ${athleteProfile.profile.firstName}, Goal — ${athleteProfile.profile.primaryGoal}`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(athleteProfile);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      throw new Error('No response from GPT-4o');
    }

    const result = JSON.parse(content) as ProgramDesignerOutput;

    // Validate the response structure
    if (!result.trainingPhilosophy || !result.weeklyStructure || !result.dayFocusAssignments) {
      throw new Error('Invalid response structure from GPT-4o');
    }

    // Ensure all 7 days are assigned
    const requiredDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of requiredDays) {
      if (!result.dayFocusAssignments[day as keyof typeof result.dayFocusAssignments]) {
        result.dayFocusAssignments[day as keyof typeof result.dayFocusAssignments] = 'Rest & Recovery';
      }
    }

    console.log('[Program Designer] Program design complete');
    console.log(`[Program Designer] Training days — ${result.weeklyStructure.trainingDays}`);
    console.log(`[Program Designer] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    return result;
  } catch (error) {
    console.error('[Program Designer] Error:', error);
    throw new Error(`Program Designer failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// FALLBACK TEMPLATES (for when API fails)
// ============================================================================

export function getFallbackProgramDesign(athleteProfile: AthleteProfileCard): ProgramDesignerOutput {
  const { profile } = athleteProfile;
  const trainingDays = profile.trainingDays;

  // Default to upper/lower split for 4 days, push/pull/legs for 6 days
  let dayAssignments: ProgramDesignerOutput['dayFocusAssignments'];

  if (trainingDays <= 3) {
    dayAssignments = {
      monday: 'Full Body Strength',
      tuesday: 'Rest & Recovery',
      wednesday: 'Full Body Strength',
      thursday: 'Rest & Recovery',
      friday: 'Full Body Strength',
      saturday: 'Active Recovery',
      sunday: 'Rest & Recovery',
    };
  } else if (trainingDays === 4) {
    dayAssignments = {
      monday: 'Lower Body Strength',
      tuesday: 'Upper Body Push',
      wednesday: 'Rest & Recovery',
      thursday: 'Lower Body Power',
      friday: 'Upper Body Pull',
      saturday: 'Active Recovery',
      sunday: 'Rest & Recovery',
    };
  } else {
    dayAssignments = {
      monday: 'Push — Chest & Shoulders',
      tuesday: 'Pull — Back & Biceps',
      wednesday: 'Legs — Quads & Glutes',
      thursday: 'Rest & Recovery',
      friday: 'Push — Shoulders & Triceps',
      saturday: 'Pull — Back & Rear Delts',
      sunday: 'Legs — Hamstrings & Calves',
    };
  }

  return {
    trainingPhilosophy: {
      approach: `This program is designed specifically for your goal of ${profile.primaryGoal}. Based on your ${profile.trainingAge} experience level and ${profile.trainingDays} available training days per week, we've created a balanced approach that maximizes results while respecting your recovery capacity.\n\nThe focus is on progressive overload — gradually increasing the demands on your body to drive continuous adaptation. Each session is structured to fit within your ${profile.sessionLengthMinutes}-minute time window while delivering maximum impact.`,
      keyPrinciples: [
        {
          principle: 'Progressive Overload',
          description: 'Gradually increase weight, reps, or sets each week to drive continuous adaptation.',
        },
        {
          principle: 'Recovery Integration',
          description: 'Training is balanced with strategic rest days to optimize recovery and prevent burnout.',
        },
        {
          principle: 'Goal Alignment',
          description: `Every session is designed to move you closer to your goal of ${profile.primaryGoal}.`,
        },
      ],
      progressionStrategy: `Over the coming weeks, you'll follow a structured progression model. Weeks 1-2 focus on establishing baseline strength and movement quality. Weeks 3-4 increase intensity by 5-10%. Weeks 5-6 push toward peak performance before a deload in week 7.\n\nListen to your body — if recovery feels compromised, reduce intensity rather than skipping sessions entirely.`,
    },
    weeklyStructure: {
      overview: `Your ${trainingDays}-day training week is structured to balance training stimulus with recovery. Each training day targets specific muscle groups or movement patterns, allowing adequate recovery time before training similar areas again.\n\nThis split optimizes your available time while ensuring you make consistent progress toward your goals.`,
      trainingDays,
      focusAreas: Object.entries(dayAssignments).map(([day, focus]) => `${day.charAt(0).toUpperCase() + day.slice(1)} — ${focus}`),
      rationale: `This split was chosen based on your ${trainingDays} available days and ${athleteProfile.computedMetrics.recoveryCapacity} recovery capacity.`,
      volumeDistribution: 'Volume is distributed evenly across training days with slightly higher volume early in the week when energy and motivation tend to be highest.',
      intensityFramework: 'Intensity follows a wave pattern — moderate intensity early in the week, peak intensity mid-week, and reduced intensity toward the weekend to support recovery.',
    },
    dayFocusAssignments: dayAssignments,
  };
}
