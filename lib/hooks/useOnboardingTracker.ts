'use client';

import { useCallback, useEffect, useRef } from 'react';

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

interface UseOnboardingTrackerOptions {
  product: 'forge' | 'sage';
  currentScreen: string;
  email?: string;
  fullName?: string;
  formDataSnapshot?: Record<string, unknown>;
}

function getOrCreateSessionId(product: string): string {
  const storageKey = `${product}_onboarding_session_id`;
  let sessionId = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;

  if (!sessionId) {
    sessionId = `${product}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, sessionId);
    }
  }

  return sessionId;
}

export function useOnboardingTracker({
  product,
  currentScreen,
  email,
  fullName,
  formDataSnapshot,
}: UseOnboardingTrackerOptions) {
  const previousScreenRef = useRef<string | null>(null);
  const screenEnterTimeRef = useRef<number>(Date.now());

  const trackProgress = useCallback(async (
    screen: string,
    eventType: 'enter' | 'exit' | 'skip' = 'enter',
    sendSlackNotification = false
  ) => {
    try {
      const sessionId = getOrCreateSessionId(product);
      const screens = product === 'forge' ? FORGE_SCREENS : SAGE_SCREENS;
      const screenIndex = screens.indexOf(screen);

      await fetch('/api/track-onboarding-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          email,
          product,
          currentScreen: screen,
          eventType,
          formDataSnapshot,
          fullName,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          referrer: typeof document !== 'undefined' ? document.referrer : undefined,
          sendSlackNotification,
          screenIndex,
          totalScreens: screens.length,
        }),
      });
    } catch (error) {
      // Silently fail - don't interrupt user flow
      console.error('[Onboarding Tracker] Error:', error);
    }
  }, [product, email, fullName, formDataSnapshot]);

  // Track screen changes
  useEffect(() => {
    // Skip tracking for intro screen
    if (currentScreen === 'intro') {
      previousScreenRef.current = currentScreen;
      return;
    }

    // Track exit from previous screen
    if (previousScreenRef.current && previousScreenRef.current !== currentScreen) {
      trackProgress(previousScreenRef.current, 'exit');
    }

    // Track enter to new screen
    trackProgress(currentScreen, 'enter', currentScreen === 'email');
    screenEnterTimeRef.current = Date.now();
    previousScreenRef.current = currentScreen;
  }, [currentScreen, trackProgress]);

  // Track when user closes the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (previousScreenRef.current && previousScreenRef.current !== 'final-completion') {
        // Use sendBeacon for reliable delivery on page close
        const sessionId = getOrCreateSessionId(product);
        const screens = product === 'forge' ? FORGE_SCREENS : SAGE_SCREENS;

        navigator.sendBeacon(
          '/api/track-onboarding-progress',
          JSON.stringify({
            sessionId,
            email,
            product,
            currentScreen: previousScreenRef.current,
            eventType: 'exit',
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [product, email]);

  return {
    trackProgress,
    sessionId: typeof window !== 'undefined' ? getOrCreateSessionId(product) : null,
  };
}

export function getScreenInfo(product: 'forge' | 'sage', currentScreen: string) {
  const screens = product === 'forge' ? FORGE_SCREENS : SAGE_SCREENS;
  const screenIndex = screens.indexOf(currentScreen);
  return {
    screenIndex,
    totalScreens: screens.length,
    percentComplete: Math.round((screenIndex / screens.length) * 100),
  };
}
