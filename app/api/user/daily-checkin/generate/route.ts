/**
 * Generate AI-Powered Daily Check-in Questions
 *
 * GET /api/user/daily-checkin/generate?email=xxx
 *
 * Generates personalized check-in questions based on:
 * - User's health data context
 * - Previous check-in responses
 * - Learned facts about the user
 * - Time of day / day of week
 * - Recent activity patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openai = new OpenAI();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface CheckInQuestion {
  id: string;
  question: string;
  category: string;
  options: {
    id: string;
    text: string;
    learnedFact?: string;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const date = searchParams.get('date') || new Date().toISOString().substring(0, 10);

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Check if we already generated a question for today
    const { data: existingQuestion } = await supabase
      .from('user_daily_checkin_questions')
      .select('*')
      .eq('user_email', email)
      .eq('question_date', date)
      .single();

    if (existingQuestion) {
      return NextResponse.json({
        success: true,
        question: existingQuestion.question_data,
        cached: true,
      }, { headers: corsHeaders });
    }

    // Gather user context
    const context = await gatherUserContext(supabase, email);

    // Generate personalized question using AI
    const question = await generatePersonalizedQuestion(context, email);

    // Store the generated question for today
    await supabase.from('user_daily_checkin_questions').upsert({
      user_email: email,
      question_date: date,
      question_data: question,
      context_used: context,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email,question_date',
    });

    return NextResponse.json({
      success: true,
      question,
      cached: false,
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Daily Check-in Generate] Error:', error);

    // Return a fallback question on error
    const fallbackQuestion = getFallbackQuestion();
    return NextResponse.json({
      success: true,
      question: fallbackQuestion,
      fallback: true,
    }, { headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

async function gatherUserContext(supabase: any, email: string): Promise<any> {
  const context: any = {
    email,
    timestamp: new Date().toISOString(),
    dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    timeOfDay: getTimeOfDay(),
  };

  try {
    // Get learned facts about user
    const { data: learnedFacts } = await supabase
      .from('user_learned_facts')
      .select('fact_category, fact_key, fact_value, confidence')
      .eq('user_email', email)
      .order('confidence', { ascending: false })
      .limit(20);

    context.learnedFacts = learnedFacts || [];

    // Get recent check-in history
    const { data: recentCheckins } = await supabase
      .from('user_daily_checkins')
      .select('question, selected_option, selected_text, checkin_date')
      .eq('user_email', email)
      .order('checkin_date', { ascending: false })
      .limit(10);

    context.recentCheckins = recentCheckins || [];

    // Get user's onboarding data for goals/preferences
    const { data: onboardingData } = await supabase
      .from('sage_onboarding_data')
      .select('form_data')
      .eq('email', email)
      .single();

    if (onboardingData?.form_data) {
      context.goals = onboardingData.form_data.goals || [];
      context.healthFocus = onboardingData.form_data.healthFocus || [];
      context.lifestyle = onboardingData.form_data.lifestyle || {};
    }

    // Get recent health insights if available
    const { data: recentInsights } = await supabase
      .from('health_insights')
      .select('category, title, insight_type')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(5);

    context.recentInsights = recentInsights || [];

  } catch (error) {
    console.error('[Context Gathering] Error:', error);
  }

  return context;
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

async function generatePersonalizedQuestion(context: any, email: string): Promise<CheckInQuestion> {
  try {
    const prompt = buildPrompt(context);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a health and wellness AI assistant that creates personalized daily check-in questions.
Your goal is to learn more about the user's habits, preferences, challenges, and goals through thoughtful questions.

Generate questions that:
1. Are warm and conversational, not clinical
2. Help understand the user better for personalization
3. Are relevant to their health journey and context
4. Have 4-5 answer options that reveal different aspects of the user
5. Each answer should teach us something useful about the user

Categories to explore:
- Energy & motivation patterns
- Sleep habits and quality
- Stress and mental state
- Exercise preferences
- Nutrition choices
- Social connections
- Work-life balance
- Health goals and challenges
- Daily routines
- Recovery and rest needs

Return ONLY valid JSON in this exact format:
{
  "id": "unique_id_string",
  "question": "Your personalized question?",
  "category": "category_name",
  "options": [
    {"id": "opt1", "text": "Option text", "learnedFact": "What we learn if they choose this"},
    {"id": "opt2", "text": "Option text", "learnedFact": "What we learn if they choose this"},
    {"id": "opt3", "text": "Option text", "learnedFact": "What we learn if they choose this"},
    {"id": "opt4", "text": "Option text", "learnedFact": "What we learn if they choose this"},
    {"id": "opt5", "text": "Option text", "learnedFact": "What we learn if they choose this"}
  ]
}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed as CheckInQuestion;
    }

    throw new Error('Failed to parse AI response');

  } catch (error) {
    console.error('[AI Generation] Error:', error);
    return getFallbackQuestion();
  }
}

function buildPrompt(context: any): string {
  let prompt = `Generate a personalized daily check-in question for this user.\n\n`;

  prompt += `Current context:\n`;
  prompt += `- Day: ${context.dayOfWeek}\n`;
  prompt += `- Time: ${context.timeOfDay}\n\n`;

  if (context.learnedFacts && context.learnedFacts.length > 0) {
    prompt += `What we know about this user:\n`;
    context.learnedFacts.slice(0, 10).forEach((fact: any) => {
      prompt += `- ${fact.fact_value} (${fact.fact_category})\n`;
    });
    prompt += `\n`;
  }

  if (context.recentCheckins && context.recentCheckins.length > 0) {
    prompt += `Recent check-in responses:\n`;
    context.recentCheckins.slice(0, 5).forEach((checkin: any) => {
      prompt += `- Q: "${checkin.question}" → "${checkin.selected_text}"\n`;
    });
    prompt += `\n`;
  }

  if (context.goals && context.goals.length > 0) {
    prompt += `User's health goals: ${context.goals.join(', ')}\n`;
  }

  if (context.healthFocus && context.healthFocus.length > 0) {
    prompt += `Health focus areas: ${context.healthFocus.join(', ')}\n`;
  }

  prompt += `\nGenerate a NEW question we haven't asked recently that helps us learn more about this user. `;
  prompt += `The question should be relevant to their context and help personalize their health experience.`;

  return prompt;
}

function getFallbackQuestion(): CheckInQuestion {
  const fallbackQuestions: CheckInQuestion[] = [
    {
      id: 'energy_level',
      question: 'How\'s your energy feeling today?',
      category: 'energy',
      options: [
        { id: 'high', text: 'Energized and ready to go', learnedFact: 'Tends to have high energy days' },
        { id: 'moderate', text: 'Pretty good, steady energy', learnedFact: 'Usually has balanced energy' },
        { id: 'low', text: 'A bit tired today', learnedFact: 'Experiences low energy days' },
        { id: 'variable', text: 'Up and down', learnedFact: 'Has variable energy patterns' },
        { id: 'building', text: 'Still waking up', learnedFact: 'Takes time to build energy' },
      ],
    },
    {
      id: 'sleep_quality',
      question: 'How did you sleep last night?',
      category: 'sleep',
      options: [
        { id: 'great', text: 'Really well, feel rested', learnedFact: 'Can achieve quality sleep' },
        { id: 'okay', text: 'Okay, could be better', learnedFact: 'Sleep quality varies' },
        { id: 'poor', text: 'Not great, feel tired', learnedFact: 'Sometimes struggles with sleep' },
        { id: 'interrupted', text: 'Woke up several times', learnedFact: 'Experiences interrupted sleep' },
        { id: 'late', text: 'Stayed up too late', learnedFact: 'Tends to stay up late' },
      ],
    },
    {
      id: 'today_focus',
      question: 'What would help you most today?',
      category: 'needs',
      options: [
        { id: 'movement', text: 'Getting some movement in', learnedFact: 'Values physical activity' },
        { id: 'rest', text: 'Some rest and recovery', learnedFact: 'Recognizes need for rest' },
        { id: 'focus', text: 'Better focus and clarity', learnedFact: 'Prioritizes mental clarity' },
        { id: 'connection', text: 'Connecting with others', learnedFact: 'Values social connection' },
        { id: 'nutrition', text: 'Eating well today', learnedFact: 'Mindful about nutrition' },
      ],
    },
    {
      id: 'stress_level',
      question: 'How are you feeling mentally?',
      category: 'mental_health',
      options: [
        { id: 'calm', text: 'Calm and centered', learnedFact: 'Can achieve mental calm' },
        { id: 'busy', text: 'Busy but managing', learnedFact: 'Handles busy periods well' },
        { id: 'stressed', text: 'A bit overwhelmed', learnedFact: 'Experiences stress regularly' },
        { id: 'anxious', text: 'Feeling anxious', learnedFact: 'Deals with anxiety' },
        { id: 'motivated', text: 'Motivated and driven', learnedFact: 'Has motivated mindset' },
      ],
    },
  ];

  // Pick based on day to avoid same question
  const dayIndex = new Date().getDay();
  return fallbackQuestions[dayIndex % fallbackQuestions.length];
}
