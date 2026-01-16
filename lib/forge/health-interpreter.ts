/**
 * Health Interpreter
 * Uses AI to interpret health context and generate training modifications
 * Results are cached for 24 hours
 */

import OpenAI from 'openai';
import { getServiceClient } from '@/lib/supabase/server';
import type {
  UnifiedHealthContext,
  TrainingModifications,
  ExerciseType,
} from './types';
import { getDefaultTrainingModifications } from './types';
import { hasRelevantHealthData } from './health-context-aggregator';

// ==================== AI PROMPT ====================

const HEALTH_INTERPRETATION_SYSTEM_PROMPT = `You are a sports medicine AI that interprets health data to determine training modifications for workout planning.

Your role is to analyze the provided health context and output specific, actionable training adjustments.

## Guidelines:

### Blood Biomarkers:
- Ferritin < 30 ng/mL (low iron): volumeAdjustment: -20, avoidHighIntensity: true
- Hemoglobin < 12 g/dL (anemia): volumeAdjustment: -30, extraRestDays: 1
- CRP > 3 mg/L (inflammation): volumeAdjustment: -25, prioritizeRecovery: true
- Cortisol > 25 ug/dL (high stress): intensityAdjustment: -20, avoid HIIT
- Low Vitamin D: Normal training, add outdoor activity note
- Low Testosterone: Maintain compound lifts, avoid overtraining

### Recovery Metrics (Oura/Whoop):
- Score < 33% (red): skipTrainingToday: true
- Score 33-66% (yellow): volumeAdjustment: -30, intensityAdjustment: -20
- Score > 66% (green): Normal training
- HRV declining trend: intensityAdjustment: -15, prioritizeRecovery: true
- High strain (>18): extraRestDays: 1, deload recommended

### Sleep:
- < 5 hours: skipTrainingToday: true
- 5-6 hours: volumeAdjustment: -30, avoidHighIntensity: true
- 6-7 hours: volumeAdjustment: -15
- Sleep debt > 5 hours: reduce training days until recovered

### Glucose (CGM):
- High variability (CV > 36%): Note to avoid fasted training
- Frequent spikes: Add post-meal walks recommendation
- Good control: Normal training

### Combined Patterns:
- Poor recovery + poor sleep: Skip training or very light only
- High stress + low sleep: Prioritize recovery exercises (yoga, stretching)
- Low iron + high training load: Significant volume reduction

## Output Format:
Return a JSON object with these fields:
{
  "volumeAdjustment": number (-30 to +10),
  "intensityAdjustment": number (-30 to +10),
  "avoidHighIntensity": boolean,
  "prioritizeRecovery": boolean,
  "skipTrainingToday": boolean,
  "extraRestDays": number (0-2),
  "maxTrainingDays": number | null,
  "muscleGroupModifiers": { "muscle_name": { "avoid": boolean, "reduceVolume": number, "reason": string } },
  "avoidExerciseTypes": ["hiit", "crossfit", etc.],
  "prioritizeExerciseTypes": ["yoga", "calisthenics", etc.],
  "reasoningSummary": "Brief explanation of key modifications"
}

If no concerning data is present, return all zeros/false (normal training).
Return ONLY the JSON object, no markdown or explanation.`;

// ==================== MAIN INTERPRETER ====================

/**
 * Interpret health context and generate training modifications
 * Uses caching to avoid repeated AI calls
 */
export async function interpretHealthForTraining(
  healthContext: UnifiedHealthContext,
  userEmail: string
): Promise<TrainingModifications> {
  const supabase = getServiceClient();

  // Check cache first
  const cached = await getCachedInterpretation(userEmail, supabase);
  if (cached && !isExpired(cached.expiresAt)) {
    console.log('[HealthInterpreter] Using cached interpretation');
    return cached;
  }

  // No relevant health data? Return defaults
  if (!hasRelevantHealthData(healthContext)) {
    console.log('[HealthInterpreter] No health data available, using defaults');
    return getDefaultTrainingModifications();
  }

  // Call AI for interpretation
  console.log('[HealthInterpreter] Generating new interpretation via AI...');
  const modifications = await callAIForInterpretation(healthContext);

  // Add metadata
  const fullModifications: TrainingModifications = {
    ...modifications,
    dataSourcesUsed: getDataSourcesUsed(healthContext),
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  // Cache for 24 hours
  await cacheInterpretation(userEmail, fullModifications, supabase);

  return fullModifications;
}

// ==================== AI CALL ====================

async function callAIForInterpretation(
  healthContext: UnifiedHealthContext
): Promise<Omit<TrainingModifications, 'dataSourcesUsed' | 'generatedAt' | 'expiresAt'>> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const userPrompt = `Analyze this health context and provide training modifications:

${JSON.stringify(healthContext, null, 2)}

Return ONLY a JSON object with the training modifications.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: HEALTH_INTERPRETATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistent interpretations
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('[HealthInterpreter] Empty response from AI');
      return getDefaultTrainingModifications();
    }

    const parsed = JSON.parse(content);
    return validateAndNormalizeModifications(parsed);
  } catch (error) {
    console.error('[HealthInterpreter] AI call failed:', error);
    return getDefaultTrainingModifications();
  }
}

function validateAndNormalizeModifications(
  raw: Record<string, unknown>
): Omit<TrainingModifications, 'dataSourcesUsed' | 'generatedAt' | 'expiresAt'> {
  return {
    volumeAdjustment: clamp(Number(raw.volumeAdjustment) || 0, -30, 10),
    intensityAdjustment: clamp(Number(raw.intensityAdjustment) || 0, -30, 10),
    avoidHighIntensity: Boolean(raw.avoidHighIntensity),
    prioritizeRecovery: Boolean(raw.prioritizeRecovery),
    skipTrainingToday: Boolean(raw.skipTrainingToday),
    extraRestDays: clamp(Number(raw.extraRestDays) || 0, 0, 2),
    maxTrainingDays: raw.maxTrainingDays !== null && raw.maxTrainingDays !== undefined
      ? clamp(Number(raw.maxTrainingDays), 2, 7)
      : null,
    muscleGroupModifiers: validateMuscleGroupModifiers(raw.muscleGroupModifiers),
    avoidExerciseTypes: validateExerciseTypes(raw.avoidExerciseTypes),
    prioritizeExerciseTypes: validateExerciseTypes(raw.prioritizeExerciseTypes),
    reasoningSummary: String(raw.reasoningSummary || 'No specific concerns detected'),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function validateMuscleGroupModifiers(
  raw: unknown
): TrainingModifications['muscleGroupModifiers'] {
  if (!raw || typeof raw !== 'object') return {};

  const validated: TrainingModifications['muscleGroupModifiers'] = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value && typeof value === 'object') {
      const mod = value as Record<string, unknown>;
      validated[key] = {
        avoid: Boolean(mod.avoid),
        reduceVolume: mod.reduceVolume !== undefined ? clamp(Number(mod.reduceVolume), 0, 100) : undefined,
        reason: mod.reason ? String(mod.reason) : undefined,
      };
    }
  }
  return validated;
}

const VALID_EXERCISE_TYPES: ExerciseType[] = [
  'weightTraining', 'hiit', 'cardio', 'yoga', 'pilates', 'calisthenics', 'crossfit', 'running'
];

function validateExerciseTypes(raw: unknown): ExerciseType[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is ExerciseType => VALID_EXERCISE_TYPES.includes(t as ExerciseType));
}

// ==================== CACHING ====================

interface CachedInterpretation extends TrainingModifications {
  id: string;
  user_email: string;
}

async function getCachedInterpretation(
  userEmail: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<TrainingModifications | null> {
  try {
    const { data, error } = await supabase
      .from('forge_health_interpretations')
      .select('*')
      .eq('user_email', userEmail)
      .maybeSingle();

    if (error || !data) return null;

    const modifications = data.modifications as TrainingModifications;
    return {
      ...modifications,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    console.error('[HealthInterpreter] Cache read error:', error);
    return null;
  }
}

async function cacheInterpretation(
  userEmail: string,
  modifications: TrainingModifications,
  supabase: ReturnType<typeof getServiceClient>
): Promise<void> {
  try {
    await supabase
      .from('forge_health_interpretations')
      .upsert({
        user_email: userEmail,
        modifications,
        data_sources_used: modifications.dataSourcesUsed,
        expires_at: modifications.expiresAt,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email',
      });
  } catch (error) {
    console.error('[HealthInterpreter] Cache write error:', error);
    // Non-fatal - continue without caching
  }
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

// ==================== HELPERS ====================

function getDataSourcesUsed(context: UnifiedHealthContext): string[] {
  const sources: string[] = [];

  if (context.bloodBiomarkers?.available) sources.push('blood_biomarkers');
  if (context.recovery?.source) sources.push(context.recovery.source);
  if (context.sleep?.source) sources.push(`${context.sleep.source}_sleep`);
  if (context.glucose?.source) sources.push(context.glucose.source);
  if (context.activity?.source) sources.push(`${context.activity.source}_activity`);

  return [...new Set(sources)]; // Remove duplicates
}

/**
 * Force refresh the cached interpretation
 * Use when user's health data has significantly changed
 */
export async function refreshHealthInterpretation(
  userEmail: string,
  healthContext: UnifiedHealthContext
): Promise<TrainingModifications> {
  const supabase = getServiceClient();

  // Delete existing cache
  await supabase
    .from('forge_health_interpretations')
    .delete()
    .eq('user_email', userEmail);

  // Generate new interpretation
  return interpretHealthForTraining(healthContext, userEmail);
}
