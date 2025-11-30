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
      text: { verbosity: 'medium' }  // Reduced from 'high' - word count limits enforce conciseness
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
    "approach": "2-3 paragraphs (200-300 words) explaining the specific training methodology being used for THIS client. Reference their specific goal (${primaryGoal}), experience level (${trainingExperience}), and available time (${trainingDays} days/week). Explain WHY this approach is optimal for THEM specifically. Include scientific reasoning and how it addresses their unique situation (injuries, stress level, sleep quality, etc). Be concise but thorough.",
    "keyPrinciples": [
      "5-6 principles that guide this specific plan. Each principle should be 1-2 sentences (20-40 words) explaining not just WHAT it is, but WHY it matters for THIS client. Reference their specific circumstances, goals, and limitations. Make these highly personalized - not generic principles."
    ],
    "progressionStrategy": "2-3 paragraphs (200-300 words) explaining exactly how this plan will progress week by week and month by month. Include specific progression metrics (weight, reps, sets, intensity), deload strategies, and how to know when to progress. Address their ${timeHorizon} timeline and explain what they can realistically achieve. Include specific examples (e.g., 'Week 1-4: Build base with moderate effort, Week 5-8: Increase intensity'). Be concise."
  },
  "weeklyStructure": {
    "overview": "2-3 paragraphs (200-300 words) describing the weekly training split and WHY this specific split is optimal for THIS client. Explain how it balances their goals, recovery capacity, available equipment, training time, and lifestyle factors (stress level: ${stressLevel}/10, sleep quality: ${sleepQuality}/10). Include the rationale behind exercise selection, volume distribution, and recovery placement throughout the week. Be concise.",
    "trainingDays": ${trainingDays},
    "rationale": "1-2 paragraphs (100-150 words) explaining the reasoning behind this ${trainingDays}-day split. Why not more or fewer days? How does it optimize recovery and progress toward their specific goal? Reference their daily activity level (${dailyActivity}), session length (${sessionLength}), and preferred training time (${exerciseTime}). Keep it brief.",
    "volumeDistribution": "1-2 paragraphs (100-150 words) with breakdown of weekly training volume. Explain total sets per muscle group, how volume is distributed across the ${trainingDays} days, and why this distribution optimizes progress for their goal. Include specific numbers (e.g., 'Chest: 12-16 sets/week distributed as 8 sets Monday, 6 sets Thursday'). Be concise.",
    "intensityFramework": "1-2 paragraphs (100-150 words) explaining how intensity is managed throughout the week. Use simple language like 'challenging but doable', 'moderate effort', 'easy pace' instead of technical terms. Explain how to determine if intensity is appropriate, and how to adjust based on recovery status. Reference their soreness preference (${sorenessPreference}/10) and effort familiarity (${effortFamiliarity}). Keep it brief.",
    "focusAreas": [
      "For each of the ${trainingDays} training days, provide a 1-2 sentence description (30-50 words each) of the focus, target muscle groups, movement patterns, intensity level, and how it fits into the weekly plan. Don't just list categories - explain the rationale and expected outcomes for each day. Be concise."
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
    "personalizedIntro": "2-3 sentences (40-80 words) introducing the recovery protocol and citing specific user data (sleep quality: ${sleepQuality}/10, stress level: ${stressLevel}/10, any relevant biomarkers). Example: 'Based on your reported sleep quality of ${sleepQuality}/10 and stress level of ${stressLevel}/10, your recovery protocol focuses on practical strategies to improve both. These evidence-based practices will support your training and overall health goals.'",
    "dailyPractices": ["4-5 specific daily recovery habits personalized to their sleep and stress levels. Each item should be 1-2 sentences (20-40 words) explaining WHAT to do and WHY it helps. Use simple language. Example: 'Morning sunlight exposure within 30 minutes of waking for 5-10 minutes. This helps regulate your sleep-wake cycle and can improve sleep quality.'"],
    "weeklyPractices": ["3-4 weekly recovery activities that fit their schedule and training load. Each item 1-2 sentences (20-40 words) with specific timing and duration. Example: 'One 30-minute gentle yoga or stretching session, ideally on a rest day. This promotes flexibility and reduces muscle tension from training.'"],
    "sleepOptimization": "2-3 paragraphs (200-300 words) with specific sleep recommendations based on their current sleep quality score (${sleepQuality}/10). Include target sleep hours, bedtime routine suggestions, sleep environment optimization, and sleep timing recommendations. Use simple language and explain WHY each recommendation matters. If sleep quality is below 7/10, prioritize sleep improvement strategies. Be concise.",
    "stressManagement": "2-3 paragraphs (200-300 words) with practical stress management strategies tailored to their stress level (${stressLevel}/10). Include breathing exercises with specific protocols (e.g., '4-7-8 breathing'), meditation guidance for beginners, and stress reduction habits. If stress is above 6/10, emphasize daily stress management practices. Reference any work pattern data if available (meeting density, after-hours work). Use simple, actionable language. Be concise.",
    "mobilityWork": "2-3 paragraphs (200-300 words) detailing a daily 10-15 minute mobility routine. Include 5-6 specific exercises targeting areas addressed in their training program and any movement restrictions (${movementRestrictions}). Provide exercise names, duration/reps, and simple form cues. Explain how this supports injury prevention and training performance. Use beginner-friendly language. Be concise."
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
    "personalizedIntro": "2-3 sentences (40-80 words) introducing nutrition guidance with specific data citations. Reference biomarkers (especially lipid levels, glucose control, inflammation markers if available), body composition goals, and training demands. Example: 'Your nutrition plan is designed to support your ${primaryGoal} goal while addressing key health markers. With ${trainingDays} training days per week and your current activity level, these recommendations optimize both performance and recovery.'",
    "proteinTarget": "2-3 paragraphs (150-250 words) explaining their specific daily protein target in grams with rationale. Break down by meals and timing. Reference their weight (${weight}), goal (${primaryGoal}), training volume, and activity level (${dailyActivity}). Explain why this amount is optimal for THEM specifically. Include protein source recommendations. Use simple language. Be concise.",
    "calorieGuidance": "2-3 paragraphs (200-300 words) with calorie recommendations tailored to their goal (${primaryGoal}). Include specific ranges for training days vs rest days. Explain the rationale based on their weight, height, age, gender, activity level, and training frequency. Reference their current supplements (${supplements}) and how nutrition should complement them. If they have metabolic biomarker concerns, adjust accordingly and explain why. Use simple, non-technical language. Be concise.",
    "mealTiming": "2-3 paragraphs (200-300 words) on optimal meal timing for THIS person. Consider their preferred training time (${exerciseTime}), session length (${sessionLength}), work schedule, and daily routine. Provide specific meal timing recommendations around workouts with exact timing windows. Address their energy levels and how meal timing can optimize performance and recovery. Include pre-workout, intra-workout, and post-workout nutrition with specific examples. Use beginner-friendly language. Be concise.",
    "hydration": "1-2 paragraphs (100-150 words) on personalized hydration strategy. Base recommendations on their training volume (${trainingDays} days/week), session length (${sessionLength}), conditioning preferences (${conditioningPreferences}), and body weight (${weight}). Include specific daily water intake targets, electrolyte timing, and signs of proper hydration. If they have relevant biomarkers (kidney function, etc.), reference them. Use simple language. Be concise.",
    "macroBreakdown": "1-2 paragraphs (100-150 words) with breakdown of recommended macronutrient distribution (protein/carbs/fats) in grams and percentages. Explain why this distribution is optimal for their specific goal, training style, and body composition. Include examples of what this looks like in actual meals. Use simple language. Be concise.",
    "mealFrequency": "1-2 paragraphs (100-150 words) explaining optimal meal frequency for THIS person based on their schedule, training time, and preferences. Include specific recommendations for number of meals per day and ideal timing. Use simple language. Be concise.",
    "supplementTiming": "If they take supplements (${supplements}), provide 1-2 paragraphs (100-150 words) on optimal timing for maximum benefit and absorption. Coordinate with their training schedule and meal timing. Use simple language. Be concise."
  },
  "progressTracking": {
    "metricsOverview": "2 paragraphs (150-200 words) with a personalized introduction explaining the importance of tracking progress for THIS specific person and their goal (${primaryGoal}). Start by citing any baseline data available (current performance bests, biomarkers, wearable metrics). Explain how to track effectively and what frequency makes sense for their experience level (${trainingExperience}). Use beginner-friendly language with NO jargon. Be concise.",
    "weeklyMetrics": [
      "List 5-6 specific metrics they should track WEEKLY. Each metric should be 2-3 sentences (40-60 words) using simple language. For each metric, include: what it is, how to measure it, why it matters, and what good progress looks like. Example format: 'Training Volume (the total amount of work you do) — Track total sets and reps per workout. This helps ensure you're progressing without overdoing it. Good progress means gradually adding 1-2 sets per week.' Include both objective measures (weight, reps, times) and subjective measures (energy level on a scale of 1-10, sleep quality, how sore you feel). If they have wearables, mention specific metrics in simple terms (e.g., 'Readiness score from your Oura Ring — a daily measure of how recovered you are'). Reference their current bests (${currentBests}) to set baseline metrics."
    ],
    "monthlyMetrics": [
      "List 3-4 metrics to assess MONTHLY using beginner-friendly language. Each should be 2-3 sentences (40-60 words) explaining WHAT to measure, HOW to measure it, and WHY it matters. Example: 'Body measurements (waist, chest, arms) using a tape measure at the same time each month. This shows body composition changes that the scale might not show.' Include performance benchmarks specific to their training and any relevant biomarkers they should recheck (explained simply). If they have metabolic concerns from blood work, specify which markers to retest and explain in simple terms what they indicate."
    ],
    "performanceBenchmarks": [
      "List 4-5 specific, measurable performance benchmarks to test monthly using simple language. Each should be 2-3 sentences (40-60 words). Avoid jargon. Each benchmark should include: the exercise name, how to perform the test safely, current baseline (if known from ${currentBests}), and realistic target for 1-3 months. Example: 'Pushups to Failure — Perform as many quality pushups as possible without stopping. Current baseline from your intake: X pushups. Target for month 1: Add 3-5 pushups. Why it matters: Shows upper body strength and endurance progress.' Make these directly related to their training program and goals."
    ],
    "biometricTargets": "1-2 paragraphs (100-150 words) on biometric targets using simple, accessible language. If they have specific biomarker concerns from blood work, explain in plain terms what each marker means, why it matters, target ranges, and realistic timeline for improvement. Example: 'Total cholesterol is currently X. We're aiming to bring this down to under 200 mg/dL over 3-6 months through nutrition and exercise. This reduces heart disease risk.' Avoid medical jargon. If no biomarker data available, recommend getting baseline measurements and explain which ones are most relevant to their goals. Be concise.",
    "reassessmentSchedule": "2 paragraphs (150-200 words) detailing when and how to reassess the program using beginner-friendly language. Include specific triggers for reassessment explained simply (e.g., 'If you stop getting stronger for 3 weeks in a row' instead of 'plateau'). Explain what to look for at 4-week, 8-week, and 12-week checkpoints in practical terms. Reference their time horizon (${timeHorizon}) and explain the assessment schedule within that timeframe. Use simple language throughout. Be concise.",
    "progressionIndicators": "1-2 paragraphs (100-150 words) explaining what 'good progress' looks like for THIS person at their experience level (${trainingExperience}) with their specific goal (${primaryGoal}). Use simple, encouraging language. Set realistic expectations with concrete examples (e.g., 'As a beginner, you can expect to add 5-10 pounds to your squat each month' instead of technical percentages). Explain what rate of progress is healthy and sustainable. Avoid jargon completely. Be concise."
  },
  "injuryPrevention": {
    "personalizedRiskAssessment": "2-3 paragraphs (200-300 words) with personalized introduction citing their specific situation. Start by referencing their injuries (${injuries}), movement restrictions (${movementRestrictions}), training history (${trainingExperience}), and age (${age}). Example start: 'Based on your reported history of ${injuries} and movement restrictions with ${movementRestrictions}, we need to pay special attention to certain areas in your training.' Analyze THIS person's specific injury risks and explain which movements or patterns pose the highest risk for THEM. Use simple, clear language with NO jargon. Explain terms when necessary. Be concise.",
    "commonRisks": [
      "List 4-5 specific injury risks for THIS person using beginner-friendly language. Each risk should be 2-3 sentences (40-60 words). Consider their current injuries (${injuries}), past injuries, movement restrictions (${movementRestrictions}), training style, experience level (${trainingExperience}), and program demands. For each risk, explain: WHAT the risk is in simple terms, WHY they're specifically at risk (reference their situation), and HOW it typically happens. Example: 'Lower back strain during squats and deadlifts — You have limited hip mobility which can cause your lower back to round when lifting. This puts extra stress on your spine instead of your hips doing the work.' Avoid technical terminology."
    ],
    "preventionStrategies": [
      "List 5-6 prevention strategies specifically for THIS person using simple, actionable language. Each should be 2-3 sentences (40-60 words) explaining: WHAT to do (specific exercise or habit), WHEN to do it (timing/frequency), and WHY it prevents their specific injury risks (explained simply). Example: 'Hip mobility routine before every lower body workout — Spend 5 minutes on hip circles, 90/90 stretches, and leg swings. This prepares your hips to move properly so your lower back doesn't compensate during squats.' Include prehab exercises, mobility work, load management (explained simply, e.g., 'don't increase weight by more than 5 pounds per week'), and technique cues relevant to their situation. No jargon."
    ],
    "warningSignals": [
      "List 5-6 specific warning signals THIS person should watch for using plain language. Each should be 2-3 sentences (40-60 words). Base these on their injury history (${injuries}) and risk factors. For each signal, explain: WHAT the warning sign is, WHAT it might indicate (in plain terms), and WHAT action to take. Example: 'Sharp pain during an exercise (not just muscle burn) — This could mean you're straining a joint or tendon. Stop the exercise immediately, try a lighter weight or different variation, and if pain persists for 2-3 days see a healthcare provider.' Avoid medical jargon."
    ],
    "injuryProtocol": "2 paragraphs (150-200 words) explaining exactly what to do if they experience pain or injury using clear, simple language. Include: when to completely rest (e.g., 'sharp pain that doesn't go away'), when to modify training (e.g., 'dull ache that improves with movement'), when to seek professional help (explained with clear examples), and how to maintain fitness during recovery (alternative exercises). Use practical, actionable advice with no technical terms. Be concise.",
    "mobilityPrescription": "2 paragraphs (150-200 words) detailing a specific daily 10-15 minute mobility routine for THIS person. Reference their movement restrictions (${movementRestrictions}) and injury prevention needs. Include 5-6 specific exercises with clear names (avoid technical terms), how long or how many reps (e.g., '10 slow reps per side' or '30 seconds hold'), and simple form cues (e.g., 'keep your back straight, don't force the stretch'). Explain in simple terms how this supports injury prevention and training performance. Make this practical and easy to follow. Be concise."
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

CRITICAL PERSONALIZED INTRODUCTION REQUIREMENTS:
19. EVERY major section MUST start with a personalized 2-3 line introduction
20. These intros MUST cite specific user data when available: blood biomarkers (with values), wearable metrics (Oura, CGM with actual numbers), behavioral patterns (Gmail/Slack insights), or onboarding goals
21. ONLY cite data if it is available - if no specific data exists for a metric, do NOT mention it or make up values
22. Priority order for data citations: Blood biomarkers → Wearable metrics → Behavioral patterns → Onboarding goals
23. Add personalizedIntro fields to: nutritionGuidance and recoveryProtocol
24. Ensure existing intro sections (executiveSummary, trainingPhilosophy.approach, weeklyStructure.overview, progressTracking.metricsOverview, injuryPrevention.personalizedRiskAssessment) all cite real user data

SIMPLIFIED LANGUAGE REQUIREMENTS:
25. Use BEGINNER-FRIENDLY language throughout, especially in Progress Tracking and Injury Prevention sections
26. Replace ALL technical jargon with plain English explanations
27. When you must use a technical term, immediately explain it in parentheses
28. Examples of required simplifications:
    - "sRPE Load" → "Training stress score (session difficulty × time)"
    - "HRV" → "Heart rate variability (shows how well recovered you are)"
    - "RPE 7-8" → "Effort level of 7-8 out of 10"
    - "1RM" → "One-rep maximum (the heaviest weight you can lift once with good form)"
    - "Tempo 3-1-1-0" → "Lower the weight slowly over 3 seconds, pause briefly, then lift"
    - "Periodization" → "Planned training phases (building, pushing hard, recovering)"
29. Every metric in Progress Tracking must explain: WHAT it is, HOW to measure it, WHY it matters, WHAT good progress looks like
30. Every injury risk must explain: WHAT the risk is, WHY they're at risk, HOW to prevent it - all in simple terms

WORD COUNT ADHERENCE (CRITICAL):
31. STRICTLY adhere to ALL word count guidance provided above
32. Content must be in-depth and thorough BUT also concise and focused
33. Do NOT exceed the maximum word counts specified - if a section says "200-300 words", do NOT write 500 words
34. Do NOT write less than the minimum word counts - if a section says "100-150 words", do NOT write 50 words
35. For list items with word counts (e.g., "2-3 sentences, 40-60 words"), follow those limits precisely
36. Being concise while maintaining quality is a key requirement - remove fluff, get to the point, provide value
37. Examples of word count targets:
    - Personalized intros: 40-80 words (2-3 sentences)
    - Short sections (hydration, macroBreakdown): 100-150 words (1-2 paragraphs)
    - Medium sections (proteinTarget, recoveryProtocol sub-sections): 200-300 words (2-3 paragraphs)
    - List items (metrics, risks, strategies): 40-60 words each (2-3 sentences)
38. Quality over quantity - make every word count

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
