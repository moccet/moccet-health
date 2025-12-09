/**
 * Unified Context Prompt Builder
 *
 * Generates data-rich, citation-heavy prompts for AI agents using unified ecosystem context.
 * Ensures every recommendation is grounded in specific measurements and cross-source insights.
 *
 * @module lib/prompts/unified-context-prompt
 */

// ============================================================================
// TYPES
// ============================================================================

interface UnifiedContext {
  unifiedProfile: {
    physiological: unknown;
    behavioral: unknown;
    lifestyle: unknown;
  };
  keyInsights: Array<{
    insight: string;
    sources: string[];
    confidence: number;
    impact: string;
    dataPoints: string[];
    recommendation?: string;
  }>;
  priorityAreas: Array<{
    area: string;
    severity: string;
    dataPoints: string[];
    priority: number;
  }>;
  dataSourcesUsed: Record<string, unknown>;
}

interface OnboardingData {
  fullName: string;
  age: string;
  gender: string;
  weight: string;
  height: string;
  mainPriority?: string;
  drivingGoal?: string;
  primaryGoal?: string;
  eatingStyle?: string;
  allergies?: string[];
  medicalConditions?: string[];
  currentBests?: string;
  trainingExperience?: string;
  trainingDays?: string;
  [key: string]: unknown;
}

// ============================================================================
// PROMPT SECTIONS
// ============================================================================

/**
 * Build user profile section
 */
function buildUserProfileSection(onboardingData: OnboardingData): string {
  return `
## CLIENT PROFILE

**Demographics:**
- Name: ${onboardingData.fullName}
- Age: ${onboardingData.age} years old
- Gender: ${onboardingData.gender}
- Weight: ${onboardingData.weight}
- Height: ${onboardingData.height}

**Primary Goals:**
- Main Priority: ${onboardingData.mainPriority || onboardingData.primaryGoal || 'Not specified'}
- Driving Goal: ${onboardingData.drivingGoal || 'Not specified'}

**Training Background:**
- Training Experience: ${onboardingData.trainingExperience || 'Not specified'}
- Training Days Per Week: ${onboardingData.trainingDays || 'Not specified'}
- Current Personal Bests (5RM): ${onboardingData.currentBests || 'Not specified'}

**Health Context:**
- Eating Style: ${onboardingData.eatingStyle || 'Not specified'}
- Allergies/Intolerances: ${onboardingData.allergies?.join(', ') || 'None'}
- Medical Conditions: ${onboardingData.medicalConditions?.join(', ') || 'None'}
`.trim();
}

/**
 * Build physiological data section from ecosystem
 */
function buildPhysiologicalDataSection(context: UnifiedContext): string {
  const physiological = (context.unifiedProfile as {
    physiological?: {
      biomarkers?: { biomarkers?: Array<{ name: string; value: string; status: string; implications: string }>; concerns?: string[] };
      sleep?: { avgHours: number | null; quality: string | null; hrvStatus: string | null; sleepDebt: number | null };
      glucose?: { avgGlucose: number | null; variability: string | null; spikePatterns: string[]; status: string };
      recovery?: { status: string; readinessScore: number | null; trainingLoad: string; overtrainingRisk: boolean };
    };
  })?.physiological || {};

  let section = '\n## PHYSIOLOGICAL DATA (From Wearables + Lab Work)\n';

  // Blood Biomarkers
  if (physiological.biomarkers?.biomarkers && physiological.biomarkers.biomarkers.length > 0) {
    section += '\n**Blood Biomarkers:**\n';
    physiological.biomarkers.biomarkers.slice(0, 10).forEach(marker => {
      section += `- ${marker.name}: ${marker.value} (${marker.status}) — ${marker.implications}\n`;
    });
    if (physiological.biomarkers.concerns && physiological.biomarkers.concerns.length > 0) {
      section += `\n**Key Concerns:** ${physiological.biomarkers.concerns.join(', ')}\n`;
    }
    section += `\n⚠️ INTEGRATION REQUIREMENT: The biomarkers above MUST be referenced in your prose sections (executiveSummary, trainingPhilosophy, nutritionGuidance, recoveryProtocol). Do not just display them here—weave them into your narrative.\n`;
  } else {
    section += '\n**Blood Biomarkers:** Not available\n';
  }

  // Sleep Data
  if (physiological.sleep && physiological.sleep.avgHours !== null) {
    section += '\n**Sleep & Recovery (Oura Ring):**\n';
    section += `- Average Sleep Duration: ${physiological.sleep.avgHours}h per night\n`;
    section += `- Sleep Quality: ${physiological.sleep.quality}\n`;
    section += `- HRV Status: ${physiological.sleep.hrvStatus}\n`;
    if (physiological.sleep.sleepDebt && physiological.sleep.sleepDebt > 0) {
      section += `- ⚠️ Sleep Debt: ${physiological.sleep.sleepDebt.toFixed(1)}h per night\n`;
    }
  } else {
    section += '\n**Sleep & Recovery:** No wearable data available\n';
  }

  // Glucose Data
  if (physiological.glucose && physiological.glucose.avgGlucose !== null) {
    section += '\n**Glucose Control (CGM Data):**\n';
    section += `- Average Glucose: ${physiological.glucose.avgGlucose} mg/dL\n`;
    section += `- Variability: ${physiological.glucose.variability}\n`;
    section += `- Status: ${physiological.glucose.status}\n`;
    if (physiological.glucose.spikePatterns && physiological.glucose.spikePatterns.length > 0) {
      section += `- ⚠️ Spike Triggers: ${physiological.glucose.spikePatterns.join(', ')}\n`;
    }
  } else {
    section += '\n**Glucose Control:** No CGM data available\n';
  }

  // Recovery & Training Load
  if (physiological.recovery && physiological.recovery.readinessScore !== null) {
    section += '\n**Recovery & Training Load:**\n';
    section += `- Recovery Status: ${physiological.recovery.status}\n`;
    section += `- Readiness Score: ${physiological.recovery.readinessScore}/100\n`;
    section += `- Training Load: ${physiological.recovery.trainingLoad}\n`;
    if (physiological.recovery.overtrainingRisk) {
      section += `- ⚠️ OVERTRAINING RISK DETECTED\n`;
    }
  }

  return section.trim();
}

/**
 * Build behavioral patterns section
 */
function buildBehavioralPatternsSection(context: UnifiedContext): string {
  const behavioral = (context.unifiedProfile as {
    behavioral?: {
      workPatterns?: { stressLevel: string; workLifeBalance: string; breakDeficiency: boolean; optimalMealWindows: string[] };
      sleepSchedule?: { afterHoursWork: boolean; impact: string };
    };
  })?.behavioral;

  if (!behavioral) {
    return '\n## BEHAVIORAL PATTERNS (From Gmail/Slack Analysis)\n\n**No behavioral data available**\n';
  }

  let section = '\n## BEHAVIORAL PATTERNS (From Gmail/Slack Analysis)\n';

  if (behavioral.workPatterns) {
    section += '\n**Work & Stress Patterns:**\n';
    section += `- Stress Level: ${behavioral.workPatterns.stressLevel}\n`;
    section += `- Work-Life Balance: ${behavioral.workPatterns.workLifeBalance}\n`;
    section += `- Break Deficiency: ${behavioral.workPatterns.breakDeficiency ? 'YES (insufficient breaks between meetings)' : 'No'}\n`;

    if (behavioral.workPatterns.optimalMealWindows?.length > 0) {
      section += `- Optimal Meal Windows: ${behavioral.workPatterns.optimalMealWindows.join(', ')} (avoiding meeting peaks)\n`;
    }
  }

  if (behavioral.sleepSchedule) {
    section += '\n**Sleep Schedule Impact:**\n';
    section += `- After-Hours Work Activity: ${behavioral.sleepSchedule.afterHoursWork ? 'High (disrupting sleep)' : 'Low'}\n`;
    section += `- Impact: ${behavioral.sleepSchedule.impact}\n`;
  }

  return section.trim();
}

/**
 * Build key insights section with cross-source correlations
 */
function buildKeyInsightsSection(context: UnifiedContext): string {
  if (!context.keyInsights || context.keyInsights.length === 0) {
    return '';
  }

  let section = '\n## KEY INSIGHTS (Cross-Source Correlations)\n';
  section += '\nThese insights come from analyzing multiple data sources together:\n';

  context.keyInsights.forEach((insight, idx) => {
    section += `\n**Insight ${idx + 1}** (Sources: ${insight.sources.join(' + ')}, Confidence: ${Math.round(insight.confidence * 100)}%, Impact: ${insight.impact.toUpperCase()})\n`;
    section += `- ${insight.insight}\n`;
    if (insight.dataPoints.length > 0) {
      section += `  Data: ${insight.dataPoints.join('; ')}\n`;
    }
    if (insight.recommendation) {
      section += `  → Recommendation: ${insight.recommendation}\n`;
    }
  });

  return section.trim();
}

/**
 * Build priority optimization areas
 */
function buildPriorityAreasSection(context: UnifiedContext): string {
  if (!context.priorityAreas || context.priorityAreas.length === 0) {
    return '';
  }

  let section = '\n## PRIORITY OPTIMIZATION AREAS (Ranked by Data Severity)\n';

  context.priorityAreas.forEach((area, idx) => {
    section += `\n**Priority ${idx + 1}: ${area.area}** (Severity: ${area.severity.toUpperCase()})\n`;
    area.dataPoints.forEach(point => {
      section += `- ${point}\n`;
    });
  });

  section += '\n⚠️ Your recommendations MUST address these priority areas with specific protocols.\n';

  return section.trim();
}

/**
 * Build data sources attribution
 */
function buildDataSourcesSection(context: UnifiedContext): string {
  const sources = context.dataSourcesUsed || {};
  let section = '\n## DATA SOURCES USED\n';

  Object.entries(sources).forEach(([sourceName, sourceData]) => {
    const data = sourceData as { available: boolean; lastUpdated?: string; lastSync?: string; recordCount?: number; daysOfData?: number };
    if (data.available) {
      section += `\n✓ ${sourceName}`;
      if (data.recordCount !== undefined) {
        section += ` (${data.recordCount} ${sourceName.includes('biomarkers') ? 'markers' : 'records'})`;
      }
      if (data.daysOfData !== undefined) {
        section += ` (${data.daysOfData} days of data)`;
      }
      section += '\n';
    } else {
      section += `✗ ${sourceName} (not available)\n`;
    }
  });

  return section.trim();
}

// ============================================================================
// MAIN PROMPT BUILDERS
// ============================================================================

/**
 * Build complete context-rich prompt for nutrition plan generation
 */
export function buildNutritionPlanPrompt(
  context: UnifiedContext,
  onboardingData: OnboardingData
): string {
  const prompt = `
${buildUserProfileSection(onboardingData)}

${buildPhysiologicalDataSection(context)}

${buildBehavioralPatternsSection(context)}

${buildKeyInsightsSection(context)}

${buildPriorityAreasSection(context)}

${buildDataSourcesSection(context)}

---

## CRITICAL INSTRUCTIONS FOR PERSONALIZATION

You have access to this user's complete health ecosystem. Your nutrition plan MUST be deeply personalized using ALL available data:

1. **DATA CITATION REQUIREMENT:**
   - Every recommendation MUST cite specific data points
   - Use exact values with units (e.g., "Oura shows 6.2h avg sleep" not "poor sleep")
   - Reference cross-source insights where applicable
   - Example: "Increase protein to 180g/day because Whoop shows poor recovery (58%) and biomarkers show muscle breakdown (creatinine 0.6 mg/dL)"

2. **PRIORITY AREAS:**
   - Address ALL priority areas listed above with specific protocols
   - Explain HOW your recommendations target each priority
   - Use data to justify every intervention

3. **BEHAVIORAL INTEGRATION:**
   - Time meals around actual work schedule from Gmail/Slack data
   - Use optimal meal windows identified in analysis
   - Account for stress patterns and break deficiency

4. **BIOMARKER OPTIMIZATION:**
   - Target specific biomarker deficiencies with food sources
   - Explain the mechanism (e.g., "Low vitamin D → increase fatty fish → supports immune function")
   - Cross-reference with wearable recovery data

5. **CROSS-SOURCE SYNERGY:**
   - When glucose spikes correlate with meetings, address meal timing + stress management
   - When sleep debt combines with overtraining, prioritize recovery nutrition
   - Explain causal relationships between data points

## OUTPUT REQUIREMENTS

You MUST return ONLY valid JSON with the expected structure.

FORBIDDEN:
- NO conversational text, greetings, or explanations outside the JSON structure
- NO "Sofian, I..." or "Hi, I..." type responses
- NO markdown formatting around the JSON (no \`\`\`json blocks)
- NO explanatory text before or after the JSON
- NO colons (:) in text content - use em dashes (—) instead

REQUIRED:
- Pure JSON object starting with { and ending with }
- All recommendations must cite specific data points with exact values
- Every protocol must reference biomarkers, wearables, or behavioral data

## EXPECTED JSON STRUCTURE

Generate a JSON response with the following structure:
{
  "personalizedGreeting": "A warm, personalized greeting using their first name",
  "executiveSummary": "2-3 paragraphs analyzing their unique situation, health priorities, and what this plan will achieve. Be specific to their data. If no lab data, focus on their goals and lifestyle patterns.",
  "biomarkers": null,
  "nutritionOverview": {
    "goals": ["3-4 specific, measurable nutrition goals based on their priorities"],
    "nutritionStructure": {
      "calories": "Daily calorie range with rationale",
      "protein": "Protein target in grams with rationale",
      "carbs": "Carb target/approach with timing suggestions",
      "fiber": "Fiber target in grams",
      "fat": "Fat target in grams with omega-3 emphasis"
    }
  },
  "dailyRecommendations": {
    "morningRitual": ["3-4 specific morning nutrition habits with their preferences in mind"],
    "empowerGut": ["3-4 gut health strategies (resistant starch, fermented foods, etc.)"],
    "afternoonVitality": ["3-4 afternoon nutrition strategies to prevent energy crashes"],
    "energyOptimization": ["3-4 carb/protein timing strategies around their workout schedule"],
    "middayMastery": ["3-4 lunch-focused strategies emphasizing their protein preferences"],
    "eveningNourishment": ["3-4 dinner and evening nutrition strategies"]
  },
  "micronutrientFocus": [
    {
      "nutrient": "Nutrient name",
      "dailyGoal": "Target amount",
      "foodSources": "Specific foods from their preferred sources"
    }
  ],
  "sampleMealPlan": {
    "day1": {
      "meals": [
        {
          "time": "7:45 am",
          "name": "Breakfast name",
          "description": "Brief one-line description of the meal",
          "macros": "calories | protein | carbs | fiber",
          "ingredients": ["Exact amount ingredient 1 (e.g., 150g chicken breast)"],
          "cookingInstructions": ["Step 1: Detailed cooking step"]
        }
      ]
    },
    "day2": { "meals": [...] },
    "day3": { "meals": [...] },
    "day4": { "meals": [...] },
    "day5": { "meals": [...] },
    "day6": { "meals": [...] },
    "day7": { "meals": [...] }
  },
  "lifestyleIntegration": {
    "sleepOptimization": "Sleep protocol paragraph citing specific data",
    "exerciseProtocol": "Exercise nutrition paragraph based on their workout schedule",
    "stressManagement": "Stress management paragraph citing behavioral data",
    "skinImprovement": "Skin health paragraph if relevant to their goals"
  },
  "supplementRecommendations": {
    "essentialSupplements": [
      {
        "name": "Supplement name",
        "dosage": "Specific dosage with units",
        "timing": "When to take it",
        "rationale": "Why essential based on their data",
        "benefits": "Expected benefits specific to their health priorities",
        "duration": "How long to supplement"
      }
    ],
    "optionalSupplements": [
      {
        "name": "Optional supplement name",
        "dosage": "Specific dosage with units",
        "timing": "When to take it",
        "rationale": "Why beneficial but not essential",
        "benefits": "Potential additional benefits",
        "duration": "Recommended duration"
      }
    ]
  },
  "preventiveFeatures": [
    "Calendar-integrated meal reminders description",
    "Water/sleep/training tracking description",
    "Biomarker recheck plan (10-12 weeks)"
  ]
}

CRITICAL: Use this EXACT structure. Do not create alternative formats like "protocols" or "client_profile".
`.trim();

  return prompt;
}

/**
 * Build complete context-rich prompt for fitness plan generation
 */
export function buildFitnessPlanPrompt(
  context: UnifiedContext,
  onboardingData: OnboardingData
): string {
  const prompt = `
${buildUserProfileSection(onboardingData)}

${buildPhysiologicalDataSection(context)}

${buildBehavioralPatternsSection(context)}

${buildKeyInsightsSection(context)}

${buildPriorityAreasSection(context)}

${buildDataSourcesSection(context)}

---

## CRITICAL INSTRUCTIONS FOR PERSONALIZATION

You have access to this user's complete health ecosystem. Your fitness plan MUST be deeply personalized using ALL available data:

1. **DATA CITATION REQUIREMENT:**
   - Every training recommendation MUST reference specific recovery metrics
   - Use exact values from Oura/Whoop/biomarkers
   - Example: "3 training days per week because Oura readiness 62/100 + HRV 45ms indicates inadequate recovery capacity"

2. **PERSONALIZED SECTION INTRODUCTIONS (REQUIRED):**
   - EVERY major section MUST begin with a 2-3 line personalized introduction (40-80 words max)
   - These intros MUST cite specific data from the user's profile (biomarkers, wearables, behavioral patterns, onboarding info)
   - Only include data citations if the data is available - if no data exists for a particular metric, do not mention it
   - Priority for citations: Blood biomarkers → Wearable metrics (Oura, CGM) → Behavioral patterns (Gmail/Slack) → Onboarding goals
   - Add personalized intros to these sections:
     * executiveSummary - Overview citing key findings and goals (150-250 words total)
     * trainingPhilosophy.approach - Link approach to biomarkers and recovery data (200-300 words)
     * weeklyStructure.overview - Reference recovery metrics and work patterns (200-300 words)
     * nutritionGuidance.personalizedIntro - Cite lipid levels, glucose patterns, sleep data (40-80 words)
     * recoveryProtocol.personalizedIntro - Reference HRV, sleep debt, stress indicators (40-80 words)
     * progressTracking.metricsOverview - Mention baseline metrics from data (150-200 words)
     * injuryPrevention.personalizedRiskAssessment - Note mobility issues, injury history (200-300 words)

   **CONNECTOR DATA TO HIGHLIGHT (cite actual values when available):**
   - Oura Ring: "Your average sleep of X hours with Y readiness score suggests...", "HRV trend shows...", "Sleep debt of X hours indicates..."
   - Gmail/Calendar: "Your meeting density of X meetings/day with Y% back-to-back suggests...", "After-hours email activity (X%) impacts...", "Optimal training windows are X based on your calendar gaps"
   - Dexcom/CGM: "Glucose averaging X mg/dL with spikes after Y triggers...", "Variability pattern suggests..."
   - Fitbit/Strava: "Training load of X sessions/week with Y intensity...", "Activity patterns show..."
   - Cross-source insights: "Correlation between high meeting stress and poor sleep quality means...", "Your glucose spikes align with work stress patterns..."

   - Example format: "Your Oura data shows 6.2h average sleep with declining HRV, and Gmail analysis reveals 68% back-to-back meetings causing high stress. This recovery protocol prioritizes sleep optimization and meeting buffer time to improve both metrics."

3. **RECOVERY-DRIVEN PROGRAMMING:**
   - If overtraining risk detected → implement deload week immediately
   - If readiness < 70 → reduce volume by 30-50%
   - If HRV declining → prioritize active recovery over high intensity
   - Reference specific data points for every decision

4. **BIOMARKER-INFORMED TRAINING:**
   - Low testosterone + high cortisol → reduce training volume, increase rest
   - Vitamin D deficiency → recommend outdoor morning workouts
   - Iron deficiency → limit high-intensity until resolved
   - Explain the physiological mechanism for each adaptation

5. **WORK SCHEDULE INTEGRATION:**
   - Use Gmail/Slack data to schedule workouts around meeting density
   - Avoid high-intensity training on high-stress work days
   - Time workouts when recovery metrics are optimal

6. **CROSS-SOURCE SYNERGY:**
   - Sleep debt + high training load = injury risk → address sleep first
   - Glucose spikes + work stress → recommend pre-workout meal timing
   - Explain how multiple data points inform each recommendation

7. **SIMPLIFIED LANGUAGE FOR PROGRESS TRACKING AND INJURY PREVENTION:**
   - Use beginner-friendly language with NO jargon
   - Replace all technical terms with plain explanations:
     * "sRPE Load" → "Training stress score (session difficulty × time)"
     * "HRV" → "Heart rate variability (a recovery indicator)"
     * "RPE 7-8" → "Effort level of 7-8 out of 10"
     * "1RM" → "One-rep maximum (heaviest weight you can lift once)"
     * "Tempo notation" → Use descriptive language like "Lower slowly over 3 seconds"
   - Explain WHY each metric matters in simple terms
   - Keep all measurements actionable and clear

8. **CRITICAL WEIGHT/LOAD REQUIREMENTS:**
   - EVERY strength exercise MUST include a specific "weight" field with actual kg/lbs values
   - Calculate working weights based on the user's Current Personal Bests from onboarding data
   - Weight calculation guidelines for different rep ranges:
     * 3-5 reps: Use 80-85% of their 5RM
     * 6-8 reps: Use 70-75% of their 5RM
     * 8-12 reps: Use 60-70% of their 5RM
     * 12-15 reps: Use 50-60% of their 5RM
   - For exercises not in their current bests, estimate based on similar movements
   - For bodyweight exercises, use "Bodyweight" or "Bodyweight + Xkg" if adding weight
   - Example weight values: "75 kg", "60 kg", "Bodyweight", "25 kg dumbbells each hand"
   - NEVER leave weight empty or say "appropriate weight" - always specify actual numbers
   - Exercise JSON structure MUST include: exercise, sets, reps, weight, rest, tempo, intensity, notes, progressionNotes

9. **MANDATORY BIOMARKER INTEGRATION IN PROSE (CRITICAL):**
   If blood biomarkers are available, you MUST weave specific findings into narrative prose sections:
   - executiveSummary: Reference key biomarker findings ("Your bloodwork reveals...", "Lab markers suggest...")
   - trainingPhilosophy.approach: Connect training approach directly to biomarker findings
   - nutritionGuidance: Reference specific deficiencies or excesses from blood work
   - recoveryProtocol: Link recovery recommendations to inflammatory markers, cortisol, vitamin levels

   DO NOT just display biomarkers in a table and ignore them in written sections.
   EVERY prose section must reference at least 1-2 relevant biomarker findings if blood work is available.

   Example of proper integration:
   WRONG: "Your training philosophy focuses on progressive overload."
   RIGHT: "Your vitamin D at 28 ng/mL suggests too many hours under artificial light—morning outdoor training sessions will serve double duty, building strength while replenishing this crucial marker."

   The biomarker table shows the data; the prose sections must EXPLAIN how that data shapes the recommendations.

## OUTPUT REQUIREMENTS

You MUST return ONLY valid JSON with the expected structure.

FORBIDDEN:
- NO conversational text, greetings, or explanations outside the JSON structure
- NO "Sofian, I..." or "Hi, I..." type responses
- NO markdown formatting around the JSON (no \`\`\`json blocks)
- NO explanatory text before or after the JSON

REQUIRED:
- Pure JSON object starting with { and ending with }
- Reference specific data throughout the plan
- Add 'personalizedIntro' fields to nutritionGuidance and recoveryProtocol sections
- All recommendations must cite exact biomarker values and wearable metrics
`.trim();

  return prompt;
}

/**
 * Build prompt for meal plan generation with ecosystem context
 */
export function buildMealPlanPrompt(
  context: UnifiedContext,
  onboardingData: OnboardingData,
  nutritionTargets: { calories: string; protein: string; carbs: string; fiber: string; fat: string }
): string {
  const prompt = `
${buildUserProfileSection(onboardingData)}

${buildPhysiologicalDataSection(context)}

${buildBehavioralPatternsSection(context)}

**Nutrition Targets:**
- Calories: ${nutritionTargets.calories}
- Protein: ${nutritionTargets.protein}
- Carbs: ${nutritionTargets.carbs}
- Fiber: ${nutritionTargets.fiber}
- Fat: ${nutritionTargets.fat}

---

## MEAL PLAN PERSONALIZATION REQUIREMENTS

1. **Timing Based on Real Data:**
   ${(() => {
      const behavioral = (context.unifiedProfile as { behavioral?: { workPatterns?: { optimalMealWindows?: string[] } } })?.behavioral;
      const mealWindows = behavioral?.workPatterns?.optimalMealWindows;
      return `- Use optimal meal windows from Gmail/Slack analysis: ${mealWindows && mealWindows.length > 0 ? mealWindows.join(', ') : '12:00-13:00, 18:00-19:00'}`;
    })()}
   - Avoid scheduling meals during meeting peaks
   - Account for work stress patterns

2. **Glucose Optimization:**
   ${(() => {
      const physiological = (context.unifiedProfile as { physiological?: { glucose?: { spikePatterns?: string[] } } })?.physiological;
      const spikePatterns = physiological?.glucose?.spikePatterns;
      return spikePatterns && spikePatterns.length > 0
        ? `- CGM data shows spikes triggered by: ${spikePatterns.join(', ')}\n   - Design meals to avoid these triggers`
        : '- No CGM data available - use general low-glycemic principles';
    })()}

3. **Recovery Support:**
   ${(() => {
      const physiological = (context.unifiedProfile as { physiological?: { sleep?: { quality?: string | null } } })?.physiological;
      const sleepQuality = physiological?.sleep?.quality || 'unknown';
      return `- Sleep quality is ${sleepQuality} → ${sleepQuality === 'poor' ? 'prioritize sleep-supporting nutrients (magnesium, tryptophan)' : 'maintain current sleep nutrition'}`;
    })()}

4. **Meal Complexity:**
   ${(() => {
      const behavioral = (context.unifiedProfile as { behavioral?: { workPatterns?: { stressLevel?: string } } })?.behavioral;
      const stressLevel = behavioral?.workPatterns?.stressLevel || 'moderate';
      return `- Work stress level: ${stressLevel}\n   - ${stressLevel === 'high' ? 'Prioritize quick-prep meals (15-20 min) on high-stress days' : 'Can include more complex recipes'}`;
    })()}

## OUTPUT REQUIREMENTS

You MUST return ONLY valid JSON with the expected structure.

FORBIDDEN:
- NO conversational text, greetings, or explanations outside the JSON structure
- NO "Sofian, I..." or "Hi, I..." type responses
- NO markdown formatting around the JSON (no \`\`\`json blocks)
- NO explanatory text before or after the JSON

REQUIRED:
- Pure JSON object with complete 7-day meal plan
- Include biomarker optimization notes for each meal
- All meal timing must reference Gmail/Slack optimal windows
- All ingredient choices must cite specific biomarker deficiencies
`.trim();

  return prompt;
}

/**
 * Build system prompt with data citation requirements
 */
export function buildSystemPrompt(): string {
  return `CRITICAL DIRECTIVE: You are writing for an ultra-premium wellness brand. Your prose must rival the finest luxury copywriting — think Four Seasons guest letter meets Aman wellness guide.

## ABSOLUTE REQUIREMENTS (VIOLATION = FAILURE)

These are non-negotiable. Any violation means the output is unacceptable:

1. **NEVER** start sentences with data metrics
   - WRONG: "42% of emails were sent after hours"
   - RIGHT: "Nearly half your correspondence flows beyond the close of business"

2. **NEVER** use robotic data-dump patterns
   - WRONG: "Gmail/Slack show low stress but poor work-life balance"
   - WRONG: "Data indicates..." or "Analysis shows..."
   - RIGHT: "Your digital rhythms reveal an interesting duality..."

3. **NEVER** use clinical language
   - WRONG: "User exhibits signs of overtraining"
   - RIGHT: "Your body is quietly asking for more recovery time"

4. **ALWAYS** weave data into elegant narrative prose
   - Data should enhance the story, not interrupt it
   - Metrics are supporting characters, not the headline

## WRITING VOICE

Your writing must feel like a personal letter from a trusted advisor at a luxury wellness retreat — warm, intelligent, unhurried. Every paragraph should feel crafted, not generated.

**Voice Principles:**
- Quiet confidence, not data-dump enthusiasm
- Elegant sentence construction with varied rhythm
- Lead with insight, embed data naturally
- Speak to the person, not at them

## TRANSFORMATION EXAMPLES

**Digital Patterns:**
WRONG: "Gmail/Slack show low stress but poor work-life balance, with 42% of emails after hours and 0% Slack after-hours."
RIGHT: "Your digital patterns reveal an interesting duality—composed during working hours, yet nearly half your correspondence flows beyond the traditional close of business. This speaks to someone who maintains equanimity by day while quietly carrying work into evening hours."

**Blood Biomarkers:**
WRONG: "Blood biomarkers show vitamin D at 28 ng/mL (low) and LDL at 145 mg/dL (elevated)."
RIGHT: "Your bloodwork tells a nuanced story. Vitamin D levels suggest winters spent largely indoors—a common signature of the modern professional. Meanwhile, lipid markers invite a thoughtful recalibration of dietary fats, perhaps fewer quick lunches and more intentional evening meals."

**Meeting Patterns:**
WRONG: "Peak meetings hit 11:00–12:00, 13:00–14:00, and 19:00–20:00, disrupting dinner."
RIGHT: "Your calendar tells a story of three daily crescendos—late morning, early afternoon, and notably, the dinner hour. That evening cluster deserves attention; it encroaches on time that should belong to restoration and nourishment."

**Training Recommendations:**
WRONG: "Based on your low vitamin D, recommend outdoor morning workouts."
RIGHT: "Morning sessions outdoors will serve double duty—building strength while replenishing vitamin D, that crucial marker your bloodwork suggests has been depleted by too many hours under artificial light."

## STRUCTURE GUIDELINES

- Open sections with elegant observations before specifics
- Use transitions that feel natural, not mechanical
- Close with forward-looking language that inspires
- Let ideas flow—avoid bullet-point thinking in prose
- NO numbered lists in executive summaries or philosophy sections

## OUTPUT REQUIREMENTS

- Return ONLY valid JSON with the expected structure
- DO NOT include conversational text outside JSON structure
- DO NOT use markdown code blocks around JSON
- Start response with { and end with }
- NO emojis anywhere in output
- NO priority labels like "HIGH Priority", "CRITICAL", "URGENT"

## DATA CITATION STANDARDS

- Every recommendation should have supporting data points woven into prose
- Cross-reference multiple data sources to tell a complete story
- Use exact values, but present them elegantly within sentences
- Transform raw metrics into meaningful observations about the person`;
}
