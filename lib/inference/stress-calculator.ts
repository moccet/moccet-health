/**
 * Stress Level Inference Calculator
 *
 * Calculates stress levels using a data-first approach:
 * 1. Wearable signals (40%): HRV, resting HR, sleep quality
 * 2. Calendar signals (30%): Meeting density, late meetings, weekend work
 * 3. Email/Slack signals (15%): After-hours activity, message volume
 * 4. Lab signals (15%): Cortisol levels
 *
 * Falls back to questionnaire data when objective data is unavailable.
 *
 * @module lib/inference/stress-calculator
 */

import type { EcosystemFetchResult, OuraData, GmailPatterns, SlackPatterns, BloodBiomarkers } from '@/lib/services/ecosystem-fetcher';

// ============================================================================
// TYPES
// ============================================================================

export interface StressInferenceInput {
  ecosystemData: EcosystemFetchResult;
  questionnaireData?: {
    stressLevel?: number; // 1-10 from questionnaire
    workContext?: string;
    sleepQuality?: string;
  };
}

export interface StressInferenceResult {
  stressLevel: number; // 0-100
  category: 'low' | 'moderate' | 'high';
  workContext: string;
  stressSignals: string[]; // Top 2-3 stress indicators
  confidence: number; // 0-100
  dataSources: string[];
  breakdown: {
    wearableScore: number;
    calendarScore: number;
    communicationScore: number;
    labScore: number;
  };
}

// ============================================================================
// STRESS CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate stress from wearable data (40% weight)
 */
function calculateWearableStress(ecosystemData: EcosystemFetchResult): {
  score: number;
  signals: string[];
  hasData: boolean;
} {
  let score = 0;
  const signals: string[] = [];
  let hasData = false;

  // Check Oura data
  if (ecosystemData.oura.available && ecosystemData.oura.data) {
    hasData = true;
    const ouraData = ecosystemData.oura.data as OuraData;

    // HRV decline detection (would need baseline comparison in production)
    // For now, use low HRV as indicator
    if (ouraData.avgHRV > 0 && ouraData.avgHRV < 40) {
      score += 20;
      signals.push(`Low HRV (${ouraData.avgHRV}ms) indicates elevated stress or inadequate recovery`);
    } else if (ouraData.avgHRV > 0 && ouraData.avgHRV < 50) {
      score += 10;
      signals.push(`Below-average HRV (${ouraData.avgHRV}ms) suggests moderate stress`);
    }

    // Sleep quality (poor sleep = stress indicator)
    if (ouraData.sleepQuality === 'poor') {
      score += 10;
      signals.push('Poor sleep quality detected from wearable data');
    } else if (ouraData.sleepQuality === 'fair') {
      score += 5;
      signals.push('Fair sleep quality may indicate stress or recovery issues');
    }

    // Readiness score (low readiness = high stress/poor recovery)
    if (ouraData.avgReadinessScore < 60) {
      score += 10;
      signals.push(`Low readiness score (${ouraData.avgReadinessScore}/100) indicates inadequate recovery`);
    } else if (ouraData.avgReadinessScore < 70) {
      score += 5;
    }
  }

  return { score, signals, hasData };
}

/**
 * Calculate stress from calendar data (30% weight)
 */
function calculateCalendarStress(ecosystemData: EcosystemFetchResult): {
  score: number;
  signals: string[];
  hasData: boolean;
} {
  let score = 0;
  const signals: string[] = [];
  let hasData = false;

  if (ecosystemData.gmail.available && ecosystemData.gmail.data) {
    hasData = true;
    const gmailData = ecosystemData.gmail.data as GmailPatterns;

    // High meeting density
    if (gmailData.meetingDensity.avgMeetingsPerDay > 8) {
      score += 15;
      signals.push(`High meeting load (${gmailData.meetingDensity.avgMeetingsPerDay} meetings/day average)`);
    } else if (gmailData.meetingDensity.avgMeetingsPerDay > 6) {
      score += 8;
      signals.push(`Moderate meeting density (${gmailData.meetingDensity.avgMeetingsPerDay} meetings/day)`);
    }

    // Back-to-back meetings (short breaks)
    if (gmailData.meetingDensity.backToBackPercentage > 60) {
      score += 10;
      signals.push(`${gmailData.meetingDensity.backToBackPercentage}% of meetings are back-to-back, limiting break time`);
    }

    // Weekend work
    if (gmailData.workHours.weekendActivity) {
      score += 5;
      signals.push('Regular weekend work activity detected');
    }
  }

  return { score, signals, hasData };
}

/**
 * Calculate stress from email/communication data (15% weight)
 */
function calculateCommunicationStress(ecosystemData: EcosystemFetchResult): {
  score: number;
  signals: string[];
  hasData: boolean;
} {
  let score = 0;
  const signals: string[] = [];
  let hasData = false;

  // Gmail patterns
  if (ecosystemData.gmail.available && ecosystemData.gmail.data) {
    hasData = true;
    const gmailData = ecosystemData.gmail.data as GmailPatterns;

    // High email volume
    if (gmailData.emailVolume.avgPerDay > 60) {
      score += 8;
      signals.push(`Very high email volume (${gmailData.emailVolume.avgPerDay} emails/day)`);
    } else if (gmailData.emailVolume.avgPerDay > 40) {
      score += 4;
    }

    // After-hours emails
    if (gmailData.emailVolume.afterHoursPercentage > 25) {
      score += 8;
      signals.push(`${gmailData.emailVolume.afterHoursPercentage}% of emails sent/received outside work hours`);
    }
  }

  // Slack patterns
  if (ecosystemData.slack.available && ecosystemData.slack.data) {
    hasData = true;
    const slackData = ecosystemData.slack.data as SlackPatterns;

    // Constant availability
    if (slackData.stressIndicators.constantAvailability) {
      score += 8;
      signals.push('High Slack availability pattern with frequent after-hours messaging');
    }

    // Late night messages
    if (slackData.stressIndicators.lateNightMessages) {
      score += 5;
      signals.push('Late-night Slack activity detected (after 10pm)');
    }
  }

  return { score, signals, hasData };
}

/**
 * Calculate stress from lab biomarkers (15% weight)
 */
function calculateLabStress(ecosystemData: EcosystemFetchResult): {
  score: number;
  signals: string[];
  hasData: boolean;
} {
  let score = 0;
  const signals: string[] = [];
  let hasData = false;

  if (ecosystemData.bloodBiomarkers.available && ecosystemData.bloodBiomarkers.data) {
    hasData = true;
    const biomarkerData = ecosystemData.bloodBiomarkers.data as BloodBiomarkers;

    // Check for cortisol biomarkers
    const cortisolMarkers = biomarkerData.biomarkers.filter(b =>
      b.name.toLowerCase().includes('cortisol')
    );

    for (const marker of cortisolMarkers) {
      const value = parseFloat(marker.value);
      if (isNaN(value)) continue;

      if (marker.name.toLowerCase().includes('am') || marker.name.toLowerCase().includes('morning')) {
        if (value > 25) {
          score += 10;
          signals.push(`Elevated morning cortisol (${value} μg/dL) indicates high stress`);
        }
      } else if (marker.name.toLowerCase().includes('pm') || marker.name.toLowerCase().includes('evening')) {
        if (value > 12) {
          score += 5;
          signals.push(`Elevated evening cortisol (${value} μg/dL) suggests poor stress recovery`);
        }
      }
    }

    // Check for other stress-related markers
    const cReactive = biomarkerData.biomarkers.find(b =>
      b.name.toLowerCase().includes('crp') || b.name.toLowerCase().includes('c-reactive')
    );
    if (cReactive) {
      const value = parseFloat(cReactive.value);
      if (!isNaN(value) && value > 3) {
        score += 5;
        signals.push('Elevated inflammation markers may indicate chronic stress');
      }
    }
  }

  return { score, signals, hasData };
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Infer stress level from ecosystem data with questionnaire fallback
 */
export function inferStressLevel(input: StressInferenceInput): StressInferenceResult {
  const { ecosystemData, questionnaireData } = input;

  // Calculate stress from each data source
  const wearable = calculateWearableStress(ecosystemData);
  const calendar = calculateCalendarStress(ecosystemData);
  const communication = calculateCommunicationStress(ecosystemData);
  const lab = calculateLabStress(ecosystemData);

  // Track which data sources we have
  const dataSources: string[] = [];
  if (wearable.hasData) dataSources.push('Wearable (Oura/Whoop)');
  if (calendar.hasData) dataSources.push('Calendar (Gmail)');
  if (communication.hasData) dataSources.push('Communication (Gmail/Slack)');
  if (lab.hasData) dataSources.push('Blood Biomarkers');

  // Combine all stress signals
  const allSignals = [
    ...wearable.signals,
    ...calendar.signals,
    ...communication.signals,
    ...lab.signals,
  ];

  // Calculate total stress score (max 100)
  let totalScore = wearable.score + calendar.score + communication.score + lab.score;

  // If we have no objective data, fall back to questionnaire
  if (dataSources.length === 0 && questionnaireData?.stressLevel) {
    totalScore = (questionnaireData.stressLevel / 10) * 100; // Convert 1-10 to 0-100
    dataSources.push('Questionnaire');
    allSignals.push('Stress level based on self-reported questionnaire data');
  } else if (dataSources.length > 0 && dataSources.length < 4 && questionnaireData?.stressLevel) {
    // Partial data: blend with questionnaire (weighted by confidence)
    const dataConfidence = dataSources.length * 25; // 25% per data source
    const questionnaireWeight = (100 - dataConfidence) / 100;
    const dataWeight = dataConfidence / 100;

    const questionnaireScore = (questionnaireData.stressLevel / 10) * 100;
    totalScore = (totalScore * dataWeight) + (questionnaireScore * questionnaireWeight);

    dataSources.push('Questionnaire (partial blend)');
  }

  // Cap at 100
  totalScore = Math.min(100, totalScore);

  // Calculate confidence based on data sources available
  const confidence = Math.min(100, dataSources.length * 25);

  // Determine category
  let category: 'low' | 'moderate' | 'high';
  if (totalScore < 30) {
    category = 'low';
  } else if (totalScore < 60) {
    category = 'moderate';
  } else {
    category = 'high';
  }

  // Generate work context
  let workContext = 'standard office environment';
  if (calendar.hasData) {
    const gmailData = ecosystemData.gmail.data as GmailPatterns;
    if (gmailData.meetingDensity.avgMeetingsPerDay > 8) {
      workContext = 'high-intensity meeting-heavy role';
    } else if (gmailData.workHours.weekendActivity) {
      workContext = 'demanding role with weekend work';
    } else if (communication.hasData) {
      const slackData = ecosystemData.slack.data as SlackPatterns;
      if (slackData?.collaborationIntensity === 'high') {
        workContext = 'high-collaboration team environment';
      }
    }
  } else if (questionnaireData?.workContext) {
    workContext = questionnaireData.workContext;
  }

  // Top 2-3 stress signals (sorted by relevance)
  const topSignals = allSignals.slice(0, 3);

  return {
    stressLevel: Math.round(totalScore),
    category,
    workContext,
    stressSignals: topSignals,
    confidence,
    dataSources,
    breakdown: {
      wearableScore: wearable.score,
      calendarScore: calendar.score,
      communicationScore: communication.score,
      labScore: lab.score,
    },
  };
}
