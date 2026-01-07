/**
 * Intent Classification API
 *
 * POST /api/intent/classify
 * Classifies user input to determine intent and task type
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Task types that can be classified
const TASK_TYPES = [
  'calendar',           // Schedule events, meetings
  'email',              // Email-related tasks
  'spotify',            // Music playback
  'health_insight',     // Health-related queries
  'supplement',         // Supplement recommendations
  'fitness',            // Exercise related
  'sleep',              // Sleep optimization
  // Sage (Moccet Chef) task types - for food/nutrition actions
  'sage_food_log',      // Log food, meals, track what was eaten
  'sage_water_log',     // Log water intake, hydration
  'sage_fasting',       // Start/stop fasting timer
  'sage_weight_log',    // Log weight measurements
  'sage_meal_update',   // Change/swap meals in meal plan
  'sage_meal_suggest',  // Get meal suggestions/recommendations
  'sage_progress',      // Query nutrition progress, calories, macros
  'unknown',            // Cannot classify
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, source, entities, health_state, metadata } = body;

    if (!input) {
      return NextResponse.json(
        { error: 'Input is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use GPT-4 for classification
    const systemPrompt = `You are an intent classifier for Moccet, a health AI assistant with nutrition tracking.

Classify the user's input into one of these task types:

## Sage (Moccet Chef) - Food & Nutrition Actions:
- sage_food_log: User wants to LOG/ADD/TRACK food they ate (e.g., "add a mocha", "log my breakfast", "I had chicken", "track my lunch", "add to my food log", "log this meal")
- sage_water_log: User wants to log water intake (e.g., "add 500ml water", "I drank water", "log hydration")
- sage_fasting: User wants to start/stop fasting (e.g., "start fasting", "break my fast", "end fast")
- sage_weight_log: User wants to log weight (e.g., "log weight 75kg", "I weigh 150 lbs")
- sage_meal_update: User wants to change/swap a meal in their plan (e.g., "change dinner to pasta", "swap my lunch")
- sage_meal_suggest: User wants meal suggestions/recommendations (e.g., "what should I eat", "suggest a meal", "recipe ideas")
- sage_progress: User asks about nutrition stats (e.g., "how many calories today", "my macros", "nutrition progress")

## Other Task Types:
- calendar: Scheduling events, meetings, reminders
- email: Sending or managing emails
- spotify: Playing music, creating playlists
- health_insight: General health questions (not food logging actions)
- supplement: Supplement recommendations
- fitness: Exercise, workouts, activity tracking
- sleep: Sleep optimization, bedtime routines
- unknown: Cannot determine intent

IMPORTANT: If the user mentions "add", "log", "track", or similar ACTION words with food/drink items, classify as sage_food_log or sage_water_log. These are ACTIONS to record data, not questions.

Respond with JSON:
{
  "primary": "task_type",
  "secondary": ["other_relevant_types"],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Input: "${input}"\nSource: ${source || 'text'}\nEntities: ${JSON.stringify(entities || {})}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const classification = JSON.parse(content);

    // Generate a unique ID for this classification
    const classificationId = `intent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return NextResponse.json({
      classification: {
        id: classificationId,
        primary: classification.primary || 'unknown',
        secondary: classification.secondary || [],
        confidence: classification.confidence || 0.5,
        context: {
          source: source || 'text',
          rawInput: input,
          entities: entities || {},
          reasoning: classification.reasoning || '',
        },
        timestamp: new Date().toISOString(),
      },
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Intent Classify] Error:', error);

    // Return a fallback classification on error
    return NextResponse.json({
      classification: {
        id: `intent_fallback_${Date.now()}`,
        primary: 'unknown',
        secondary: [],
        confidence: 0.1,
        context: {
          source: 'text',
          rawInput: '',
          entities: {},
          reasoning: 'Classification failed, using fallback',
        },
        timestamp: new Date().toISOString(),
      },
    }, { headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
