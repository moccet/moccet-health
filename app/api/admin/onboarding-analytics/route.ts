import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const product = searchParams.get('product') || 'forge';
    const days = parseInt(searchParams.get('days') || '30', 10);

    if (!['forge', 'sage'].includes(product)) {
      return NextResponse.json(
        { error: 'Invalid product. Must be "forge" or "sage"' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch progress records
    const { data: progressRecords, error: progressError } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('product', product)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: false });

    if (progressError) {
      console.error('Error fetching progress records:', progressError);
      return NextResponse.json(
        { error: 'Failed to fetch progress records' },
        { status: 500 }
      );
    }

    // Calculate drop-off stats manually
    const screenCounts: Record<string, { reached: number; dropped: number }> = {};
    const screenIndices: Record<string, number> = {};

    for (const record of progressRecords || []) {
      const screen = record.current_screen;
      if (!screenCounts[screen]) {
        screenCounts[screen] = { reached: 0, dropped: 0 };
        screenIndices[screen] = record.screen_index;
      }
      screenCounts[screen].reached++;
      if (!record.completed_at && !record.dropped_off) {
        // User is still on this screen (potentially dropped)
        const lastUpdate = new Date(record.last_updated_at);
        const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
        if (hoursSinceUpdate > 24) {
          screenCounts[screen].dropped++;
        }
      } else if (record.dropped_off) {
        screenCounts[screen].dropped++;
      }
    }

    const dropoffStats = Object.entries(screenCounts)
      .map(([screen, counts]) => ({
        screen,
        screen_index: screenIndices[screen],
        total_reached: counts.reached,
        total_dropped: counts.dropped,
        dropoff_rate: counts.reached > 0
          ? Math.round((counts.dropped / counts.reached) * 100 * 100) / 100
          : 0,
      }))
      .sort((a, b) => a.screen_index - b.screen_index);

    // Calculate funnel data
    const screenOrder = product === 'forge'
      ? ['intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
         'email', 'objective-intro', 'primary-goal', 'time-horizon', 'training-days',
         'baseline-intro', 'injuries', 'movement-restrictions', 'medical-conditions',
         'environment-intro', 'equipment', 'training-location', 'session-length', 'exercise-time',
         'sleep-quality', 'stress-level', 'forge-intake-intro', 'training-experience', 'skills-priority',
         'current-bests', 'conditioning-preferences', 'soreness-preference',
         'daily-activity', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'payment', 'final-completion']
      : ['intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
         'email', 'ikigai-intro', 'main-priority', 'driving-goal',
         'baseline-intro', 'allergies', 'medications', 'supplements', 'medical-conditions',
         'fuel-intro', 'eating-style', 'first-meal', 'energy-crash', 'protein-sources', 'food-dislikes',
         'meals-cooked', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'payment', 'final-completion'];

    // Count users who reached each screen or beyond
    const usersReachedScreen: Record<string, Set<string>> = {};
    for (const screen of screenOrder) {
      usersReachedScreen[screen] = new Set();
    }

    for (const record of progressRecords || []) {
      const screenIndex = screenOrder.indexOf(record.current_screen);
      if (screenIndex >= 0) {
        // User reached this screen and all previous screens
        for (let i = 0; i <= screenIndex; i++) {
          usersReachedScreen[screenOrder[i]].add(record.session_id);
        }
      }
    }

    const totalStarted = usersReachedScreen[screenOrder[0]]?.size || 0;
    let prevCount = totalStarted;

    const funnelData = screenOrder.map((screen, index) => {
      const usersReached = usersReachedScreen[screen]?.size || 0;
      const conversionFromPrevious = prevCount > 0
        ? Math.round((usersReached / prevCount) * 100 * 100) / 100
        : 0;
      const overallConversion = totalStarted > 0
        ? Math.round((usersReached / totalStarted) * 100 * 100) / 100
        : 0;

      const result = {
        screen,
        screen_index: index,
        users_reached: usersReached,
        conversion_from_previous: conversionFromPrevious,
        overall_conversion: overallConversion,
      };

      prevCount = usersReached;
      return result;
    });

    return NextResponse.json({
      progressRecords: progressRecords || [],
      dropoffStats,
      funnelData,
      summary: {
        totalStarted,
        totalCompleted: progressRecords?.filter(r => r.completed_at).length || 0,
        totalWithEmail: progressRecords?.filter(r => r.email).length || 0,
        product,
        days,
      },
    });
  } catch (error) {
    console.error('Error in onboarding analytics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
