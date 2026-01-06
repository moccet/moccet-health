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
  'calendar',      // Schedule events, meetings
  'email',         // Email-related tasks
  'spotify',       // Music playback
  'health_insight', // Health-related queries
  'supplement',    // Supplement recommendations
  'nutrition',     // Food/diet related
  'fitness',       // Exercise related
  'sleep',         // Sleep optimization
  'unknown',       // Cannot classify
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
    const systemPrompt = `You are an intent classifier for a health AI assistant.
Classify the user's input into one of these task types:
- calendar: scheduling events, meetings, reminders
- email: sending or managing emails
- spotify: playing music, creating playlists
- health_insight: general health questions or insights
- supplement: supplement recommendations
- nutrition: food, diet, meal planning
- fitness: exercise, workouts, activity
- sleep: sleep optimization, bedtime routines
- unknown: cannot determine intent

Respond with JSON in this exact format:
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
