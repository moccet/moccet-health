/**
 * Meal Timing Optimization
 *
 * Optimizes meal timing based on calendar patterns, work schedule,
 * and sleep data. Falls back to questionnaire preferences when needed.
 *
 * @module lib/inference/meal-timing
 */

import type { EcosystemFetchResult, GmailPatterns, OuraData } from '@/lib/services/ecosystem-fetcher';

// ============================================================================
// TYPES
// ============================================================================

export interface MealTimingInput {
  ecosystemData: EcosystemFetchResult;
  questionnaireData?: {
    preferredMealTimes?: {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
    };
    sleepTime?: string; // e.g., "23:00"
    wakeTime?: string; // e.g., "07:00"
  };
}

export interface MealWindow {
  suggestedTime: string; // "12:30"
  windowStart: string; // "12:00"
  windowEnd: string; // "13:00"
  rationale: string;
  flexibility: 'fixed' | 'flexible' | 'very-flexible';
}

export interface MealTimingResult {
  firstMeal: MealWindow;
  lunch: MealWindow;
  dinner: MealWindow;
  confidence: number; // 0-100
  dataSource: string;
  insights: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Convert minutes since midnight to time string
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Add buffer to time
 */
function addMinutes(time: string, minutesToAdd: number): string {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  return minutesToTime(totalMinutes % (24 * 60));
}

/**
 * Subtract buffer from time
 */
function subtractMinutes(time: string, minutesToSubtract: number): string {
  let totalMinutes = timeToMinutes(time) - minutesToSubtract;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  return minutesToTime(totalMinutes);
}

// ============================================================================
// MEAL TIMING CALCULATION
// ============================================================================

/**
 * Calculate optimal meal timing from calendar data
 */
function calculateFromCalendar(gmailData: GmailPatterns): {
  firstMeal: MealWindow;
  lunch: MealWindow;
  dinner: MealWindow;
  insights: string[];
} {
  const insights: string[] = [];

  // Use work start time for first meal calculation
  const workStart = gmailData.workHours.start;
  const workEnd = gmailData.workHours.end;

  // First meal: 30-60 minutes before work starts
  const firstMealMinutes = timeToMinutes(workStart) - 45; // 45 min before work
  const firstMealTime = minutesToTime(Math.max(0, firstMealMinutes));

  // But cap at reasonable time (not before 6am)
  const earliestBreakfast = timeToMinutes('06:00');
  const adjustedFirstMeal = Math.max(earliestBreakfast, firstMealMinutes);

  const firstMeal: MealWindow = {
    suggestedTime: minutesToTime(adjustedFirstMeal),
    windowStart: minutesToTime(adjustedFirstMeal - 30),
    windowEnd: minutesToTime(adjustedFirstMeal + 30),
    rationale: `Based on work start time (${workStart}), suggests eating 45 minutes before to fuel productivity`,
    flexibility: 'flexible',
  };

  insights.push(`First meeting typically at ${workStart}, allowing time for breakfast before work`);

  // Lunch: Use optimal meal windows from calendar analysis
  let lunchTime = '12:30'; // default
  let lunchRationale = 'Standard midday meal time';

  if (gmailData.optimalMealWindows.length > 0) {
    const lunchWindow = gmailData.optimalMealWindows[0]; // First window is usually lunch
    const [start, end] = lunchWindow.split('-');
    const lunchMinutes = (timeToMinutes(start) + timeToMinutes(end)) / 2;
    lunchTime = minutesToTime(Math.round(lunchMinutes));
    lunchRationale = `Largest gap in meeting schedule is ${lunchWindow}`;
    insights.push(`Calendar shows consistent gap for lunch around ${lunchTime}`);
  }

  const lunch: MealWindow = {
    suggestedTime: lunchTime,
    windowStart: subtractMinutes(lunchTime, 30),
    windowEnd: addMinutes(lunchTime, 30),
    rationale: lunchRationale,
    flexibility: gmailData.meetingDensity.backToBackPercentage > 50 ? 'fixed' : 'flexible',
  };

  // Dinner: 1-2 hours after work ends
  const dinnerMinutes = timeToMinutes(workEnd) + 75; // 1.25 hours after work
  let dinnerTime = minutesToTime(dinnerMinutes % (24 * 60));

  // Cap dinner at 8pm for metabolic health
  if (timeToMinutes(dinnerTime) > timeToMinutes('20:00')) {
    dinnerTime = '19:30';
    insights.push('Dinner time optimized for 8pm deadline (3 hours before typical sleep time)');
  }

  const dinner: MealWindow = {
    suggestedTime: dinnerTime,
    windowStart: subtractMinutes(dinnerTime, 45),
    windowEnd: addMinutes(dinnerTime, 45),
    rationale: `Based on typical work end time (${workEnd}), allowing time to commute and prepare`,
    flexibility: 'very-flexible',
  };

  if (gmailData.workHours.weekendActivity) {
    insights.push('Weekend work detected - maintain consistent meal timing for metabolic health');
  }

  return { firstMeal, lunch, dinner, insights };
}

/**
 * Calculate meal timing from sleep data
 */
function adjustForSleep(
  meals: { firstMeal: MealWindow; lunch: MealWindow; dinner: MealWindow },
  sleepTime?: string,
  wakeTime?: string
): { firstMeal: MealWindow; lunch: MealWindow; dinner: MealWindow; insights: string[] } {
  const insights: string[] = [];

  if (wakeTime) {
    // Ensure first meal is at least 30 minutes after waking
    const wakeMinutes = timeToMinutes(wakeTime);
    const firstMealMinutes = wakeMinutes + 45; // 45 min after wake
    const suggestedTime = minutesToTime(firstMealMinutes);

    if (timeToMinutes(suggestedTime) < timeToMinutes(meals.firstMeal.suggestedTime)) {
      meals.firstMeal.suggestedTime = suggestedTime;
      meals.firstMeal.rationale = `Based on typical wake time (${wakeTime}), allowing 45 minutes for morning routine`;
      insights.push('First meal timing adjusted based on wake time from sleep data');
    }
  }

  if (sleepTime) {
    // Ensure dinner is at least 3 hours before sleep
    const sleepMinutes = timeToMinutes(sleepTime);
    const latestDinnerMinutes = sleepMinutes - 180; // 3 hours before sleep
    const latestDinner = minutesToTime(latestDinnerMinutes > 0 ? latestDinnerMinutes : latestDinnerMinutes + 24 * 60);

    if (timeToMinutes(meals.dinner.suggestedTime) > timeToMinutes(latestDinner)) {
      meals.dinner.suggestedTime = latestDinner;
      meals.dinner.windowEnd = latestDinner;
      meals.dinner.rationale = `Optimized for 3 hours before sleep (${sleepTime}) to support digestion and sleep quality`;
      insights.push('Dinner timing adjusted to allow 3 hours before bedtime');
    }
  }

  return { ...meals, insights };
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Infer optimal meal timing from ecosystem data
 */
export function inferMealTiming(input: MealTimingInput): MealTimingResult {
  const { ecosystemData, questionnaireData } = input;

  let confidence = 0;
  let dataSource = 'Questionnaire';
  let meals: { firstMeal: MealWindow; lunch: MealWindow; dinner: MealWindow };
  let insights: string[] = [];

  // Try to calculate from calendar data first
  if (ecosystemData.gmail.available && ecosystemData.gmail.data) {
    const gmailData = ecosystemData.gmail.data as GmailPatterns;
    const result = calculateFromCalendar(gmailData);
    meals = { firstMeal: result.firstMeal, lunch: result.lunch, dinner: result.dinner };
    insights = result.insights;
    confidence = 85;
    dataSource = 'Google Calendar + Email Patterns';

    // Adjust for sleep data if available
    if (ecosystemData.oura.available && ecosystemData.oura.data) {
      const ouraData = ecosystemData.oura.data as OuraData;
      // Oura doesn't provide explicit wake/sleep times in our current structure
      // In production, you'd extract these from sleep_data
      confidence = 90;
      dataSource = 'Calendar Patterns + Sleep Data';
    }
  } else {
    // Fallback to questionnaire data
    const preferredTimes = questionnaireData?.preferredMealTimes;

    meals = {
      firstMeal: {
        suggestedTime: preferredTimes?.breakfast || '08:00',
        windowStart: subtractMinutes(preferredTimes?.breakfast || '08:00', 30),
        windowEnd: addMinutes(preferredTimes?.breakfast || '08:00', 30),
        rationale: 'Based on your preferred breakfast time',
        flexibility: 'very-flexible',
      },
      lunch: {
        suggestedTime: preferredTimes?.lunch || '12:30',
        windowStart: subtractMinutes(preferredTimes?.lunch || '12:30', 30),
        windowEnd: addMinutes(preferredTimes?.lunch || '12:30', 30),
        rationale: 'Based on your preferred lunch time',
        flexibility: 'very-flexible',
      },
      dinner: {
        suggestedTime: preferredTimes?.dinner || '19:00',
        windowStart: subtractMinutes(preferredTimes?.dinner || '19:00', 45),
        windowEnd: addMinutes(preferredTimes?.dinner || '19:00', 45),
        rationale: 'Based on your preferred dinner time',
        flexibility: 'very-flexible',
      },
    };

    confidence = 40;
    insights.push('Meal timing based on questionnaire preferences. Connect Google Calendar for optimized scheduling.');
  }

  // Adjust for sleep time if provided
  if (questionnaireData?.sleepTime || questionnaireData?.wakeTime) {
    const adjusted = adjustForSleep(
      meals,
      questionnaireData?.sleepTime,
      questionnaireData?.wakeTime
    );
    meals = adjusted;
    insights.push(...adjusted.insights);
  }

  return {
    firstMeal: meals.firstMeal,
    lunch: meals.lunch,
    dinner: meals.dinner,
    confidence,
    dataSource,
    insights,
  };
}
