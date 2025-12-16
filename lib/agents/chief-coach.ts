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

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the athlete
3. Reference SPECIFIC data from their profile and ecosystem
4. Keep tone warm, professional, and encouraging
5. Cross-references should feel natural, not forced
6. The executive summary should make the athlete excited to start

CROSS-REFERENCE EXAMPLES:
- "Your leg day on Monday aligns with your highest Oura readiness scores"
- "The pre-workout meal timing accounts for your early morning training preference"
- "Recovery protocols target the stress patterns we see in your calendar data"
- "Supplement timing coordinates with your training schedule for maximum benefit"

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
  const { profile, computedMetrics, keyInsights, biomarkerFlags } = athleteProfile;

  // Summarize training structure
  const trainingDays = Object.entries(programDesign.dayFocusAssignments)
    .filter(([_, focus]) => !focus.toLowerCase().includes('rest'))
    .map(([day, focus]) => `${day} — ${focus}`);

  // Extract key ecosystem insights
  const ecosystemSummary = keyInsights
    .slice(0, 5)
    .map(i => `[${i.source.toUpperCase()}] ${i.insight}`)
    .join('\n');

  // Summarize biomarker concerns
  const biomarkerSummary = biomarkerFlags.length > 0
    ? biomarkerFlags.map(f => `${f.marker} — ${f.status}`).join(', ')
    : 'No significant concerns';

  return `# ATHLETE OVERVIEW

## Personal Details
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Primary Goal — ${profile.primaryGoal}
- Time Horizon — ${profile.timeHorizon}
- Experience Level — ${profile.trainingAge}

## Recovery Status
- Sleep Score — ${computedMetrics.sleepScore}/10
- Stress Level — ${computedMetrics.stressScore}
- Recovery Capacity — ${computedMetrics.recoveryCapacity}
- Overtraining Risk — ${computedMetrics.overtrainingRisk}

## Ecosystem Insights
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
   - References ecosystem insights where relevant
   - Explains how the program addresses their unique needs
   - Gets them excited to start
3. Adaptive features for energy-based adjustments
4. Cross-references that connect training, recovery, and nutrition naturally

Return the JSON structure as specified.`;
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
