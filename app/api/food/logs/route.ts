/**
 * Food Logs API Endpoint
 *
 * GET /api/food/logs?email=xxx&date=YYYY-MM-DD
 *
 * Retrieves food log entries for a user.
 * - If date is provided, returns logs for that specific day
 * - If no date, returns recent logs (last 7 days)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const date = searchParams.get('date'); // Format: YYYY-MM-DD

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    let query = supabase
      .from('sage_food_logs')
      .select('*')
      .eq('user_email', email)
      .order('logged_at', { ascending: false });

    if (date) {
      // Get logs for a specific date
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      query = query.gte('logged_at', startOfDay).lte('logged_at', endOfDay);
    } else {
      // Default: last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query.gte('logged_at', sevenDaysAgo.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error('[FoodLogs] Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to retrieve food logs' },
        { status: 500 }
      );
    }

    // Calculate daily totals if date is provided
    let dailyTotals = null;
    if (date && data && data.length > 0) {
      dailyTotals = data.reduce(
        (acc, log) => ({
          calories: acc.calories + (log.calories || 0),
          protein: acc.protein + (log.protein || 0),
          carbs: acc.carbs + (log.carbs || 0),
          fat: acc.fat + (log.fat || 0),
          fiber: acc.fiber + (log.fiber || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      );
    }

    return NextResponse.json({
      success: true,
      logs: data || [],
      count: data?.length || 0,
      dailyTotals,
    });
  } catch (error) {
    console.error('[FoodLogs] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve food logs' },
      { status: 500 }
    );
  }
}

// Handle DELETE for removing a food log entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const email = searchParams.get('email');

    if (!id || !email) {
      return NextResponse.json(
        { success: false, error: 'Both id and email parameters are required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('sage_food_logs')
      .delete()
      .eq('id', id)
      .eq('user_email', email);

    if (error) {
      console.error('[FoodLogs] Delete error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete food log' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[FoodLogs] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete food log' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
