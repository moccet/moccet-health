import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

    const openai = getOpenAIClient();

    // Build the prompt for comprehensive fitness plan generation
    const prompt = buildForgePlanPrompt(formData, bloodAnalysis);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an elite strength and conditioning coach and fitness expert. You create comprehensive, personalized fitness plans that are safe, effective, and scientifically grounded. You consider the client's complete profile including training history, goals, injuries, available equipment, and biomarkers when available.

Your plans are detailed, progressive, and designed for long-term results. You provide specific exercises, sets, reps, rest periods, and progression strategies. You also include recovery protocols, mobility work, and supplement recommendations when appropriate.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const planContent = completion.choices[0].message.content;
    if (!planContent) {
      throw new Error('No plan content generated');
    }

    const plan = JSON.parse(planContent);
    console.log('[FORGE-PLAN] ✅ Fitness plan generated successfully');

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
function buildForgePlanPrompt(formData: any, bloodAnalysis: any): string {
  const {
    fullName,
    age,
    gender,
    weight,
    height,
    primaryGoal,
    timeHorizon,
    trainingDays,
    injuries,
    movementRestrictions,
    medicalConditions,
    medications,
    supplements,
    equipment,
    trainingLocation,
    sessionLength,
    exerciseTime,
    sleepQuality,
    stressLevel,
    trainingExperience,
    skillsPriority,
    effortFamiliarity,
    currentBests,
    conditioningPreferences,
    sorenessPreference,
    dailyActivity
  } = formData;

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
    "approach": "Explanation of the training methodology being used",
    "keyPrinciples": ["List of 4-5 core principles guiding this plan"],
    "progressionStrategy": "How the plan will progress over time"
  },
  "weeklyStructure": {
    "overview": "Description of the weekly training split",
    "trainingDays": ${trainingDays},
    "focusAreas": ["List the main focus areas for each training day"]
  },
  "sevenDayProgram": {
    "day1": {
      "focus": "e.g., Lower Body Strength",
      "duration": "${sessionLength}",
      "warmup": {
        "description": "Specific warm-up routine",
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
          "tempo": "e.g., 3-1-1-0",
          "intensity": "e.g., RPE 8/10 or 75% 1RM",
          "notes": "Form cues and modifications",
          "progressionNotes": "How to progress this exercise"
        }
      ],
      "cooldown": {
        "description": "Cool-down routine",
        "exercises": [
          {
            "name": "Stretch or mobility work",
            "duration": "X minutes or X reps",
            "notes": "Key points"
          }
        ]
      }
    }
    // Include all 7 days with "day1" through "day7"
    // For rest days, provide active recovery activities
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
    "proteinTarget": "Daily protein target in grams",
    "calorieGuidance": "Calorie range for their goal",
    "mealTiming": "Pre and post workout nutrition recommendations",
    "hydration": "Daily hydration target and electrolyte guidance"
  },
  "progressTracking": {
    "metrics": ["List of metrics to track weekly"],
    "benchmarks": ["Specific performance benchmarks to test monthly"],
    "whenToReassess": "When to reassess and adjust the plan"
  },
  "injuryPrevention": {
    "commonRisks": ["Specific injury risks for this training style"],
    "preventionStrategies": ["Strategies to prevent these injuries"],
    "warningSignals": ["What to watch out for"]
  },
  "adaptiveFeatures": {
    "highEnergyDay": "How to adjust training on high energy days",
    "lowEnergyDay": "How to adjust training on low energy days",
    "travelModifications": "Minimal equipment alternatives",
    "injuryModifications": "How to train around their specific injuries/restrictions"
  }
}

IMPORTANT INSTRUCTIONS:
1. Make the plan specific to their equipment and location
2. Account for their injuries and restrictions with modifications
3. Match the volume and intensity to their experience level
4. Design progression that aligns with their time horizon
5. Include specific exercises, not just categories
6. Provide exact sets, reps, rest periods, and intensity markers (RPE or %)
7. Make supplement recommendations evidence-based and conservative
8. If they have biomarker concerns, adjust training intensity and recovery accordingly
9. All 7 days must be detailed - use rest/active recovery days appropriately
10. Be specific with exercise names, form cues, and progression strategies`;
}
