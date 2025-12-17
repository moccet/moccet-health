/**
 * Forge Multi-Agent Orchestrator
 *
 * Coordinates all specialized agents to generate a complete fitness plan.
 * This replaces the monolithic GPT-5 approach with a cost-effective
 * multi-agent architecture.
 *
 * Cost: ~$0.10-0.20 per plan (down from ~$3.50)
 *
 * Pipeline:
 * 1. Coordinator (GPT-4o-mini) → Athlete Profile Card
 * 2. Program Designer (GPT-4o) → Training Philosophy + Weekly Structure
 * 3. Exercise Prescriber (GPT-4o-mini) → Full Weekly Program
 * 4. Form Coach (GPT-4o-mini) → Polish exercises with coaching cues
 * 5. Recovery Scientist (GPT-4o-mini) → Recovery + Injury Prevention
 * 6. Nutrition Coach (GPT-4o-mini) → Nutrition + Supplements
 * 7. Chief Coach (GPT-4o) → Executive Summary + Cross-references
 */

import { runCoordinatorAgent } from './agents/coordinator-agent';
import { runProgramDesigner, getFallbackProgramDesign } from './agents/training/program-designer';
import { runExercisePrescriber, ExercisePrescriberInput } from './agents/training/exercise-prescriber';
import { runFormCoach, FormCoachInput } from './agents/training/form-coach';
import { runRecoveryScientist } from './agents/recovery-scientist';
import { runNutritionCoach } from './agents/nutrition-coach';
import { runChiefCoach, ChiefCoachInput } from './agents/chief-coach';
import { validateForgePlan, repairPlan } from './validators/plan-validator';
import { CoordinatorInput } from './types/athlete-profile';
import {
  ForgeFitnessPlan,
  ProgramDesignerOutput,
  FormCoachOutput,
  RecoveryScientistOutput,
  NutritionCoachOutput,
  ChiefCoachOutput,
} from './types/plan-output';
import { AthleteProfileCard } from './types/athlete-profile';

// ============================================================================
// ORCHESTRATOR INPUT TYPES
// ============================================================================

export interface ForgeOrchestratorInput {
  onboardingData: Record<string, unknown>;
  bloodAnalysis?: Record<string, unknown>;
  ecosystemData?: Record<string, unknown>;
  inferenceOutputs?: Record<string, unknown>;
}

export interface ForgeOrchestratorResult {
  success: boolean;
  plan?: ForgeFitnessPlan;
  error?: string;
  metadata: {
    totalDurationMs: number;
    costs: {
      coordinator: number;
      programDesigner: number;
      exercisePrescriber: number;
      formCoach: number;
      recoveryScientist: number;
      nutritionCoach: number;
      chiefCoach: number;
      total: number;
    };
    validation: {
      valid: boolean;
      errorCount: number;
      warningCount: number;
    };
    athleteProfile?: AthleteProfileCard;
  };
}

// ============================================================================
// COST TRACKING (estimated)
// ============================================================================

const ESTIMATED_COSTS = {
  coordinator: 0.001,
  programDesigner: 0.03,
  exercisePrescriber: 0.008,
  formCoach: 0.003,
  recoveryScientist: 0.005,
  nutritionCoach: 0.005,
  chiefCoach: 0.045,
};

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export async function generateForgePlan(
  input: ForgeOrchestratorInput
): Promise<ForgeOrchestratorResult> {
  const startTime = Date.now();

  console.log('[Forge Orchestrator] Starting plan generation...');
  console.log('[Forge Orchestrator] Input has blood analysis:', !!input.bloodAnalysis);
  console.log('[Forge Orchestrator] Input has ecosystem data:', !!input.ecosystemData);

  const costs = { ...ESTIMATED_COSTS, total: 0 };
  costs.total = Object.values(ESTIMATED_COSTS).reduce((a, b) => a + b, 0);

  try {
    // ========================================================================
    // PHASE 1: Data Preparation
    // ========================================================================
    console.log('[Forge Orchestrator] Phase 1: Data Preparation');

    const coordinatorInput: CoordinatorInput = {
      onboardingData: input.onboardingData,
      bloodAnalysis: input.bloodAnalysis,
      ecosystemData: input.ecosystemData,
      inferenceOutputs: input.inferenceOutputs,
    };

    const coordinatorResult = await runCoordinatorAgent(coordinatorInput);
    const { athleteProfile } = coordinatorResult;

    console.log(`[Forge Orchestrator] Athlete: ${athleteProfile.profile.firstName}`);
    console.log(`[Forge Orchestrator] Goal: ${athleteProfile.profile.primaryGoal}`);
    console.log(`[Forge Orchestrator] Training days: ${athleteProfile.profile.trainingDays}`);

    // ========================================================================
    // PHASE 2: Parallel Generation (Training + Recovery + Nutrition)
    // ========================================================================
    console.log('[Forge Orchestrator] Phase 2: Parallel Agent Execution');

    // Training is a sequential sub-pipeline
    const trainingPipeline = async (): Promise<{
      programDesign: ProgramDesignerOutput;
      training: FormCoachOutput;
    }> => {
      // Step 2a: Program Designer (GPT-4o)
      console.log('[Forge Orchestrator] Running Program Designer...');
      let programDesign: ProgramDesignerOutput;
      try {
        programDesign = await runProgramDesigner(athleteProfile);
      } catch (error) {
        console.warn('[Forge Orchestrator] Program Designer failed, using fallback');
        programDesign = getFallbackProgramDesign(athleteProfile);
      }

      // Step 2b: Exercise Prescriber (GPT-4o-mini)
      console.log('[Forge Orchestrator] Running Exercise Prescriber...');
      const exerciseInput: ExercisePrescriberInput = {
        athleteProfile,
        programDesign,
      };
      const exerciseResult = await runExercisePrescriber(exerciseInput);

      // Step 2c: Form Coach (GPT-4o-mini)
      console.log('[Forge Orchestrator] Running Form Coach...');
      const formInput: FormCoachInput = {
        athleteProfile,
        weeklyProgram: exerciseResult.weeklyProgram,
      };
      const training = await runFormCoach(formInput);

      return { programDesign, training };
    };

    // Recovery Scientist (parallel)
    const recoveryPipeline = async (): Promise<RecoveryScientistOutput> => {
      console.log('[Forge Orchestrator] Running Recovery Scientist...');
      return await runRecoveryScientist(athleteProfile);
    };

    // Nutrition Coach (parallel)
    const nutritionPipeline = async (): Promise<NutritionCoachOutput> => {
      console.log('[Forge Orchestrator] Running Nutrition Coach...');
      return await runNutritionCoach(athleteProfile);
    };

    // Execute all three pipelines in parallel
    const [trainingResult, recovery, nutrition] = await Promise.all([
      trainingPipeline(),
      recoveryPipeline(),
      nutritionPipeline(),
    ]);

    const { programDesign, training } = trainingResult;

    // ========================================================================
    // PHASE 3: Final Assembly (Chief Coach)
    // ========================================================================
    console.log('[Forge Orchestrator] Phase 3: Final Assembly');

    const chiefInput: ChiefCoachInput = {
      athleteProfile,
      programDesign,
      training,
      recovery,
      nutrition,
    };

    const chiefOutput = await runChiefCoach(chiefInput);

    // ========================================================================
    // PHASE 4: Assemble Final Plan
    // ========================================================================
    console.log('[Forge Orchestrator] Phase 4: Assembling Final Plan');

    const plan = assembleFinalPlan({
      athleteProfile,
      programDesign,
      training,
      recovery,
      nutrition,
      chiefOutput,
    });

    // ========================================================================
    // PHASE 5: Validation
    // ========================================================================
    console.log('[Forge Orchestrator] Phase 5: Validation');

    let finalPlan = plan;
    const validationResult = validateForgePlan(plan);

    if (!validationResult.valid) {
      console.warn(`[Forge Orchestrator] Plan has ${validationResult.errors.length} validation errors`);
      console.warn('[Forge Orchestrator] Attempting repair...');

      // Attempt repair
      const repaired = repairPlan(plan as unknown as Record<string, unknown>);
      const revalidation = validateForgePlan(repaired);

      if (revalidation.valid) {
        console.log('[Forge Orchestrator] Plan repaired successfully');
        finalPlan = repaired as unknown as ForgeFitnessPlan;
      } else {
        console.warn('[Forge Orchestrator] Plan could not be fully repaired');
        // Log remaining errors for debugging
        revalidation.errors.forEach(err => {
          console.warn(`  - ${err.field}: ${err.message}`);
        });
      }
    }

    // Log stats
    console.log(`[Forge Orchestrator] Plan stats:`);
    console.log(`  - Training days: ${validationResult.stats.trainingDays}`);
    console.log(`  - Rest days: ${validationResult.stats.restDays}`);
    console.log(`  - Total exercises: ${validationResult.stats.totalExercises}`);
    console.log(`  - Exercises with weights: ${validationResult.stats.exercisesWithWeights}`);

    const totalDurationMs = Date.now() - startTime;
    console.log(`[Forge Orchestrator] Plan generation complete in ${totalDurationMs}ms`);
    console.log(`[Forge Orchestrator] Estimated cost: $${costs.total.toFixed(3)}`);

    return {
      success: true,
      plan: finalPlan,
      metadata: {
        totalDurationMs,
        costs,
        validation: {
          valid: validationResult.valid,
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length,
        },
        athleteProfile,
      },
    };
  } catch (error) {
    const totalDurationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error('[Forge Orchestrator] Plan generation failed:', errorMessage);

    return {
      success: false,
      error: errorMessage,
      metadata: {
        totalDurationMs,
        costs,
        validation: {
          valid: false,
          errorCount: 1,
          warningCount: 0,
        },
      },
    };
  }
}

// ============================================================================
// ASSEMBLE FINAL PLAN
// ============================================================================

interface AssembleInput {
  athleteProfile: AthleteProfileCard;
  programDesign: ProgramDesignerOutput;
  training: FormCoachOutput;
  recovery: RecoveryScientistOutput;
  nutrition: NutritionCoachOutput;
  chiefOutput: ChiefCoachOutput;
}

function assembleFinalPlan(input: AssembleInput): ForgeFitnessPlan {
  const {
    programDesign,
    training,
    recovery,
    nutrition,
    chiefOutput,
  } = input;

  // Merge cross-references into relevant sections
  const trainingPhilosophy = {
    ...programDesign.trainingPhilosophy,
    approach: addCrossReferences(
      programDesign.trainingPhilosophy.approach,
      chiefOutput.crossReferences.training
    ),
  };

  const recoveryProtocol = {
    ...recovery.recoveryProtocol,
    personalizedNotes: chiefOutput.crossReferences.recovery.length > 0
      ? `${recovery.recoveryProtocol.personalizedNotes || ''} ${chiefOutput.crossReferences.recovery.join(' ')}`.trim()
      : recovery.recoveryProtocol.personalizedNotes,
  };

  const nutritionGuidance = {
    ...nutrition.nutritionGuidance,
  };

  // Add cross-references to nutrition if it has a personalizedIntro
  if (typeof nutritionGuidance.personalizedIntro === 'string' && chiefOutput.crossReferences.nutrition.length > 0) {
    nutritionGuidance.personalizedIntro = addCrossReferences(
      nutritionGuidance.personalizedIntro,
      chiefOutput.crossReferences.nutrition
    );
  }

  return {
    personalizedGreeting: chiefOutput.personalizedGreeting,
    executiveSummary: chiefOutput.executiveSummary,
    trainingPhilosophy,
    weeklyStructure: programDesign.weeklyStructure,
    weeklyProgram: training.weeklyProgram,
    recoveryProtocol,
    supplementRecommendations: nutrition.supplementRecommendations,
    nutritionGuidance,
    progressTracking: recovery.progressTracking || {
      metricsOverview: 'Track your progress consistently to ensure you are moving toward your goals.',
      weeklyMetrics: ['Training volume', 'Energy levels', 'Sleep quality', 'Soreness levels'],
      monthlyMetrics: ['Body measurements', 'Progress photos', 'Performance benchmarks'],
      performanceBenchmarks: ['Push-ups to failure', 'Plank hold time', 'Main lift progress'],
      biometricTargets: 'Monitor resting heart rate and body composition if relevant to your goals.',
      reassessmentSchedule: 'Full program reassessment every 8-12 weeks.',
    },
    injuryPrevention: recovery.injuryPrevention || {
      personalizedRiskAssessment: 'Prevention is always better than cure. Listen to your body and maintain proper form.',
      commonRisks: ['Overuse injuries', 'Form breakdown when fatigued', 'Insufficient warm-up'],
      preventionStrategies: ['Always warm up', 'Stop sets before failure on compound exercises', 'Include mobility work'],
      warningSignals: ['Sharp pain during movement', 'Joint pain after warming up', 'Persistent fatigue'],
      injuryProtocol: 'If you experience pain, stop immediately and rest. Consult a healthcare professional if pain persists.',
      mobilityPrescription: 'Daily 10 minutes of targeted mobility work focusing on hips, thoracic spine, and shoulders.',
    },
    adaptiveFeatures: chiefOutput.adaptiveFeatures,
  };
}

/**
 * Adds cross-references naturally to text
 */
function addCrossReferences(text: string, references: string[]): string {
  if (references.length === 0) return text;

  // Add a connecting paragraph with cross-references
  const refParagraph = references
    .map(ref => ref.endsWith('.') ? ref : `${ref}.`)
    .join(' ');

  return `${text}\n\n${refParagraph}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { CoordinatorInput } from './types/athlete-profile';
export type { ChiefCoachInput } from './agents/chief-coach';
