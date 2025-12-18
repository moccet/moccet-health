/**
 * Coordinator Agent
 *
 * Purpose: Parse all input data and create the Athlete Profile Card
 * Model: GPT-4o-mini (data extraction, no reasoning needed)
 * Cost: ~$0.001 per call
 *
 * This is the first agent in the pipeline. It takes raw onboarding data,
 * blood analysis, ecosystem data, and inference outputs, then produces
 * a structured Athlete Profile Card for downstream agents.
 */

import OpenAI from 'openai';
import {
  AthleteProfileCard,
  AthleteBasicProfile,
  AthleteTrainingProfile,
  ComputedMetrics,
  AthleteConstraints,
  BiomarkerFlag,
  EcosystemInsight,
  TrainingHistory,
  InjuryConstraint,
  CoordinatorInput,
  CoordinatorOutput,
  DetailedEcosystemMetrics,
  RecoveryMetrics,
  ScheduleMetrics,
} from '../types/athlete-profile';

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
// HELPER FUNCTIONS - COMPUTE METRICS
// ============================================================================

function calculateBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  // Mifflin-St Jeor Equation
  if (gender === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  } else {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
}

function calculateTDEE(bmr: number, activityLevel: string, trainingDays: number): number {
  // Activity multipliers
  let multiplier = 1.2; // Sedentary

  if (trainingDays >= 6) {
    multiplier = 1.9; // Very active
  } else if (trainingDays >= 5) {
    multiplier = 1.725; // Very active
  } else if (trainingDays >= 3) {
    multiplier = 1.55; // Moderately active
  } else if (trainingDays >= 1) {
    multiplier = 1.375; // Lightly active
  }

  // Adjust based on daily activity level from questionnaire
  if (activityLevel === 'very-active') {
    multiplier += 0.1;
  } else if (activityLevel === 'sedentary') {
    multiplier -= 0.1;
  }

  return Math.round(bmr * multiplier);
}

function calculateMacros(
  weightKg: number,
  tdee: number,
  goal: string
): { protein: number; carbs: number; fat: number } {
  // Protein: 1.6-2.2g per kg based on goal
  let proteinMultiplier = 1.8;
  if (goal === 'build-up' || goal === 'muscle_gain') {
    proteinMultiplier = 2.2;
  } else if (goal === 'slim-down' || goal === 'fat_loss') {
    proteinMultiplier = 2.0;
  }
  const protein = Math.round(weightKg * proteinMultiplier);

  // Fat: 25-30% of calories
  const fatCalories = tdee * 0.27;
  const fat = Math.round(fatCalories / 9);

  // Carbs: remaining calories
  const proteinCalories = protein * 4;
  const carbCalories = tdee - proteinCalories - fatCalories;
  const carbs = Math.round(carbCalories / 4);

  return { protein, carbs, fat };
}

function determineTrainingAge(experience: string): 'beginner' | 'intermediate' | 'advanced' {
  const exp = experience?.toLowerCase() || '';
  if (exp.includes('beginner') || exp.includes('none') || exp.includes('less than')) {
    return 'beginner';
  } else if (exp.includes('advanced') || exp.includes('expert') || exp.includes('5+') || exp.includes('years')) {
    return 'advanced';
  }
  return 'intermediate';
}

function determineStressScore(stressLevel: string | number): 'low' | 'moderate' | 'high' | 'very-high' {
  const level = typeof stressLevel === 'string' ? parseInt(stressLevel) : stressLevel;
  if (level <= 3) return 'low';
  if (level <= 5) return 'moderate';
  if (level <= 7) return 'high';
  return 'very-high';
}

function determineRecoveryCapacity(
  sleepScore: number,
  stressScore: string,
  age: number
): 'poor' | 'fair' | 'normal' | 'good' | 'excellent' {
  let score = 50;

  // Sleep impact
  if (sleepScore >= 8) score += 20;
  else if (sleepScore >= 6) score += 10;
  else if (sleepScore <= 4) score -= 20;

  // Stress impact
  if (stressScore === 'low') score += 15;
  else if (stressScore === 'high') score -= 15;
  else if (stressScore === 'very-high') score -= 25;

  // Age impact
  if (age > 50) score -= 10;
  else if (age > 40) score -= 5;
  else if (age < 30) score += 5;

  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'normal';
  if (score >= 35) return 'fair';
  return 'poor';
}

// ============================================================================
// PARSE ECOSYSTEM DATA
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
        priority: parseFloat(String(oura.avgSleepHours)) < 7 ? 'high' : 'medium',
      });
    }
    if (oura.avgHRV) {
      insights.push({
        source: 'oura',
        insight: `HRV averaging ${oura.avgHRV}ms indicates ${parseFloat(String(oura.avgHRV)) > 50 ? 'good' : 'compromised'} recovery capacity`,
        dataPoint: `${oura.avgHRV}ms HRV`,
        impact: 'recovery',
        priority: parseFloat(String(oura.avgHRV)) < 40 ? 'high' : 'low',
      });
    }
    if (oura.readinessScore) {
      insights.push({
        source: 'oura',
        insight: `Readiness score of ${oura.readinessScore} suggests ${parseFloat(String(oura.readinessScore)) > 70 ? 'good' : 'reduced'} training capacity`,
        dataPoint: `Readiness: ${oura.readinessScore}`,
        impact: 'training',
        priority: parseFloat(String(oura.readinessScore)) < 60 ? 'high' : 'low',
      });
    }
  }

  // Parse Gmail/Calendar data
  if (ecosystemData.calendar || ecosystemData.gmail) {
    const calendar = (ecosystemData.calendar || ecosystemData.gmail) as Record<string, unknown>;
    if (calendar.meetingDensity) {
      const density = parseFloat(String(calendar.meetingDensity));
      if (density > 60) {
        insights.push({
          source: 'gmail',
          insight: `High meeting density (${density}%) - schedule training around meeting blocks`,
          dataPoint: `${density}% meeting density`,
          impact: 'schedule',
          priority: 'high',
        });
      }
    }
    if (calendar.peakStressTimes) {
      insights.push({
        source: 'gmail',
        insight: `Peak stress times identified - avoid training during these windows`,
        dataPoint: String(calendar.peakStressTimes),
        impact: 'schedule',
        priority: 'medium',
      });
    }
  }

  // Parse Strava data
  if (ecosystemData.strava) {
    const strava = ecosystemData.strava as Record<string, unknown>;
    if (strava.weeklyMinutes) {
      insights.push({
        source: 'strava',
        insight: `Currently training ${strava.weeklyMinutes} minutes per week`,
        dataPoint: `${strava.weeklyMinutes} min/week`,
        impact: 'training',
        priority: 'medium',
      });
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
          insight: `${afterHours}% after-hours communication indicates work-life balance challenges`,
          dataPoint: `${afterHours}% after-hours`,
          impact: 'recovery',
          priority: 'high',
        });
      }
    }
    // Check for message patterns
    if (slack.summary || slack.patterns) {
      const summary = String(slack.summary || slack.patterns || '');
      if (summary.length > 10) {
        insights.push({
          source: 'slack',
          insight: summary.substring(0, 150),
          dataPoint: 'Slack activity',
          impact: 'general',
          priority: 'medium',
        });
      }
    }
  }

  // Parse Whoop data
  if (ecosystemData.whoop) {
    const whoop = ecosystemData.whoop as Record<string, unknown>;
    if (whoop.recoveryScore || whoop.recovery) {
      const recovery = parseFloat(String(whoop.recoveryScore || whoop.recovery || 0));
      insights.push({
        source: 'whoop',
        insight: `Whoop recovery score: ${recovery}% — ${recovery < 50 ? 'prioritize rest today' : recovery > 80 ? 'ready for intense training' : 'moderate intensity recommended'}`,
        dataPoint: `${recovery}% recovery`,
        impact: 'recovery',
        priority: recovery < 50 ? 'high' : 'medium',
      });
    }
    if (whoop.strain || whoop.strainScore) {
      const strain = parseFloat(String(whoop.strain || whoop.strainScore || 0));
      insights.push({
        source: 'whoop',
        insight: `Average strain: ${strain.toFixed(1)} — ${strain > 15 ? 'high training load detected' : 'moderate training load'}`,
        dataPoint: `${strain.toFixed(1)} strain`,
        impact: 'training',
        priority: strain > 18 ? 'high' : 'low',
      });
    }
    if (whoop.hrv || whoop.hrvAvg) {
      const hrv = parseFloat(String(whoop.hrv || whoop.hrvAvg || 0));
      insights.push({
        source: 'whoop',
        insight: `HRV average: ${hrv}ms — ${hrv < 40 ? 'stress/fatigue indicators present' : hrv > 70 ? 'excellent recovery capacity' : 'normal recovery range'}`,
        dataPoint: `${hrv}ms HRV`,
        impact: 'recovery',
        priority: hrv < 40 ? 'high' : 'low',
      });
    }
    if (whoop.sleepPerformance || whoop.sleepScore) {
      const sleep = parseFloat(String(whoop.sleepPerformance || whoop.sleepScore || 0));
      insights.push({
        source: 'whoop',
        insight: `Sleep performance: ${sleep}% — ${sleep < 70 ? 'sleep optimization needed' : 'sleep quality is good'}`,
        dataPoint: `${sleep}% sleep`,
        impact: 'recovery',
        priority: sleep < 70 ? 'high' : 'low',
      });
    }
  }

  // Parse Outlook data
  if (ecosystemData.outlook) {
    const outlook = ecosystemData.outlook as Record<string, unknown>;
    if (outlook.meetingHoursPerDay || outlook.meetingDensity) {
      const hours = parseFloat(String(outlook.meetingHoursPerDay || outlook.meetingDensity || 0));
      if (hours > 4) {
        insights.push({
          source: 'outlook',
          insight: `${hours.toFixed(1)} hours of meetings per day — schedule training around peak meeting times`,
          dataPoint: `${hours.toFixed(1)}h meetings/day`,
          impact: 'general',
          priority: 'medium',
        });
      }
    }
    if (outlook.backToBackMeetings) {
      const b2b = parseFloat(String(outlook.backToBackMeetings || 0));
      if (b2b > 50) {
        insights.push({
          source: 'outlook',
          insight: `${b2b}% back-to-back meetings — stress management is critical, consider walking meetings`,
          dataPoint: `${b2b}% back-to-back`,
          impact: 'recovery',
          priority: 'high',
        });
      }
    }
  }

  // Parse raw summary if available (catches any ecosystem data structure)
  if (ecosystemData.summary && typeof ecosystemData.summary === 'string') {
    insights.push({
      source: 'ecosystem',
      insight: String(ecosystemData.summary).substring(0, 200),
      dataPoint: 'Ecosystem summary',
      impact: 'general',
      priority: 'medium',
    });
  }

  return insights;
}

// ============================================================================
// PARSE DETAILED ECOSYSTEM METRICS (for training agents)
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
      recovery.recommendedRestDays = trainingLoad.recommendedRestDays ? parseInt(String(trainingLoad.recommendedRestDays)) : undefined;
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

    // Resting HR
    const restingHRAnalysis = whoop.restingHRAnalysis as Record<string, unknown> | undefined;
    if (restingHRAnalysis) {
      recovery.restingHR = restingHRAnalysis.currentAvg ? parseFloat(String(restingHRAnalysis.currentAvg)) : undefined;
      recovery.restingHRBaseline = restingHRAnalysis.baseline ? parseFloat(String(restingHRAnalysis.baseline)) : undefined;
      recovery.restingHRElevated = restingHRAnalysis.trend === 'elevated';
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
  const calendarData = (ecosystemData.gmail || ecosystemData.outlook) as Record<string, unknown> | undefined;
  if (calendarData) {
    dataSources.push(ecosystemData.gmail ? 'gmail' : 'outlook');

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

    // Optimal training windows (reuse meal windows if available)
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
// PARSE BIOMARKER DATA
// ============================================================================

function parseBiomarkerFlags(bloodAnalysis?: Record<string, unknown>): BiomarkerFlag[] {
  const flags: BiomarkerFlag[] = [];

  if (!bloodAnalysis) return flags;

  const biomarkers = bloodAnalysis.biomarkers as Array<Record<string, unknown>> | undefined;
  if (!biomarkers || !Array.isArray(biomarkers)) return flags;

  for (const marker of biomarkers) {
    const status = String(marker.status || '').toLowerCase();
    if (status === 'low' || status === 'high') {
      flags.push({
        marker: String(marker.name || marker.marker || 'Unknown'),
        status: status as 'low' | 'high',
        value: marker.value ? String(marker.value) : undefined,
        implication: String(marker.implications || marker.implication || 'Requires attention'),
        recommendations: Array.isArray(marker.recommendations)
          ? marker.recommendations.map(String)
          : [],
      });
    }
  }

  return flags;
}

// ============================================================================
// PARSE INJURY CONSTRAINTS
// ============================================================================

function parseInjuryConstraints(injuries: string[] | string | undefined): InjuryConstraint[] {
  if (!injuries) return [];

  const injuryList = Array.isArray(injuries) ? injuries : [injuries];
  const constraints: InjuryConstraint[] = [];

  const injuryMap: Record<string, { exercisesToAvoid: string[]; modifications: string[] }> = {
    'lower-back': {
      exercisesToAvoid: ['Deadlift', 'Good Mornings', 'Heavy Rows'],
      modifications: ['Use leg press instead of squats', 'Focus on core stabilization'],
    },
    'shoulder': {
      exercisesToAvoid: ['Overhead Press', 'Upright Rows', 'Dips'],
      modifications: ['Use neutral grip', 'Limit range of motion', 'Prioritize rotator cuff work'],
    },
    'knee': {
      exercisesToAvoid: ['Deep Squats', 'Lunges', 'Box Jumps'],
      modifications: ['Use partial range squats', 'Focus on quad strengthening'],
    },
    'neck': {
      exercisesToAvoid: ['Shrugs', 'Behind-neck Press'],
      modifications: ['Avoid neck flexion under load', 'Use supportive equipment'],
    },
    'wrist': {
      exercisesToAvoid: ['Barbell Curls', 'Front Squats'],
      modifications: ['Use straps', 'Neutral grip exercises'],
    },
  };

  for (const injury of injuryList) {
    const normalizedInjury = injury.toLowerCase().replace(/[^a-z]/g, '-');
    const mapping = injuryMap[normalizedInjury] || {
      exercisesToAvoid: [],
      modifications: ['Consult with healthcare provider', 'Start with low intensity'],
    };

    constraints.push({
      area: injury,
      severity: 'moderate', // Default, could be parsed from questionnaire
      exercisesToAvoid: mapping.exercisesToAvoid,
      modifications: mapping.modifications,
    });
  }

  return constraints;
}

// ============================================================================
// MAIN COORDINATOR FUNCTION
// ============================================================================

export async function runCoordinatorAgent(input: CoordinatorInput): Promise<CoordinatorOutput> {
  const { onboardingData, bloodAnalysis, ecosystemData, inferenceOutputs } = input;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Extract basic profile data
    const formData = onboardingData as Record<string, unknown>;

    // Parse weight (handle both kg and lbs)
    let weightKg = parseFloat(String(formData.weight || 70));
    if (formData.weightUnit === 'lbs') {
      weightKg = weightKg * 0.453592;
    }

    // Parse height (handle both cm and ft/in)
    let heightCm = parseFloat(String(formData.height || 170));
    if (formData.heightUnit === 'ft' || formData.heightFeet) {
      const feet = parseFloat(String(formData.heightFeet || 5));
      const inches = parseFloat(String(formData.heightInches || 8));
      heightCm = (feet * 12 + inches) * 2.54;
    }

    const age = parseInt(String(formData.age || 30));
    const gender = String(formData.gender || 'male');

    // Calculate BMI
    const heightM = heightCm / 100;
    const bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

    // Build basic profile
    const basicProfile: AthleteBasicProfile = {
      name: String(formData.fullName || 'Athlete'),
      firstName: String(formData.fullName || 'Athlete').split(' ')[0],
      age,
      gender: gender as AthleteBasicProfile['gender'],
      weightKg: Math.round(weightKg * 10) / 10,
      heightCm: Math.round(heightCm),
      bmi,
    };

    // Build training profile
    const trainingProfile: AthleteTrainingProfile = {
      trainingAge: determineTrainingAge(String(formData.trainingExperience || 'intermediate')),
      primaryGoal: String(formData.primaryGoal || 'general-fitness'),
      secondaryGoals: Array.isArray(formData.secondaryGoals)
        ? formData.secondaryGoals.map(String)
        : [],
      trainingDays: parseInt(String(formData.trainingDays || 4)),
      sessionLengthMinutes: parseInt(String(formData.sessionLength || 60)),
      preferredExerciseTime: (formData.exerciseTime || 'varies') as AthleteTrainingProfile['preferredExerciseTime'],
      timeHorizon: (formData.timeHorizon || 'medium-term') as AthleteTrainingProfile['timeHorizon'],
    };

    // Calculate computed metrics
    const bmr = calculateBMR(weightKg, heightCm, age, gender);
    const tdee = calculateTDEE(bmr, String(formData.dailyActivity || 'moderate'), trainingProfile.trainingDays);
    const macros = calculateMacros(weightKg, tdee, trainingProfile.primaryGoal);

    const sleepScore = parseInt(String(formData.sleepQuality || 7));
    const stressLevel = formData.stressLevel !== undefined ? formData.stressLevel : 5;
    const stressScore = determineStressScore(typeof stressLevel === 'number' ? stressLevel : String(stressLevel));
    const recoveryCapacity = determineRecoveryCapacity(sleepScore, stressScore, age);

    // Determine overtraining risk from inference outputs
    let overtrainingRisk: ComputedMetrics['overtrainingRisk'] = 'low';
    if (inferenceOutputs?.training) {
      const training = inferenceOutputs.training as Record<string, unknown>;
      if (training.overtrainingRisk === 'high') overtrainingRisk = 'high';
      else if (training.overtrainingRisk === 'moderate') overtrainingRisk = 'moderate';
    }

    const computedMetrics: ComputedMetrics = {
      tdee,
      bmr,
      proteinTargetGrams: macros.protein,
      carbTargetGrams: macros.carbs,
      fatTargetGrams: macros.fat,
      sleepScore,
      stressScore,
      recoveryCapacity,
      hrvTrend: 'unknown',
      overtrainingRisk,
      weeklyVolumeCapacity: recoveryCapacity === 'poor' || recoveryCapacity === 'fair' ? 'low' : recoveryCapacity === 'excellent' ? 'high' : 'moderate',
      recommendedIntensity: recoveryCapacity === 'poor' ? 'conservative' : recoveryCapacity === 'excellent' ? 'aggressive' : 'moderate',
      dataConfidence: bloodAnalysis ? 80 : ecosystemData ? 60 : 40,
      primaryDataSources: [
        'questionnaire',
        ...(bloodAnalysis ? ['blood_analysis'] : []),
        ...(ecosystemData ? ['ecosystem'] : []),
      ],
    };

    // Build constraints
    const injuries = parseInjuryConstraints(formData.injuries as string[] | string | undefined);
    const equipment = Array.isArray(formData.equipment)
      ? formData.equipment.map(String)
      : String(formData.equipment || 'bodyweight').split(',').map(s => s.trim());

    const constraints: AthleteConstraints = {
      injuries,
      movementRestrictions: Array.isArray(formData.movementRestrictions)
        ? formData.movementRestrictions.map(String)
        : [],
      medicalConditions: Array.isArray(formData.medicalConditions)
        ? formData.medicalConditions.map(String)
        : [],
      medications: Array.isArray(formData.medications)
        ? formData.medications.map(String)
        : [],
      equipment,
      trainingLocation: (formData.trainingLocation || 'gym') as AthleteConstraints['trainingLocation'],
      timeWindows: [],
      busyDays: [],
      optimalDays: [],
    };

    // Parse biomarker flags
    const biomarkerFlags = parseBiomarkerFlags(bloodAnalysis);

    // Parse ecosystem insights
    const keyInsights = parseEcosystemInsights(ecosystemData);

    // Parse detailed ecosystem metrics for training agents
    const ecosystemMetrics = parseDetailedEcosystemMetrics(ecosystemData);

    // Build training history from ecosystem/inference
    let trainingHistory: TrainingHistory | undefined;
    if (inferenceOutputs?.training) {
      const training = inferenceOutputs.training as Record<string, unknown>;
      trainingHistory = {
        weeklyMinutes: parseInt(String(training.weeklyMinutes || 0)),
        weeklyFrequency: parseInt(String(training.weeklyFrequency || 0)),
        dominantWorkoutType: String(training.dominantWorkoutType || 'mixed'),
        intensityDistribution: {
          easy: 30,
          moderate: 50,
          hard: 20,
        },
        recentTrend: 'stable',
      };
    }

    // Build the final Athlete Profile Card
    const athleteProfile: AthleteProfileCard = {
      generatedAt: new Date().toISOString(),
      profileVersion: '1.0.0',
      profile: { ...basicProfile, ...trainingProfile },
      computedMetrics,
      constraints,
      biomarkerFlags,
      keyInsights,
      trainingHistory,
      ecosystemMetrics,
      rawDataAvailable: {
        bloodAnalysis: !!bloodAnalysis,
        ouraData: !!ecosystemData?.oura,
        stravaData: !!ecosystemData?.strava,
        whoopData: !!ecosystemData?.whoop,
        calendarData: !!ecosystemData?.calendar || !!ecosystemData?.gmail,
        slackData: !!ecosystemData?.slack,
        outlookData: !!ecosystemData?.outlook,
      },
    };

    console.log('[Coordinator] Athlete Profile Card generated successfully');
    console.log(`[Coordinator] Data confidence: ${computedMetrics.dataConfidence}%`);
    console.log(`[Coordinator] Sources: ${computedMetrics.primaryDataSources.join(', ')}`);
    console.log(`[Coordinator] Insights: ${keyInsights.length}, Biomarker flags: ${biomarkerFlags.length}`);

    return {
      athleteProfile,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    console.error('[Coordinator] Error generating profile:', error);
    throw new Error(`Coordinator agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
