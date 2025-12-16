/**
 * Forge Plan Validator
 *
 * Validates that the generated plan matches the UI expectations
 * in /forge/personalised-plan exactly. This catches issues before
 * the plan is saved to the database.
 */

import {
  ForgeFitnessPlan,
  MainExercise,
  DayWorkout,
  WeeklyProgram,
  REQUIRED_TOP_LEVEL_FIELDS,
  REQUIRED_EXERCISE_FIELDS,
  DAY_ORDER,
  DayKey,
} from '../types/plan-output';

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    totalExercises: number;
    trainingDays: number;
    restDays: number;
    exercisesWithWeights: number;
    exercisesMissingWeights: number;
  };
}

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

export function validateForgePlan(plan: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const stats = {
    totalExercises: 0,
    trainingDays: 0,
    restDays: 0,
    exercisesWithWeights: 0,
    exercisesMissingWeights: 0,
  };

  if (!plan || typeof plan !== 'object') {
    errors.push({
      field: 'root',
      message: 'Plan must be an object',
      severity: 'error',
    });
    return { valid: false, errors, warnings, stats };
  }

  const p = plan as Record<string, unknown>;

  // Check required top-level fields
  for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
    if (!(field in p) || p[field] === undefined || p[field] === null) {
      errors.push({
        field,
        message: `Missing required field: ${field}`,
        severity: 'error',
      });
    }
  }

  // Validate personalizedGreeting
  if (typeof p.personalizedGreeting !== 'string' || p.personalizedGreeting.length < 5) {
    errors.push({
      field: 'personalizedGreeting',
      message: 'personalizedGreeting must be a non-empty string',
      severity: 'error',
    });
  }

  // Validate executiveSummary
  if (typeof p.executiveSummary !== 'string' || p.executiveSummary.length < 100) {
    warnings.push({
      field: 'executiveSummary',
      message: 'executiveSummary should be at least 100 characters (2-3 paragraphs)',
      severity: 'warning',
    });
  }

  // Validate trainingPhilosophy
  if (p.trainingPhilosophy && typeof p.trainingPhilosophy === 'object') {
    const tp = p.trainingPhilosophy as Record<string, unknown>;
    if (!tp.approach || typeof tp.approach !== 'string') {
      errors.push({
        field: 'trainingPhilosophy.approach',
        message: 'trainingPhilosophy.approach is required',
        severity: 'error',
      });
    }
    if (!Array.isArray(tp.keyPrinciples) || tp.keyPrinciples.length === 0) {
      errors.push({
        field: 'trainingPhilosophy.keyPrinciples',
        message: 'trainingPhilosophy.keyPrinciples must be a non-empty array',
        severity: 'error',
      });
    }
    if (!tp.progressionStrategy || typeof tp.progressionStrategy !== 'string') {
      errors.push({
        field: 'trainingPhilosophy.progressionStrategy',
        message: 'trainingPhilosophy.progressionStrategy is required',
        severity: 'error',
      });
    }
  }

  // Validate weeklyStructure
  if (p.weeklyStructure && typeof p.weeklyStructure === 'object') {
    const ws = p.weeklyStructure as Record<string, unknown>;
    if (!ws.overview || typeof ws.overview !== 'string') {
      errors.push({
        field: 'weeklyStructure.overview',
        message: 'weeklyStructure.overview is required',
        severity: 'error',
      });
    }
    if (typeof ws.trainingDays !== 'number' || ws.trainingDays < 1 || ws.trainingDays > 7) {
      errors.push({
        field: 'weeklyStructure.trainingDays',
        message: 'weeklyStructure.trainingDays must be a number between 1 and 7',
        severity: 'error',
      });
    }
    if (!Array.isArray(ws.focusAreas) || ws.focusAreas.length === 0) {
      errors.push({
        field: 'weeklyStructure.focusAreas',
        message: 'weeklyStructure.focusAreas must be a non-empty array',
        severity: 'error',
      });
    }
  }

  // Validate weeklyProgram (CRITICAL)
  if (p.weeklyProgram && typeof p.weeklyProgram === 'object') {
    const wp = p.weeklyProgram as Record<string, unknown>;

    // Check all 7 days are present with lowercase keys
    for (const day of DAY_ORDER) {
      if (!(day in wp)) {
        errors.push({
          field: `weeklyProgram.${day}`,
          message: `Missing day: ${day} (must use lowercase keys)`,
          severity: 'error',
        });
      } else {
        // Validate each day
        const dayResult = validateDayWorkout(wp[day], day);
        errors.push(...dayResult.errors);
        warnings.push(...dayResult.warnings);

        // Update stats
        if (dayResult.isRestDay) {
          stats.restDays++;
        } else {
          stats.trainingDays++;
        }
        stats.totalExercises += dayResult.exerciseCount;
        stats.exercisesWithWeights += dayResult.exercisesWithWeights;
        stats.exercisesMissingWeights += dayResult.exercisesMissingWeights;
      }
    }

    // Check for uppercase keys (common mistake)
    for (const key of Object.keys(wp)) {
      if (key !== key.toLowerCase()) {
        errors.push({
          field: `weeklyProgram.${key}`,
          message: `Day keys must be lowercase: "${key}" should be "${key.toLowerCase()}"`,
          severity: 'error',
        });
      }
    }
  }

  // Validate adaptiveFeatures
  if (p.adaptiveFeatures && typeof p.adaptiveFeatures === 'object') {
    const af = p.adaptiveFeatures as Record<string, unknown>;
    if (!af.highEnergyDay) {
      warnings.push({
        field: 'adaptiveFeatures.highEnergyDay',
        message: 'adaptiveFeatures.highEnergyDay is recommended',
        severity: 'warning',
      });
    }
    if (!af.lowEnergyDay) {
      warnings.push({
        field: 'adaptiveFeatures.lowEnergyDay',
        message: 'adaptiveFeatures.lowEnergyDay is recommended',
        severity: 'warning',
      });
    }
    if (!af.travelAdjustments) {
      warnings.push({
        field: 'adaptiveFeatures.travelAdjustments',
        message: 'adaptiveFeatures.travelAdjustments is recommended',
        severity: 'warning',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

// ============================================================================
// DAY WORKOUT VALIDATOR
// ============================================================================

interface DayValidationResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  isRestDay: boolean;
  exerciseCount: number;
  exercisesWithWeights: number;
  exercisesMissingWeights: number;
}

function validateDayWorkout(day: unknown, dayName: string): DayValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  let exerciseCount = 0;
  let exercisesWithWeights = 0;
  let exercisesMissingWeights = 0;

  if (!day || typeof day !== 'object') {
    errors.push({
      field: `weeklyProgram.${dayName}`,
      message: `${dayName} must be an object`,
      severity: 'error',
    });
    return { errors, warnings, isRestDay: true, exerciseCount, exercisesWithWeights, exercisesMissingWeights };
  }

  const d = day as Record<string, unknown>;

  // Check if it's a rest day
  const isRestDay =
    (typeof d.focus === 'string' && d.focus.toLowerCase().includes('rest')) ||
    d.isRestDay === true ||
    (!d.mainWorkout && !d.warmup && !d.cooldown);

  // Required fields for all days
  if (!d.focus || typeof d.focus !== 'string') {
    errors.push({
      field: `weeklyProgram.${dayName}.focus`,
      message: `${dayName}.focus is required`,
      severity: 'error',
    });
  }

  if (!d.duration || typeof d.duration !== 'string') {
    errors.push({
      field: `weeklyProgram.${dayName}.duration`,
      message: `${dayName}.duration is required`,
      severity: 'error',
    });
  }

  // For training days, validate workout structure
  if (!isRestDay) {
    // Validate warmup
    if (!d.warmup || typeof d.warmup !== 'object') {
      errors.push({
        field: `weeklyProgram.${dayName}.warmup`,
        message: `${dayName}.warmup is required for training days`,
        severity: 'error',
      });
    } else {
      const warmup = d.warmup as Record<string, unknown>;
      if (!warmup.description || typeof warmup.description !== 'string') {
        warnings.push({
          field: `weeklyProgram.${dayName}.warmup.description`,
          message: `${dayName}.warmup.description is recommended`,
          severity: 'warning',
        });
      }
      if (!Array.isArray(warmup.exercises)) {
        errors.push({
          field: `weeklyProgram.${dayName}.warmup.exercises`,
          message: `${dayName}.warmup.exercises must be an array`,
          severity: 'error',
        });
      }
    }

    // Validate mainWorkout
    if (!Array.isArray(d.mainWorkout)) {
      errors.push({
        field: `weeklyProgram.${dayName}.mainWorkout`,
        message: `${dayName}.mainWorkout must be an array`,
        severity: 'error',
      });
    } else {
      const mainWorkout = d.mainWorkout as unknown[];
      exerciseCount = mainWorkout.length;

      if (mainWorkout.length === 0) {
        errors.push({
          field: `weeklyProgram.${dayName}.mainWorkout`,
          message: `${dayName}.mainWorkout must have at least one exercise`,
          severity: 'error',
        });
      }

      // Validate each exercise
      mainWorkout.forEach((exercise, idx) => {
        const exerciseResult = validateExercise(exercise, dayName, idx);
        errors.push(...exerciseResult.errors);
        warnings.push(...exerciseResult.warnings);
        if (exerciseResult.hasWeight) {
          exercisesWithWeights++;
        } else {
          exercisesMissingWeights++;
        }
      });
    }

    // Validate cooldown
    if (!d.cooldown || typeof d.cooldown !== 'object') {
      warnings.push({
        field: `weeklyProgram.${dayName}.cooldown`,
        message: `${dayName}.cooldown is recommended for training days`,
        severity: 'warning',
      });
    }
  }

  return { errors, warnings, isRestDay, exerciseCount, exercisesWithWeights, exercisesMissingWeights };
}

// ============================================================================
// EXERCISE VALIDATOR
// ============================================================================

interface ExerciseValidationResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  hasWeight: boolean;
}

function validateExercise(exercise: unknown, dayName: string, idx: number): ExerciseValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const fieldPrefix = `weeklyProgram.${dayName}.mainWorkout[${idx}]`;

  if (!exercise || typeof exercise !== 'object') {
    errors.push({
      field: fieldPrefix,
      message: `Exercise at index ${idx} must be an object`,
      severity: 'error',
    });
    return { errors, warnings, hasWeight: false };
  }

  const e = exercise as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_EXERCISE_FIELDS) {
    if (!(field in e) || !e[field] || typeof e[field] !== 'string') {
      // Weight is critical - always an error
      if (field === 'weight') {
        errors.push({
          field: `${fieldPrefix}.${field}`,
          message: `Exercise "${e.exercise || `at index ${idx}`}" is missing required field: ${field}. Weight must NEVER be empty.`,
          severity: 'error',
        });
      } else if (field === 'exercise' || field === 'sets' || field === 'reps') {
        errors.push({
          field: `${fieldPrefix}.${field}`,
          message: `Exercise at index ${idx} is missing required field: ${field}`,
          severity: 'error',
        });
      } else {
        warnings.push({
          field: `${fieldPrefix}.${field}`,
          message: `Exercise "${e.exercise || `at index ${idx}`}" is missing recommended field: ${field}`,
          severity: 'warning',
        });
      }
    }
  }

  // Check weight format
  const hasWeight = typeof e.weight === 'string' && e.weight.length > 0;
  if (hasWeight) {
    const weight = e.weight as string;
    // Check for common invalid values
    if (weight.toLowerCase() === 'undefined' || weight.toLowerCase() === 'null' || weight === '-') {
      errors.push({
        field: `${fieldPrefix}.weight`,
        message: `Invalid weight value "${weight}" for exercise "${e.exercise}". Use "Bodyweight", specific kg/lb, or "X% of max"`,
        severity: 'error',
      });
    }
  }

  // Check sets format (should include "sets")
  if (typeof e.sets === 'string' && !e.sets.toLowerCase().includes('set')) {
    warnings.push({
      field: `${fieldPrefix}.sets`,
      message: `Sets should include "sets" (e.g., "4 sets" not "4")`,
      severity: 'warning',
    });
  }

  // Check reps format (should include "reps")
  if (typeof e.reps === 'string' && !e.reps.toLowerCase().includes('rep')) {
    warnings.push({
      field: `${fieldPrefix}.reps`,
      message: `Reps should include "reps" (e.g., "8-10 reps" not "8-10")`,
      severity: 'warning',
    });
  }

  // Check tempo format (should be plain language, not notation)
  if (typeof e.tempo === 'string') {
    const tempo = e.tempo as string;
    if (/^\d+-\d+-\d+$/.test(tempo) || /^\d+-\d+-\d+-\d+$/.test(tempo)) {
      errors.push({
        field: `${fieldPrefix}.tempo`,
        message: `Tempo must be plain language (e.g., "Lower 2 sec, lift 1 sec") not notation like "${tempo}"`,
        severity: 'error',
      });
    }
  }

  // Check intensity format (should be plain language, not RPE)
  if (typeof e.intensity === 'string') {
    const intensity = e.intensity as string;
    if (/^RPE\s*\d+$/i.test(intensity)) {
      errors.push({
        field: `${fieldPrefix}.intensity`,
        message: `Intensity must be plain language (e.g., "Challenging but doable") not "${intensity}"`,
        severity: 'error',
      });
    }
  }

  // Check notes length (max 15 words)
  if (typeof e.notes === 'string') {
    const wordCount = e.notes.split(/\s+/).length;
    if (wordCount > 15) {
      warnings.push({
        field: `${fieldPrefix}.notes`,
        message: `Notes exceed 15 word limit (${wordCount} words)`,
        severity: 'warning',
      });
    }
  }

  // Check progressionNotes length (max 15 words)
  if (typeof e.progressionNotes === 'string') {
    const wordCount = e.progressionNotes.split(/\s+/).length;
    if (wordCount > 15) {
      warnings.push({
        field: `${fieldPrefix}.progressionNotes`,
        message: `Progression notes exceed 15 word limit (${wordCount} words)`,
        severity: 'warning',
      });
    }
  }

  return { errors, warnings, hasWeight };
}

// ============================================================================
// REPAIR HELPERS
// ============================================================================

/**
 * Attempts to repair common issues in the plan
 */
export function repairPlan(plan: Record<string, unknown>): Record<string, unknown> {
  const repaired = { ...plan };

  // Fix uppercase day keys
  if (repaired.weeklyProgram && typeof repaired.weeklyProgram === 'object') {
    const wp = repaired.weeklyProgram as Record<string, unknown>;
    const fixedWp: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(wp)) {
      fixedWp[key.toLowerCase()] = value;
    }

    repaired.weeklyProgram = fixedWp;
  }

  // Add missing dayName fields
  if (repaired.weeklyProgram && typeof repaired.weeklyProgram === 'object') {
    const wp = repaired.weeklyProgram as Record<string, Record<string, unknown>>;

    for (const day of DAY_ORDER) {
      if (wp[day] && !wp[day].dayName) {
        wp[day].dayName = day.charAt(0).toUpperCase() + day.slice(1);
      }
    }
  }

  return repaired;
}

/**
 * Quick check if plan is likely valid (for fast rejection)
 */
export function quickValidate(plan: unknown): boolean {
  if (!plan || typeof plan !== 'object') return false;

  const p = plan as Record<string, unknown>;

  return (
    typeof p.personalizedGreeting === 'string' &&
    typeof p.executiveSummary === 'string' &&
    p.trainingPhilosophy !== undefined &&
    p.weeklyStructure !== undefined &&
    p.weeklyProgram !== undefined
  );
}
