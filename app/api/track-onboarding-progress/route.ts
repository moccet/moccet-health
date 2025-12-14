import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { notifyOnboardingEmail } from '@/lib/slack';

// Screen orders for reference
const FORGE_SCREENS = [
  'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
  'email', 'objective-intro', 'primary-goal', 'time-horizon', 'training-days',
  'baseline-intro', 'injuries', 'movement-restrictions', 'medical-conditions',
  'environment-intro', 'equipment', 'training-location', 'session-length', 'exercise-time',
  'sleep-quality', 'stress-level', 'forge-intake-intro', 'training-experience', 'skills-priority',
  'current-bests', 'conditioning-preferences', 'soreness-preference',
  'daily-activity', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'payment', 'final-completion'
];

const SAGE_SCREENS = [
  'intro', 'welcome', 'name', 'age', 'gender', 'weight', 'height',
  'email', 'ikigai-intro', 'main-priority', 'driving-goal',
  'baseline-intro', 'allergies', 'medications', 'supplements', 'medical-conditions',
  'fuel-intro', 'eating-style', 'first-meal', 'energy-crash', 'protein-sources', 'food-dislikes',
  'meals-cooked', 'completion', 'final-step-intro', 'ecosystem-integration', 'lab-upload', 'payment', 'final-completion'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      email,
      product,
      currentScreen,
      eventType = 'enter',
      formDataSnapshot,
      fullName,
      userAgent,
      referrer,
      sendSlackNotification = false,
    } = body;

    // Validate required fields
    if (!sessionId || !product || !currentScreen) {
      return NextResponse.json(
        { error: 'sessionId, product, and currentScreen are required' },
        { status: 400 }
      );
    }

    if (!['forge', 'sage'].includes(product)) {
      return NextResponse.json(
        { error: 'product must be "forge" or "sage"' },
        { status: 400 }
      );
    }

    const screens = product === 'forge' ? FORGE_SCREENS : SAGE_SCREENS;
    const screenIndex = screens.indexOf(currentScreen);
    const totalScreens = screens.length;

    if (screenIndex === -1) {
      return NextResponse.json(
        { error: `Invalid screen "${currentScreen}" for product "${product}"` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if we already have a progress record for this session
    const { data: existingProgress } = await supabase
      .from('onboarding_progress')
      .select('id, screen_index, email')
      .eq('session_id', sessionId)
      .single();

    const isCompleted = currentScreen === 'final-completion';
    const now = new Date().toISOString();

    if (existingProgress) {
      // Update existing progress
      const updateData: Record<string, unknown> = {
        current_screen: currentScreen,
        screen_index: screenIndex,
        last_updated_at: now,
        dropped_off: false,
      };

      if (email && !existingProgress.email) {
        updateData.email = email;
      }

      if (formDataSnapshot) {
        updateData.form_data_snapshot = formDataSnapshot;
      }

      if (isCompleted) {
        updateData.completed_at = now;
      }

      await supabase
        .from('onboarding_progress')
        .update(updateData)
        .eq('id', existingProgress.id);
    } else {
      // Create new progress record
      await supabase
        .from('onboarding_progress')
        .insert({
          session_id: sessionId,
          email: email || null,
          product,
          current_screen: currentScreen,
          screen_index: screenIndex,
          total_screens: totalScreens,
          form_data_snapshot: formDataSnapshot || {},
          user_agent: userAgent || null,
          referrer: referrer || null,
          completed_at: isCompleted ? now : null,
        });
    }

    // Log screen event
    await supabase
      .from('onboarding_screen_events')
      .insert({
        session_id: sessionId,
        email: email || null,
        product,
        screen: currentScreen,
        screen_index: screenIndex,
        event_type: eventType,
      });

    // Send Slack notification when user leaves the email screen (i.e., clicks Continue)
    if (sendSlackNotification && email && currentScreen === 'email' && eventType === 'exit') {
      await notifyOnboardingEmail(
        email,
        product === 'forge' ? 'Forge' : 'Sage',
        currentScreen,
        screenIndex,
        totalScreens,
        fullName
      );
    }

    return NextResponse.json({
      success: true,
      progress: {
        screenIndex,
        totalScreens,
        percentComplete: Math.round((screenIndex / totalScreens) * 100),
      },
    });
  } catch (error) {
    console.error('Error tracking onboarding progress:', error);
    return NextResponse.json(
      { error: 'Failed to track progress' },
      { status: 500 }
    );
  }
}

// GET endpoint for retrieving progress (useful for session restoration)
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: progress, error } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (error || !progress) {
      return NextResponse.json({ progress: null });
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Error fetching onboarding progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
