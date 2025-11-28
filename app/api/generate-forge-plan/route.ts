import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildFitnessPlanPrompt, buildSystemPrompt } from '@/lib/prompts/unified-context-prompt';

export const maxDuration = 300;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formData, bloodAnalysis } = body;

    console.log('[FORGE-PLAN] Generating comprehensive fitness plan...');

    // Step 1: Aggregate unified context from ecosystem
    console.log('[FORGE-PLAN] Aggregating unified context from ecosystem data...');
    let unifiedContext = null;
    const userEmail = formData.email;

    if (userEmail) {
      try {
        const contextResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/aggregate-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            contextType: 'forge',
            forceRefresh: false,
          }),
        });

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          unifiedContext = contextData.context;
          console.log('[FORGE-PLAN] ✅ Unified context aggregated');
          console.log(`[FORGE-PLAN] Data Quality: ${contextData.qualityMessage?.split('\n')[0] || 'Unknown'}`);
        } else {
          console.log('[FORGE-PLAN] ⚠️ Context aggregation failed, using standard prompt');
        }
      } catch (error) {
        console.error('[FORGE-PLAN] Error aggregating context:', error);
        console.log('[FORGE-PLAN] Proceeding with standard prompt');
      }
    }

    const openai = getOpenAIClient();

    // Build the prompt (ecosystem-enriched or standard)
    const prompt = unifiedContext
      ? buildFitnessPlanPrompt(unifiedContext, formData)
      : buildForgePlanPrompt(formData, bloodAnalysis);

    const systemPrompt = unifiedContext
      ? buildSystemPrompt()
      : `You are an elite strength and conditioning coach and fitness expert. You create comprehensive, personalized fitness plans that are safe, effective, and scientifically grounded. You consider the client's complete profile including training history, goals, injuries, available equipment, and biomarkers when available.

Your plans are detailed, progressive, and designed for long-term results. You provide specific exercises, sets, reps, rest periods, and progression strategies. You also include recovery protocols, mobility work, and supplement recommendations when appropriate.`;

    console.log(`[FORGE-PLAN] Using ${unifiedContext ? 'ECOSYSTEM-ENRICHED' : 'STANDARD'} prompt`);
    console.log(`[FORGE-PLAN] Model: GPT-5 for superior reasoning and personalization`);

    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: `${systemPrompt}\n\n${prompt}`,
      reasoning: { effort: 'high' },
      text: { verbosity: 'high' }
    });

    let planContent = completion.output_text || '{}';

    // Strip markdown code blocks if present
    planContent = planContent.trim();
    if (planContent.startsWith('```json')) {
      planContent = planContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (planContent.startsWith('```')) {
      planContent = planContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    planContent = planContent.trim();

    const plan = JSON.parse(planContent);
    console.log('[FORGE-PLAN] ✅ Fitness plan generated successfully with GPT-5');

    return NextResponse.json({
      success: true,
      plan
    });

  } catch (error) {
    console.error('[FORGE-PLAN] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate fitness plan'
      },
      { status: 500 }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildForgePlanPrompt(formData: any, bloodAnalysis: any): string {
  // Extract fields with proper fallbacks for undefined values
  const fullName = formData.fullName || 'Client';
  const age = formData.age || '30';
  const gender = formData.gender || 'not specified';
  const weight = formData.weight || 'not specified';
  const height = formData.height || 'not specified';
  const primaryGoal = formData.primaryGoal || 'improve overall fitness';
  const timeHorizon = formData.timeHorizon || '3-6 months';
  const trainingDays = formData.trainingDays || '3-4';
  const injuries = formData.injuries || 'None';
  const movementRestrictions = formData.movementRestrictions || 'None';
  const medicalConditions = formData.medicalConditions || 'None';
  const medications = formData.medications || 'None';
  const supplements = formData.supplements || 'None';
  const equipment = formData.equipment || [];
  const trainingLocation = formData.trainingLocation || 'gym';
  const sessionLength = formData.sessionLength || '45-60 minutes';
  const exerciseTime = formData.exerciseTime || 'flexible';
  const sleepQuality = formData.sleepQuality || '7';
  const stressLevel = formData.stressLevel || '5';
  const trainingExperience = formData.trainingExperience || 'intermediate';
  const skillsPriority = formData.skillsPriority || 'balanced approach';
  const effortFamiliarity = formData.effortFamiliarity || 'somewhat familiar';
  const currentBests = formData.currentBests || 'not specified';
  const conditioningPreferences = formData.conditioningPreferences || 'moderate cardio';
  const sorenessPreference = formData.sorenessPreference || '5';
  const dailyActivity = formData.dailyActivity || 'moderately active';

  // Build biomarker summary if available
  let biomarkerContext = '';
  if (bloodAnalysis?.biomarkers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const concerns = bloodAnalysis.biomarkers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => ['High', 'Low', 'Needs Optimization'].includes(b.status))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => `${b.name}: ${b.value} (${b.status})`)
      .join(', ');

    if (concerns) {
      biomarkerContext = `\n\nBlood Biomarker Concerns:\n${concerns}\n\nConsider these in your recommendations for training intensity, recovery needs, and supplement suggestions.`;
    }
  }

  return `Create a comprehensive 7-day fitness plan for ${fullName}.

CLIENT PROFILE:
- Age: ${age}, Gender: ${gender}
- Weight: ${weight}, Height: ${height}
- Primary Goal: ${primaryGoal}
- Time Horizon: ${timeHorizon}
- Training Days Available: ${trainingDays} days per week
- Training Experience: ${trainingExperience}
- Session Length: ${sessionLength}
- Preferred Training Time: ${exerciseTime}
- Sleep Quality (1-10): ${sleepQuality}
- Stress Level (1-10): ${stressLevel}
- Daily Activity Level: ${dailyActivity}

TRAINING PREFERENCES:
- Skills Priority: ${skillsPriority}
- Conditioning Preferences: ${conditioningPreferences}
- Effort Familiarity: ${effortFamiliarity}
- Current Personal Bests: ${currentBests}
- Soreness Preference (1-10): ${sorenessPreference}

EQUIPMENT & LOCATION:
- Available Equipment: ${equipment?.join(', ') || 'None specified'}
- Training Location: ${trainingLocation}

HEALTH CONSIDERATIONS:
- Injuries: ${injuries || 'None'}
- Movement Restrictions: ${movementRestrictions || 'None'}
- Medical Conditions: ${medicalConditions || 'None'}
- Current Medications: ${medications || 'None'}
- Current Supplements: ${supplements || 'None'}
${biomarkerContext}

Generate a comprehensive fitness plan in JSON format with the following structure:

{
  "personalizedGreeting": "A welcoming message using their first name and acknowledging their goal",
  "executiveSummary": "2-3 paragraphs summarizing the plan's approach, key focuses, and what results to expect in their specified timeframe. Address their specific goal, experience level, and any limitations.",
  "trainingPhilosophy": {
    "approach": "3-4 detailed paragraphs explaining the specific training methodology being used for THIS client. Reference their specific goal (${primaryGoal}), experience level (${trainingExperience}), and available time (${trainingDays} days/week). Explain WHY this approach is optimal for THEM specifically. Include scientific reasoning and how it addresses their unique situation (injuries, stress level, sleep quality, etc).",
    "keyPrinciples": [
      "At least 6-8 detailed principles that guide this specific plan. Each principle should be 2-3 sentences explaining not just WHAT it is, but WHY it matters for THIS client. Reference their specific circumstances, goals, and limitations. Make these highly personalized - not generic principles."
    ],
    "progressionStrategy": "3-4 detailed paragraphs explaining exactly how this plan will progress week by week and month by month. Include specific progression metrics (weight, reps, sets, intensity), deload strategies, periodization approach, and how to know when to progress. Address their ${timeHorizon} timeline and explain what they can realistically achieve. Include specific examples (e.g., 'Week 1-4: Build base with 3x8-10 reps at RPE 7, Week 5-8: Increase to 4x6-8 at RPE 8')."
  },
  "weeklyStructure": {
    "overview": "3-4 detailed paragraphs describing the weekly training split and WHY this specific split is optimal for THIS client. Explain how it balances their goals, recovery capacity, available equipment, training time, and lifestyle factors (stress level: ${stressLevel}/10, sleep quality: ${sleepQuality}/10). Include the rationale behind exercise selection, volume distribution, and recovery placement throughout the week.",
    "trainingDays": ${trainingDays},
    "rationale": "2-3 paragraphs explaining the scientific reasoning behind this ${trainingDays}-day split. Why not more or fewer days? How does it optimize recovery, muscle protein synthesis, skill acquisition, and progress toward their specific goal? Reference their daily activity level (${dailyActivity}), session length (${sessionLength}), and preferred training time (${exerciseTime}).",
    "volumeDistribution": "Detailed breakdown of weekly training volume. Explain total sets per muscle group, how volume is distributed across the ${trainingDays} days, and why this distribution optimizes progress for their goal. Include specific numbers (e.g., 'Chest: 12-16 sets/week distributed as 8 sets Monday, 6 sets Thursday').",
    "intensityFramework": "Detailed explanation of how intensity is managed throughout the week. Use simple language like 'challenging but doable', 'moderate effort', 'easy pace' instead of technical terms. Explain how to determine if intensity is appropriate, and how to adjust based on recovery status. Reference their soreness preference (${sorenessPreference}/10) and effort familiarity (${effortFamiliarity}).",
    "focusAreas": [
      "For each of the ${trainingDays} training days, provide a detailed 2-3 sentence description of the focus, target muscle groups, movement patterns, intensity level, and how it fits into the weekly plan. Don't just list categories - explain the rationale and expected outcomes for each day."
    ]
  },
  "weeklyProgram": {
    "monday": {
      "dayName": "Monday",
      "focus": "e.g., Lower Body Strength",
      "duration": "${sessionLength}",
      "warmup": {
        "description": "Specific warm-up routine lasting 8-12 minutes",
        "exercises": [
          {
            "name": "Exercise name",
            "sets": "X sets",
            "reps": "X reps or X seconds",
            "notes": "Key coaching points"
          }
        ]
      },
      "mainWorkout": [
        {
          "exercise": "Exercise name",
          "sets": "X sets",
          "reps": "X reps",
          "rest": "X seconds/minutes",
          "tempo": "Controlled and steady",
          "intensity": "Challenging but doable - leave 2-3 reps in reserve",
          "notes": "Form cues and modifications",
          "progressionNotes": "How to progress this exercise"
        }
      ],
      "cooldown": {
        "description": "Cool-down routine lasting 5-8 minutes",
        "exercises": [
          {
            "name": "Stretch or mobility work",
            "duration": "X minutes or X reps",
            "notes": "Key points"
          }
        ]
      }
    },
    "tuesday": { /* Same structure as monday */ },
    "wednesday": { /* Same structure as monday */ },
    "thursday": { /* Same structure as monday */ },
    "friday": { /* Same structure as monday */ },
    "saturday": { /* Same structure as monday */ },
    "sunday": { /* Same structure as monday */ }
    // Include all 7 days with weekday names
    // For rest days, set focus as "Rest & Recovery" and provide active recovery activities
    // Use simple intensity language: "Easy pace", "Moderate effort", "Challenging but doable", "Very challenging - push hard"
    // Avoid technical terms like RPE, 1RM, tempo notation - use descriptive language instead

    // CRITICAL WORKOUT DURATION REQUIREMENTS:
    // - Warmup must include 4-6 exercises lasting 8-12 minutes total
    // - Main workout must include enough exercises to match the claimed duration (${sessionLength})
    // - For 45-60 minute sessions: Include 5-8 main exercises with 3-4 sets each
    // - For 30-45 minute sessions: Include 4-6 main exercises with 3-4 sets each
    // - For 60+ minute sessions: Include 8-12 main exercises with 3-5 sets each
    // - Each main exercise takes approximately 4-6 minutes including rest (e.g., 4 sets × 45s work + 60s rest = 6.7 minutes)
    // - Cooldown must include 3-5 stretches/mobility exercises lasting 5-8 minutes total
    // - The total duration must ACTUALLY match the claimed duration when you calculate: warmup time + (number of exercises × sets × (work time + rest time)) + cooldown time
    // - Example for 45-60 min: 10 min warmup + 35-40 min main workout (6 exercises × 6 min each) + 8 min cooldown = 53-58 minutes
  },
  "recoveryProtocol": {
    "dailyPractices": ["List of daily recovery habits"],
    "weeklyPractices": ["List of weekly recovery activities"],
    "sleepOptimization": "Specific sleep recommendations based on their sleep quality score",
    "stressManagement": "Stress management strategies based on their stress level",
    "mobilityWork": "Daily mobility routine with specific exercises"
  },
  "supplementRecommendations": {
    "essential": [
      {
        "supplement": "Name",
        "dosage": "Specific amount",
        "timing": "When to take",
        "rationale": "Why it's recommended for this client",
        "duration": "How long to use"
      }
    ],
    "optional": [
      {
        "supplement": "Name",
        "dosage": "Specific amount",
        "timing": "When to take",
        "rationale": "Why it's recommended",
        "duration": "How long to use"
      }
    ],
    "considerations": "Any cautions or interactions to be aware of"
  },
  "nutritionGuidance": {
    "proteinTarget": "3-4 paragraphs explaining their specific daily protein target in grams with detailed rationale. Break down by meals and timing. Reference their weight (${weight}), goal (${primaryGoal}), training volume, and activity level (${dailyActivity}). Explain why this amount is optimal for THEM specifically. Include protein source recommendations based on their preferences.",
    "calorieGuidance": "3-4 paragraphs with detailed calorie recommendations tailored to their goal (${primaryGoal}). Include specific ranges for training days vs rest days. Explain the rationale based on their weight, height, age, gender, activity level, and training frequency. Reference their current supplements (${supplements}) and how nutrition should complement them. If they have metabolic biomarker concerns, adjust accordingly and explain why.",
    "mealTiming": "3-4 detailed paragraphs on optimal meal timing for THIS person. Consider their preferred training time (${exerciseTime}), session length (${sessionLength}), work schedule, and daily routine. Provide specific meal timing recommendations around workouts with exact timing windows. Address their energy levels and how meal timing can optimize performance and recovery. Include pre-workout, intra-workout, and post-workout nutrition with specific examples.",
    "hydration": "2-3 paragraphs on personalized hydration strategy. Base recommendations on their training volume (${trainingDays} days/week), session length (${sessionLength}), conditioning preferences (${conditioningPreferences}), and body weight (${weight}). Include specific daily water intake targets, electrolyte timing, and signs of proper hydration. If they have relevant biomarkers (kidney function, etc.), reference them.",
    "macroBreakdown": "Detailed breakdown of recommended macronutrient distribution (protein/carbs/fats) in grams and percentages. Explain why this distribution is optimal for their specific goal, training style, and body composition. Include examples of what this looks like in actual meals.",
    "mealFrequency": "2-3 paragraphs explaining optimal meal frequency for THIS person based on their schedule, training time, and preferences. Include specific recommendations for number of meals per day and ideal timing.",
    "supplementTiming": "If they take supplements (${supplements}), provide 2-3 paragraphs on optimal timing for maximum benefit and absorption. Coordinate with their training schedule and meal timing."
  },
  "progressTracking": {
    "metricsOverview": "2-3 paragraphs explaining the importance of tracking progress for THIS specific person and their goal (${primaryGoal}). Explain how to track effectively and what frequency makes sense for their experience level (${trainingExperience}).",
    "weeklyMetrics": [
      "List 6-8 specific metrics they should track WEEKLY. Make these specific to their goal, training style, and available tracking methods. Include both objective measures (weight, reps, times) and subjective measures (energy, sleep quality, recovery). If they have wearables like Oura Ring connected, mention specific metrics to track from those devices. Reference their current bests (${currentBests}) to set baseline metrics."
    ],
    "monthlyMetrics": [
      "List 4-6 metrics to assess MONTHLY. Include body composition changes, performance benchmarks specific to their training, and relevant biomarkers they should recheck. If they have metabolic concerns from blood work, specify which markers to retest."
    ],
    "performanceBenchmarks": [
      "List 5-7 specific, measurable performance benchmarks to test monthly. These should be directly related to their training program and goals. Include specific exercises from their program with target improvements (e.g., 'Barbell Back Squat: Progress from X reps to Y reps at Z weight'). Reference their current bests and set realistic progression targets."
    ],
    "biometricTargets": "2-3 paragraphs on biometric targets based on their blood work and health data. If they have specific biomarker concerns, set targets for improvement and timeline. Explain what biomarkers to monitor and why they matter for their goals.",
    "reassessmentSchedule": "3-4 paragraphs detailing when and how to reassess the program. Include specific triggers for reassessment (plateaus, injuries, life changes, biomarker changes). Explain what to look for at 4-week, 8-week, and 12-week checkpoints. Reference their time horizon (${timeHorizon}) and explain the assessment schedule within that timeframe.",
    "progressionIndicators": "2-3 paragraphs explaining what 'good progress' looks like for THIS person at their experience level with their specific goal. Set realistic expectations and explain what rate of progress is healthy and sustainable."
  },
  "injuryPrevention": {
    "personalizedRiskAssessment": "3-4 paragraphs analyzing THIS person's specific injury risks based on their injuries (${injuries}), movement restrictions (${movementRestrictions}), training history (${trainingExperience}), age (${age}), and the demands of their program. Be highly specific about which movements or patterns pose the highest risk for THEM.",
    "commonRisks": [
      "List 5-7 specific injury risks for THIS person considering their current injuries, past injuries, movement restrictions, training style, experience level, and program demands. For each risk, explain WHY they're at risk (2-3 sentences)."
    ],
    "preventionStrategies": [
      "List 6-8 detailed prevention strategies specifically for THIS person. Each should be 2-3 sentences explaining exactly WHAT to do, WHEN to do it, and WHY it prevents their specific injury risks. Include prehab exercises, mobility work, load management, and technique cues relevant to their situation."
    ],
    "warningSignals": [
      "List 6-8 specific warning signals THIS person should watch for, based on their injury history and risk factors. For each signal, explain what it might indicate and what action to take (2-3 sentences)."
    ],
    "injuryProtocol": "2-3 paragraphs explaining exactly what to do if they experience pain or injury. Include when to rest, when to modify, when to seek professional help, and how to maintain fitness during recovery.",
    "mobilityPrescription": "3-4 paragraphs detailing specific daily mobility work for THIS person based on their movement restrictions and injury prevention needs. Include specific exercises, duration, and timing."
  },
  "adaptiveFeatures": {
    "energyBasedAdjustments": "3-4 paragraphs explaining how to adjust training based on energy levels, sleep quality (current: ${sleepQuality}/10), and stress (current: ${stressLevel}/10). Include specific modification protocols for high, normal, and low energy days. Reference their soreness preference (${sorenessPreference}/10) and explain how to balance pushing hard vs. backing off.",
    "highEnergyDay": "2-3 paragraphs with specific protocols for high energy days. Include exact modifications (adding sets, reps, exercises, or intensity). Make these specific to their program structure.",
    "normalEnergyDay": "1-2 paragraphs explaining how to execute the program as written when energy is normal.",
    "lowEnergyDay": "3-4 paragraphs with detailed protocols for low energy/high stress days. Include specific volume and intensity reductions, exercise substitutions, and minimum effective dose options. Explain how to maintain progress while respecting recovery needs.",
    "travelModifications": "3-4 paragraphs with comprehensive travel workout strategies. Based on their equipment (${equipment?.join(', ')}), provide bodyweight alternatives and minimal equipment options for each major workout type in their program. Include hotel gym, outdoor, and room-based options.",
    "injuryModifications": "3-4 paragraphs specifically addressing how to train around their injuries (${injuries}) and movement restrictions (${movementRestrictions}). For each limitation, provide specific exercise substitutions and modifications that maintain training stimulus while avoiding aggravation.",
    "scheduleAdaptations": "2-3 paragraphs on how to adapt training when schedule changes occur. Include strategies for missed workouts, shortened sessions, and rearranging the weekly split. ${formData.integrations?.includes('apple-calendar') || formData.integrations?.includes('google-calendar') || formData.integrations?.includes('outlook') || formData.integrations?.includes('teams') ? 'Since they have calendar integration, reference being able to identify busy weeks and plan accordingly.' : ''}",
    "recoverStatus": "${formData.integrations?.includes('oura-ring') ? '2-3 paragraphs explaining how to use Oura Ring recovery metrics (readiness score, HRV, sleep stages, RHR) to modify training. Include specific decision trees: if readiness <70, reduce volume by X; if HRV drops Y%, change intensity to Z. Make this actionable and specific.' : '2-3 paragraphs on how to assess recovery status without wearables using subjective measures (morning heart rate, grip strength, mood, soreness) and adjust training accordingly.'}"
  }
}

IMPORTANT INSTRUCTIONS:
1. Make the plan HIGHLY PERSONALIZED using ALL available data about THIS specific person
2. Reference their specific biomarkers, injuries, restrictions, goals, and circumstances throughout
3. If they have ecosystem integrations (Oura Ring, Calendar, etc.), incorporate those data points and explain how to use them
4. Make the plan specific to their equipment and location
5. Account for their injuries and restrictions with modifications
6. Match the volume and intensity to their experience level
7. Design progression that aligns with their time horizon
8. Include specific exercises, not just categories
9. Provide exact sets, reps, rest periods, and intensity descriptions using SIMPLE LANGUAGE
10. NEVER use technical terms like "RPE", "1RM", "%", "tempo notation (3-1-1-0)"
11. Use descriptive intensity language: "Easy pace", "Moderate effort", "Challenging but doable", "Very challenging", "Leave 2-3 reps in reserve"
12. Make supplement recommendations evidence-based and conservative
13. If they have biomarker concerns, adjust training intensity and recovery accordingly
14. All 7 days must be detailed using WEEKDAY NAMES (Monday, Tuesday, etc.) - use rest/active recovery days appropriately
15. Be specific with exercise names, form cues, and progression strategies in simple, accessible language
16. CRITICAL: NEVER output the word "undefined" or leave any fields empty. If a value is not specified, infer the most appropriate answer based on their other data. For example, if session length is not specified, recommend "45-60 minutes" based on their experience level and goals.
17. Every section should feel like it was written specifically for THIS person, not a generic template
18. Reference specific numbers from their profile (weight, sleep score, stress level, training days, etc.) throughout the plan

FORMATTING RULES:
- DO NOT use colons (:) ANYWHERE in the plan - not for labels, titles, or in sentences
- Use em dashes (—) instead of colons for labels and separators
- Example: Instead of "Warm-up: Dynamic stretches" write "Warm-up — Dynamic stretches"
- Example: Instead of "On heavy days: focus on" write "On heavy days — focus on" or "On heavy days, focus on"
- Use proper punctuation: commas for lists, periods for sentence endings
- When listing items in a sentence, use commas to separate them (e.g., "squats, lunges, deadlifts, and rows")
- Only use periods to end complete sentences, NOT to separate list items within a sentence
- NEVER use colons after phrases like "Aim for", "On training days", "Focus on", etc.

🔥 CRITICAL WORKOUT VOLUME REQUIREMENTS 🔥:
19. The workout duration MUST match the claimed duration (${sessionLength}). This is NON-NEGOTIABLE.
20. Calculate actual workout time: Warmup (8-12 min) + Main Workout Time + Cooldown (5-8 min) MUST equal the stated duration
21. For 45-60 minute workouts:
    - Warmup: 4-6 dynamic exercises (8-12 minutes total)
    - Main Workout: 6-8 exercises with 3-4 sets each (30-40 minutes total)
    - Cooldown: 3-5 stretches (5-8 minutes total)
    - Each main exercise = ~5 minutes (e.g., 3 sets × 12 reps × 45s + 60s rest = 5.25 min)
22. For 30-45 minute workouts:
    - Warmup: 3-5 dynamic exercises (6-8 minutes)
    - Main Workout: 4-6 exercises with 3 sets each (18-25 minutes)
    - Cooldown: 3-4 stretches (5-7 minutes)
23. For 60-90 minute workouts:
    - Warmup: 5-7 dynamic exercises (10-15 minutes)
    - Main Workout: 8-12 exercises with 3-5 sets each (40-60 minutes)
    - Cooldown: 4-6 stretches (8-10 minutes)
24. DO NOT create short workouts (2-3 exercises) that claim to be 45-60 minutes. This is false and unhelpful.
25. Warmup exercises should include: dynamic mobility, activation drills, movement prep - NOT just 2 exercises
26. Cooldown should include: static stretches for all major muscle groups worked - NOT just 2 stretches
27. Verify your math: Count each exercise, multiply by sets, add work+rest time, ensure it matches duration
28. A "Full Body" workout claiming 45-60 minutes with only 2 main exercises is WRONG. Full body needs 6-8 exercises minimum.`;
}
