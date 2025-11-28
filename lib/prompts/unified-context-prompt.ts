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
## USER PROFILE

**Demographics:**
- Name: ${onboardingData.fullName}
- Age: ${onboardingData.age} years old
- Gender: ${onboardingData.gender}
- Weight: ${onboardingData.weight}
- Height: ${onboardingData.height}

**Primary Goals:**
- Main Priority: ${onboardingData.mainPriority || onboardingData.primaryGoal || 'Not specified'}
- Driving Goal: ${onboardingData.drivingGoal || 'Not specified'}

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

**Output Format:** Return ONLY valid JSON with the expected structure. Do NOT use colons (:) anywhere in text content - use em dashes (—) instead.
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

2. **RECOVERY-DRIVEN PROGRAMMING:**
   - If overtraining risk detected → implement deload week immediately
   - If readiness < 70 → reduce volume by 30-50%
   - If HRV declining → prioritize active recovery over high intensity
   - Reference specific data points for every decision

3. **BIOMARKER-INFORMED TRAINING:**
   - Low testosterone + high cortisol → reduce training volume, increase rest
   - Vitamin D deficiency → recommend outdoor morning workouts
   - Iron deficiency → limit high-intensity until resolved
   - Explain the physiological mechanism for each adaptation

4. **WORK SCHEDULE INTEGRATION:**
   - Use Gmail/Slack data to schedule workouts around meeting density
   - Avoid high-intensity training on high-stress work days
   - Time workouts when recovery metrics are optimal

5. **CROSS-SOURCE SYNERGY:**
   - Sleep debt + high training load = injury risk → address sleep first
   - Glucose spikes + work stress → recommend pre-workout meal timing
   - Explain how multiple data points inform each recommendation

**Output Format:** Return ONLY valid JSON with the expected structure. Reference specific data throughout your plan.
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

**Output Format:** Return JSON with 7-day meal plan. Include biomarker optimization notes for each meal.
`.trim();

  return prompt;
}

/**
 * Build system prompt with data citation requirements
 */
export function buildSystemPrompt(): string {
  return `You are an elite health optimization expert with access to the user's complete health ecosystem including biomarkers, wearable data, and behavioral patterns.

CRITICAL REQUIREMENTS:
1. Every recommendation MUST reference specific data points from the user's profile
2. Use exact values with units (e.g., "Oura sleep 6.2h" not "poor sleep")
3. Explain causal relationships between data sources (e.g., "glucose spikes correlate with meeting stress")
4. Address ALL priority areas with data-driven protocols
5. When multiple data sources agree, explicitly state the convergence
6. Never make generic recommendations - everything must be tied to their actual measurements

Your output will be reviewed for:
- Data citation density (every recommendation should have 2-3 supporting data points)
- Cross-source integration (using multiple data sources together)
- Specificity (exact values, not qualitative descriptions)
- Actionability (clear protocols, not vague advice)`;
}
