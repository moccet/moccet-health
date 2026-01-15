/**
 * Sage Orchestrator
 *
 * Main orchestration layer for the Sage multi-agent nutrition plan system.
 * Coordinates all specialized agents to produce a complete personalized
 * nutrition plan from user data.
 *
 * Cost Breakdown (per plan):
 * - Sage Coordinator (GPT-4o-mini): ~$0.001
 * - Biomarker Analyst (GPT-4o): ~$0.03
 * - Nutrition Architect (GPT-4o): ~$0.03
 * - Meal Planner (GPT-4o-mini): ~$0.015
 * - Recipe Enricher (GPT-4o-mini): ~$0.008
 * - Micronutrient Specialist (GPT-4o-mini): ~$0.005
 * - Lifestyle Integrator (GPT-4o-mini): ~$0.005
 * - Chief Nutritionist (GPT-4o): ~$0.045
 * Total: ~$0.15-0.20 per plan (vs ~$3.50 with GPT-5)
 */

import { SageCoordinatorInput, ClientProfileCard } from './types/client-profile';
import {
  SagePlanOutput,
  NutritionArchitectOutput,
  BiomarkerAnalystOutput,
  MealPlannerOutput,
  RecipeEnricherOutput,
  MicronutrientSpecialistOutput,
  LifestyleIntegratorOutput,
  ChiefNutritionistOutput,
} from './types/sage-plan-output';

// Agent imports
import { runSageCoordinator } from './agents/sage/coordinator-agent';
import { runNutritionArchitect } from './agents/sage/nutrition-architect';
import { runBiomarkerAnalyst } from './agents/sage/biomarker-analyst';
import { runMealPlanner, MealPlannerInput } from './agents/sage/meal-planner';
import { runRecipeEnricher, RecipeEnricherInput } from './agents/sage/recipe-enricher';
import { runMicronutrientSpecialist, MicronutrientSpecialistInput } from './agents/sage/micronutrient-specialist';
import { runLifestyleIntegrator } from './agents/sage/lifestyle-integrator';
import { runChiefNutritionist, ChiefNutritionistInput } from './agents/sage/chief-nutritionist';

// Validation
import { validateAndFixSagePlan } from './validators/sage-plan-validator';

// ============================================================================
// TYPES
// ============================================================================

export interface SageOrchestratorInput {
  onboardingData: Record<string, unknown>;
  bloodAnalysis?: Record<string, unknown>;
  ecosystemData?: Record<string, unknown>;
  inferenceOutputs?: Record<string, unknown>;
}

export interface SageOrchestratorOutput {
  plan: SagePlanOutput;
  metadata: {
    generatedAt: string;
    agentCosts: AgentCostBreakdown;
    validationResult: {
      isValid: boolean;
      errors: string[];
      warnings: string[];
      fixedFields: string[];
    };
  };
}

export interface AgentCostBreakdown {
  coordinator: number;
  nutritionArchitect: number;
  biomarkerAnalyst: number;
  mealPlanner: number;
  recipeEnricher: number;
  micronutrientSpecialist: number;
  lifestyleIntegrator: number;
  chiefNutritionist: number;
  total: number;
}

// ============================================================================
// COST ESTIMATES
// ============================================================================

const ESTIMATED_COSTS = {
  coordinator: 0.001,
  nutritionArchitect: 0.03,
  biomarkerAnalyst: 0.03,
  mealPlanner: 0.015,
  recipeEnricher: 0.008,
  micronutrientSpecialist: 0.005,
  lifestyleIntegrator: 0.005,
  chiefNutritionist: 0.045,
};

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

export async function runSageOrchestrator(
  input: SageOrchestratorInput
): Promise<SageOrchestratorOutput> {
  const startTime = Date.now();
  console.log('='.repeat(60));
  console.log('[Sage Orchestrator] Starting nutrition plan generation');
  console.log('='.repeat(60));

  // Track costs
  const costs: AgentCostBreakdown = {
    coordinator: 0,
    nutritionArchitect: 0,
    biomarkerAnalyst: 0,
    mealPlanner: 0,
    recipeEnricher: 0,
    micronutrientSpecialist: 0,
    lifestyleIntegrator: 0,
    chiefNutritionist: 0,
    total: 0,
  };

  // ========================================================================
  // PHASE 1: Data Preparation (Sage Coordinator)
  // ========================================================================
  console.log('\n[Phase 1] Data Preparation');
  console.log('-'.repeat(40));

  const coordinatorInput: SageCoordinatorInput = {
    onboardingData: input.onboardingData,
    bloodAnalysis: input.bloodAnalysis,
    ecosystemData: input.ecosystemData,
    inferenceOutputs: input.inferenceOutputs,
  };

  const coordinatorOutput = await runSageCoordinator(coordinatorInput);
  const clientProfile = coordinatorOutput.clientProfile;
  costs.coordinator = ESTIMATED_COSTS.coordinator;

  console.log(`[Sage Orchestrator] Client profile created for ${clientProfile.profile.firstName}`);
  console.log(`[Sage Orchestrator] Data sources: ${clientProfile.computedMetrics.primaryDataSources.join(', ')}`);

  // ========================================================================
  // PHASE 2: Parallel Analysis (Nutrition Architect, Biomarker Analyst, Lifestyle)
  // ========================================================================
  console.log('\n[Phase 2] Parallel Analysis');
  console.log('-'.repeat(40));

  // Run these in parallel
  const [nutritionFramework, biomarkerAnalysis, lifestyle] = await Promise.all([
    runNutritionArchitect(clientProfile),
    runBiomarkerAnalyst(clientProfile),
    runLifestyleIntegrator(clientProfile),
  ]);

  costs.nutritionArchitect = ESTIMATED_COSTS.nutritionArchitect;
  costs.biomarkerAnalyst = ESTIMATED_COSTS.biomarkerAnalyst;
  costs.lifestyleIntegrator = ESTIMATED_COSTS.lifestyleIntegrator;

  console.log('[Sage Orchestrator] Nutrition framework complete');
  console.log('[Sage Orchestrator] Biomarker analysis complete');
  console.log('[Sage Orchestrator] Lifestyle protocols complete');

  // ========================================================================
  // PHASE 3: Meal Generation + Micronutrients (Parallel optimization)
  // ========================================================================
  console.log('\n[Phase 3] Meal Plan + Micronutrients (Parallel)');
  console.log('-'.repeat(40));

  // Micronutrients only needs biomarkerAnalysis, so run it in parallel with meal plan
  const micronutrientInput: MicronutrientSpecialistInput = {
    clientProfile,
    biomarkerAnalysis,
  };

  // Meal planner needs nutrition framework and biomarker analysis
  const mealPlannerInput: MealPlannerInput = {
    clientProfile,
    nutritionFramework,
    biomarkerAnalysis,
  };

  // Run meal planner and micronutrients in parallel
  const [mealPlanResult, micronutrients] = await Promise.all([
    runMealPlanner(mealPlannerInput),
    runMicronutrientSpecialist(micronutrientInput),
  ]);

  costs.mealPlanner = ESTIMATED_COSTS.mealPlanner;
  costs.micronutrientSpecialist = ESTIMATED_COSTS.micronutrientSpecialist;

  console.log('[Sage Orchestrator] Meal plan skeleton complete');
  console.log('[Sage Orchestrator] Micronutrient recommendations complete');

  // Recipe enricher adds detailed ingredients and instructions (sequential - needs meal plan)
  const recipeEnricherInput: RecipeEnricherInput = {
    clientProfile,
    mealPlanSkeleton: mealPlanResult.sampleMealPlan,
  };

  const enrichedMealPlan = await runRecipeEnricher(recipeEnricherInput);
  costs.recipeEnricher = ESTIMATED_COSTS.recipeEnricher;

  console.log('[Sage Orchestrator] Recipe enrichment complete');

  // ========================================================================
  // PHASE 4: Final Assembly (Chief Nutritionist)
  // ========================================================================
  console.log('\n[Phase 4] Final Assembly');
  console.log('-'.repeat(40));

  const chiefInput: ChiefNutritionistInput = {
    clientProfile,
    nutritionFramework,
    biomarkerAnalysis,
    mealPlan: { sampleMealPlan: enrichedMealPlan.enrichedMealPlan },
    micronutrients,
    lifestyle,
  };

  const chiefOutput = await runChiefNutritionist(chiefInput);
  costs.chiefNutritionist = ESTIMATED_COSTS.chiefNutritionist;

  console.log('[Sage Orchestrator] Final assembly complete');

  // ========================================================================
  // PHASE 5: Assemble Final Plan
  // ========================================================================
  console.log('\n[Phase 5] Plan Assembly & Validation');
  console.log('-'.repeat(40));

  const rawPlan = assembleFinalPlan(
    clientProfile,
    nutritionFramework,
    biomarkerAnalysis,
    enrichedMealPlan,
    micronutrients,
    lifestyle,
    chiefOutput
  );

  // Validate and fix any issues
  const { plan: validatedPlan, validation } = validateAndFixSagePlan(rawPlan);

  // Calculate total cost
  costs.total = Object.values(costs).reduce((sum, cost) => sum + cost, 0) - costs.total;

  // Log completion
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('='.repeat(60));
  console.log(`[Sage Orchestrator] Plan generation complete`);
  console.log(`[Sage Orchestrator] Duration: ${duration}s`);
  console.log(`[Sage Orchestrator] Estimated cost: $${costs.total.toFixed(4)}`);
  console.log(`[Sage Orchestrator] Validation: ${validation.isValid ? 'PASSED' : 'ISSUES FOUND'}`);
  if (validation.warnings.length > 0) {
    console.log(`[Sage Orchestrator] Warnings: ${validation.warnings.length}`);
  }
  if (validation.fixedFields.length > 0) {
    console.log(`[Sage Orchestrator] Auto-fixed: ${validation.fixedFields.length} fields`);
  }
  console.log('='.repeat(60));

  return {
    plan: validatedPlan,
    metadata: {
      generatedAt: new Date().toISOString(),
      agentCosts: costs,
      validationResult: validation,
    },
  };
}

// ============================================================================
// ASSEMBLE FINAL PLAN
// ============================================================================

function assembleFinalPlan(
  clientProfile: ClientProfileCard,
  nutritionFramework: NutritionArchitectOutput,
  biomarkerAnalysis: BiomarkerAnalystOutput,
  enrichedMealPlan: RecipeEnricherOutput,
  micronutrients: MicronutrientSpecialistOutput,
  lifestyle: LifestyleIntegratorOutput,
  chiefOutput: ChiefNutritionistOutput
): SagePlanOutput {
  return {
    // Core Identity (from Chief Nutritionist)
    personalizedGreeting: chiefOutput.personalizedGreeting,
    executiveSummary: chiefOutput.executiveSummary,

    // Nutrition Core (from Nutrition Architect)
    nutritionPhilosophy: nutritionFramework.nutritionPhilosophy,
    nutritionOverview: nutritionFramework.nutritionOverview,
    dailyRecommendations: nutritionFramework.dailyRecommendations,

    // Micronutrients
    micronutrientFocus: micronutrients.micronutrientFocus,

    // Meal Planning (from Meal Planner + Recipe Enricher)
    sampleMealPlan: enrichedMealPlan.enrichedMealPlan,

    // Lifestyle (from Lifestyle Integrator)
    lifestyleIntegration: lifestyle.lifestyleIntegration,

    // Supplements (from Chief Nutritionist)
    supplementRecommendations: chiefOutput.supplementRecommendations,

    // Biomarkers (if available)
    biomarkerAnalysis: biomarkerAnalysis.biomarkerAnalysis,

    // Confidence/metadata
    confidenceTransparency: {
      overallConfidence: clientProfile.computedMetrics.dataConfidence,
      dataSources: clientProfile.computedMetrics.primaryDataSources,
    },
  };
}

// ============================================================================
// EXPORT FOR EXTERNAL USE
// ============================================================================

export type { SagePlanOutput } from './types/sage-plan-output';
export type { ClientProfileCard } from './types/client-profile';
