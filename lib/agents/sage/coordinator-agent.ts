/**
 * Sage Coordinator Agent
 *
 * Purpose: Parse onboarding data, blood analysis, and ecosystem data into
 * a structured ClientProfileCard for the Sage nutrition plan system.
 * Model: GPT-4o-mini (structured data extraction, no reasoning needed)
 * Cost: ~$0.001 per call
 *
 * Reuses calculation functions from Forge coordinator where applicable.
 */

import {
  ClientProfileCard,
  ClientBasicProfile,
  ClientNutritionProfile,
  ComputedNutritionMetrics,
  ClientConstraints,
  DietaryConstraint,
  NutritionBiomarkerFlag,
  SageCoordinatorInput,
  SageCoordinatorOutput,
} from '../../types/client-profile';
import { EcosystemInsight, DetailedEcosystemMetrics, RecoveryMetrics, ScheduleMetrics } from '../../types/athlete-profile';

// ============================================================================
// CALCULATION FUNCTIONS (adapted from Forge coordinator)
// ============================================================================

function calculateBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  // Mifflin-St Jeor Equation
  if (gender === 'female') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
}

function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    'sedentary': 1.2,
    'light': 1.375,
    'moderate': 1.55,
    'active': 1.725,
    'very active': 1.9,
  };
  const multiplier = multipliers[activityLevel.toLowerCase()] || 1.55;
  return Math.round(bmr * multiplier);
}

function calculateMacros(
  tdee: number,
  weightKg: number,
  goal: string
): { protein: number; carbs: number; fat: number; fiber: number } {
  // Protein: 1.6-2.2g per kg based on goal
  let proteinMultiplier = 1.8;
  let calorieAdjustment = 0;

  if (goal.includes('build') || goal.includes('muscle') || goal.includes('physical')) {
    proteinMultiplier = 2.0;
    calorieAdjustment = 300;
  } else if (goal.includes('slim') || goal.includes('fat') || goal.includes('lose') || goal.includes('weight')) {
    proteinMultiplier = 2.2; // Higher protein for muscle preservation
    calorieAdjustment = -400;
  } else if (goal.includes('longevity') || goal.includes('health')) {
    proteinMultiplier = 1.6;
    calorieAdjustment = 0;
  }

  const adjustedCalories = tdee + calorieAdjustment;
  const protein = Math.round(weightKg * proteinMultiplier);
  const proteinCalories = protein * 4;

  // Fat: 25-30% of calories
  const fatCalories = adjustedCalories * 0.28;
  const fat = Math.round(fatCalories / 9);

  // Carbs: remaining calories
  const carbCalories = adjustedCalories - proteinCalories - fatCalories;
  const carbs = Math.round(carbCalories / 4);

  // Fiber: 14g per 1000 calories
  const fiber = Math.round((adjustedCalories / 1000) * 14);

  return { protein, carbs, fat, fiber };
}

function calculateWaterIntake(weightKg: number, activityLevel: string): number {
  // Base: 30-35ml per kg
  let baseMultiplier = 0.033;
  if (activityLevel === 'active' || activityLevel === 'very active') {
    baseMultiplier = 0.04;
  }
  return Math.round(weightKg * baseMultiplier * 10) / 10;
}

// ============================================================================
// STRESS/SLEEP SCORING
// ============================================================================

function determineStressScore(stressLevel: number | string): 'low' | 'moderate' | 'high' | 'very-high' {
  const level = typeof stressLevel === 'string' ? parseInt(stressLevel) : stressLevel;
  if (level <= 3) return 'low';
  if (level <= 5) return 'moderate';
  if (level <= 7) return 'high';
  return 'very-high';
}

function determineSleepScore(sleepQuality: number | string): 'poor' | 'fair' | 'normal' | 'good' | 'excellent' {
  const quality = typeof sleepQuality === 'string' ? parseInt(sleepQuality) : sleepQuality;
  if (quality <= 3) return 'poor';
  if (quality <= 5) return 'fair';
  if (quality <= 6) return 'normal';
  if (quality <= 8) return 'good';
  return 'excellent';
}

function determineMetabolicHealth(
  biomarkerFlags: NutritionBiomarkerFlag[]
): 'needs-attention' | 'fair' | 'good' | 'excellent' {
  const criticalCount = biomarkerFlags.filter(f => f.priority === 'critical').length;
  const highCount = biomarkerFlags.filter(f => f.priority === 'high').length;

  if (criticalCount > 0) return 'needs-attention';
  if (highCount >= 3) return 'needs-attention';
  if (highCount >= 1) return 'fair';
  if (biomarkerFlags.length > 5) return 'good';
  return 'excellent';
}

// ============================================================================
// PARSE ECOSYSTEM INSIGHTS
// ============================================================================

function parseEcosystemInsights(ecosystemData?: Record<string, unknown>): EcosystemInsight[] {
  const insights: EcosystemInsight[] = [];

  if (!ecosystemData) return insights;

  // Parse Oura data
  if (ecosystemData.oura) {
    const oura = ecosystemData.oura as Record<string, unknown>;
    if (oura.avgSleepHours) {
      insights.push({
        source: 'oura',
        insight: `Average sleep: ${oura.avgSleepHours} hours per night`,
        dataPoint: `${oura.avgSleepHours}h sleep`,
        impact: 'recovery',
        priority: parseFloat(String(oura.avgSleepHours)) < 7 ? 'high' : 'low',
      });
    }
    if (oura.hrvTrend) {
      insights.push({
        source: 'oura',
        insight: `HRV trend: ${oura.hrvTrend}`,
        dataPoint: String(oura.hrvTrend),
        impact: 'recovery',
        priority: oura.hrvTrend === 'declining' ? 'high' : 'low',
      });
    }
  }

  // Parse Whoop data
  if (ecosystemData.whoop) {
    const whoop = ecosystemData.whoop as Record<string, unknown>;
    if (whoop.recoveryScore || whoop.recovery) {
      const recovery = parseFloat(String(whoop.recoveryScore || whoop.recovery || 0));
      insights.push({
        source: 'whoop',
        insight: `Whoop recovery score: ${recovery}% — ${recovery < 50 ? 'prioritize rest and nutrient-dense foods' : recovery > 80 ? 'optimal recovery' : 'moderate recovery'}`,
        dataPoint: `${recovery}% recovery`,
        impact: 'recovery',
        priority: recovery < 50 ? 'high' : 'medium',
      });
    }
    if (whoop.strain || whoop.strainScore) {
      const strain = parseFloat(String(whoop.strain || whoop.strainScore || 0));
      insights.push({
        source: 'whoop',
        insight: `Average strain: ${strain.toFixed(1)} — ${strain > 15 ? 'high activity, ensure adequate nutrition' : 'moderate activity'}`,
        dataPoint: `${strain.toFixed(1)} strain`,
        impact: 'nutrition',
        priority: strain > 18 ? 'high' : 'low',
      });
    }
  }

  // Parse Calendar data (Gmail/Outlook)
  if (ecosystemData.calendar || ecosystemData.gmail || ecosystemData.outlook) {
    const calendar = (ecosystemData.calendar || ecosystemData.gmail || ecosystemData.outlook) as Record<string, unknown>;
    if (calendar.meetingDensity || calendar.meetingHoursPerDay) {
      const density = parseFloat(String(calendar.meetingDensity || calendar.meetingHoursPerDay || 0));
      if (density > 50 || density > 4) {
        insights.push({
          source: 'calendar',
          insight: `High meeting density — plan easy-to-eat meals and healthy snacks for busy days`,
          dataPoint: `${density}${calendar.meetingDensity ? '% meetings' : 'h meetings/day'}`,
          impact: 'nutrition',
          priority: 'medium',
        });
      }
    }
  }

  // Parse Slack data
  if (ecosystemData.slack) {
    const slack = ecosystemData.slack as Record<string, unknown>;
    if (slack.afterHoursPercentage) {
      const afterHours = parseFloat(String(slack.afterHoursPercentage));
      if (afterHours > 30) {
        insights.push({
          source: 'slack',
          insight: `${afterHours}% after-hours communication — consider stress-reducing foods and earlier last meal`,
          dataPoint: `${afterHours}% after-hours`,
          impact: 'nutrition',
          priority: 'high',
        });
      }
    }
  }

  return insights;
}

// ============================================================================
// PARSE DETAILED ECOSYSTEM METRICS (for Sage agents)
// ============================================================================

function parseDetailedEcosystemMetrics(
  ecosystemData?: Record<string, unknown>
): DetailedEcosystemMetrics | undefined {
  if (!ecosystemData) return undefined;

  const recovery: RecoveryMetrics = {};
  const schedule: ScheduleMetrics = {};
  const dataSources: string[] = [];

  // Parse Whoop data
  if (ecosystemData.whoop) {
    const whoop = ecosystemData.whoop as Record<string, unknown>;
    dataSources.push('whoop');

    // Recovery score
    if (whoop.avgRecoveryScore !== undefined) {
      recovery.whoopRecoveryScore = parseFloat(String(whoop.avgRecoveryScore));
    } else if (whoop.recoveryScore !== undefined) {
      recovery.whoopRecoveryScore = parseFloat(String(whoop.recoveryScore));
    } else if (whoop.recovery !== undefined) {
      recovery.whoopRecoveryScore = parseFloat(String(whoop.recovery));
    }

    // Strain score
    if (whoop.avgStrainScore !== undefined) {
      recovery.strainScore = parseFloat(String(whoop.avgStrainScore));
    } else if (whoop.strainScore !== undefined) {
      recovery.strainScore = parseFloat(String(whoop.strainScore));
    } else if (whoop.strain !== undefined) {
      recovery.strainScore = parseFloat(String(whoop.strain));
    }

    // Training load data
    const trainingLoad = whoop.trainingLoad as Record<string, unknown> | undefined;
    if (trainingLoad) {
      recovery.weeklyStrain = trainingLoad.weeklyStrain ? parseFloat(String(trainingLoad.weeklyStrain)) : undefined;
      recovery.overtrainingRisk = trainingLoad.overtrainingRisk as RecoveryMetrics['overtrainingRisk'];
    }

    // HRV patterns
    const hrvPatterns = whoop.hrvPatterns as Record<string, unknown> | undefined;
    if (hrvPatterns) {
      recovery.hrvCurrent = hrvPatterns.currentWeekAvg ? parseFloat(String(hrvPatterns.currentWeekAvg)) : undefined;
      recovery.hrvBaseline = hrvPatterns.baseline ? parseFloat(String(hrvPatterns.baseline)) : undefined;
      recovery.hrvTrend = hrvPatterns.trend as RecoveryMetrics['hrvTrend'];
      if (recovery.hrvBaseline && recovery.hrvBaseline > 0 && recovery.hrvCurrent) {
        recovery.hrvPercentOfBaseline = Math.round((recovery.hrvCurrent / recovery.hrvBaseline) * 100);
      }
    } else if (whoop.hrv !== undefined || whoop.hrvAvg !== undefined) {
      recovery.hrvCurrent = parseFloat(String(whoop.hrv || whoop.hrvAvg));
    }

    // Sleep data
    const whoopSleep = whoop.whoopSleep as Record<string, unknown> | undefined;
    if (whoopSleep) {
      recovery.sleepHoursAvg = whoopSleep.avgSleepHours ? parseFloat(String(whoopSleep.avgSleepHours)) : undefined;
      recovery.sleepEfficiency = whoopSleep.avgSleepEfficiency ? parseFloat(String(whoopSleep.avgSleepEfficiency)) : undefined;
      recovery.sleepDebtHours = whoopSleep.sleepDebtHours ? parseFloat(String(whoopSleep.sleepDebtHours)) : undefined;
    }
  }

  // Parse Oura data
  if (ecosystemData.oura) {
    const oura = ecosystemData.oura as Record<string, unknown>;
    dataSources.push('oura');

    // Readiness score
    if (oura.avgReadinessScore !== undefined) {
      recovery.ouraReadinessScore = parseFloat(String(oura.avgReadinessScore));
    } else if (oura.readinessScore !== undefined) {
      recovery.ouraReadinessScore = parseFloat(String(oura.readinessScore));
    }

    // HRV (use if not already set from Whoop)
    const hrvAnalysis = oura.hrvAnalysis as Record<string, unknown> | undefined;
    if (hrvAnalysis && !recovery.hrvCurrent) {
      recovery.hrvCurrent = hrvAnalysis.currentAvg ? parseFloat(String(hrvAnalysis.currentAvg)) : undefined;
      recovery.hrvBaseline = hrvAnalysis.baseline ? parseFloat(String(hrvAnalysis.baseline)) : undefined;
      recovery.hrvTrend = hrvAnalysis.trend as RecoveryMetrics['hrvTrend'];
      if (recovery.hrvBaseline && recovery.hrvBaseline > 0 && recovery.hrvCurrent) {
        recovery.hrvPercentOfBaseline = Math.round((recovery.hrvCurrent / recovery.hrvBaseline) * 100);
      }
    } else if (!recovery.hrvCurrent && oura.avgHRV !== undefined) {
      recovery.hrvCurrent = parseFloat(String(oura.avgHRV));
    }

    // Sleep architecture
    const sleepArchitecture = oura.sleepArchitecture as Record<string, unknown> | undefined;
    if (sleepArchitecture) {
      recovery.deepSleepPercent = sleepArchitecture.deepSleepPercent ? parseFloat(String(sleepArchitecture.deepSleepPercent)) : undefined;
      recovery.remSleepPercent = sleepArchitecture.remSleepPercent ? parseFloat(String(sleepArchitecture.remSleepPercent)) : undefined;
      if (!recovery.sleepEfficiency && sleepArchitecture.sleepEfficiency) {
        recovery.sleepEfficiency = parseFloat(String(sleepArchitecture.sleepEfficiency));
      }
    }

    // Sleep debt
    const sleepDebt = oura.sleepDebt as Record<string, unknown> | undefined;
    if (sleepDebt && !recovery.sleepDebtHours) {
      recovery.sleepDebtHours = sleepDebt.weeklyDeficit ? parseFloat(String(sleepDebt.weeklyDeficit)) : undefined;
    }

    // Average sleep hours
    if (!recovery.sleepHoursAvg && oura.avgSleepHours !== undefined) {
      recovery.sleepHoursAvg = parseFloat(String(oura.avgSleepHours));
    }
  }

  // Calculate combined recovery score if multiple sources
  if (recovery.whoopRecoveryScore && recovery.ouraReadinessScore) {
    recovery.combinedRecoveryScore = Math.round(
      (recovery.whoopRecoveryScore + recovery.ouraReadinessScore) / 2
    );
  } else {
    recovery.combinedRecoveryScore = recovery.whoopRecoveryScore || recovery.ouraReadinessScore;
  }

  // Parse Gmail/Outlook calendar patterns
  const calendarData = (ecosystemData.gmail || ecosystemData.outlook || ecosystemData.calendar) as Record<string, unknown> | undefined;
  if (calendarData) {
    dataSources.push(ecosystemData.gmail ? 'gmail' : ecosystemData.outlook ? 'outlook' : 'calendar');

    const meetingDensity = calendarData.meetingDensity as Record<string, unknown> | undefined;
    if (meetingDensity && meetingDensity.avgMeetingsPerDay !== undefined) {
      const avgMeetings = parseFloat(String(meetingDensity.avgMeetingsPerDay));
      schedule.avgMeetingsPerDay = avgMeetings;
      schedule.meetingDensity = avgMeetings <= 2 ? 'low'
        : avgMeetings <= 4 ? 'moderate'
        : avgMeetings <= 6 ? 'high'
        : 'very-high';
    }

    const stressIndicators = calendarData.stressIndicators as Record<string, unknown> | undefined;
    if (stressIndicators) {
      schedule.workStressIndicators = {
        afterHoursWork: !!stressIndicators.frequentAfterHoursWork,
        backToBackMeetings: !!stressIndicators.shortMeetingBreaks,
        shortBreaks: (meetingDensity?.backToBackPercentage ? parseFloat(String(meetingDensity.backToBackPercentage)) : 0) > 50,
      };
    }

    // Optimal meal/training windows
    if (calendarData.optimalMealWindows && Array.isArray(calendarData.optimalMealWindows)) {
      schedule.optimalTrainingWindows = calendarData.optimalMealWindows.map(String);
    }
  }

  // Parse Slack/Teams patterns for additional stress signals
  const chatData = (ecosystemData.slack || ecosystemData.teams) as Record<string, unknown> | undefined;
  if (chatData) {
    dataSources.push(ecosystemData.slack ? 'slack' : 'teams');

    const stressIndicators = chatData.stressIndicators as Record<string, unknown> | undefined;
    if (stressIndicators) {
      if (!schedule.workStressIndicators) {
        schedule.workStressIndicators = { afterHoursWork: false, backToBackMeetings: false, shortBreaks: false };
      }
      schedule.workStressIndicators.afterHoursWork =
        schedule.workStressIndicators.afterHoursWork ||
        !!stressIndicators.constantAvailability ||
        !!stressIndicators.lateNightMessages;
    }

    // Also check afterHoursPercentage
    if (chatData.afterHoursPercentage) {
      const afterHours = parseFloat(String(chatData.afterHoursPercentage));
      if (afterHours > 30) {
        if (!schedule.workStressIndicators) {
          schedule.workStressIndicators = { afterHoursWork: false, backToBackMeetings: false, shortBreaks: false };
        }
        schedule.workStressIndicators.afterHoursWork = true;
      }
    }
  }

  // Only return if we have meaningful data
  if (dataSources.length === 0) return undefined;

  return {
    recovery,
    schedule,
    dataFreshness: {
      dataSources,
      lastWearableSync: ecosystemData.fetchTimestamp as string | undefined,
    },
  };
}

// ============================================================================
// PARSE BIOMARKER DATA (NUTRITION-FOCUSED)
// ============================================================================

function parseBiomarkerFlags(bloodAnalysis?: Record<string, unknown>): NutritionBiomarkerFlag[] {
  const flags: NutritionBiomarkerFlag[] = [];

  if (!bloodAnalysis) return flags;

  const biomarkers = bloodAnalysis.biomarkers as Array<Record<string, unknown>> | undefined;
  if (!biomarkers || !Array.isArray(biomarkers)) return flags;

  // Nutrition-relevant biomarkers and their implications
  const nutritionMarkers: Record<string, { foodRecs: string[]; supplementRec?: string }> = {
    'vitamin d': {
      foodRecs: ['Fatty fish (salmon, mackerel)', 'Egg yolks', 'Fortified foods'],
      supplementRec: 'Vitamin D3 2000-4000 IU daily',
    },
    'vitamin b12': {
      foodRecs: ['Meat', 'Fish', 'Eggs', 'Dairy'],
      supplementRec: 'B12 1000mcg daily',
    },
    'iron': {
      foodRecs: ['Red meat', 'Spinach', 'Legumes', 'Fortified cereals'],
      supplementRec: 'Iron supplement with vitamin C',
    },
    'ferritin': {
      foodRecs: ['Red meat', 'Organ meats', 'Dark leafy greens'],
      supplementRec: 'Iron supplement if deficient',
    },
    'folate': {
      foodRecs: ['Leafy greens', 'Legumes', 'Fortified grains'],
    },
    'magnesium': {
      foodRecs: ['Nuts', 'Seeds', 'Dark chocolate', 'Leafy greens'],
      supplementRec: 'Magnesium glycinate 200-400mg',
    },
    'omega-3': {
      foodRecs: ['Fatty fish', 'Walnuts', 'Flaxseed', 'Chia seeds'],
      supplementRec: 'Fish oil 2-3g EPA/DHA',
    },
    'cholesterol': {
      foodRecs: ['Oats', 'Nuts', 'Olive oil', 'Fatty fish', 'Reduce saturated fat'],
    },
    'ldl': {
      foodRecs: ['Increase soluble fiber', 'Reduce saturated fat', 'Add plant sterols'],
    },
    'hdl': {
      foodRecs: ['Olive oil', 'Fatty fish', 'Nuts', 'Exercise regularly'],
    },
    'triglyceride': {
      foodRecs: ['Reduce refined carbs', 'Limit alcohol', 'Add omega-3s'],
    },
    'glucose': {
      foodRecs: ['Focus on complex carbs', 'Increase fiber', 'Protein with each meal'],
    },
    'hba1c': {
      foodRecs: ['Low glycemic foods', 'High fiber', 'Balanced meals'],
    },
    'crp': {
      foodRecs: ['Anti-inflammatory foods', 'Turmeric', 'Fatty fish', 'Colorful vegetables'],
    },
  };

  for (const marker of biomarkers) {
    const status = String(marker.status || '').toLowerCase();
    const name = String(marker.name || marker.marker || '').toLowerCase();

    if (status === 'low' || status === 'high' || status === 'deficient' || status === 'elevated') {
      // Find matching nutrition recommendations
      let foodRecs: string[] = ['Consult with a healthcare provider'];
      let supplementRec: string | undefined;

      for (const [key, value] of Object.entries(nutritionMarkers)) {
        if (name.includes(key)) {
          foodRecs = value.foodRecs;
          supplementRec = value.supplementRec;
          break;
        }
      }

      // Determine priority
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      if (status === 'deficient' || name.includes('glucose') || name.includes('hba1c')) {
        priority = 'high';
      }
      if (marker.critical === true) {
        priority = 'critical';
      }

      flags.push({
        marker: String(marker.name || marker.marker || 'Unknown'),
        status: status as 'deficient' | 'low' | 'optimal' | 'high' | 'excessive',
        value: marker.value ? String(marker.value) : undefined,
        unit: marker.unit ? String(marker.unit) : undefined,
        implication: String(marker.implications || marker.implication || 'May affect nutritional status'),
        foodRecommendations: foodRecs,
        supplementRecommendation: supplementRec,
        priority,
      });
    }
  }

  return flags;
}

// ============================================================================
// PARSE DIETARY CONSTRAINTS
// ============================================================================

function parseDietaryConstraints(formData: Record<string, unknown>): DietaryConstraint[] {
  const constraints: DietaryConstraint[] = [];

  // Parse allergies
  const allergies = formData.allergies as string[] | string | undefined;
  if (allergies) {
    const allergyList = Array.isArray(allergies) ? allergies : [allergies];
    for (const allergy of allergyList) {
      if (allergy && allergy !== 'none' && allergy !== 'None') {
        constraints.push({
          type: 'allergy',
          item: allergy,
          severity: 'strict-avoid',
        });
      }
    }
  }

  // Parse intolerances
  const intolerances = formData.intolerances as string[] | string | undefined;
  if (intolerances) {
    const intoleranceList = Array.isArray(intolerances) ? intolerances : [intolerances];
    for (const intolerance of intoleranceList) {
      if (intolerance && intolerance !== 'none') {
        constraints.push({
          type: 'intolerance',
          item: intolerance,
          severity: 'minimize',
        });
      }
    }
  }

  // Parse food dislikes
  const dislikes = formData.foodDislikes as string[] | string | undefined;
  if (dislikes) {
    const dislikeList = Array.isArray(dislikes) ? dislikes : [dislikes];
    for (const dislike of dislikeList) {
      if (dislike && dislike !== 'none') {
        constraints.push({
          type: 'preference',
          item: dislike,
          severity: 'prefer-avoid',
        });
      }
    }
  }

  return constraints;
}

// ============================================================================
// MAIN COORDINATOR FUNCTION
// ============================================================================

export async function runSageCoordinator(input: SageCoordinatorInput): Promise<SageCoordinatorOutput> {
  console.log('[Sage Coordinator] Starting client profile generation...');

  const { onboardingData, bloodAnalysis, ecosystemData } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const formData = onboardingData as Record<string, unknown>;

    // Extract basic profile
    const name = String(formData.fullName || formData.name || 'Client');
    const firstName = name.split(' ')[0];
    const age = parseInt(String(formData.age || 30));
    const gender = String(formData.gender || 'prefer-not-to-say') as ClientBasicProfile['gender'];
    const weightKg = parseFloat(String(formData.weight || 70));
    const heightCm = parseFloat(String(formData.height || 170));
    const bmi = Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10;

    const basicProfile: ClientBasicProfile = {
      name,
      firstName,
      age,
      gender,
      weightKg,
      heightCm,
      bmi,
    };

    // Extract nutrition profile
    const nutritionProfile: ClientNutritionProfile = {
      mainPriority: String(formData.mainPriority || formData.primaryGoal || 'longevity'),
      drivingGoal: String(formData.drivingGoal || formData.goals || 'Optimize health'),
      timeHorizon: (formData.timeHorizon as 'short-term' | 'medium-term' | 'long-term') || 'medium-term',
      eatingStyle: String(formData.eatingStyle || 'balanced'),
      firstMealTiming: String(formData.firstMeal || formData.firstMealTiming || '8:00 AM'),
      mealsPerDay: parseInt(String(formData.mealsPerDay || 3)),
      cookingFrequency: String(formData.mealsCooked || formData.cookingFrequency || 'few times per week'),
      proteinPreferences: Array.isArray(formData.proteinSources) ? formData.proteinSources as string[] : [],
      allergies: Array.isArray(formData.allergies) ? formData.allergies as string[] : [],
      intolerances: Array.isArray(formData.intolerances) ? formData.intolerances as string[] : [],
      foodDislikes: Array.isArray(formData.foodDislikes) ? formData.foodDislikes as string[] : [],
      alcoholConsumption: String(formData.alcoholConsumption || 'occasional'),
      activityLevel: String(formData.dailyActivity || formData.activityLevel || 'moderate'),
      sleepQuality: parseInt(String(formData.sleepQuality || 7)),
      stressLevel: parseInt(String(formData.stressLevel || 5)),
    };

    // Calculate metrics
    const bmr = calculateBMR(weightKg, heightCm, age, gender);
    const tdee = calculateTDEE(bmr, nutritionProfile.activityLevel);
    const macros = calculateMacros(tdee, weightKg, nutritionProfile.mainPriority);

    // Calculate calorie adjustment
    let calorieAdjustment = 0;
    const goal = nutritionProfile.mainPriority.toLowerCase();
    if (goal.includes('build') || goal.includes('muscle')) {
      calorieAdjustment = 300;
    } else if (goal.includes('slim') || goal.includes('fat') || goal.includes('lose')) {
      calorieAdjustment = -400;
    }

    // Parse biomarker flags
    const biomarkerFlags = parseBiomarkerFlags(bloodAnalysis);

    const computedMetrics: ComputedNutritionMetrics = {
      bmr,
      tdee,
      targetCalories: tdee + calorieAdjustment,
      calorieAdjustment,
      proteinTargetGrams: macros.protein,
      carbTargetGrams: macros.carbs,
      fatTargetGrams: macros.fat,
      fiberTargetGrams: macros.fiber,
      waterIntakeLiters: calculateWaterIntake(weightKg, nutritionProfile.activityLevel),
      stressScore: determineStressScore(nutritionProfile.stressLevel),
      sleepScore: determineSleepScore(nutritionProfile.sleepQuality),
      metabolicHealth: determineMetabolicHealth(biomarkerFlags),
      dataConfidence: bloodAnalysis ? 80 : ecosystemData ? 60 : 40,
      primaryDataSources: [
        'questionnaire',
        ...(bloodAnalysis ? ['blood_analysis'] : []),
        ...(ecosystemData ? ['ecosystem'] : []),
      ],
    };

    // Parse dietary constraints
    const dietaryConstraints = parseDietaryConstraints(formData);

    const constraints: ClientConstraints = {
      dietary: dietaryConstraints,
      medical: Array.isArray(formData.medicalConditions) ? formData.medicalConditions as string[] : [],
      medications: Array.isArray(formData.medications)
        ? formData.medications as string[]
        : formData.medications ? [String(formData.medications)] : [],
      currentSupplements: Array.isArray(formData.supplements)
        ? formData.supplements as string[]
        : formData.supplements ? [String(formData.supplements)] : [],
    };

    // Parse ecosystem insights
    const keyInsights = parseEcosystemInsights(ecosystemData);

    // Parse detailed ecosystem metrics for Sage agents
    const ecosystemMetrics = parseDetailedEcosystemMetrics(ecosystemData);

    // Build the client profile card
    const clientProfile: ClientProfileCard = {
      generatedAt: new Date().toISOString(),
      profileVersion: '1.0.0',
      profile: { ...basicProfile, ...nutritionProfile },
      computedMetrics,
      constraints,
      biomarkerFlags,
      keyInsights,
      ecosystemMetrics,
      rawDataAvailable: {
        bloodAnalysis: !!bloodAnalysis,
        ouraData: !!ecosystemData?.oura,
        whoopData: !!ecosystemData?.whoop,
        cgmData: !!ecosystemData?.cgm,
        calendarData: !!ecosystemData?.calendar || !!ecosystemData?.gmail || !!ecosystemData?.outlook,
      },
    };

    console.log('[Sage Coordinator] Client Profile Card generated successfully');
    console.log(`[Sage Coordinator] Data confidence: ${computedMetrics.dataConfidence}%`);
    console.log(`[Sage Coordinator] Biomarker flags: ${biomarkerFlags.length}`);
    console.log(`[Sage Coordinator] Key insights: ${keyInsights.length}`);

    return {
      clientProfile,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('[Sage Coordinator] Error:', error);
    throw new Error(`Sage Coordinator failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
