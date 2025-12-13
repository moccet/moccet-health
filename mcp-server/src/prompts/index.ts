/**
 * MCP Prompts
 *
 * Pre-built prompt templates for common health tasks.
 * These help users get started with specific analyses.
 */

import { Prompt, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export interface ServerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  userEmail: string;
  baseUrl: string;
}

type PromptHandler = (args: Record<string, any>, config: ServerConfig) => Promise<GetPromptResult>;

// =============================================================================
// PROMPT DEFINITIONS
// =============================================================================

export const promptDefinitions: Prompt[] = [
  {
    name: 'analyze-deficiency',
    description: 'Deep dive analysis on a specific nutrient deficiency, including causes, symptoms, and solutions',
    arguments: [
      {
        name: 'nutrient',
        description: 'The nutrient to analyze (e.g., "vitamin_d", "iron", "b12")',
        required: true,
      },
    ],
  },
  {
    name: 'optimize-sleep',
    description: 'Comprehensive sleep optimization plan based on Oura data and lifestyle factors',
    arguments: [
      {
        name: 'focusArea',
        description: 'Specific area to focus on: "duration", "quality", "consistency", or "all"',
        required: false,
      },
    ],
  },
  {
    name: 'supplement-protocol',
    description: 'Create a personalized supplement protocol based on blood work deficiencies',
    arguments: [
      {
        name: 'budget',
        description: 'Monthly budget: "low" (<$50), "medium" ($50-100), or "high" (>$100)',
        required: false,
      },
    ],
  },
  {
    name: 'weekly-health-review',
    description: 'Weekly summary of health metrics with trends and actionable recommendations',
    arguments: [],
  },
  {
    name: 'glucose-optimization',
    description: 'Analyze glucose patterns and provide dietary/lifestyle recommendations',
    arguments: [
      {
        name: 'goal',
        description: 'Primary goal: "reduce_spikes", "improve_stability", or "optimize_fasting"',
        required: false,
      },
    ],
  },
  {
    name: 'recovery-plan',
    description: 'Create a recovery optimization plan based on HRV and readiness data',
    arguments: [],
  },
];

// =============================================================================
// PROMPT HANDLERS
// =============================================================================

async function analyzeDeficiency(args: Record<string, any>, config: ServerConfig): Promise<GetPromptResult> {
  const { nutrient } = args;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please analyze my ${nutrient} status in detail.

First, read my blood biomarkers from the health://blood/biomarkers resource to get my actual ${nutrient} level.

Then provide:

1. **Current Status**
   - My exact ${nutrient} level and what it means
   - How it compares to optimal ranges (not just "normal" reference ranges)
   - Severity assessment

2. **Root Cause Analysis**
   - Common causes of ${nutrient} deficiency
   - Which might apply to me based on my health profile
   - Dietary factors that could contribute

3. **Health Implications**
   - Short-term effects I might be experiencing
   - Long-term risks if not addressed
   - How it interacts with other biomarkers

4. **Action Plan**
   - Specific supplement recommendations (brand, dose, form)
   - Dietary changes to support ${nutrient} levels
   - Lifestyle modifications
   - Timeline for improvement

5. **Monitoring**
   - When to retest
   - What levels to target
   - Signs of improvement to watch for

Use the supplements_search and supplements_recommend tools if I need supplementation.
If scheduling a retest would help, use calendar_find_slots to suggest times.`,
        },
      },
    ],
  };
}

async function optimizeSleep(args: Record<string, any>, config: ServerConfig): Promise<GetPromptResult> {
  const { focusArea = 'all' } = args;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Create a comprehensive sleep optimization plan for me.

First, read my sleep data from health://oura/sleep and recovery data from health://oura/recovery.

Focus area: ${focusArea}

Please provide:

1. **Current Sleep Assessment**
   - My average sleep score and what it indicates
   - Sleep duration vs. my needs
   - Deep sleep and REM analysis
   - Sleep efficiency evaluation

2. **Pattern Analysis**
   - Best and worst sleep nights - what differed?
   - Consistency of sleep schedule
   - Correlation with other factors (stress, activity, etc.)

3. **Personalized Recommendations**
   ${focusArea === 'duration' || focusArea === 'all' ? `
   **Duration Optimization:**
   - Ideal bedtime and wake time for me
   - How to gradually adjust if needed
   - Weekend vs. weekday strategy` : ''}

   ${focusArea === 'quality' || focusArea === 'all' ? `
   **Quality Improvement:**
   - Deep sleep enhancement strategies
   - REM optimization techniques
   - Environmental factors to address` : ''}

   ${focusArea === 'consistency' || focusArea === 'all' ? `
   **Consistency Building:**
   - Circadian rhythm optimization
   - Pre-sleep routine suggestions
   - Wake-up routine optimization` : ''}

4. **Action Items**
   - Tonight: One thing to try immediately
   - This week: 3 habits to implement
   - This month: Longer-term changes

5. **Tracking Plan**
   - What metrics to watch
   - How to know if it's working
   - When to adjust the plan

If helpful, use spotify_create_playlist to create a wind-down playlist.
Use calendar_create_event to schedule consistent sleep/wake times as reminders.`,
        },
      },
    ],
  };
}

async function supplementProtocol(args: Record<string, any>, config: ServerConfig): Promise<GetPromptResult> {
  const { budget = 'medium' } = args;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Create a personalized supplement protocol based on my blood work.

First, read my deficiencies from health://blood/deficiencies and my full biomarkers from health://blood/biomarkers.

Budget: ${budget} (${budget === 'low' ? '<$50/month' : budget === 'medium' ? '$50-100/month' : '>$100/month'})

Please provide:

1. **Priority Assessment**
   - Rank my deficiencies by severity and impact
   - Which need immediate attention
   - Which can wait or be addressed through diet

2. **Core Protocol**
   For each recommended supplement:
   - Specific product recommendation (use supplements_search)
   - Exact dosage and form (e.g., D3 vs D2, methylated B12)
   - Best time to take
   - With food or without
   - Any interactions to avoid

3. **Timing Schedule**
   - Morning supplements
   - Afternoon supplements (if any)
   - Evening supplements
   - Cycling recommendations (if applicable)

4. **Budget Breakdown**
   - Cost per supplement per month
   - Total monthly cost
   - Priority order if budget is tight

5. **Expected Timeline**
   - When to expect improvements
   - When to retest each marker
   - Signs of over-supplementation to watch for

6. **Food-First Options**
   - Dietary sources for each nutrient
   - Meal ideas to boost levels naturally
   - Foods to avoid that deplete these nutrients

Use supplements_recommend to get specific product suggestions.
If I want to purchase, use shopping_add_to_cart (I'll approve).`,
        },
      },
    ],
  };
}

async function weeklyHealthReview(args: Record<string, any>, config: ServerConfig): Promise<GetPromptResult> {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Provide my weekly health review.

Read all available health data:
- health://context/unified for the full picture
- health://oura/sleep for sleep trends
- health://oura/recovery for HRV and readiness
- health://dexcom/glucose for glucose patterns (if available)
- health://priorities for areas needing attention

Please provide:

1. **Week at a Glance**
   - Overall health score/status
   - Key wins this week
   - Areas that declined
   - Most important metric changes

2. **Sleep Summary**
   - Average sleep score and trend
   - Best/worst nights and why
   - Sleep debt status

3. **Recovery Status**
   - HRV trend
   - Readiness patterns
   - Training load assessment

4. **Glucose Health** (if CGM connected)
   - Average glucose and trend
   - Spike frequency
   - Time in range

5. **Key Insights**
   - Cross-domain patterns noticed
   - Correlations between metrics
   - Hidden trends

6. **Action Items for Next Week**
   - Top 3 priorities
   - Specific, actionable steps
   - Metrics to focus on

7. **Wins to Celebrate**
   - Progress made
   - Good habits maintained
   - Improvements noticed

Would you like me to schedule any health activities for next week using the calendar tools?`,
        },
      },
    ],
  };
}

async function glucoseOptimization(args: Record<string, any>, config: ServerConfig): Promise<GetPromptResult> {
  const { goal = 'improve_stability' } = args;

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Help me optimize my glucose levels.

Read my glucose data from health://dexcom/glucose and unified context from health://context/unified.

Primary goal: ${goal}

Please provide:

1. **Current Glucose Assessment**
   - Average glucose and what it means
   - Variability analysis
   - Time in range percentage
   - Spike patterns and frequency

2. **Pattern Analysis**
   - When do spikes typically occur?
   - What foods/activities correlate with spikes?
   - Fasting glucose trends
   - Post-meal patterns

3. **Goal-Specific Recommendations**
   ${goal === 'reduce_spikes' ? `
   **Spike Reduction Strategy:**
   - Pre-meal habits to blunt response
   - Food combining strategies
   - Post-meal activity recommendations
   - Specific foods to limit` : ''}

   ${goal === 'improve_stability' ? `
   **Stability Improvement:**
   - Meal timing optimization
   - Fiber and protein strategies
   - Stress management (cortisol affects glucose)
   - Sleep optimization (poor sleep = higher glucose)` : ''}

   ${goal === 'optimize_fasting' ? `
   **Fasting Glucose Optimization:**
   - Evening meal timing and composition
   - Pre-bed routine adjustments
   - Morning routine impact
   - Liver health considerations` : ''}

4. **Dietary Protocol**
   - Breakfast recommendations
   - Lunch guidelines
   - Dinner approach
   - Snack strategies

5. **Lifestyle Factors**
   - Movement timing (when to walk)
   - Stress management techniques
   - Sleep optimization for glucose
   - Meal timing windows

6. **Tracking Plan**
   - What patterns to watch
   - How to experiment safely
   - Success metrics`,
        },
      },
    ],
  };
}

async function recoveryPlan(args: Record<string, any>, config: ServerConfig): Promise<GetPromptResult> {
  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Create a recovery optimization plan for me.

Read my recovery data from health://oura/recovery and sleep data from health://oura/sleep.

Please provide:

1. **Recovery Assessment**
   - Current HRV status and trend
   - Readiness score analysis
   - Recovery capacity evaluation
   - Training load assessment

2. **HRV Analysis**
   - What my HRV numbers mean
   - Baseline vs. current
   - Factors affecting my HRV
   - Optimal HRV targets for me

3. **Recovery Optimization**

   **Sleep for Recovery:**
   - Sleep timing for optimal recovery
   - Sleep environment optimization
   - Pre-sleep routine for HRV

   **Stress Management:**
   - Techniques to improve HRV
   - Breathing exercises
   - When to prioritize recovery

   **Movement & Training:**
   - How to balance training with recovery
   - Active recovery strategies
   - When to push vs. rest

4. **Daily Recovery Protocol**
   - Morning routine for recovery
   - Throughout the day
   - Evening wind-down

5. **Weekly Rhythm**
   - High-intensity days
   - Recovery days
   - How to read your data to decide

6. **Red Flags**
   - Signs of overtraining
   - When to take extra rest
   - Recovery debt indicators

If a relaxation playlist would help, I can create one with spotify_create_playlist.
Want me to schedule recovery activities in your calendar?`,
        },
      },
    ],
  };
}

// =============================================================================
// EXPORT HANDLERS
// =============================================================================

export const promptHandlers: Record<string, PromptHandler> = {
  'analyze-deficiency': analyzeDeficiency,
  'optimize-sleep': optimizeSleep,
  'supplement-protocol': supplementProtocol,
  'weekly-health-review': weeklyHealthReview,
  'glucose-optimization': glucoseOptimization,
  'recovery-plan': recoveryPlan,
};
