'use client';

import { useState, useEffect } from 'react';
import './personalised-plan.css';
import ShoppingCart from '@/components/ShoppingCart';

interface Biomarker {
  name: string;
  value: string;
  referenceRange: string;
  status: 'Optimal' | 'Excellent' | 'Good' | 'Normal' | 'Adequate' | 'Borderline' | 'High' | 'Low' | 'Needs Optimization';
  significance: string;
  implications: string;
}

interface BloodAnalysis {
  summary: string;
  biomarkers: Biomarker[];
  concerns: string[];
  positives: string[];
  recommendations: {
    lifestyle: string[];
    dietary: string[];
    supplements: string[];
    followUp: string[];
    retestTiming: string;
  };
  personalizedNotes?: string[];
}

interface NutritionPlan {
  personalizedGreeting: string;
  executiveSummary: string;
  nutritionOverview?: {
    goals: string[];
    nutritionStructure: {
      calories: string;
      protein: string;
      carbs: string;
      fiber: string;
      fat: string;
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dailyRecommendations?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  micronutrientFocus?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sampleMealPlan?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lifestyleIntegration?: any;
  preventiveFeatures?: string[];
}

interface FitnessPlan {
  personalizedGreeting: string;
  executiveSummary: string;
  trainingPhilosophy: {
    approach: string;
    keyPrinciples: Array<{principle: string; description: string}>;
    progressionStrategy: string;
  };
  weeklyStructure: {
    overview: string;
    trainingDays: number;
    focusAreas: string[];
    rationale?: string;
    volumeDistribution?: string;
    intensityFramework?: string;
  };
  sevenDayProgram?: {
    [key: string]: {
      dayName?: string;
      focus: string;
      duration: string;
      warmup: {
        description: string;
        exercises: Array<{
          name: string;
          sets: string;
          reps: string;
          notes: string;
        }>;
      };
      mainWorkout: Array<{
        exercise: string;
        sets: string;
        reps: string;
        rest: string;
        tempo: string;
        intensity: string;
        notes: string;
        progressionNotes: string;
      }>;
      cooldown: {
        description: string;
        exercises: Array<{
          name: string;
          duration: string;
          notes: string;
        }>;
      };
    };
  };
  weeklyProgram?: {
    [key: string]: {
      dayName?: string;
      focus: string;
      duration: string;
      warmup: {
        description: string;
        exercises: Array<{
          name: string;
          sets: string;
          reps: string;
          notes: string;
        }>;
      };
      mainWorkout: Array<{
        exercise: string;
        sets: string;
        reps: string;
        rest: string;
        tempo?: string;
        intensity: string;
        notes: string;
        progressionNotes?: string;
      }>;
      cooldown: {
        description: string;
        exercises: Array<{
          name: string;
          duration: string;
          notes: string;
        }>;
      };
    };
  };
  recoveryProtocol?: {
    personalizedIntro?: string;
    dailyPractices?: string[];
    weeklyPractices?: string[];
    sleepOptimization?: string;
    stressManagement?: string;
    mobilityWork?: string;
    activeRecovery?: string;
    personalizedNotes?: string;
  };
  supplementRecommendations?: {
    essential?: Array<{
      supplement: string;
      dosage: string;
      timing: string;
      rationale: string;
      duration: string;
    }>;
    optional?: Array<{
      supplement: string;
      dosage: string;
      timing: string;
      rationale: string;
      duration: string;
    }>;
    essentialSupplements?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
    }>;
    optionalSupplements?: Array<{
      name: string;
      dosage: string;
      timing: string;
      rationale: string;
      benefits?: string;
    }>;
    considerations?: string;
    personalizedNotes?: string;
  };
  nutritionGuidance: {
    personalizedIntro?: string;
    proteinTarget: string;
    calorieGuidance: string;
    mealTiming: string;
    hydration: string;
    macroBreakdown?: string;
    mealFrequency?: string;
    supplementTiming?: string;
  };
  progressTracking: {
    metricsOverview?: string;
    weeklyMetrics?: string[];
    monthlyMetrics?: string[];
    performanceBenchmarks?: string[];
    biometricTargets?: string;
    reassessmentSchedule?: string;
    progressionIndicators?: string;
    metrics?: string[]; // Old format
    benchmarks?: string[]; // Old format
    whenToReassess?: string; // Old format
  };
  injuryPrevention: {
    personalizedRiskAssessment?: string;
    commonRisks: string[];
    preventionStrategies: string[];
    warningSignals: string[];
    injuryProtocol?: string;
    mobilityPrescription?: string;
  };
  adaptiveFeatures: {
    energyBasedAdjustments?: string;
    highEnergyDay: string;
    normalEnergyDay?: string;
    lowEnergyDay: string;
    travelAdjustments: string;
    busyScheduleAdjustments?: string;
    scheduleAdaptations?: string;
    recoverStatus?: string;
    autoregulationGuidance?: string;
    readinessScoring?: string;
  };
}

function isNutritionPlan(plan: FitnessPlan | NutritionPlan): plan is NutritionPlan {
  return 'nutritionOverview' in plan;
}

function isFitnessPlan(plan: FitnessPlan | NutritionPlan): plan is FitnessPlan {
  // Check for either sevenDayProgram (old structure) or weeklyProgram (new structure) or new comprehensive structure
  return 'sevenDayProgram' in plan || 'weeklyProgram' in plan || 'trainingPhilosophy' in plan || 'training_plan' in plan || 'training_protocol' in plan;
}

export default function PersonalisedPlanPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planStatus, setPlanStatus] = useState<'queued' | 'processing' | 'completed' | 'failed' | 'unknown'>('unknown');
  const [plan, setPlan] = useState<FitnessPlan | NutritionPlan | null>(null);
  const [bloodAnalysis, setBloodAnalysis] = useState<BloodAnalysis | null>(null);
  const [loadingBloodAnalysis, setLoadingBloodAnalysis] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string | null>(null);

  // Supplement product enrichment
  const [enrichedEssentialSupplements, setEnrichedEssentialSupplements] = useState<any[]>([]);
  const [enrichedOptionalSupplements, setEnrichedOptionalSupplements] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [cartItemCount, setCartItemCount] = useState(0);

  // Enrich supplements with product data
  const enrichSupplements = async (supplements: any[], type: 'essential' | 'optional') => {
    if (!supplements || supplements.length === 0) return;

    setLoadingProducts(true);
    try {
      const response = await fetch('/api/supplements/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendations: supplements }),
      });

      const data = await response.json();
      if (data.success) {
        if (type === 'essential') {
          setEnrichedEssentialSupplements(data.recommendations);
        } else {
          setEnrichedOptionalSupplements(data.recommendations);
        }
      }
    } catch (error) {
      console.error('Error enriching supplements:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCartCount = async () => {
    const userIdentifier = email || `guest-${planCode}`;
    if (!userIdentifier) return;

    try {
      const response = await fetch(`/api/cart?email=${encodeURIComponent(userIdentifier)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('[Cart Badge] API Response:', data);
        setCartItemCount(data.cart?.itemCount || 0);
      }
    } catch (error) {
      console.error('Error fetching cart count:', error);
    }
  };

  // Add to cart handler
  const handleAddToCart = async (productId: string, supplementName: string, recommendation: any) => {
    // Use email if logged in, otherwise use planCode as identifier for guest checkout
    const userIdentifier = email || `guest-${planCode}`;

    setAddingToCart(productId);
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userIdentifier,
          productId,
          quantity: 1,
          planCode,
          recommendationContext: {
            supplementName,
            dosage: recommendation.dosage,
            timing: recommendation.timing,
            rationale: recommendation.rationale,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Trigger cart refresh by reloading the cart component
        window.dispatchEvent(new Event('cartUpdated'));
      } else {
        console.error('Error adding to cart:', data.error);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setAddingToCart(null);
    }
  };

  // Helper function to get the correct image path based on gender
  const getImagePath = (imageNumber: number): string => {
    const isFemale = gender?.toLowerCase() === 'female';

    if (isFemale) {
      // Map to female-specific images
      const femaleImages = [
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_barbe_05211cb1-f012-4763-bd3d-94f6ff51f62a.png', // Training
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_push__dfe579db-f247-4e76-97f4-f81d07bda077.png', // Workout program
        'studiosiraj_instructional_illustration_of_a_woman_doing_yoga_--_5fd75609-0566-48e3-bb4d-2e8f37c0bc0d.png', // Recovery
        'studiosiraj_instructional_illustration_of_a_woman_sprinting_--c_7c58aa6a-7612-4ccc-a9a1-0ed252c3aef6.png', // Progress tracking
        'studiosiraj_instructional_illustration_of_a_woman_legs_apart_el_c4cfa759-f6d3-4ae9-8e27-8fce4d8fe80f.png', // Injury prevention
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_barbe_b105ca49-3fdf-49b5-a330-7df6fbc57ca3.png', // Adaptive training
        'studiosiraj_instructional_illustration_of_a_woman_doing_a_barbe_05211cb1-f012-4763-bd3d-94f6ff51f62a.png', // Final
      ];
      return `/images/forge-female/${femaleImages[imageNumber - 1]}`;
    }

    // Default male/generic images
    const maleImages = [
      '152B53DF-AD96-42ED-BDB2-DA150D3FF857.png', // Training
      '15C867CC-152F-4E9B-81E6-ACF57A9C1F73.png', // Workout program
      '3E33A2E7-42C9-4E27-88F6-57AF1A54DD8D.png', // Recovery
      '8B4AB139-C742-440C-849F-7AE394A3A037.png', // Progress tracking
      '498BA8A7-59A9-485F-8481-AB1C2122C236.png', // Injury prevention
      '7C9557A4-F309-4837-A1AF-58B6D4BB3051.png', // Adaptive training
      'A89F1709-0CA0-4C39-A794-854DED0A76F8.png', // Final
    ];
    return `/images/forge/${maleImages[imageNumber - 1]}`;
  };

  useEffect(() => {
    // Get code or email from URL params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const emailParam = params.get('email');

    // Set email state
    setEmail(emailParam);

    // Use code parameter if available, otherwise use email parameter
    const identifier = code || emailParam;

    if (!identifier) {
      setError('No plan identifier provided');
      setLoading(false);
      return;
    }

    // Store the identifier type for API calls
    const paramName = code ? 'code' : 'email';

    // Fetch all data - blood analysis first, then meal plan (to optimize for biomarkers)
    const fetchAllData = async () => {
      try {
        // Step 0: Check plan status first
        const statusResponse = await fetch(`/api/plan-status?${paramName}=${encodeURIComponent(identifier)}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setPlanStatus(statusData.status);

          // If plan is still being generated, show waiting message
          if (statusData.status === 'queued' || statusData.status === 'processing') {
            setLoading(false);
            return; // Don't fetch plan data yet
          }

          // If plan failed, show error
          if (statusData.status === 'failed') {
            setError(statusData.error || 'Plan generation failed');
            setLoading(false);
            return;
          }

          // If no plan found and status is unknown, it might be an old plan without status
          // Continue to try fetching it
        }

        setLoadingBloodAnalysis(true);

        // Step 1: Fetch plan data (lightweight - just reads from database)
        const planResponse = await fetch(`/api/get-plan?${paramName}=${encodeURIComponent(identifier)}`);

        if (!planResponse.ok) {
          throw new Error('Failed to fetch plan');
        }

        // Get the raw text first to debug JSON parsing errors
        const rawText = await planResponse.text();
        console.log('[DEBUG] Raw response (first 500 chars):', rawText.substring(0, 500));

        let planData;
        try {
          planData = JSON.parse(rawText);
        } catch (jsonError) {
          console.error('[ERROR] Failed to parse JSON response:', jsonError);
          console.error('[ERROR] Raw response:', rawText);
          throw new Error(`Invalid JSON response from server: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
        }

        if (!planData.success) {
          throw new Error(planData.error || 'Plan not found');
        }

        // TRANSFORM THE PLAN FIRST before setting state
        // Check if we have the new comprehensive structure with nested plan OR top-level protocol data
        if (planData.plan?.plan?.training_protocol || planData.plan?.plan?.nutrition_protocol ||
            planData.plan?.training_program || planData.plan?.nutrition_program ||
            planData.plan?.sleep_recovery_protocol || planData.plan?.supplement_protocol ||
            (planData.plan?.weeklyProgram && !planData.plan?.personalizedGreeting)) {
          console.log('[PLAN TYPE] New comprehensive plan structure detected - transforming to legacy format...');

          // Transform the new comprehensive structure to match the old UI expectations
          const userName = planData.plan.user?.name || 'Your';

          // Executive summary will be set inline in transformedPlan object below

          // First spread all the original data as a base
          const baseData = {
            ...planData.plan,
            ...planData.plan.plan,
          };

          const transformedPlan = {
            ...baseData, // Include all original data first

            personalizedGreeting: `${userName} Comprehensive Health Plan`,
            // Use executiveSummary from specialized agent first, fallback to building from profile
            executiveSummary: planData.plan.executiveSummary || (() => {
              // Fallback: Try to build from user_profile or prioritized_objectives
              if (planData.plan.user_profile) {
                const profile = planData.plan.user_profile;
                let summary = '';
                if (profile.age && profile.gender) {
                  summary += `${profile.age}-year-old ${profile.gender}. `;
                }
                if (profile.goals || profile.primary_goals) {
                  summary += `Primary goals: ${(profile.goals || profile.primary_goals).join(', ')}. `;
                }
                if (profile.health_conditions || profile.conditions) {
                  summary += `Health focus: ${(profile.health_conditions || profile.conditions).join(', ')}. `;
                }
                if (summary) return summary;
              }
              if (planData.plan.prioritized_objectives) {
                return `Focus areas: ${planData.plan.prioritized_objectives.slice(0, 3).join(', ')}.`;
              }
              // Final fallback if no data available
              return 'Comprehensive health and fitness plan tailored to your biomarkers and health data.';
            })(),

            // Use trainingPhilosophy from specialized agent first, fallback to base plan transformation
            trainingPhilosophy: planData.plan.trainingPhilosophy || {
              approach: planData.plan.plan?.training_protocol?.recommendations?.[0]?.causal_rationale ||
                        planData.plan.training_protocol?.recommendations?.[0]?.causal_rationale ||
                        planData.plan.training_program?.approach ||
                        undefined,
              keyPrinciples: (planData.plan.plan?.training_protocol?.recommendations ||
                             planData.plan.training_protocol?.recommendations ||
                             planData.plan.training_program?.key_principles || []).map((rec: any) => ({
                principle: rec.name || rec.title || '',
                description: `${rec.intensity || ''}\n${rec.causal_rationale || rec.description || ''}`.trim()
              })),
              progressionStrategy: (() => {
                const rules = planData.plan.plan?.training_protocol?.progression_rules_week_3_plus ||
                             planData.plan.training_protocol?.progression_rules_week_3_plus ||
                             planData.plan.training_program?.progression_strategy;
                if (typeof rules === 'string') return rules;
                if (Array.isArray(rules)) {
                  // Format array of rules as readable text
                  return rules.map((rule: any, idx: number) =>
                    `Rule ${idx + 1}: ${rule.rule || rule.description || JSON.stringify(rule)}`
                  ).join('\n\n');
                }
                if (typeof rules === 'object' && rules !== null) {
                  // Format object rules as readable text
                  return Object.entries(rules).map(([key, value]) =>
                    `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`
                  ).join('\n\n');
                }
                return undefined;
              })()
            },

            // Use weeklyStructure from specialized agent first, fallback to base plan transformation
            weeklyStructure: planData.plan.weeklyStructure || {
              overview: planData.plan.plan?.training_protocol?.phase ||
                       planData.plan.training_protocol?.phase ||
                       planData.plan.training_program?.overview ||
                       undefined,
              trainingDays: planData.plan.plan?.training_protocol?.recommendations?.[0]?.frequency_per_week ||
                           planData.plan.training_protocol?.recommendations?.[0]?.frequency_per_week ||
                           planData.plan.training_program?.training_days || 3,
              focusAreas: (planData.plan.plan?.training_protocol?.recommendations ||
                          planData.plan.training_protocol?.recommendations ||
                          planData.plan.training_program?.focus_areas || []).map((rec: any) => rec.name || rec),
              rationale: (() => {
                const summary = planData.plan.data_summary;
                if (typeof summary === 'string') return summary;
                if (typeof summary === 'object' && summary !== null) {
                  // Format data summary object as readable text
                  const available = summary.available || {};
                  const notAvailable = summary.not_available || {};
                  let text = '';

                  if (available.conditions) {
                    text += `Health Conditions: ${Array.isArray(available.conditions) ? available.conditions.join(', ') : available.conditions}\n\n`;
                  }
                  if (available.demographics) {
                    text += `Demographics: ${Array.isArray(available.demographics) ? available.demographics.join(', ') : JSON.stringify(available.demographics)}\n\n`;
                  }
                  if (Object.keys(notAvailable).length > 0) {
                    text += `Data not available: ${Object.keys(notAvailable).join(', ')}`;
                  }

                  return text.trim() || undefined;
                }
                return undefined;
              })(),
              volumeDistribution: (planData.plan.plan?.training_protocol?.recommendations ||
                                  planData.plan.training_protocol?.recommendations || []).map((rec: any) =>
                `${rec.name}: ${rec.frequency_per_week || rec.frequency_per_day || ''} sessions`
              ).join('\n') || '',
              intensityFramework: undefined
            },

            // Use nutrition guidance from specialized agent, with field transformations for display
            nutritionGuidance: planData.plan.nutritionGuidance ? {
              ...planData.plan.nutritionGuidance,
              // Add simple string versions for Protein Target and Calorie Guidance
              proteinTarget: planData.plan.nutritionGuidance.proteinTarget ||
                (planData.plan.nutritionGuidance.macronutrients?.protein ?
                  `${planData.plan.nutritionGuidance.macronutrients.protein.grams}g/day (${planData.plan.nutritionGuidance.macronutrients.protein.rationale || 'optimized for recovery'})` :
                  undefined),
              calorieGuidance: planData.plan.nutritionGuidance.calorieGuidance ||
                (planData.plan.nutritionGuidance.dailyCalories ?
                  `${planData.plan.nutritionGuidance.dailyCalories.target} | Protein: ${planData.plan.nutritionGuidance.macronutrients?.protein?.grams || '?'}g | Carbs: ${planData.plan.nutritionGuidance.macronutrients?.carbohydrates?.grams || '?'}g | Fat: ${planData.plan.nutritionGuidance.macronutrients?.fats?.grams || '?'}g` :
                  undefined),
              // Convert hydration object to string if needed
              hydration: typeof planData.plan.nutritionGuidance.hydration === 'string' ?
                planData.plan.nutritionGuidance.hydration :
                (planData.plan.nutritionGuidance.hydration?.baselineDaily ?
                  `${planData.plan.nutritionGuidance.hydration.baselineDaily} daily, ${planData.plan.nutritionGuidance.hydration.duringTraining || '500-750ml/hour during training'}` :
                  planData.plan.nutritionGuidance.hydration)
            } : undefined,

            // Use progress tracking and injury prevention directly from specialized recovery agent
            progressTracking: planData.plan.progressTracking || undefined,
            injuryPrevention: planData.plan.injuryPrevention || undefined,

            // Use adaptive features directly from specialized adaptation agent
            adaptiveFeatures: planData.plan.adaptiveFeatures || undefined,

            // Use weekly program directly from specialized training agent
            weeklyProgram: planData.plan.weeklyProgram || undefined,
            sevenDayProgram: planData.plan.weeklyProgram || planData.plan.sevenDayProgram || undefined,

            // Recovery protocol - build from base plan data if not provided by specialized agent
            recoveryProtocol: planData.plan.recoveryProtocol || (baseData.sleep_recovery ? {
              dailyPractices: baseData.sleep_recovery.protocol?.filter((p: string) =>
                p.includes('Morning') || p.includes('Evening') || p.includes('daily')
              ) || ['Morning: 10-20 min outdoor light exposure', 'Evening: Dim lights 90 min before bed'],
              weeklyPractices: ['Track sleep duration and quality', 'Monitor recovery metrics'],
              sleepOptimization: baseData.sleep_recovery.protocol?.join('. ') ||
                `Target: ${baseData.sleep_recovery.targets?.time_in_bed_hours || '7-9'} hours per night`,
              stressManagement: 'Practice breathing exercises and stress management techniques',
              mobilityWork: 'Include daily mobility and stretching work'
            } : undefined),

            // Use supplement recommendations from orchestrator OR extract from nutritionGuidance for older plans
            supplementRecommendations: planData.plan.supplementRecommendations || (planData.plan.nutritionGuidance?.supplements ? {
              essentialSupplements: planData.plan.nutritionGuidance.supplements.filter((s: any) =>
                ['Omega-3', 'EPA/DHA', 'Fish Oil', 'Vitamin D', 'Vitamin D3', 'Magnesium'].some(name =>
                  s.name.includes(name)
                )
              ),
              optionalSupplements: planData.plan.nutritionGuidance.supplements.filter((s: any) =>
                !['Omega-3', 'EPA/DHA', 'Fish Oil', 'Vitamin D', 'Vitamin D3', 'Magnesium'].some(name =>
                  s.name.includes(name)
                )
              )
            } : undefined),

            // Add additional nutrition/health protocol references
            nutritionProtocol: planData.plan.plan?.nutrition_protocol || planData.plan.nutrition_protocol || baseData.nutrition,
            lipidManagement: planData.plan.plan?.lipid_management_protocol || planData.plan.lipid_management_protocol,
            sleepRecovery: planData.plan.plan?.sleep_recovery_protocol || planData.plan.sleep_recovery_protocol || baseData.sleep_recovery,
            bloodPressureManagement: planData.plan.plan?.blood_pressure_management_protocol || planData.plan.blood_pressure_management_protocol,
          };

          planData.plan = transformedPlan;
          console.log('[PLAN DEBUG] Transformed plan to legacy format');
          console.log('[PLAN DEBUG] Has trainingPhilosophy now:', !!planData.plan.trainingPhilosophy);
          console.log('[PLAN DEBUG] Has recoveryProtocol:', !!planData.plan.recoveryProtocol);
          console.log('[PLAN DEBUG] Has nutritionGuidance:', !!planData.plan.nutritionGuidance);
          console.log('[PLAN DEBUG] Has supplementRecommendations:', !!planData.plan.supplementRecommendations);
          console.log('[PLAN DEBUG] Has adaptiveFeatures:', !!planData.plan.adaptiveFeatures);
          console.log('[PLAN DEBUG] Raw plan keys:', Object.keys(planData.plan).slice(0, 20));
          console.log('[PLAN DEBUG] sleep_recovery_protocol:', planData.plan.sleep_recovery_protocol);
          console.log('[PLAN DEBUG] supplement_protocol:', planData.plan.supplement_protocol);
          console.log('[PLAN DEBUG] nutrition_program:', planData.plan.nutrition_program);
          console.log('[PLAN DEBUG] nutritionGuidance:', planData.plan.nutritionGuidance);
          console.log('[PLAN DEBUG] adaptiveFeatures:', planData.plan.adaptiveFeatures);
          console.log('[PLAN DEBUG] weeklyProgram:', planData.plan.weeklyProgram);
        }

        // NOW Set plan data after transformation
        console.log('[PLAN DEBUG] Setting plan state...');
        console.log('[PLAN DEBUG] Plan has personalizedGreeting:', !!planData.plan?.personalizedGreeting);
        console.log('[PLAN DEBUG] Plan has executiveSummary:', !!planData.plan?.executiveSummary);
        console.log('[PLAN DEBUG] Plan has trainingPhilosophy:', !!planData.plan?.trainingPhilosophy);
        console.log('[PLAN DEBUG] isFitnessPlan result:', isFitnessPlan(planData.plan));
        console.log('[NUTRITION CHECK]', planData.plan?.nutritionGuidance);
        console.log('[WEEKLY PROGRAM CHECK]', planData.plan?.weeklyProgram);
        console.log('[PLAN KEYS]', Object.keys(planData.plan || {}));
        setPlan(planData.plan);
        setPlanStatus(planData.status || 'completed');
        setGender(planData.gender || null);
        setPlanCode(code || null);

        // Extract and set email from API response if not already set
        if (!email && planData.email) {
          setEmail(planData.email);
          console.log('[Email] Extracted from plan data:', planData.email);
        }

        console.log('[PLAN DEBUG] All state set');

        // Enrich supplements with product data if this is a fitness plan
        if (planData.plan?.supplementRecommendations) {
          const essential = planData.plan.supplementRecommendations.essentialSupplements ||
                           planData.plan.supplementRecommendations.essential || [];
          const optional = planData.plan.supplementRecommendations.optionalSupplements ||
                          planData.plan.supplementRecommendations.optional || [];

          if (essential.length > 0) {
            enrichSupplements(essential, 'essential');
          }
          if (optional.length > 0) {
            enrichSupplements(optional, 'optional');
          }
        }

        // Set blood analysis if available
        if (planData.bloodAnalysis) {
          setBloodAnalysis(planData.bloodAnalysis);
          console.log('[Blood Analysis] Loaded from database:', planData.bloodAnalysis);
        }

        setLoadingBloodAnalysis(false);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load your personalized plan');
        setLoadingBloodAnalysis(false);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // Fetch cart count on mount and when cart updates
  useEffect(() => {
    if (email || planCode) {
      fetchCartCount();
    }

    // Listen for cart updates
    const handleCartUpdate = () => {
      fetchCartCount();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
    };
  }, [email, planCode]);

  if (loading) {
    return (
      <div className="plan-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#1a1a1a'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 300,
            color: '#000000',
            marginBottom: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
          }}>
            loading forge plan
          </div>
          <div style={{
            width: '200px',
            height: '2px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '1px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: '#ffffff',
              animation: 'loading 1.5s ease-in-out infinite'
            }}></div>
          </div>
        </div>
        <style>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  // Show waiting message if plan is still being generated
  if (planStatus === 'queued' || planStatus === 'processing') {
    return (
      <div className="plan-loading" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#1a1a1a',
        padding: '20px',
        position: 'relative'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 24px',
            border: '3px solid rgba(255,255,255,0.1)',
            borderTop: '3px solid #e5e5e5',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <h2 style={{
            fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '32px',
            marginBottom: '16px',
            color: '#000000',
            fontWeight: 400,
            letterSpacing: '0.3px'
          }}>
            your plan is being generated.
          </h2>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        {/* Footer text with email notification */}
        <div style={{
          position: 'fixed',
          bottom: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: '16px',
          fontWeight: 400,
          color: '#000000',
          letterSpacing: '0.3px'
        }}>
          This typically takes 5-15 minutes. You&apos;ll receive an email at {email || 'your email'} when your plan is ready.
        </div>

        {/* Brand footer */}
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
          fontSize: '18px',
          fontWeight: 500,
          fontStretch: 'expanded',
          color: '#000000',
          letterSpacing: '0.5px'
        }}>
          forge
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="plan-error" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        textAlign: 'center',
        background: '#1a1a1a'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '16px', color: '#000000' }}>Unable to Load Plan</h1>
        <p style={{ fontSize: '18px', marginBottom: '24px', color: '#000000', maxWidth: '600px' }}>
          {error.includes('No plan found') || error.includes('Failed to fetch plan')
            ? 'Your plan is currently being generated. This typically takes 5-15 minutes. Please check your email for a notification when your plan is ready, or try refreshing this page in a few minutes.'
            : error
          }
        </p>
        <button
          onClick={() => window.location.href = '/forge'}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            background: '#2d3a2d',
            color: '#000000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Return to Forge
        </button>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="plan-container">
      {/* Shopping Cart Sidepanel */}
      <ShoppingCart
        userEmail={email || `guest-${planCode}`}
        planCode={planCode || undefined}
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
      />

      {/* Sidebar - Share buttons and cart */}
      <div className="plan-sidebar">
        <button
          className="sidebar-icon-button"
          onClick={() => {
            const url = window.location.href;
            const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            window.open(shareUrl, '_blank', 'width=600,height=600');
          }}
          title="Share on LinkedIn"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        </button>
        <button
          className="sidebar-icon-button"
          onClick={() => {
            const text = "Check out my personalized fitness plan from Forge!";
            const url = window.location.href;
            const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
            window.open(shareUrl, '_blank', 'width=600,height=600');
          }}
          title="Share on X"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </button>
        <button
          className="sidebar-icon-button"
          onClick={() => setCartOpen(true)}
          title="View Cart"
          style={{ position: 'relative' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          {cartItemCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#4CAF50',
              color: 'white',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              border: '2px solid white'
            }}>
              {cartItemCount}
            </span>
          )}
        </button>
      </div>

      {/* Hero Image */}
      <div className="hero-image-container">
        <img
          src="/images/forge-loading.png"
          alt="Forge Fitness Plan"
          className="hero-image"
        />
      </div>

      {/* Header */}
      <header className="plan-header">
        <h1 className="plan-main-title">Forge Fitness Plan</h1>
        <p className="plan-subtitle">A guide as unique as you.</p>
      </header>

      {/* Personalized Greeting */}
      <section className="plan-section greeting-section">
        <h2 className="section-heading mb-4">{plan.personalizedGreeting}</h2>
        <p className="section-subheading">Your biomarker data, your insights, your plan.</p>
        <p className="intro-text">
          This fitness plan has been crafted especially for you in accordance with your unique biology.
          It takes into account your most recent lab results, daily wearable data and habitual information.
        </p>

        {/* Personal Summary */}
        <div className="executive-summary-container">
          <h2 className="section-title">Personal Summary</h2>
          <div className="executive-summary">
            {(plan.executiveSummary || '').split('\n').map((paragraph, idx) => (
              paragraph.trim() && <p key={idx}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Blood Work Analysis Section - only show if blood analysis exists */}
      {bloodAnalysis && bloodAnalysis.biomarkers && bloodAnalysis.biomarkers.length > 0 && (
        <section className="plan-section blood-metrics-section">
          <h2 className="section-title">Personalized metrics | {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
          <p className="section-subtitle">Your lab results are in. These are the biomarkers that you should focus on.</p>

          <div className="biomarkers-table-container" style={{ overflowX: 'auto' }}>
              <table className="biomarkers-table" style={{
                width: '100%',
                borderCollapse: 'collapse',
                display: 'table',
                background: 'rgba(255,255,255,0.05)',
                fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '18px'
              }}>
                <thead style={{ display: 'table-header-group', borderBottom: '1px solid #e0e0e0' }}>
                  <tr style={{ display: 'table-row' }}>
                    <th style={{ display: 'table-cell', textAlign: 'left', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', fontWeight: 400, color: '#000000', fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '16px' }}>Biomarker</th>
                    <th style={{ display: 'table-cell', textAlign: 'left', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', fontWeight: 400, color: '#000000', fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '16px' }}>Value</th>
                    <th style={{ display: 'table-cell', textAlign: 'left', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', fontWeight: 400, color: '#000000', fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '16px' }}>Optimal Range</th>
                    <th style={{ display: 'table-cell', textAlign: 'left', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', fontWeight: 400, color: '#000000', fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '16px' }}>Status</th>
                  </tr>
                </thead>
                <tbody style={{ display: 'table-row-group' }}>
                  {bloodAnalysis.biomarkers.map((marker, idx) => (
                    <tr key={idx} style={{ display: 'table-row', borderBottom: '1px solid #f0f0f0' }}>
                      <td className="biomarker-name" style={{ display: 'table-cell', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', color: '#000000', fontWeight: 400, fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '18px' }}>{marker.name}</td>
                      <td className="biomarker-value" style={{ display: 'table-cell', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', color: '#000000', fontWeight: 400, fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '18px' }}>{marker.value}</td>
                      <td className="biomarker-range" style={{ display: 'table-cell', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', color: '#000000', fontWeight: 400, fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '18px' }}>{marker.referenceRange || 'N/A'}</td>
                      <td className={`biomarker-status status-${marker.status.toLowerCase().replace(/\s+/g, '-')}`} style={{ display: 'table-cell', padding: typeof window !== 'undefined' && window.innerWidth <= 768 ? '12px' : '12px 24px', fontWeight: 400, fontSize: typeof window !== 'undefined' && window.innerWidth <= 768 ? '14px' : '18px' }}>{marker.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </section>
      )}

      {/* Nutrition Plan Overview - Only for nutrition plans */}
      {isNutritionPlan(plan) && (
        <section className="plan-section">
          <h2 className="section-title">Nutrition Plan Overview</h2>
          <div className="overview-grid">
            <div className="overview-column">
              <h3 className="overview-heading">Goals</h3>
              <ul className="goals-list">
                {plan.nutritionOverview?.goals.map((goal, idx) => (
                  <li key={idx}>{goal}</li>
                ))}
              </ul>
            </div>
            <div className="overview-column">
              <h3 className="overview-heading">Nutrition Structure</h3>
              <div className="nutrition-structure">
                <p><strong>Total Daily Calories:</strong> {plan.nutritionOverview?.nutritionStructure.calories}</p>
                <p><strong>Protein:</strong> {plan.nutritionOverview?.nutritionStructure.protein}</p>
                <p><strong>Carbs:</strong> {plan.nutritionOverview?.nutritionStructure.carbs}</p>
                <p><strong>Total Fiber:</strong> {plan.nutritionOverview?.nutritionStructure.fiber}</p>
                <p><strong>Fat:</strong> {plan.nutritionOverview?.nutritionStructure.fat}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Fitness Plan Sections - Only for fitness plans */}
      {isFitnessPlan(plan) && (
        <>
          {/* Decorative Image 1 */}
          <div className="plan-image-container">
            <img src={getImagePath(1)} alt="Fitness training" className="plan-image" />
          </div>

          {/* Training Philosophy */}
          {plan.trainingPhilosophy && (
            <section className="plan-section">
              <h2 className="section-title">Training Philosophy</h2>

              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Approach</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#000000' }}>
                  {(plan.trainingPhilosophy.approach || '').split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {plan.trainingPhilosophy.keyPrinciples && (
                <div style={{ marginBottom: '30px' }}>
                  <h3 className="overview-heading">Key Principles</h3>
                  <div style={{
                    overflow: 'hidden'
                  }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '15px',
                      lineHeight: '1.8'
                    }}>
                      <tbody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.trainingPhilosophy.keyPrinciples.map((principle: any, idx: number) => {
                      // Handle both object format {principle, description} and string format
                      let title: string;
                      let description: string;

                      if (typeof principle === 'object' && principle.principle) {
                        title = principle.principle;
                        description = principle.description || '';
                      } else if (typeof principle === 'object' && principle.title) {
                        // Legacy format fallback
                        title = principle.title;
                        description = principle.description || '';
                      } else if (typeof principle === 'string') {
                        // Split on first colon for legacy string format
                        const colonIndex = principle.indexOf(':');
                        title = colonIndex !== -1 ? principle.substring(0, colonIndex).trim() : principle;
                        description = colonIndex !== -1 ? principle.substring(colonIndex + 1).trim() : '';
                      } else {
                        title = String(principle);
                        description = '';
                      }

                      return (
                        <tr key={idx} style={{
                          borderBottom: idx < plan.trainingPhilosophy.keyPrinciples.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}>
                          <td style={{
                            padding: '16px 20px',
                            fontWeight: '600',
                            verticalAlign: 'top',
                            width: '35%',
                            color: '#000000'
                          }}>
                            {title}
                          </td>
                          <td style={{
                            padding: '16px 20px',
                            verticalAlign: 'top',
                            color: '#000000'
                          }}>
                            {description || title}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
              )}

              {plan.trainingPhilosophy.progressionStrategy && (
                <div>
                  <h3 className="overview-heading">Progression Strategy</h3>
                  <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#000000' }}>
                    {(plan.trainingPhilosophy.progressionStrategy || '').split('\n').map((paragraph: string, idx: number) => (
                      paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Weekly Structure */}
          {plan.weeklyStructure && (
            <section className="plan-section">
              <h2 className="section-title">Weekly Structure</h2>

              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Overview</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#000000' }}>
                  {(plan.weeklyStructure.overview || '').split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>

              {plan.weeklyStructure.trainingDays && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px', marginBottom: '30px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '8px', border: '1px solid #e5e5e5' }}>
                    <h3 className="overview-heading">Training Days Per Week</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#000000', marginBottom: '10px' }}>{plan.weeklyStructure.trainingDays}</p>
                  </div>
                </div>
              )}

            {plan.weeklyStructure.rationale && (
              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Rationale</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#000000' }}>
                  {(plan.weeklyStructure.rationale || '').split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {plan.weeklyStructure.volumeDistribution && (
              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Volume Distribution</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#000000' }}>
                  {(plan.weeklyStructure.volumeDistribution || '').split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {plan.weeklyStructure.intensityFramework && (
              <div style={{ marginBottom: '30px' }}>
                <h3 className="overview-heading">Intensity Framework</h3>
                <div style={{ fontSize: '15px', lineHeight: '1.8', color: '#000000' }}>
                  {(plan.weeklyStructure.intensityFramework || '').split('\n').map((paragraph: string, idx: number) => (
                    paragraph.trim() && <p key={idx} style={{ marginBottom: '15px' }}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {plan.weeklyStructure.focusAreas && plan.weeklyStructure.focusAreas.length > 0 && (
              <div>
                <h3 className="overview-heading">Daily Focus Areas</h3>
                <div style={{
                  overflow: 'hidden'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '15px',
                    lineHeight: '1.8'
                  }}>
                    <tbody>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {plan.weeklyStructure.focusAreas.map((area: any, idx: number) => {
                      // Split on first colon
                      const colonIndex = area.indexOf(':');
                      const day = colonIndex !== -1 ? area.substring(0, colonIndex).trim() : `Day ${idx + 1}`;
                      const description = colonIndex !== -1 ? area.substring(colonIndex + 1).trim() : area;

                      return (
                        <tr key={idx} style={{
                          borderBottom: idx < plan.weeklyStructure.focusAreas.length - 1 ? '1px solid #e0e0e0' : 'none'
                        }}>
                          <td style={{
                            padding: '16px 20px',
                            fontWeight: '600',
                            verticalAlign: 'top',
                            width: '20%',
                            color: '#000000'
                          }}>
                            {day}
                          </td>
                          <td style={{
                            padding: '16px 20px',
                            verticalAlign: 'top',
                            color: '#000000'
                          }}>
                            {description}
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            </section>
          )}

          {/* Decorative Image 2 */}
          <div className="plan-image-container">
            <img src={getImagePath(2)} alt="Workout program" className="plan-image" />
          </div>

          {/* Weekly Workout Program */}
          <section className="plan-section" id="workout-program">
            <h2 className="section-title">Weekly Workout Program</h2>
            <div className="meal-plan-grid">
              {(() => {
                // Define day order
                const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

                // Get the program (either weeklyProgram or sevenDayProgram)
                const program = plan.weeklyProgram || plan.sevenDayProgram || {};

                // Check if program is empty
                if (Object.keys(program).length === 0) {
                  return (
                    <div style={{
                      padding: '40px',
                      textAlign: 'center',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid #e5e5e5',
                      borderRadius: '12px',
                      width: '100%'
                    }}>
                      <h3 style={{ fontSize: '20px', marginBottom: '15px', color: '#000000' }}>
                        Training Protocol Overview
                      </h3>
                      <p style={{ fontSize: '16px', color: '#000000', lineHeight: '1.6', marginBottom: '20px' }}>
                        Your plan includes comprehensive training protocols based on your biomarkers and health data.
                        See the "Training Philosophy" and "Weekly Structure" sections above for your personalized training recommendations.
                      </p>
                      {plan.weeklyStructure?.focusAreas && plan.weeklyStructure.focusAreas.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                          <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#000000' }}>
                            Your Training Focus Areas:
                          </p>
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {plan.weeklyStructure.focusAreas.map((area: string, idx: number) => (
                              <li key={idx} style={{ fontSize: '15px', color: '#000000', marginBottom: '8px' }}>
                                • {area}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                }

                // Sort keys by day order
                const sortedDayKeys = Object.keys(program).sort((a, b) => {
                  const indexA = dayOrder.indexOf(a.toLowerCase());
                  const indexB = dayOrder.indexOf(b.toLowerCase());
                  // If day not found in order, put it at the end
                  if (indexA === -1) return 1;
                  if (indexB === -1) return -1;
                  return indexA - indexB;
                });

                return sortedDayKeys.map((dayKey, dayIdx) => {
                  const day = program[dayKey];
                  if (!day) return null;

                  // Get proper day name
                  const dayIndex = dayOrder.indexOf(dayKey.toLowerCase());
                  const displayDayName = day.dayName || (dayIndex !== -1 ? dayNames[dayIndex] : `Day ${dayIdx + 1}`);

                const isOpen = openDays[dayKey] || false;

                return (
                  <div key={dayKey} className="day-column">
                    <h3 className="day-title">{displayDayName}</h3>
                    <div
                      className="workout-day-header"
                      onClick={() => setOpenDays(prev => ({ ...prev, [dayKey]: !prev[dayKey] }))}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid #e5e5e5',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px', color: '#000000' }}>
                          {day.focus}
                        </div>
                        <div style={{ fontSize: '14px', color: '#000000' }}>
                          Duration: {day.duration}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '20px',
                        color: '#000000',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                      }}>
                        ▼
                      </div>
                    </div>

                    {isOpen && (
                      <>
                        {/* Warmup */}
                        {day.warmup && (
                          <div className="workout-section" style={{ marginBottom: '20px' }}>
                            <h4 style={{
                              fontSize: '14px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              color: '#000000',
                              marginBottom: '10px'
                            }}>
                              Warmup
                            </h4>
                            {day.warmup.description && (
                              <p style={{ fontSize: '13px', marginBottom: '10px', color: '#000000' }}>
                                {day.warmup.description}
                              </p>
                            )}
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {day.warmup.exercises?.map((exercise: any, idx: number) => (
                              <div key={idx} style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid #e0e0e0',
                                borderRadius: '6px',
                                padding: '10px',
                                marginBottom: '8px'
                              }}>
                                <div style={{ fontWeight: '500', marginBottom: '4px' }}>{exercise.name}</div>
                                <div style={{ fontSize: '13px', color: '#000000' }}>
                                  {exercise.sets} × {exercise.reps}
                                </div>
                                {exercise.notes && (
                                  <div style={{ fontSize: '12px', color: '#000000', marginTop: '4px', fontStyle: 'italic' }}>
                                    {exercise.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                    {/* Main Workout */}
                    <div className="workout-section" style={{ marginBottom: '20px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        color: '#000000',
                        marginBottom: '10px'
                      }}>
                        Main Workout
                      </h4>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {day.mainWorkout?.map((exercise: any, idx: number) => (
                        <div key={idx} style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '2px solid #000',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '12px'
                        }}>
                          <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px' }}>
                            {exercise.exercise}
                          </div>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '8px',
                            fontSize: '13px',
                            marginBottom: '8px'
                          }}>
                            <div>
                              <span style={{ color: '#000000' }}>Sets × Reps:</span> <strong>{exercise.sets} × {exercise.reps}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#000000' }}>Rest:</span> <strong>{exercise.rest}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#000000' }}>Tempo:</span> <strong>{exercise.tempo}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#000000' }}>Intensity:</span> <strong>{exercise.intensity}</strong>
                            </div>
                          </div>
                          {exercise.notes && (
                            <div style={{
                              fontSize: '12px',
                              color: '#000000',
                              background: '#f9f9f9',
                              padding: '8px',
                              borderRadius: '4px',
                              marginBottom: '6px'
                            }}>
                              <strong>Form:</strong> {exercise.notes}
                            </div>
                          )}
                          {exercise.progressionNotes && (
                            <div style={{
                              fontSize: '12px',
                              color: '#0066cc',
                              fontStyle: 'italic'
                            }}>
                              <strong>Progression:</strong> {exercise.progressionNotes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                        {/* Cooldown */}
                        {day.cooldown && (
                          <div className="workout-section">
                            <h4 style={{
                              fontSize: '14px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              color: '#000000',
                              marginBottom: '10px'
                            }}>
                              Cooldown
                            </h4>
                            {day.cooldown.description && (
                              <p style={{ fontSize: '13px', marginBottom: '10px', color: '#000000' }}>
                                {day.cooldown.description}
                              </p>
                            )}
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {day.cooldown.exercises?.map((exercise: any, idx: number) => (
                              <div key={idx} style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid #e0e0e0',
                                borderRadius: '6px',
                                padding: '10px',
                                marginBottom: '8px'
                              }}>
                                <div style={{ fontWeight: '500', marginBottom: '4px' }}>{exercise.name}</div>
                                <div style={{ fontSize: '13px', color: '#000000' }}>{exercise.duration}</div>
                                {exercise.notes && (
                                  <div style={{ fontSize: '12px', color: '#000000', marginTop: '4px', fontStyle: 'italic' }}>
                                    {exercise.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              });
              })()}
            </div>
          </section>

          {/* Supplement Recommendations */}
          <section className="plan-section">
            <h2 className="section-title">Supplement Recommendations</h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <h3 className="overview-heading" style={{ marginBottom: 0 }}>Essential Supplements</h3>

              {/* Purchase as Bundle button */}
              {enrichedEssentialSupplements.length > 0 && enrichedEssentialSupplements.every((s: any) => s.product?.inStock) && (
                <button
                  onClick={async () => {
                    // Add all supplements to cart
                    for (const supp of enrichedEssentialSupplements) {
                      if (supp.product?.productId) {
                        await handleAddToCart(supp.product.productId, supp.name, supp);
                      }
                    }
                    // Redirect to checkout after a short delay
                    const userIdentifier = email || `guest-${planCode}`;
                    setTimeout(() => {
                      window.location.href = `/checkout?email=${encodeURIComponent(userIdentifier)}${planCode ? `&planCode=${planCode}` : ''}`;
                    }, 800);
                  }}
                  style={{
                    padding: '14px 24px',
                    background: '#1a1a1a',
                    color: '#ffffff',
                    border: '1px solid #1a1a1a',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    fontFamily: '"Inter", Helvetica, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#000000';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#1a1a1a';
                  }}
                >
                  Purchase as Bundle
                </button>
              )}
            </div>

            <div style={{ marginBottom: '30px' }}>
              {loadingProducts ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#000000' }}>
                  Loading products...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                  {enrichedEssentialSupplements.map((supp: any, idx: number) => (
                    <div key={idx} style={{
                      background: 'transparent',
                      borderBottom: idx < enrichedEssentialSupplements.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      paddingBottom: '32px'
                    }}>
                      <div style={{
                        fontFamily: '"SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
                        fontWeight: '600',
                        fontSize: '28px',
                        marginBottom: '16px',
                        color: '#000000',
                        letterSpacing: '-0.01em'
                      }}>
                        {supp.name || supp.supplement}
                      </div>

                      {/* Product Info */}
                      {supp.product && (
                        <div style={{
                          background: '#fafafa',
                          padding: '20px',
                          borderRadius: '8px',
                          marginBottom: '16px',
                          border: '1px solid #e5e5e5',
                          display: 'flex',
                          gap: '20px',
                          alignItems: 'flex-start'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontFamily: '"Inter", Helvetica, sans-serif',
                              fontSize: '18px',
                              fontWeight: '600',
                              marginBottom: '6px',
                              color: '#000000'
                            }}>
                              {supp.product.brand} {supp.product.name}
                            </div>
                            <div style={{
                              fontFamily: '"Inter", Helvetica, sans-serif',
                              fontSize: '13px',
                              color: '#000000',
                              marginBottom: '16px'
                            }}>
                              {supp.product.quantity} {supp.product.unit} • {supp.product.strength}
                            </div>
                            <div>
                              <div style={{
                                fontFamily: '"SF Pro", sans-serif',
                                fontSize: '16px',
                                fontWeight: '600',
                                color: '#000000',
                                letterSpacing: '-0.02em'
                              }}>
                                ${supp.product.retailPrice.toFixed(2)}
                              </div>
                              <div style={{
                                fontFamily: '"Inter", Helvetica, sans-serif',
                                fontSize: '12px',
                                color: '#000000',
                                marginTop: '4px'
                              }}>
                                ${supp.product.perDayPrice.toFixed(2)}/day
                              </div>
                            </div>
                          </div>

                          {/* Add to Cart and Buy Now Buttons - Stacked on right */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px' }}>
                            {supp.product.inStock && (
                              <>
                              <button
                                onClick={() => {
                                  handleAddToCart(supp.product.productId, supp.name, supp);
                                  const userIdentifier = email || `guest-${planCode}`;
                                  setTimeout(() => {
                                    window.location.href = `/checkout?email=${encodeURIComponent(userIdentifier)}${planCode ? `&planCode=${planCode}` : ''}`;
                                  }, 500);
                                }}
                                disabled={addingToCart === supp.product.productId}
                                style={{
                                  padding: '12px 16px',
                                  background: '#1a1a1a',
                                  color: '#ffffff',
                                  border: '1px solid #1a1a1a',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  fontFamily: '"Inter", Helvetica, sans-serif',
                                  cursor: addingToCart === supp.product.productId ? 'not-allowed' : 'pointer',
                                  opacity: addingToCart === supp.product.productId ? 0.6 : 1,
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (addingToCart !== supp.product.productId) {
                                    e.currentTarget.style.background = '#000000';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (addingToCart !== supp.product.productId) {
                                    e.currentTarget.style.background = '#1a1a1a';
                                  }
                                }}
                              >
                                Buy Now
                              </button>
                              <button
                                onClick={() => handleAddToCart(supp.product.productId, supp.name, supp)}
                                disabled={addingToCart === supp.product.productId}
                                style={{
                                  padding: '12px 16px',
                                  background: '#f5f5f5',
                                  color: '#000000',
                                  border: '1px solid #e5e5e5',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '400',
                                  fontFamily: '"Inter", Helvetica, sans-serif',
                                  cursor: addingToCart === supp.product.productId ? 'not-allowed' : 'pointer',
                                  opacity: addingToCart === supp.product.productId ? 0.6 : 1,
                                  transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (addingToCart !== supp.product.productId) {
                                    e.currentTarget.style.background = '#eeeeee';
                                    e.currentTarget.style.borderColor = '#d0d0d0';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (addingToCart !== supp.product.productId) {
                                    e.currentTarget.style.background = '#f5f5f5';
                                    e.currentTarget.style.borderColor = '#e5e5e5';
                                  }
                                }}
                              >
                                {addingToCart === supp.product.productId ? 'Adding...' : 'Add to Cart'}
                              </button>
                              </>
                            )}

                            {/* Stock status below buttons */}
                            <div style={{ textAlign: 'center', marginTop: '4px' }}>
                              {supp.product.inStock ? (
                                <div style={{
                                  fontFamily: '"Inter", Helvetica, sans-serif',
                                  fontSize: '11px',
                                  color: '#10b981',
                                  fontWeight: '400'
                                }}>
                                  In Stock
                                </div>
                              ) : (
                                <div style={{
                                  fontFamily: '"Inter", Helvetica, sans-serif',
                                  fontSize: '11px',
                                  color: '#ef4444',
                                  fontWeight: '400'
                                }}>
                                  Out of Stock
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Recommendation Details */}
                      <div style={{
                        fontFamily: '"Inter", Helvetica, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.7',
                        color: '#000000',
                        marginBottom: '8px',
                        letterSpacing: '0'
                      }}>
                        Dosage: {supp.dosage} • Timing: {supp.timing}
                      </div>
                      <div style={{
                        fontFamily: '"SF Pro", sans-serif',
                        fontSize: '15px',
                        lineHeight: '1.7',
                        color: '#000000',
                        marginBottom: '8px',
                        letterSpacing: '-0.01em'
                      }}>
                        {supp.rationale}
                      </div>
                      {supp.benefits && (
                        <div style={{
                          fontFamily: '"Inter", Helvetica, sans-serif',
                          fontSize: '13px',
                          color: '#000000',
                          marginTop: '12px',
                          lineHeight: '1.6'
                        }}>
                          {supp.benefits}
                        </div>
                      )}
                      {supp.duration && (
                        <div style={{
                          fontFamily: '"Inter", Helvetica, sans-serif',
                          fontSize: '12px',
                          color: '#000000',
                          marginTop: '8px'
                        }}>
                          Duration: {supp.duration}
                        </div>
                      )}

                      {/* No Match Warning */}
                      {supp.matchStatus === 'no_match' && (
                        <div style={{
                          marginTop: '16px',
                          padding: '12px 16px',
                          background: 'rgba(254, 243, 199, 0.08)',
                          borderRadius: '6px',
                          border: '1px solid rgba(254, 243, 199, 0.15)',
                          fontFamily: '"Inter", Helvetica, sans-serif',
                          fontSize: '13px',
                          color: '#fbbf24'
                        }}>
                          Product not available in our store yet
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 className="overview-heading">Optional Supplements</h3>
              <div style={{ display: 'grid', gap: '15px' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(plan.supplementRecommendations?.optionalSupplements || plan.supplementRecommendations?.optional || []).map((supp: any, idx: number) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    padding: '15px'
                  }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '8px' }}>
                      {supp.name || supp.supplement}
                    </div>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                      <strong>Dosage:</strong> {supp.dosage} • <strong>Timing:</strong> {supp.timing}
                    </div>
                    <div style={{ fontSize: '13px', color: '#000000', marginBottom: '6px' }}>
                      <strong>Why:</strong> {supp.rationale}
                    </div>
                    {supp.benefits && (
                      <div style={{ fontSize: '12px', color: '#000000', marginTop: '6px' }}>
                        <strong>Benefits:</strong> {supp.benefits}
                      </div>
                    )}
                    {supp.duration && (
                      <div style={{ fontSize: '12px', color: '#000000' }}>
                        <strong>Duration:</strong> {supp.duration}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </section>

          {/* Decorative Image 3 */}
          <div className="plan-image-container">
            <img src={getImagePath(3)} alt="Recovery and wellness" className="plan-image" />
          </div>

          {/* Recovery Protocol */}
          <section className="plan-section">
            <h2 className="section-title">Recovery Protocol</h2>

            {plan.recoveryProtocol?.personalizedIntro && (
              <div className="personalized-intro" style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{ margin: 0, lineHeight: '1.6' }}>{plan.recoveryProtocol.personalizedIntro}</p>
              </div>
            )}

            <div className="recommendations-grid">
              <div className="recommendation-card">
                <h3>Daily Practices</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.recoveryProtocol?.dailyPractices || []).map((practice: any, idx: number) => (
                    <li key={idx}>{practice}</li>
                  ))}
                </ul>
              </div>
              <div className="recommendation-card">
                <h3>Weekly Practices</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.recoveryProtocol?.weeklyPractices || []).map((practice: any, idx: number) => (
                    <li key={idx}>{practice}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="recommendations-grid" style={{ marginTop: '20px' }}>
              <div className="recommendation-card">
                <h3>Sleep Optimization</h3>
                {plan.recoveryProtocol?.sleepOptimization ? (
                  plan.recoveryProtocol.sleepOptimization.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} style={{ marginBottom: '12px' }}>{paragraph.trim()}</p>
                  ))
                ) : (
                  <p>Not available</p>
                )}
              </div>
              <div className="recommendation-card">
                <h3>Stress Management</h3>
                {plan.recoveryProtocol?.stressManagement ? (
                  plan.recoveryProtocol.stressManagement.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} style={{ marginBottom: '12px' }}>{paragraph.trim()}</p>
                  ))
                ) : (
                  <p>Not available</p>
                )}
              </div>
              <div className="recommendation-card">
                <h3>Mobility Work</h3>
                {plan.recoveryProtocol?.mobilityWork ? (
                  plan.recoveryProtocol.mobilityWork.split('\n\n').map((paragraph, idx) => (
                    <p key={idx} style={{ marginBottom: '12px' }}>{paragraph.trim()}</p>
                  ))
                ) : (
                  <p>Not available</p>
                )}
              </div>
            </div>
          </section>

          {/* Nutrition Guidance */}
          <section className="plan-section">
            <h2 className="section-title">Nutrition Guidance</h2>

            {plan.nutritionGuidance.personalizedIntro && (
              <div className="personalized-intro" style={{
                backgroundColor: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                borderLeft: '4px solid #007bff'
              }}>
                <p style={{ margin: 0, lineHeight: '1.6' }}>{plan.nutritionGuidance.personalizedIntro}</p>
              </div>
            )}

            <div className="overview-grid">
              <div className="overview-column">
                <h3 className="overview-heading">Protein Target</h3>
                {typeof plan.nutritionGuidance.proteinTarget === 'string' ? (
                  <p>{plan.nutritionGuidance.proteinTarget}</p>
                ) : plan.nutritionGuidance.proteinTarget && typeof plan.nutritionGuidance.proteinTarget === 'object' ? (
                  <div>
                    {plan.nutritionGuidance.proteinTarget.target && (
                      <p><strong>{plan.nutritionGuidance.proteinTarget.target}</strong></p>
                    )}
                    {plan.nutritionGuidance.proteinTarget.rationale && (
                      <p style={{ fontSize: '0.85em', marginTop: '5px', color: '#000000' }}>
                        {plan.nutritionGuidance.proteinTarget.rationale}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="overview-column">
                <h3 className="overview-heading">Calorie Guidance</h3>
                {typeof plan.nutritionGuidance.calorieGuidance === 'string' ? (
                  <p>{plan.nutritionGuidance.calorieGuidance}</p>
                ) : plan.nutritionGuidance.calorieGuidance && typeof plan.nutritionGuidance.calorieGuidance === 'object' ? (
                  <div>
                    {plan.nutritionGuidance.calorieGuidance.target && (
                      <p><strong>{plan.nutritionGuidance.calorieGuidance.target}</strong></p>
                    )}
                    {plan.nutritionGuidance.calorieGuidance.range && (
                      <p style={{ fontSize: '0.9em', marginTop: '3px' }}>Range: {plan.nutritionGuidance.calorieGuidance.range}</p>
                    )}
                    {plan.nutritionGuidance.calorieGuidance.rationale && (
                      <p style={{ fontSize: '0.85em', marginTop: '5px', color: '#000000' }}>
                        {plan.nutritionGuidance.calorieGuidance.rationale}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="overview-grid" style={{ marginTop: '20px' }}>
              <div className="overview-column">
                <h3 className="overview-heading">Meal Timing</h3>
                {typeof plan.nutritionGuidance.mealTiming === 'string' ? (
                  <p>{plan.nutritionGuidance.mealTiming}</p>
                ) : plan.nutritionGuidance.mealTiming && typeof plan.nutritionGuidance.mealTiming === 'object' ? (
                  <div>
                    {plan.nutritionGuidance.mealTiming.mealsPerDay && (
                      <p><strong>Meals per day:</strong> {plan.nutritionGuidance.mealTiming.mealsPerDay}</p>
                    )}
                    {plan.nutritionGuidance.mealTiming.preworkout && (
                      <div style={{ marginTop: '10px' }}>
                        <p><strong>Pre-workout:</strong></p>
                        {typeof plan.nutritionGuidance.mealTiming.preworkout === 'string' ? (
                          <p style={{ fontSize: '0.9em', color: '#000000' }}>{plan.nutritionGuidance.mealTiming.preworkout}</p>
                        ) : (
                          <div style={{ fontSize: '0.9em', color: '#000000', marginLeft: '10px' }}>
                            {plan.nutritionGuidance.mealTiming.preworkout.timing && <p>Timing: {plan.nutritionGuidance.mealTiming.preworkout.timing}</p>}
                            {plan.nutritionGuidance.mealTiming.preworkout.composition && <p>Composition: {plan.nutritionGuidance.mealTiming.preworkout.composition}</p>}
                            {plan.nutritionGuidance.mealTiming.preworkout.examples && <p>Examples: {plan.nutritionGuidance.mealTiming.preworkout.examples}</p>}
                            {plan.nutritionGuidance.mealTiming.preworkout.rationale && <p style={{ fontSize: '0.85em', marginTop: '5px' }}>Why: {plan.nutritionGuidance.mealTiming.preworkout.rationale}</p>}
                          </div>
                        )}
                      </div>
                    )}
                    {plan.nutritionGuidance.mealTiming.postworkout && (
                      <div style={{ marginTop: '10px' }}>
                        <p><strong>Post-workout:</strong></p>
                        {typeof plan.nutritionGuidance.mealTiming.postworkout === 'string' ? (
                          <p style={{ fontSize: '0.9em', color: '#000000' }}>{plan.nutritionGuidance.mealTiming.postworkout}</p>
                        ) : (
                          <div style={{ fontSize: '0.9em', color: '#000000', marginLeft: '10px' }}>
                            {plan.nutritionGuidance.mealTiming.postworkout.timing && <p>Timing: {plan.nutritionGuidance.mealTiming.postworkout.timing}</p>}
                            {plan.nutritionGuidance.mealTiming.postworkout.composition && <p>Composition: {plan.nutritionGuidance.mealTiming.postworkout.composition}</p>}
                            {plan.nutritionGuidance.mealTiming.postworkout.examples && <p>Examples: {plan.nutritionGuidance.mealTiming.postworkout.examples}</p>}
                            {plan.nutritionGuidance.mealTiming.postworkout.rationale && <p style={{ fontSize: '0.85em', marginTop: '5px' }}>Why: {plan.nutritionGuidance.mealTiming.postworkout.rationale}</p>}
                          </div>
                        )}
                      </div>
                    )}
                    {plan.nutritionGuidance.mealTiming.generalGuidance && (
                      <p style={{ fontSize: '0.9em', marginTop: '10px', color: '#000000' }}>
                        {plan.nutritionGuidance.mealTiming.generalGuidance}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="overview-column">
                <h3 className="overview-heading">Hydration</h3>
                {typeof plan.nutritionGuidance.hydration === 'string' ? (
                  <p>{plan.nutritionGuidance.hydration}</p>
                ) : plan.nutritionGuidance.hydration && typeof plan.nutritionGuidance.hydration === 'object' ? (
                  <div>
                    {plan.nutritionGuidance.hydration.dailyTarget && (
                      <p><strong>Daily target:</strong> {plan.nutritionGuidance.hydration.dailyTarget}</p>
                    )}
                    {plan.nutritionGuidance.hydration.timing && (
                      <p style={{ fontSize: '0.9em', marginTop: '5px', color: '#000000' }}>
                        {plan.nutritionGuidance.hydration.timing}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Decorative Image 6 */}
          <div className="plan-image-container">
            <img src={getImagePath(4)} alt="Progress tracking" className="plan-image" />
          </div>

          {/* Progress Tracking & Injury Prevention */}
          <section className="plan-section">
            <h2 className="section-title">Progress Tracking</h2>
            <div className="recommendations-grid">
              <div className="recommendation-card">
                <h3>Metrics to Track</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.progressTracking.weeklyMetrics || plan.progressTracking.metrics || []).map((metric: any, idx: number) => (
                    <li key={idx}>
                      {typeof metric === 'string' ? metric : (
                        <div>
                          <strong>{metric.metric}</strong>
                          {metric.target && <div style={{ fontSize: '0.9em', color: '#000000' }}>Target: {metric.target}</div>}
                          {metric.frequency && <div style={{ fontSize: '0.9em', color: '#000000' }}>Frequency: {metric.frequency}</div>}
                          {metric.trackingMethod && <div style={{ fontSize: '0.9em', color: '#000000' }}>Method: {metric.trackingMethod}</div>}
                          {metric.measurement && <div style={{ fontSize: '0.9em', color: '#000000' }}>Measurement: {metric.measurement}</div>}
                          {metric.rationale && <div style={{ fontSize: '0.85em', color: '#0d7a3d', marginTop: '5px' }}><em>{metric.rationale}</em></div>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="recommendation-card">
                <h3>Performance Benchmarks</h3>
                <ul>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(plan.progressTracking.performanceBenchmarks || plan.progressTracking.benchmarks || []).map((benchmark: any, idx: number) => (
                    <li key={idx}>
                      {typeof benchmark === 'string' ? benchmark : (
                        <div>
                          <strong>{benchmark.metric || benchmark.name || benchmark.benchmark}</strong>
                          {benchmark.target && <div style={{ fontSize: '0.9em', color: '#000000' }}>Target: {benchmark.target}</div>}
                          {benchmark.frequency && <div style={{ fontSize: '0.9em', color: '#000000' }}>Frequency: {benchmark.frequency}</div>}
                          {benchmark.rationale && <div style={{ fontSize: '0.85em', color: '#0d7a3d', marginTop: '5px' }}><em>{benchmark.rationale}</em></div>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {(plan.progressTracking.reassessmentSchedule || plan.progressTracking.whenToReassess) && (
              <div className="recommendation-card" style={{ marginTop: '20px' }}>
                <h3>When to Reassess</h3>
                <p>{plan.progressTracking.reassessmentSchedule || plan.progressTracking.whenToReassess}</p>
              </div>
            )}
          </section>

          {/* Decorative Image 4 */}
          <div className="plan-image-container">
            <img src={getImagePath(5)} alt="Injury prevention" className="plan-image" />
          </div>

          {plan.injuryPrevention && (
            <section className="plan-section">
              <h2 className="section-title">Injury Prevention</h2>
              <div className="recommendations-grid">
                {plan.injuryPrevention.commonRisks && plan.injuryPrevention.commonRisks.length > 0 && (
                  <div className="recommendation-card">
                    <h3>Common Risks</h3>
                    <ul>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {plan.injuryPrevention.commonRisks.map((risk: any, idx: number) => (
                        <li key={idx}>
                          {typeof risk === 'string' ? risk : (
                            <div>
                              <strong>{risk.risk || risk.name}</strong>
                              {risk.description && <div style={{ fontSize: '0.9em', color: '#000000', marginTop: '5px' }}>{risk.description}</div>}
                              {risk.severity && <div style={{ fontSize: '0.85em', color: '#ff6b6b', marginTop: '3px' }}>Severity: {risk.severity}</div>}
                              {risk.prevention && <div style={{ fontSize: '0.9em', color: '#0d7a3d', marginTop: '5px' }}>Prevention: {risk.prevention}</div>}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {plan.injuryPrevention.preventionStrategies && plan.injuryPrevention.preventionStrategies.length > 0 && (
                  <div className="recommendation-card">
                    <h3>Prevention Strategies</h3>
                    <ul>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {plan.injuryPrevention.preventionStrategies.map((strategy: any, idx: number) => (
                        <li key={idx}>
                          {typeof strategy === 'string' ? strategy : (
                            <div>
                              <strong>{strategy.strategy || strategy.name}</strong>
                              {strategy.rationale && <div style={{ fontSize: '0.9em', color: '#000000', marginTop: '5px' }}>{strategy.rationale}</div>}
                              {strategy.implementation && <div style={{ fontSize: '0.9em', color: '#000000', marginTop: '5px' }}>Implementation: {strategy.implementation}</div>}
                              {strategy.exercises && Array.isArray(strategy.exercises) && strategy.exercises.length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                  <div style={{ fontSize: '0.85em', fontWeight: 'bold', color: '#0d7a3d' }}>Exercises:</div>
                                  <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                                    {strategy.exercises.map((exercise: string, exIdx: number) => (
                                      <li key={exIdx} style={{ fontSize: '0.85em', color: '#000000' }}>{exercise}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Decorative Image 5 */}
          <div className="plan-image-container">
            <img src={getImagePath(6)} alt="Adaptive training" className="plan-image" />
          </div>

          {/* Adaptive Features */}
          <section className="plan-section">
            <h2 className="section-title">Adaptive Features</h2>
            <div className="lifestyle-grid">
              <div className="lifestyle-item mb-6">
                <h3>High Energy Day Adjustments</h3>
                {typeof plan.adaptiveFeatures.highEnergyDay === 'string' ? (
                  <p>{plan.adaptiveFeatures.highEnergyDay}</p>
                ) : plan.adaptiveFeatures.highEnergyDay ? (
                  <div>
                    {plan.adaptiveFeatures.highEnergyDay.description && <p>{plan.adaptiveFeatures.highEnergyDay.description}</p>}
                    {plan.adaptiveFeatures.highEnergyDay.modifications && (
                      <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#000000' }}>
                        <strong>Modifications:</strong>
                        {typeof plan.adaptiveFeatures.highEnergyDay.modifications === 'string' ? (
                          <p>{plan.adaptiveFeatures.highEnergyDay.modifications}</p>
                        ) : Array.isArray(plan.adaptiveFeatures.highEnergyDay.modifications) ? (
                          <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                            {plan.adaptiveFeatures.highEnergyDay.modifications.map((mod: any, i: number) => (
                              <li key={i}>
                                {typeof mod === 'string' ? mod : (
                                  <div>
                                    {mod.aspect && <div><strong>{mod.aspect}:</strong></div>}
                                    {mod.adjustment && <div>{mod.adjustment}</div>}
                                    {mod.example && <div style={{ fontSize: '0.85em', color: '#0d7a3d' }}>Example: {mod.example}</div>}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div>
                            {plan.adaptiveFeatures.highEnergyDay.modifications.aspect && <div><strong>{plan.adaptiveFeatures.highEnergyDay.modifications.aspect}:</strong></div>}
                            {plan.adaptiveFeatures.highEnergyDay.modifications.adjustment && <div>{plan.adaptiveFeatures.highEnergyDay.modifications.adjustment}</div>}
                            {plan.adaptiveFeatures.highEnergyDay.modifications.example && <div style={{ fontSize: '0.85em', color: '#0d7a3d' }}>Example: {plan.adaptiveFeatures.highEnergyDay.modifications.example}</div>}
                          </div>
                        )}
                      </div>
                    )}
                    {plan.adaptiveFeatures.highEnergyDay.exampleWorkout && (
                      <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#0d7a3d' }}>
                        {typeof plan.adaptiveFeatures.highEnergyDay.exampleWorkout === 'string' ? (
                          <p><strong>Example:</strong> {plan.adaptiveFeatures.highEnergyDay.exampleWorkout}</p>
                        ) : (
                          <div>
                            {plan.adaptiveFeatures.highEnergyDay.exampleWorkout.original && (
                              <p><strong>Original:</strong> {plan.adaptiveFeatures.highEnergyDay.exampleWorkout.original}</p>
                            )}
                            {plan.adaptiveFeatures.highEnergyDay.exampleWorkout.highEnergy && (
                              <p><strong>High Energy:</strong> {plan.adaptiveFeatures.highEnergyDay.exampleWorkout.highEnergy}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="lifestyle-item mb-6">
                <h3>Low Energy Day Adjustments</h3>
                {typeof plan.adaptiveFeatures.lowEnergyDay === 'string' ? (
                  <p>{plan.adaptiveFeatures.lowEnergyDay}</p>
                ) : plan.adaptiveFeatures.lowEnergyDay ? (
                  <div>
                    {plan.adaptiveFeatures.lowEnergyDay.description && <p>{plan.adaptiveFeatures.lowEnergyDay.description}</p>}
                    {plan.adaptiveFeatures.lowEnergyDay.modifications && (
                      <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#000000' }}>
                        <strong>Modifications:</strong>
                        {typeof plan.adaptiveFeatures.lowEnergyDay.modifications === 'string' ? <p>{plan.adaptiveFeatures.lowEnergyDay.modifications}</p> :
                         Array.isArray(plan.adaptiveFeatures.lowEnergyDay.modifications) ? (
                          <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                            {plan.adaptiveFeatures.lowEnergyDay.modifications.map((mod: any, i: number) => (
                              <li key={i}>{typeof mod === 'string' ? mod : `${mod.aspect}: ${mod.adjustment}${mod.example ? ` (e.g., ${mod.example})` : ''}`}</li>
                            ))}
                          </ul>
                        ) : <div>{plan.adaptiveFeatures.lowEnergyDay.modifications.aspect}: {plan.adaptiveFeatures.lowEnergyDay.modifications.adjustment}</div>}
                      </div>
                    )}
                    {plan.adaptiveFeatures.lowEnergyDay.exampleWorkout && (
                      <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#0d7a3d' }}>
                        {typeof plan.adaptiveFeatures.lowEnergyDay.exampleWorkout === 'string' ? (
                          <p><strong>Example:</strong> {plan.adaptiveFeatures.lowEnergyDay.exampleWorkout}</p>
                        ) : (
                          <div>
                            {plan.adaptiveFeatures.lowEnergyDay.exampleWorkout.original && (
                              <p><strong>Original:</strong> {plan.adaptiveFeatures.lowEnergyDay.exampleWorkout.original}</p>
                            )}
                            {plan.adaptiveFeatures.lowEnergyDay.exampleWorkout.lowEnergy && (
                              <p><strong>Low Energy:</strong> {plan.adaptiveFeatures.lowEnergyDay.exampleWorkout.lowEnergy}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="lifestyle-item mb-6">
                <h3>Travel Adjustments</h3>
                {typeof plan.adaptiveFeatures.travelAdjustments === 'string' ? (
                  <p>{plan.adaptiveFeatures.travelAdjustments}</p>
                ) : plan.adaptiveFeatures.travelAdjustments ? (
                  <div>
                    {plan.adaptiveFeatures.travelAdjustments.description && <p>{plan.adaptiveFeatures.travelAdjustments.description}</p>}
                    {plan.adaptiveFeatures.travelAdjustments.modifications && (
                      <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#000000' }}>
                        <strong>Modifications:</strong>
                        {typeof plan.adaptiveFeatures.travelAdjustments.modifications === 'string' ? <p>{plan.adaptiveFeatures.travelAdjustments.modifications}</p> :
                         Array.isArray(plan.adaptiveFeatures.travelAdjustments.modifications) ? (
                          <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                            {plan.adaptiveFeatures.travelAdjustments.modifications.map((mod: any, i: number) => (
                              <li key={i}>{typeof mod === 'string' ? mod : `${mod.aspect}: ${mod.adjustment}`}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )}
                    {plan.adaptiveFeatures.travelAdjustments.exampleWorkout && (
                      <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#0d7a3d' }}>
                        {typeof plan.adaptiveFeatures.travelAdjustments.exampleWorkout === 'string' ? (
                          <p><strong>Example:</strong> {plan.adaptiveFeatures.travelAdjustments.exampleWorkout}</p>
                        ) : (
                          <div>
                            {plan.adaptiveFeatures.travelAdjustments.exampleWorkout.original && (
                              <p><strong>Original:</strong> {plan.adaptiveFeatures.travelAdjustments.exampleWorkout.original}</p>
                            )}
                            {plan.adaptiveFeatures.travelAdjustments.exampleWorkout.travel && (
                              <p><strong>Travel:</strong> {plan.adaptiveFeatures.travelAdjustments.exampleWorkout.travel}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {/* Decorative Image 7 - Final */}
          <div className="plan-image-container">
            <img src={getImagePath(7)} alt="Fitness journey" className="plan-image" />
          </div>
        </>
      )}

      {/* Daily Recommendations - Only for nutrition plans */}
      {isNutritionPlan(plan) && plan.dailyRecommendations && (
        <section className="plan-section">
          <h2 className="section-title">Daily Recommendations</h2>
          <div className="recommendations-grid">
            <div className="recommendation-card">
              <h3>Morning Ritual</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.morningRitual?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Empower the Gut</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.empowerGut?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Afternoon Vitality</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.afternoonVitality?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Energy Optimization</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.energyOptimization?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Midday Mastery</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.middayMastery?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="recommendation-card">
              <h3>Evening Nourishment</h3>
              <ul>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.dailyRecommendations.eveningNourishment?.map((item: any, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Micronutrient Focus - Only for nutrition plans */}
      {isNutritionPlan(plan) && (
        <section className="plan-section">
          <h2 className="section-title">Micronutrient Focus</h2>

          {plan.micronutrientFocus && Array.isArray(plan.micronutrientFocus) && plan.micronutrientFocus.length > 0 && (
            <>
              {/* Personalized intro for fallback micronutrients */}
              <p className="micronutrients-intro">
                {`Based on ${bloodAnalysis ? 'your blood biomarkers' : 'your profile'}${
                  bloodAnalysis && bloodAnalysis.concerns?.length > 0
                    ? ` showing ${bloodAnalysis.concerns.slice(0, 2).join(' and ')}`
                    : ''
                }, your ${plan?.nutritionOverview?.goals?.[0]?.toLowerCase() || 'health goals'}, and your ${
                  plan?.dailyRecommendations ? 'personalized nutrition plan' : 'lifestyle'
                }, these micronutrients are specifically chosen to support your optimal health and performance.`}
              </p>

              <div className="table-container">
                <table className="micronutrient-table">
                  <thead>
                    <tr>
                      <th>Nutrient</th>
                      <th>Daily Goal</th>
                      <th>Food Sources in Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {plan.micronutrientFocus.map((nutrient: any, idx: number) => (
                    <tr key={idx}>
                      <td className="nutrient-name">{nutrient.nutrient}</td>
                      <td className="nutrient-goal">{nutrient.dailyGoal}</td>
                      <td className="nutrient-sources">{nutrient.foodSources}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      )}

      {/* Sample Meal Plan with Side Image Layout - Only for nutrition plans */}
      {isNutritionPlan(plan) && plan.sampleMealPlan && (
      <div className="with-side-image-layout">
        <div className="side-image-container">
          <img
            src="/meal-plan-side-image.png"
            alt="Gourmet Meal"
            className="side-image"
          />
        </div>

        <div className="side-content">
          {/* Sample Meal Plan */}
          <section className="plan-section">
            <h2 className="section-title">Meal Plan</h2>

            {/* Personalized intro for meal plan */}
            <p className="meal-plan-intro">
              {`This 7-day meal plan is optimized for ${bloodAnalysis ? 'your biomarkers' : 'your goals'}${
                bloodAnalysis && bloodAnalysis.concerns?.length > 0
                  ? `, specifically targeting ${bloodAnalysis.concerns[0]?.toLowerCase()}`
                  : ''
              }. Each meal is designed around your ${plan?.nutritionOverview?.nutritionStructure?.protein || 'protein'} targets${
                plan?.nutritionOverview?.goals?.[0]
                  ? ` to ${plan.nutritionOverview.goals[0].toLowerCase().replace(/^(improve|enhance|boost|increase|optimize)\s+/i, 'support ')}`
                  : ''
              }, while respecting your ${plan?.lifestyleIntegration?.exerciseProtocol ? 'training schedule' : 'lifestyle preferences'} and eating window.`}
            </p>

            <div className="meal-plan-grid">
              {Object.keys(plan.sampleMealPlan)
                .filter(key => key !== 'profileSummary') // Skip the profile summary object
                .map((dayKey, dayIdx) => {
                const day = plan.sampleMealPlan[dayKey];
                if (!day || !day.meals) return null; // Safety check
                return (
                  <div key={dayKey} className="day-column">
                    <h3 className="day-title">Day {dayIdx + 1}</h3>
                    <div className="meals-list">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {day.meals.map((meal: any, mealIdx: number) => (
                        <div key={mealIdx} className="meal-card">
                          <div className="meal-time">
                            <span className="time-dot"></span>
                            {meal.time}
                          </div>
                          <div className="meal-name">{meal.name}</div>
                          <div className="meal-description">{meal.description}</div>
                          {meal.cookingTime && (
                            <div className="meal-meta">
                              <span>{meal.cookingTime}</span>
                              {meal.difficulty && <span> • {meal.difficulty}</span>}
                            </div>
                          )}
                          <div className="meal-macros">{meal.macros}</div>
                          {meal.biomarkerNotes && (
                            <div className="biomarker-notes">
                              {meal.biomarkerNotes}
                            </div>
                          )}
                          {meal.prepType && (
                            <div className="meal-tags">
                              <span className="meal-tag">{meal.prepType}</span>
                              {meal.complexity && <span className="meal-tag">{meal.complexity}</span>}
                              {meal.prepTime && <span className="meal-tag">{meal.prepTime}</span>}
                            </div>
                          )}
                          {meal.ingredients && meal.ingredients.length > 0 && (
                            <details className="meal-details">
                              <summary>View Recipe</summary>
                              <div className="recipe-content">
                                <h4>Ingredients:</h4>
                                <ul className="ingredients-list">
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {meal.ingredients.map((ingredient: any, idx: number) => (
                                    <li key={idx}>{ingredient}</li>
                                  ))}
                                </ul>
                                {meal.cookingInstructions && meal.cookingInstructions.length > 0 && (
                                  <>
                                    <h4>Instructions:</h4>
                                    <ol className="instructions-list">
                                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                      {meal.cookingInstructions.map((instruction: any, idx: number) => (
                                        <li key={idx}>{instruction}</li>
                                      ))}
                                    </ol>
                                  </>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Lifestyle Integration */}
          <section className="plan-section">
            <h2 className="section-title">Lifestyle Integration</h2>

            {/* Personalized intro for lifestyle */}
            <p className="lifestyle-intro">
              {`Your lifestyle plan is tailored to ${
                plan?.nutritionOverview?.goals?.[0]
                  ? `${plan.nutritionOverview.goals[0].toLowerCase().replace(/^(improve|enhance|boost|increase|optimize)\s+/i, '')}`
                  : 'your health goals'
              }${
                bloodAnalysis && bloodAnalysis.concerns?.length > 0
                  ? ` and optimized to address ${bloodAnalysis.concerns.slice(0, 2).join(' and ').toLowerCase()}`
                  : ''
              }. These protocols integrate seamlessly with your daily routine, ${
                plan?.dailyRecommendations?.morningRitual
                  ? 'from your morning ritual'
                  : 'from sleep optimization'
              } to stress management, ensuring sustainable habits that compound over time.`}
            </p>

            {plan.lifestyleIntegration ? (
              <div className="lifestyle-clean">
                {/* Sleep Optimization */}
                {plan.lifestyleIntegration.sleepOptimization && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Sleep Optimization</h3>
                    {plan.lifestyleIntegration.sleepOptimization.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.sleepOptimization.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.optimalSleepWindow && (
                      <div className="lifestyle-text">
                        <p><strong>Optimal Sleep Window:</strong> {plan.lifestyleIntegration.sleepOptimization.optimalSleepWindow}</p>
                      </div>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.preBedroutine && plan.lifestyleIntegration.sleepOptimization.preBedroutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Pre-Bed Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.sleepOptimization.preBedroutine.map((item: any, idx: number) => (
                          <p key={idx}>• {item}</p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.morningProtocol && plan.lifestyleIntegration.sleepOptimization.morningProtocol.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Morning Protocol:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.sleepOptimization.morningProtocol.map((item: any, idx: number) => (
                          <p key={idx}>• {item}</p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.sleepOptimization.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.sleepOptimization.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Exercise Protocol */}
                {plan.lifestyleIntegration.exerciseProtocol && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Exercise Protocol</h3>
                    {plan.lifestyleIntegration.exerciseProtocol.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.exerciseProtocol.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.exerciseProtocol.weeklyStructure && (
                      <div className="lifestyle-text">
                        <p><strong>Weekly Structure:</strong> {plan.lifestyleIntegration.exerciseProtocol.weeklyStructure}</p>
                      </div>
                    )}

                    {plan.lifestyleIntegration.exerciseProtocol.workoutSplit && plan.lifestyleIntegration.exerciseProtocol.workoutSplit.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Workout Split:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.exerciseProtocol.workoutSplit.map((workout: any, idx: number) => (
                          <p key={idx}>
                            <strong>{workout.day}:</strong> {workout.focus}
                            {workout.duration && <> • {workout.duration}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.exerciseProtocol.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.exerciseProtocol.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Stress Management */}
                {plan.lifestyleIntegration.stressManagement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Stress Management</h3>
                    {plan.lifestyleIntegration.stressManagement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.stressManagement.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.stressManagement.dailyPractices && plan.lifestyleIntegration.stressManagement.dailyPractices.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Daily Practices:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.stressManagement.dailyPractices.map((practice: any, idx: number) => (
                          <p key={idx}>
                            <strong>{practice.practice}</strong>
                            {practice.timing && <> • {practice.timing}</>}
                            {practice.duration && <> • {practice.duration}</>}
                            {practice.benefit && <><br />{practice.benefit}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.stressManagement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.stressManagement.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Skin Improvement */}
                {plan.lifestyleIntegration.skinImprovement && (
                  <div className="lifestyle-section">
                    <h3 className="lifestyle-title">Skin Improvement</h3>
                    {plan.lifestyleIntegration.skinImprovement.personalizedIntro && (
                      <p className="lifestyle-subtitle">{plan.lifestyleIntegration.skinImprovement.personalizedIntro}</p>
                    )}

                    {plan.lifestyleIntegration.skinImprovement.morningRoutine && plan.lifestyleIntegration.skinImprovement.morningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Morning Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.skinImprovement.morningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.skinImprovement.eveningRoutine && plan.lifestyleIntegration.skinImprovement.eveningRoutine.length > 0 && (
                      <div className="lifestyle-text">
                        <p><strong>Evening Routine:</strong></p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {plan.lifestyleIntegration.skinImprovement.eveningRoutine.map((step: any, idx: number) => (
                          <p key={idx}>
                            {idx + 1}. <strong>{step.product}</strong>
                            {step.purpose && <> - {step.purpose}</>}
                          </p>
                        ))}
                      </div>
                    )}

                    {plan.lifestyleIntegration.skinImprovement.whyThisMatters && (
                      <div className="lifestyle-text">
                        <p><strong>Why This Matters:</strong> {plan.lifestyleIntegration.skinImprovement.whyThisMatters}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="lifestyle-content">
                <div className="lifestyle-item">
                  <h3>Sleep Optimization Protocol:</h3>
                  <p>{plan.lifestyleIntegration.sleepOptimization}</p>
                </div>
                <div className="lifestyle-item">
                  <h3>Exercise Protocol:</h3>
                  <p>{plan.lifestyleIntegration.exerciseProtocol}</p>
                </div>
                <div className="lifestyle-item">
                  <h3>Stress Management Protocol:</h3>
                  <p>{plan.lifestyleIntegration.stressManagement}</p>
                </div>
                {plan.lifestyleIntegration.skinImprovement && (
                  <div className="lifestyle-item">
                    <h3>Skin Improvement Protocol:</h3>
                    <p>{plan.lifestyleIntegration.skinImprovement}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Preventive & Adaptive Features */}
          {plan.preventiveFeatures && Array.isArray(plan.preventiveFeatures) && plan.preventiveFeatures.length > 0 && (
            <section className="plan-section">
              <h2 className="section-title">Preventive & Adaptive Features</h2>
              <ul className="features-list">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {plan.preventiveFeatures.map((feature: any, idx: number) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
      )}

      {/* Moccet Waitlist CTA */}
      <section className="plan-section waitlist-section">
        <h2 className="waitlist-title">If you enjoyed using forge, join the waitlist for moccet.</h2>
        <p className="waitlist-subtitle">You will be one of the first to try out our full suite.</p>
        <div className="qr-code-placeholder">
          <div className="qr-box">
            <img
              src="/sage-qr-code.png"
              alt="Moccet Waitlist QR Code"
              className="qr-code-image"
            />
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <footer className="plan-footer">
        <p>
          For questions, guidance, or personalized workout updates / additions contact the forge team.<br />
          All numbers, meal plans and recommendations reflect clinical best practices and feature only foods and dosages shown safe and effective
          for the clients clinical profile. Supplementation is subject to personal discretion, contact your physician if any adverse effects occur.
        </p>
        <p className="footer-brand">forge, a product by moccet inc © 2025</p>
      </footer>
    </div>
  );
}
