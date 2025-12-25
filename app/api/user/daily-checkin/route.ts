/**
 * Daily Check-in API
 *
 * POST /api/user/daily-checkin
 * Store user's daily check-in response for MCP personalization.
 * The responses help the AI learn user preferences and priorities.
 *
 * GET /api/user/daily-checkin
 * Get user's check-in history for analytics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * POST /api/user/daily-checkin
 * Store a daily check-in response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, question, selectedOption, selectedText, date } = body;

    if (!email || !question || !selectedOption || !date) {
      return NextResponse.json(
        { error: 'email, question, selectedOption, and date are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // Store the check-in response
    const { data, error } = await supabase
      .from('user_daily_checkins')
      .upsert(
        {
          user_email: email,
          question,
          selected_option: selectedOption,
          selected_text: selectedText,
          checkin_date: date,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_email,checkin_date',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[Daily Check-in API] Error storing check-in:', error);
      // Table might not exist yet, create it
      if (error.code === '42P01') {
        // Table doesn't exist - this will be handled by migration
        console.log('[Daily Check-in API] Table does not exist yet');
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // Also store as a learned fact for MCP context
    await storeAsLearnedFact(supabase, email, question, selectedOption, selectedText);

    console.log(`[Daily Check-in API] Stored check-in for ${email}: ${selectedOption}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Check-in recorded',
        checkin: data,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Daily Check-in API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * GET /api/user/daily-checkin
 * Get user's check-in history
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const limit = parseInt(searchParams.get('limit') || '30');

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('user_daily_checkins')
      .select('*')
      .eq('user_email', email)
      .order('checkin_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Daily Check-in API] Error fetching history:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    // Calculate patterns
    const patterns = analyzePatterns(data || []);

    return NextResponse.json(
      {
        success: true,
        checkins: data || [],
        patterns,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Daily Check-in API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * Store check-in as a learned fact for MCP context
 */
async function storeAsLearnedFact(
  supabase: any,
  email: string,
  question: string,
  selectedOption: string,
  selectedText: string
) {
  try {
    // Map check-in responses to learnable facts
    const factMappings: Record<string, { category: string; fact: string }> = {
      // What matters most
      learn_grow: { category: 'goals', fact: 'Values continuous learning and personal growth' },
      connect: { category: 'social', fact: 'Prioritizes connecting with loved ones' },
      strength: { category: 'fitness', fact: 'Focused on building physical strength and energy' },
      calm: { category: 'mental_health', fact: 'Seeks calm and stress reduction' },
      progress: { category: 'goals', fact: 'Goal-oriented and focused on progress' },

      // Feelings
      energetic: { category: 'energy', fact: 'Tends to feel energetic and motivated' },
      tired: { category: 'energy', fact: 'Often pushes through tiredness' },
      stressed: { category: 'mental_health', fact: 'Experiences stress that needs attention' },
      calm_focused: { category: 'mental_health', fact: 'Can achieve calm and focused states' },
      uncertain: { category: 'mental_health', fact: 'Sometimes uncertain about their state' },

      // What makes today great
      productive: { category: 'goals', fact: 'Values productivity highly' },
      rest: { category: 'recovery', fact: 'Recognizes importance of rest' },
      exercise: { category: 'fitness', fact: 'Prioritizes exercise and workouts' },
      healthy_meal: { category: 'nutrition', fact: 'Values healthy eating' },
      quality_time: { category: 'social', fact: 'Values quality time with others' },

      // Weekly priorities
      fitness: { category: 'fitness', fact: 'Currently prioritizing fitness improvement' },
      sleep: { category: 'sleep', fact: 'Working on improving sleep quality' },
      nutrition: { category: 'nutrition', fact: 'Focused on healthier eating habits' },
      mental: { category: 'mental_health', fact: 'Mental wellbeing is a current focus' },
      balance: { category: 'lifestyle', fact: 'Seeking better work-life balance' },
    };

    const mapping = factMappings[selectedOption];
    if (!mapping) return;

    // Upsert the learned fact
    await supabase.from('user_learned_facts').upsert(
      {
        user_email: email,
        fact_category: mapping.category,
        fact_key: `checkin_${selectedOption}`,
        fact_value: mapping.fact,
        confidence: 0.8,
        source: 'daily_checkin',
        last_confirmed: new Date().toISOString(),
      },
      {
        onConflict: 'user_email,fact_key',
      }
    );

    console.log(`[Daily Check-in] Stored learned fact: ${mapping.category} - ${mapping.fact}`);
  } catch (error) {
    console.error('[Daily Check-in] Error storing learned fact:', error);
  }
}

/**
 * Analyze patterns in check-in history
 */
function analyzePatterns(checkins: any[]): Record<string, any> {
  if (checkins.length === 0) return {};

  // Count option selections
  const optionCounts: Record<string, number> = {};
  for (const checkin of checkins) {
    const option = checkin.selected_option;
    optionCounts[option] = (optionCounts[option] || 0) + 1;
  }

  // Find most common
  const sorted = Object.entries(optionCounts).sort((a, b) => b[1] - a[1]);
  const mostCommon = sorted[0];

  return {
    totalCheckins: checkins.length,
    optionCounts,
    mostCommonOption: mostCommon ? { option: mostCommon[0], count: mostCommon[1] } : null,
    streakDays: calculateStreak(checkins),
  };
}

/**
 * Calculate current check-in streak
 */
function calculateStreak(checkins: any[]): number {
  if (checkins.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < checkins.length; i++) {
    const checkinDate = new Date(checkins[i].checkin_date);
    checkinDate.setHours(0, 0, 0, 0);

    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (checkinDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
