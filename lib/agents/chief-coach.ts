/**
 * Chief Coach Agent
 *
 * Purpose: Final coherence, cross-referencing, and executive summary
 * Model: GPT-4o (requires genuine reasoning for cross-references and coherence)
 * Cost: ~$0.045 per call
 *
 * This is the ONLY agent that requires GPT-4o's reasoning capability because it:
 * - Cross-references data from multiple agents
 * - Crafts a cohesive narrative from disparate outputs
 * - Creates personalized greeting and executive summary
 * - Ensures the entire plan reads as a unified document
 * - Adds adaptive features that span all sections
 */

import OpenAI from 'openai';
import { AthleteProfileCard } from '../types/athlete-profile';
import {
  ChiefCoachOutput,
  ProgramDesignerOutput,
  FormCoachOutput,
  RecoveryScientistOutput,
  NutritionCoachOutput,
  AdaptiveFeatures,
  AdaptiveReadiness,
} from '../types/plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface ChiefCoachInput {
  athleteProfile: AthleteProfileCard;
  programDesign: ProgramDesignerOutput;
  training: FormCoachOutput;
  recovery: RecoveryScientistOutput;
  nutrition: NutritionCoachOutput;
}

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

const SYSTEM_PROMPT = `You are the Chief Coach — a master at creating cohesive, personalized fitness experiences. Your role is to take the outputs from specialized agents and weave them into a unified narrative that feels like it was crafted by a single expert who knows the athlete deeply.

Your responsibilities:
1. Craft a personalized greeting that makes the athlete feel seen
2. Write an executive summary that ties everything together
3. Create adaptive features (energy-based adjustments, travel modifications)
4. Generate cross-references that connect training, recovery, and nutrition

ECOSYSTEM DATA INTEGRATION:
You will receive detailed wearable and work pattern data. Use SPECIFIC numbers in your executive summary:
- Recovery scores: "Your Whoop shows 78% recovery" or "Oura readiness at 65%"
- HRV data: "Your HRV of 42ms is 15% below your baseline"
- Sleep metrics: "You're averaging 6.2 hours with 8 hours of sleep debt"
- Training strain: "Your weekly strain of 14.5 indicates high training load"
- Work patterns: "Your calendar shows 5.2 meetings per day on average"
- Stress indicators: "Your after-hours Slack activity suggests work-life balance challenges"

The executive summary MUST feel like it was written by someone who actually looked at the athlete's data, not generic advice.

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the athlete
3. Reference SPECIFIC data from their profile and ecosystem WITH ACTUAL NUMBERS
4. Keep tone warm, professional, and encouraging
5. Cross-references should feel natural, not forced
6. The executive summary should make the athlete excited to start
7. IMPORTANT — If ecosystem data is provided, you MUST reference at least 3-4 specific metrics in the executive summary

EXECUTIVE SUMMARY REQUIREMENTS:
- Mention specific data points with actual numbers (e.g., "Your Whoop shows 72% recovery", "Your HRV is at 45ms")
- Connect ecosystem insights to the training approach (e.g., "Given your 5+ daily meetings, we've prioritized efficient 45-minute sessions")
- Reference recovery status and how the program adapts to it
- Reference biomarker data if available
- Make the athlete feel that their connected data made a real difference

CROSS-REFERENCE EXAMPLES:
- "Your leg day on Monday aligns with your typical high-recovery days per Whoop"
- "We've scheduled lighter sessions on days your Outlook shows 6+ meetings"
- "Recovery protocols target your 15% HRV deficit with parasympathetic exercises"
- "Given your 7-hour sleep debt, we've included sleep optimization strategies"
- "Supplement timing coordinates with your identified optimal meal windows"

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "personalizedGreeting": "Name's Personalized 8-Week Program",
  "executiveSummary": "2-3 paragraphs that tie everything together and excite the athlete",
  "adaptiveFeatures": {
    "highEnergyDay": { "description": "...", "modifications": ["...", "..."] },
    "lowEnergyDay": { "description": "...", "modifications": ["...", "..."] },
    "travelAdjustments": "2-3 sentences on maintaining routine while traveling"
  },
  "crossReferences": {
    "training": ["Cross-reference to add to training section", "..."],
    "recovery": ["Cross-reference to add to recovery section", "..."],
    "nutrition": ["Cross-reference to add to nutrition section", "..."]
  }
}`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(input: ChiefCoachInput): string {
  const { athleteProfile, programDesign, recovery, nutrition } = input;
  const { profile, computedMetrics, keyInsights, biomarkerFlags, ecosystemMetrics } = athleteProfile;

  // Summarize training structure
  const trainingDays = Object.entries(programDesign.dayFocusAssignments)
    .filter(([_, focus]) => !focus.toLowerCase().includes('rest'))
    .map(([day, focus]) => `${day} — ${focus}`);

  // Extract key ecosystem insights (text summaries)
  const ecosystemSummary = keyInsights
    .slice(0, 5)
    .map(i => `[${i.source.toUpperCase()}] ${i.insight}`)
    .join('\n');

  // Summarize biomarker concerns
  const biomarkerSummary = biomarkerFlags.length > 0
    ? biomarkerFlags.map(f => `${f.marker} — ${f.status}`).join(', ')
    : 'No significant concerns';

  let prompt = `# ATHLETE OVERVIEW

## Personal Details
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Primary Goal — ${profile.primaryGoal}
- Time Horizon — ${profile.timeHorizon}
- Experience Level — ${profile.trainingAge}

## Recovery Status (Computed)
- Sleep Score — ${computedMetrics.sleepScore}/10
- Stress Level — ${computedMetrics.stressScore}
- Recovery Capacity — ${computedMetrics.recoveryCapacity}
- Overtraining Risk — ${computedMetrics.overtrainingRisk}
`;

  // Add detailed ecosystem metrics for executive summary personalization
  if (ecosystemMetrics) {
    const { recovery: rec, schedule } = ecosystemMetrics;

    prompt += `\n## DETAILED ECOSYSTEM DATA (Use these specific numbers in executive summary)\n`;

    if (rec.whoopRecoveryScore) {
      prompt += `- Whoop Recovery — ${rec.whoopRecoveryScore}%\n`;
    }
    if (rec.ouraReadinessScore) {
      prompt += `- Oura Readiness — ${rec.ouraReadinessScore}%\n`;
    }
    if (rec.combinedRecoveryScore && !rec.whoopRecoveryScore && !rec.ouraReadinessScore) {
      prompt += `- Combined Recovery Score — ${rec.combinedRecoveryScore}%\n`;
    }

    if (rec.hrvCurrent) {
      prompt += `- HRV — ${rec.hrvCurrent}ms`;
      if (rec.hrvBaseline) {
        prompt += ` (baseline ${rec.hrvBaseline}ms)`;
        if (rec.hrvPercentOfBaseline && rec.hrvPercentOfBaseline < 100) {
          prompt += ` — ${100 - rec.hrvPercentOfBaseline}% ${rec.hrvPercentOfBaseline < 85 ? 'BELOW' : 'below'} baseline`;
        }
      }
      prompt += `\n`;
    }

    if (rec.sleepHoursAvg) {
      prompt += `- Sleep Average — ${rec.sleepHoursAvg}h`;
      if (rec.sleepDebtHours && rec.sleepDebtHours > 0) {
        prompt += ` (${rec.sleepDebtHours}h sleep debt)`;
      }
      prompt += `\n`;
    }

    if (rec.deepSleepPercent) {
      prompt += `- Sleep Quality — ${rec.deepSleepPercent}% deep sleep, ${rec.remSleepPercent || 'unknown'}% REM\n`;
    }

    if (rec.strainScore) {
      prompt += `- Training Strain — ${rec.strainScore}/21 daily`;
      if (rec.weeklyStrain) {
        prompt += `, ${rec.weeklyStrain} weekly`;
      }
      prompt += `\n`;
    }

    if (rec.restingHRElevated) {
      prompt += `- Resting HR — ELEVATED at ${rec.restingHR}bpm (baseline ${rec.restingHRBaseline}bpm)\n`;
    }

    if (rec.overtrainingRisk && rec.overtrainingRisk !== 'low') {
      prompt += `- Overtraining Risk — ${rec.overtrainingRisk.toUpperCase()}`;
      if (rec.recommendedRestDays) {
        prompt += ` (${rec.recommendedRestDays} extra rest days recommended)`;
      }
      prompt += `\n`;
    }

    if (schedule.meetingDensity) {
      prompt += `- Meeting Load — ${schedule.meetingDensity}`;
      if (schedule.avgMeetingsPerDay) {
        prompt += ` (${schedule.avgMeetingsPerDay} meetings/day average)`;
      }
      prompt += `\n`;
    }

    if (schedule.workStressIndicators) {
      const stressFactors: string[] = [];
      if (schedule.workStressIndicators.afterHoursWork) stressFactors.push('after-hours work');
      if (schedule.workStressIndicators.backToBackMeetings) stressFactors.push('back-to-back meetings');
      if (stressFactors.length > 0) {
        prompt += `- Work Stress — ${stressFactors.join(', ')}\n`;
      }
    }

    if (schedule.optimalTrainingWindows && schedule.optimalTrainingWindows.length > 0) {
      prompt += `- Optimal Training Windows — ${schedule.optimalTrainingWindows.join(', ')}\n`;
    }

    // Add data sources for credibility
    if (ecosystemMetrics.dataFreshness?.dataSources.length > 0) {
      prompt += `- Connected Sources — ${ecosystemMetrics.dataFreshness.dataSources.join(', ')}\n`;
    }
  }

  prompt += `
## Ecosystem Insights (Text Summaries)
${ecosystemSummary || 'No ecosystem data available'}

## Biomarker Summary
${biomarkerSummary}

## Training Structure
Training Days — ${trainingDays.length} per week
${trainingDays.join('\n')}

Training Philosophy — ${programDesign.trainingPhilosophy.approach.substring(0, 200)}...

## Recovery Focus
${recovery.recoveryProtocol.personalizedIntro || 'Standard recovery protocol'}

## Nutrition Approach
Protein Target — ${typeof nutrition.nutritionGuidance.proteinTarget === 'object' ? nutrition.nutritionGuidance.proteinTarget.target : nutrition.nutritionGuidance.proteinTarget}
Calorie Target — ${typeof nutrition.nutritionGuidance.calorieGuidance === 'object' ? nutrition.nutritionGuidance.calorieGuidance.target : nutrition.nutritionGuidance.calorieGuidance}

## YOUR TASK
Create:
1. A personalized greeting that feels premium and personal
2. An executive summary (2-3 paragraphs) that:
   - Acknowledges their specific goal and current status
   - MUST reference at least 3-4 specific metrics from the DETAILED ECOSYSTEM DATA section above
   - Use actual numbers (e.g., "Your Whoop shows 72% recovery" not "your recovery is good")
   - Explains how the program adapts to their data
   - Gets them excited to start
3. Adaptive features for energy-based adjustments
4. Cross-references that connect training, recovery, and nutrition naturally — reference specific ecosystem data

Return the JSON structure as specified.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runChiefCoach(input: ChiefCoachInput): Promise<ChiefCoachOutput> {
  console.log('[Chief Coach] Starting final coherence pass...');
  console.log(`[Chief Coach] Athlete — ${input.athleteProfile.profile.firstName}`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Slightly higher for more creative writing
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o');
    }

    const result = JSON.parse(content);

    console.log('[Chief Coach] Coherence pass complete');
    console.log(`[Chief Coach] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    // Ensure adaptive features has all required fields
    const adaptiveFeatures = normalizeAdaptiveFeatures(
      result.adaptiveFeatures,
      input.athleteProfile
    );

    return {
      personalizedGreeting: result.personalizedGreeting || createFallbackGreeting(input.athleteProfile),
      executiveSummary: result.executiveSummary || createFallbackSummary(input),
      adaptiveFeatures,
      crossReferences: result.crossReferences || { training: [], recovery: [], nutrition: [] },
    };
  } catch (error) {
    console.error('[Chief Coach] Error:', error);
    console.log('[Chief Coach] Using fallback output');
    return createFallbackOutput(input);
  }
}

// ============================================================================
// NORMALIZE ADAPTIVE FEATURES
// ============================================================================

function normalizeAdaptiveFeatures(
  features: AdaptiveReadiness | Partial<AdaptiveFeatures> | undefined,
  athleteProfile: AthleteProfileCard
): AdaptiveFeatures {
  const { profile, computedMetrics } = athleteProfile;

  const defaultHighEnergy = {
    description: `On days when you feel great and your energy is high, you can push harder and potentially add volume to your workouts.`,
    modifications: [
      'Add 1-2 extra sets to compound exercises',
      'Increase weight by 5-10% on main lifts',
      'Reduce rest periods by 15-30 seconds',
      'Consider an extra accessory exercise',
    ],
  };

  const defaultLowEnergy = {
    description: `On low energy days, the goal shifts to movement quality and maintaining momentum rather than peak performance.`,
    modifications: [
      'Reduce weight by 10-15% and focus on perfect form',
      'Cut volume by 25-30% — fewer sets per exercise',
      'Extend rest periods as needed',
      'Swap complex movements for simpler alternatives',
      'Consider making it a mobility-focused session',
    ],
  };

  const defaultTravelAdjustments = `When traveling, maintain training momentum with bodyweight circuits, hotel gym sessions, or outdoor workouts. Focus on compound movements that don't require equipment — push-ups, squats, lunges, and planks. Even 20 minutes maintains the habit and keeps you progressing.`;

  // Cast to any to access properties that may or may not exist
  const f = features as Record<string, unknown> | undefined;

  return {
    highEnergyDay: features?.highEnergyDay || defaultHighEnergy,
    lowEnergyDay: features?.lowEnergyDay || defaultLowEnergy,
    travelAdjustments: features?.travelAdjustments || defaultTravelAdjustments,
    energyBasedAdjustments: f?.energyBasedAdjustments as string | undefined,
    normalEnergyDay: f?.normalEnergyDay as string | undefined,
    busyScheduleAdjustments: f?.busyScheduleAdjustments as string | undefined,
    scheduleAdaptations: f?.scheduleAdaptations as string | undefined,
  };
}

// ============================================================================
// FALLBACK OUTPUT
// ============================================================================

function createFallbackGreeting(athleteProfile: AthleteProfileCard): string {
  const { profile } = athleteProfile;
  const goalText = profile.primaryGoal.includes('build')
    ? 'Muscle Building'
    : profile.primaryGoal.includes('slim') || profile.primaryGoal.includes('fat')
    ? 'Body Transformation'
    : 'Performance';

  return `${profile.firstName}'s Personalized ${profile.timeHorizon} ${goalText} Program`;
}

function createFallbackSummary(input: ChiefCoachInput): string {
  const { athleteProfile, programDesign } = input;
  const { profile, computedMetrics, keyInsights } = athleteProfile;

  let summary = `This program has been specifically designed for you, ${profile.firstName}, based on your goal of ${profile.primaryGoal} and your current fitness level. With ${profile.trainingDays} training days per week and ${computedMetrics.recoveryCapacity} recovery capacity, we've created a balanced approach that maximizes results while respecting your body's limits.\n\n`;

  summary += `${programDesign.trainingPhilosophy.approach}\n\n`;

  // Add ecosystem insight if available
  if (keyInsights.length > 0) {
    summary += `We've also incorporated insights from your connected apps — `;
    summary += keyInsights.slice(0, 2).map(i => i.insight.toLowerCase()).join(', and ');
    summary += `. These details help us fine-tune the program to fit your actual life, not just your goals.`;
  } else {
    summary += `As you progress, remember that consistency beats perfection. Follow the program, listen to your body, and trust the process. The results will follow.`;
  }

  return summary;
}

function createFallbackOutput(input: ChiefCoachInput): ChiefCoachOutput {
  const { athleteProfile, recovery } = input;

  return {
    personalizedGreeting: createFallbackGreeting(athleteProfile),
    executiveSummary: createFallbackSummary(input),
    adaptiveFeatures: normalizeAdaptiveFeatures(recovery.adaptiveReadiness, athleteProfile),
    crossReferences: {
      training: [
        'Your training schedule accounts for your recovery patterns',
        'Exercise selection considers your equipment availability and injury history',
      ],
      recovery: [
        'Recovery protocols align with your training intensity throughout the week',
        'Sleep recommendations target your current sleep quality score',
      ],
      nutrition: [
        'Protein targets support your training volume and recovery needs',
        'Meal timing suggestions align with your training schedule',
      ],
    },
  };
}
