import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { getValidatedAccessToken } from '@/lib/services/token-manager';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { GmailPatterns } from '@/lib/services/ecosystem-fetcher';
import {
  analyzeEmailSubjects,
  storeSentimentAnalysis,
  analyzeEmailsForLifeContext,
  storeLifeContext,
} from '@/lib/services/content-sentiment-analyzer';
import {
  analyzeGmailDeepContent,
  storeDeepContentAnalysis,
} from '@/lib/services/deep-content-analyzer';
import {
  transformGmailPatterns,
  dualWriteUnifiedRecords,
} from '@/lib/services/unified-data';

// Validation function to test if Gmail token is valid
async function validateGmailToken(token: string): Promise<boolean> {
  try {
    // Quick API call to validate token - use userinfo endpoint (lightweight)
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper function to look up user's unique code from onboarding data
async function getUserCode(email: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Try forge_onboarding_data first
  const { data: forgeData } = await supabase
    .from('forge_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (forgeData?.form_data?.uniqueCode) {
    return forgeData.form_data.uniqueCode;
  }

  // Try sage_onboarding_data
  const { data: sageData } = await supabase
    .from('sage_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (sageData?.form_data?.uniqueCode) {
    return sageData.form_data.uniqueCode;
  }

  return null;
}

// Helper type for calendar events - use Google's Schema$Event type
type CalendarEvent = calendar_v3.Schema$Event;

// Helper type for email data
interface EmailData {
  timestamp: string;
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isAfterHours: boolean;
  subject?: string; // For sentiment analysis
  from?: string; // Sender name/email for deep content analysis
  snippet?: string; // Email preview fallback
  body?: string; // Full email body for deep content analysis
  messageId?: string; // Gmail message ID
}

/**
 * Calculate meeting density patterns from calendar events
 */
function calculateMeetingDensity(events: CalendarEvent[]): GmailPatterns['meetingDensity'] {
  if (events.length === 0) {
    return {
      peakHours: [],
      avgMeetingsPerDay: 0,
      backToBackPercentage: 0
    };
  }

  // Group events by date and hour
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  const eventsByHour: Record<number, number> = {};
  let backToBackCount = 0;

  const sortedEvents = events
    .filter(e => e.start?.dateTime)
    .sort((a, b) => {
      const aTime = new Date(a.start!.dateTime as string).getTime();
      const bTime = new Date(b.start!.dateTime as string).getTime();
      return aTime - bTime;
    });

  sortedEvents.forEach((event, index) => {
    const startTime = new Date(event.start!.dateTime as string);
    const dateKey = startTime.toISOString().split('T')[0];
    const hour = startTime.getHours();

    // Group by date
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);

    // Count by hour
    eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;

    // Check if back-to-back with next event
    if (index < sortedEvents.length - 1) {
      const endTime = event.end?.dateTime ? new Date(event.end.dateTime as string) : null;
      const nextStartTime = new Date(sortedEvents[index + 1].start!.dateTime as string);

      if (endTime && (nextStartTime.getTime() - endTime.getTime()) <= 5 * 60 * 1000) {
        backToBackCount++;
      }
    }
  });

  // Calculate average meetings per day
  const avgMeetingsPerDay = Object.keys(eventsByDate).length > 0
    ? Object.values(eventsByDate).reduce((sum, evs) => sum + evs.length, 0) / Object.keys(eventsByDate).length
    : 0;

  // Find peak hours (top 3 hours with most meetings)
  const peakHours = Object.entries(eventsByHour)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => {
      const h = parseInt(hour);
      const endH = h + 1;
      return `${h.toString().padStart(2, '0')}:00-${endH.toString().padStart(2, '0')}:00`;
    });

  // Calculate back-to-back percentage
  const backToBackPercentage = sortedEvents.length > 1
    ? Math.round((backToBackCount / (sortedEvents.length - 1)) * 100)
    : 0;

  return {
    peakHours,
    avgMeetingsPerDay: Math.round(avgMeetingsPerDay * 10) / 10,
    backToBackPercentage
  };
}

/**
 * Calculate email volume patterns
 */
function calculateEmailVolume(emailData: EmailData[], totalDays: number): GmailPatterns['emailVolume'] {
  if (emailData.length === 0) {
    return {
      avgPerDay: 0,
      peakHours: [],
      afterHoursPercentage: 0
    };
  }

  // Count emails by hour
  const emailsByHour: Record<number, number> = {};
  let afterHoursCount = 0;

  emailData.forEach(email => {
    emailsByHour[email.hour] = (emailsByHour[email.hour] || 0) + 1;
    if (email.isAfterHours) {
      afterHoursCount++;
    }
  });

  // Calculate average per day
  const avgPerDay = totalDays > 0 ? Math.round(emailData.length / totalDays) : 0;

  // Find peak hours (top 3)
  const peakHours = Object.entries(emailsByHour)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => {
      const h = parseInt(hour);
      const endH = h + 1;
      return `${h.toString().padStart(2, '0')}:00-${endH.toString().padStart(2, '0')}:00`;
    });

  // Calculate after-hours percentage
  const afterHoursPercentage = Math.round((afterHoursCount / emailData.length) * 100);

  return {
    avgPerDay,
    peakHours,
    afterHoursPercentage
  };
}

/**
 * Calculate work hours based on calendar and email patterns
 */
function calculateWorkHours(events: CalendarEvent[], emailData: EmailData[]): GmailPatterns['workHours'] {
  const allTimes: Date[] = [];

  // Add calendar event times
  events.forEach(event => {
    if (event.start?.dateTime) {
      allTimes.push(new Date(event.start.dateTime as string));
    }
  });

  // Add email times
  emailData.forEach(email => {
    allTimes.push(new Date(email.timestamp));
  });

  if (allTimes.length === 0) {
    return {
      start: '09:00',
      end: '17:00',
      weekendActivity: false
    };
  }

  // Filter to weekday times only for start/end calculation
  const weekdayTimes = allTimes.filter(t => {
    const day = t.getDay();
    return day !== 0 && day !== 6;
  });

  // Calculate average start time (earliest 10% of activities)
  const sortedHours = weekdayTimes
    .map(t => t.getHours() + t.getMinutes() / 60)
    .sort((a, b) => a - b);

  const earlyActivities = sortedHours.slice(0, Math.max(1, Math.floor(sortedHours.length * 0.1)));
  const lateActivities = sortedHours.slice(Math.floor(sortedHours.length * 0.9));

  const avgStart = earlyActivities.reduce((sum, h) => sum + h, 0) / earlyActivities.length;
  const avgEnd = lateActivities.reduce((sum, h) => sum + h, 0) / lateActivities.length;

  const startHour = Math.floor(avgStart);
  const startMin = Math.round((avgStart - startHour) * 60);
  const endHour = Math.floor(avgEnd);
  const endMin = Math.round((avgEnd - endHour) * 60);

  // Check for weekend activity
  const weekendActivity = allTimes.some(t => {
    const day = t.getDay();
    return day === 0 || day === 6;
  });

  return {
    start: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
    end: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
    weekendActivity
  };
}

/**
 * Find optimal meal windows based on meeting gaps
 */
function findOptimalMealWindows(events: CalendarEvent[]): string[] {
  if (events.length === 0) {
    return ['12:00-13:00', '18:00-19:00'];
  }

  const mealWindows: string[] = [];

  // Filter events with dateTime and sort by start time
  const sortedEvents = events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .sort((a, b) => {
      const aTime = new Date(a.start!.dateTime as string).getTime();
      const bTime = new Date(b.start!.dateTime as string).getTime();
      return aTime - bTime;
    });

  if (sortedEvents.length === 0) {
    return ['12:00-13:00', '18:00-19:00'];
  }

  // Find gaps for lunch (11am-3pm)
  const lunchGaps: { start: Date; end: Date; duration: number }[] = [];

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const currentEnd = new Date(sortedEvents[i].end!.dateTime as string);
    const nextStart = new Date(sortedEvents[i + 1].start!.dateTime as string);
    const gapDuration = (nextStart.getTime() - currentEnd.getTime()) / (60 * 1000); // minutes

    const currentEndHour = currentEnd.getHours();

    // Look for gaps in lunch window (11am-3pm) that are at least 30 minutes
    if (currentEndHour >= 11 && currentEndHour < 15 && gapDuration >= 30) {
      lunchGaps.push({
        start: currentEnd,
        end: nextStart,
        duration: gapDuration
      });
    }
  }

  // Add lunch window (largest gap or default)
  if (lunchGaps.length > 0) {
    const bestLunchGap = lunchGaps.sort((a, b) => b.duration - a.duration)[0];
    const lunchStart = bestLunchGap.start;
    const lunchEnd = new Date(Math.min(
      bestLunchGap.end.getTime(),
      lunchStart.getTime() + 60 * 60 * 1000 // Max 1 hour
    ));

    mealWindows.push(
      `${lunchStart.getHours().toString().padStart(2, '0')}:${lunchStart.getMinutes().toString().padStart(2, '0')}-${lunchEnd.getHours().toString().padStart(2, '0')}:${lunchEnd.getMinutes().toString().padStart(2, '0')}`
    );
  } else {
    mealWindows.push('12:00-13:00');
  }

  // Add dinner window (1 hour after last meeting, or default 6pm)
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  const lastEventEnd = new Date(lastEvent.end!.dateTime as string);
  const dinnerTime = new Date(lastEventEnd.getTime() + 60 * 60 * 1000); // 1 hour after

  // Cap dinner time at 8pm
  if (dinnerTime.getHours() <= 20) {
    const dinnerEnd = new Date(dinnerTime.getTime() + 60 * 60 * 1000);
    mealWindows.push(
      `${dinnerTime.getHours().toString().padStart(2, '0')}:${dinnerTime.getMinutes().toString().padStart(2, '0')}-${dinnerEnd.getHours().toString().padStart(2, '0')}:${dinnerEnd.getMinutes().toString().padStart(2, '0')}`
    );
  } else {
    mealWindows.push('18:00-19:00');
  }

  return mealWindows;
}

/**
 * Calculate stress indicators
 */
function calculateStressIndicators(
  meetingDensity: GmailPatterns['meetingDensity'],
  emailVolume: GmailPatterns['emailVolume'],
  workHours: GmailPatterns['workHours']
): GmailPatterns['stressIndicators'] {
  return {
    highEmailVolume: emailVolume.avgPerDay > 50,
    frequentAfterHoursWork: emailVolume.afterHoursPercentage > 20 || workHours.weekendActivity,
    shortMeetingBreaks: meetingDensity.backToBackPercentage > 50
  };
}

/**
 * Analyze meeting types (1:1, group, large all-hands)
 */
function calculateMeetingTypes(events: CalendarEvent[]): GmailPatterns['meetingTypes'] {
  let oneOnOnes = 0;
  let groupMeetings = 0;
  let largeAllHands = 0;
  let totalAttendees = 0;
  let eventsWithAttendees = 0;

  events.forEach(event => {
    const attendeeCount = event.attendees?.length || 1;
    totalAttendees += attendeeCount;
    eventsWithAttendees++;

    if (attendeeCount <= 2) {
      oneOnOnes++;
    } else if (attendeeCount >= 10) {
      largeAllHands++;
    } else {
      groupMeetings++;
    }
  });

  return {
    oneOnOnes,
    groupMeetings,
    largeAllHands,
    avgAttendeesPerMeeting: eventsWithAttendees > 0
      ? Math.round((totalAttendees / eventsWithAttendees) * 10) / 10
      : 0
  };
}

/**
 * Analyze focus time blocks and meeting-free periods
 */
function calculateFocusTime(events: CalendarEvent[], totalDays: number): GmailPatterns['focusTime'] {
  // Group events by date
  const eventsByDate: Record<string, CalendarEvent[]> = {};

  events.forEach(event => {
    if (event.start?.dateTime) {
      const dateKey = new Date(event.start.dateTime as string).toISOString().split('T')[0];
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);
    }
  });

  // Count meeting-free days
  const datesWithMeetings = Object.keys(eventsByDate).length;
  const meetingFreeDays = Math.max(0, totalDays - datesWithMeetings);

  // Calculate focus blocks (2+ hour gaps during work hours 9am-5pm)
  let totalFocusBlocks = 0;
  let longestFocusBlock = 0;

  Object.values(eventsByDate).forEach(dayEvents => {
    const sortedEvents = dayEvents
      .filter(e => e.start?.dateTime && e.end?.dateTime)
      .sort((a, b) => new Date(a.start!.dateTime as string).getTime() - new Date(b.start!.dateTime as string).getTime());

    // Check gap at start of day (9am to first meeting)
    if (sortedEvents.length > 0) {
      const firstMeetingStart = new Date(sortedEvents[0].start!.dateTime as string);
      const dayStart = new Date(firstMeetingStart);
      dayStart.setHours(9, 0, 0, 0);
      const morningGap = (firstMeetingStart.getTime() - dayStart.getTime()) / (1000 * 60);
      if (morningGap >= 120) {
        totalFocusBlocks++;
        longestFocusBlock = Math.max(longestFocusBlock, morningGap);
      }
    }

    // Check gaps between meetings
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const currentEnd = new Date(sortedEvents[i].end!.dateTime as string);
      const nextStart = new Date(sortedEvents[i + 1].start!.dateTime as string);
      const gap = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);

      if (gap >= 120) {
        totalFocusBlocks++;
        longestFocusBlock = Math.max(longestFocusBlock, gap);
      }
    }

    // Check gap at end of day (last meeting to 5pm)
    if (sortedEvents.length > 0) {
      const lastMeetingEnd = new Date(sortedEvents[sortedEvents.length - 1].end!.dateTime as string);
      const dayEnd = new Date(lastMeetingEnd);
      dayEnd.setHours(17, 0, 0, 0);
      const afternoonGap = (dayEnd.getTime() - lastMeetingEnd.getTime()) / (1000 * 60);
      if (afternoonGap >= 120) {
        totalFocusBlocks++;
        longestFocusBlock = Math.max(longestFocusBlock, afternoonGap);
      }
    }
  });

  const avgFocusBlocksPerDay = datesWithMeetings > 0 ? totalFocusBlocks / datesWithMeetings : 2;

  // Determine focus score
  let focusScore: 'excellent' | 'good' | 'limited' | 'fragmented' = 'fragmented';
  if (avgFocusBlocksPerDay >= 2 && longestFocusBlock >= 180) {
    focusScore = 'excellent';
  } else if (avgFocusBlocksPerDay >= 1.5 || longestFocusBlock >= 120) {
    focusScore = 'good';
  } else if (avgFocusBlocksPerDay >= 1 || longestFocusBlock >= 90) {
    focusScore = 'limited';
  }

  return {
    avgFocusBlocksPerDay: Math.round(avgFocusBlocksPerDay * 10) / 10,
    longestFocusBlock: Math.round(longestFocusBlock),
    meetingFreeDays,
    focusScore
  };
}

/**
 * Analyze recurring meeting burden
 */
function calculateRecurringMeetings(events: CalendarEvent[]): GmailPatterns['recurringMeetings'] {
  let weeklyRecurring = 0;
  let totalRecurringMinutes = 0;
  let standupsPerWeek = 0;

  events.forEach(event => {
    // Check if recurring
    if (event.recurringEventId) {
      weeklyRecurring++;

      // Calculate duration
      if (event.start?.dateTime && event.end?.dateTime) {
        const start = new Date(event.start.dateTime as string);
        const end = new Date(event.end.dateTime as string);
        totalRecurringMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
      }

      // Detect standups
      const summary = (event.summary || '').toLowerCase();
      if (summary.includes('standup') || summary.includes('stand-up') || summary.includes('daily') || summary.includes('sync')) {
        standupsPerWeek++;
      }
    }
  });

  return {
    weeklyRecurring,
    totalRecurringHours: Math.round((totalRecurringMinutes / 60) * 10) / 10,
    standupsPerWeek
  };
}

/**
 * Analyze calendar health (buffers, protected time)
 */
function calculateCalendarHealth(events: CalendarEvent[]): GmailPatterns['calendarHealth'] {
  const sortedEvents = events
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .sort((a, b) => new Date(a.start!.dateTime as string).getTime() - new Date(b.start!.dateTime as string).getTime());

  // Calculate average buffer between meetings
  let totalBuffer = 0;
  let bufferCount = 0;
  let lunchMeetings = 0;
  let eveningMeetings = 0;

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const currentEnd = new Date(sortedEvents[i].end!.dateTime as string);
    const nextStart = new Date(sortedEvents[i + 1].start!.dateTime as string);

    // Only count buffers on the same day
    if (currentEnd.toDateString() === nextStart.toDateString()) {
      const buffer = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60);
      if (buffer > 0 && buffer < 240) { // Ignore gaps > 4 hours
        totalBuffer += buffer;
        bufferCount++;
      }
    }
  }

  // Check lunch and evening protection
  sortedEvents.forEach(event => {
    if (event.start?.dateTime) {
      const startHour = new Date(event.start.dateTime as string).getHours();
      if (startHour >= 12 && startHour < 13) {
        lunchMeetings++;
      }
      if (startHour >= 18) {
        eveningMeetings++;
      }
    }
  });

  const uniqueDays = new Set(
    sortedEvents.map(e => new Date(e.start!.dateTime as string).toDateString())
  ).size;

  return {
    bufferBetweenMeetings: bufferCount > 0 ? Math.round(totalBuffer / bufferCount) : 30,
    lunchProtected: uniqueDays > 0 ? (lunchMeetings / uniqueDays) < 0.3 : true,
    eveningsClear: uniqueDays > 0 ? (eveningMeetings / uniqueDays) < 0.2 : true
  };
}

/**
 * Generate insights from patterns
 */
function generateInsights(patterns: Omit<GmailPatterns, 'insights'>): string[] {
  const insights: string[] = [];

  // Focus time insights (most valuable)
  if (patterns.focusTime) {
    if (patterns.focusTime.focusScore === 'fragmented') {
      insights.push(`Calendar is fragmented with only ${patterns.focusTime.avgFocusBlocksPerDay} focus blocks per day — deep work requires protection`);
    } else if (patterns.focusTime.focusScore === 'excellent') {
      insights.push(`Strong calendar hygiene with ${patterns.focusTime.meetingFreeDays} meeting-free days and regular focus blocks`);
    }
    if (patterns.focusTime.longestFocusBlock > 0 && patterns.focusTime.longestFocusBlock < 90) {
      insights.push(`Longest uninterrupted period is only ${patterns.focusTime.longestFocusBlock} minutes — consider blocking longer focus time`);
    }
  }

  // Meeting types insights
  if (patterns.meetingTypes) {
    const total = patterns.meetingTypes.oneOnOnes + patterns.meetingTypes.groupMeetings + patterns.meetingTypes.largeAllHands;
    if (total > 0) {
      const oneOnOnePercent = Math.round((patterns.meetingTypes.oneOnOnes / total) * 100);
      if (oneOnOnePercent > 60) {
        insights.push(`${oneOnOnePercent}% of meetings are 1:1s — consider batching for efficiency`);
      }
      if (patterns.meetingTypes.largeAllHands > 5) {
        insights.push(`${patterns.meetingTypes.largeAllHands} large meetings (10+ people) this month — evaluate necessity`);
      }
    }
  }

  // Recurring meeting burden
  if (patterns.recurringMeetings) {
    if (patterns.recurringMeetings.totalRecurringHours > 15) {
      insights.push(`${patterns.recurringMeetings.totalRecurringHours}h/week locked in recurring meetings — audit for value`);
    }
    if (patterns.recurringMeetings.standupsPerWeek > 5) {
      insights.push(`${patterns.recurringMeetings.standupsPerWeek} standups per week may be excessive`);
    }
  }

  // Calendar health insights
  if (patterns.calendarHealth) {
    if (!patterns.calendarHealth.lunchProtected) {
      insights.push('Lunch hour is frequently invaded by meetings — nourishment deserves protection');
    }
    if (!patterns.calendarHealth.eveningsClear) {
      insights.push('Evening meetings encroach on personal time — consider hard boundaries');
    }
    if (patterns.calendarHealth.bufferBetweenMeetings < 10) {
      insights.push(`Only ${patterns.calendarHealth.bufferBetweenMeetings} minutes average between meetings — insufficient transition time`);
    }
  }

  // Meeting density insights
  if (patterns.meetingDensity.avgMeetingsPerDay > 8) {
    insights.push(`Calendar carries ${patterns.meetingDensity.avgMeetingsPerDay} meetings daily — a demanding cadence`);
  }
  if (patterns.meetingDensity.backToBackPercentage > 60) {
    insights.push(`${patterns.meetingDensity.backToBackPercentage}% back-to-back meetings leave no room to breathe`);
  }

  // Email volume insights
  if (patterns.emailVolume.afterHoursPercentage > 25) {
    insights.push(`${patterns.emailVolume.afterHoursPercentage}% of email activity flows beyond 5pm — evening boundaries may need reinforcement`);
  }

  // Work-life balance insights
  if (patterns.workHours.weekendActivity) {
    insights.push('Weekend work patterns detected — rest is not optional');
  }

  // Positive insights
  if (patterns.focusTime?.focusScore === 'excellent' && !patterns.stressIndicators.shortMeetingBreaks) {
    insights.push('Well-structured calendar with meaningful focus time and adequate breaks');
  }

  // Default if no insights
  if (insights.length === 0) {
    insights.push('Balanced calendar structure with room for both collaboration and focus');
  }

  return insights;
}

/**
 * POST endpoint to fetch and analyze Gmail + Calendar data
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Gmail Fetch] Starting data fetch for ${email}`);

    // Get user code - use provided code or look it up from onboarding data
    const userCode = code || await getUserCode(email);
    if (userCode) {
      console.log(`[Gmail Fetch] Using user code: ${userCode}`);
    }

    // Get access token using token-manager with validation (auto-refreshes if invalid)
    const { token, error: tokenError, wasRefreshed } = await getValidatedAccessToken(
      email,
      'gmail',
      userCode,
      validateGmailToken  // Validates token against Google API, refreshes if invalid
    );

    if (wasRefreshed) {
      console.log(`[Gmail Fetch] Token was refreshed for ${email}`);
    }

    if (!token || tokenError) {
      console.error('[Gmail Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Gmail', details: tokenError },
        { status: 401 }
      );
    }

    // Initialize Google APIs
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback'
    );

    oauth2Client.setCredentials({ access_token: token });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Date ranges
    const endDate = new Date();
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days future
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    console.log(`[Gmail Fetch] Fetching data from ${startDate.toISOString()} to ${futureDate.toISOString()}`);

    // Fetch data in parallel
    const [calendarResponse, emailResponse] = await Promise.all([
      calendar.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: futureDate.toISOString(),
        maxResults: 500,
        singleEvents: true,
        orderBy: 'startTime'
      }).catch(err => {
        console.error('[Gmail Fetch] Calendar error:', err);
        return { data: { items: [] } };
      }),
      gmail.users.messages.list({
        userId: 'me',
        q: `newer_than:90d`,
        maxResults: 200
      }).catch(err => {
        console.error('[Gmail Fetch] Gmail error:', err);
        return { data: { messages: [] } };
      })
    ]);

    const calendarEvents = calendarResponse.data.items || [];
    const emailMessages = emailResponse.data.messages || [];

    console.log(`[Gmail Fetch] Retrieved ${calendarEvents.length} calendar events and ${emailMessages.length} email messages`);

    // Process email metadata (sample up to 100 for performance)
    const emailData: EmailData[] = [];
    const emailSample = emailMessages.slice(0, 100);

    for (const message of emailSample) {
      try {
        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'full', // Full body for deep content analysis
        });

        const headers = messageDetail.data.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const dateHeader = headers.find(h => h.name?.toLowerCase() === 'date');
        const subjectHeader = headers.find(h => h.name?.toLowerCase() === 'subject');
        const fromHeader = headers.find(h => h.name?.toLowerCase() === 'from');

        // Extract email body from full format
        let body = '';
        const payload = messageDetail.data.payload;
        if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              body = Buffer.from(part.body.data, 'base64').toString('utf-8');
              break;
            }
          }
        }

        // Extract sender name from "Name <email@domain.com>" format
        const fromValue = fromHeader?.value || '';
        const senderName = fromValue.includes('<')
          ? fromValue.split('<')[0].trim().replace(/"/g, '')
          : fromValue.split('@')[0];

        // Get snippet as fallback
        const snippet = messageDetail.data.snippet || '';

        if (dateHeader?.value) {
          const date = new Date(dateHeader.value);
          const hour = date.getHours();
          const dayOfWeek = date.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          // FIXED: After-hours is now 9am-5pm (was 7am-7pm)
          const isAfterHours = hour < 9 || hour >= 17;

          emailData.push({
            timestamp: date.toISOString(),
            hour,
            dayOfWeek,
            isWeekend,
            isAfterHours,
            subject: subjectHeader?.value || '',
            from: senderName,
            snippet: snippet,
            body: body, // Full email body for deep content analysis
            messageId: message.id!,
          });
        }
      } catch (err) {
        console.error('[Gmail Fetch] Error fetching message detail:', err);
      }
    }

    console.log(`[Gmail Fetch] Processed ${emailData.length} email metadata entries`);

    // Calculate behavioral patterns
    const meetingDensity = calculateMeetingDensity(calendarEvents);
    const emailVolume = calculateEmailVolume(emailData, totalDays);
    const workHours = calculateWorkHours(calendarEvents, emailData);
    const optimalMealWindows = findOptimalMealWindows(calendarEvents);
    const stressIndicators = calculateStressIndicators(meetingDensity, emailVolume, workHours);

    // NEW: Enhanced analysis
    const meetingTypes = calculateMeetingTypes(calendarEvents);
    const focusTime = calculateFocusTime(calendarEvents, totalDays);
    const recurringMeetings = calculateRecurringMeetings(calendarEvents);
    const calendarHealth = calculateCalendarHealth(calendarEvents);

    const patterns: GmailPatterns = {
      meetingDensity,
      emailVolume,
      workHours,
      optimalMealWindows,
      stressIndicators,
      // NEW fields
      meetingTypes,
      focusTime,
      recurringMeetings,
      calendarHealth,
      insights: []
    };

    // Generate insights
    patterns.insights = generateInsights(patterns);

    console.log('[Gmail Fetch] Patterns calculated:', JSON.stringify(patterns, null, 2));

    // =====================================================
    // SENTIMENT & LIFE CONTEXT ANALYSIS (tier-based)
    // =====================================================
    try {
      const adminClient = createAdminClient();

      // Check user preferences (opt-out check) and subscription tier
      const [prefsResult, subResult] = await Promise.all([
        adminClient
          .from('sentiment_analysis_preferences')
          .select('gmail_subject_analysis, gmail_snippet_analysis')
          .eq('user_email', email)
          .maybeSingle(),
        adminClient
          .from('user_subscriptions')
          .select('tier, status')
          .eq('user_email', email)
          .maybeSingle()
      ]);

      const sentimentPrefs = prefsResult.data;
      // Determine subscription tier for analysis depth
      const subscriptionTier = (subResult.data?.status === 'active' && subResult.data?.tier) || 'free';
      const isPremium = subscriptionTier === 'pro' || subscriptionTier === 'max';

      // DEFAULT: Enabled for everyone (opt-in by default)
      // Only disabled if user EXPLICITLY set BOTH gmail_subject_analysis AND gmail_snippet_analysis = false
      const subjectOptedOut = sentimentPrefs?.gmail_subject_analysis === false;
      const snippetOptedOut = sentimentPrefs?.gmail_snippet_analysis === false;
      const userOptedOut = subjectOptedOut && snippetOptedOut;
      const sentimentEnabled = !userOptedOut;

      console.log(`[Gmail Fetch] Content analysis: enabled=${sentimentEnabled}, userOptedOut=${userOptedOut}, tier=${subscriptionTier}`);

      // Only analyze if we have enough data
      if (sentimentEnabled && emailData.length >= 10) {
        console.log(`[Gmail Fetch] Running ${isPremium ? 'life context' : 'sentiment'} analysis for ${email} (${subscriptionTier} tier, ${emailData.length} emails)`);

        // Prepare all subjects with metadata
        const allSubjects = emailData
          .filter(e => e.subject && e.subject.trim().length > 0)
          .map(e => ({
            subject: e.subject!,
            timestamp: e.timestamp,
            isAfterHours: e.isAfterHours
          }));

        if (isPremium && allSubjects.length >= 5) {
          // Pro/Max: Full life context analysis with AI
          // Analyze ALL emails together to detect patterns across time
          const lifeContext = await analyzeEmailsForLifeContext(allSubjects);

          // Store life context
          await storeLifeContext(email, lifeContext);

          // Also store daily sentiment for trend tracking
          const emailsByDate: Record<string, typeof allSubjects> = {};
          for (const subj of allSubjects) {
            const date = subj.timestamp.split('T')[0];
            if (!emailsByDate[date]) emailsByDate[date] = [];
            emailsByDate[date].push(subj);
          }

          for (const [date, daySubjects] of Object.entries(emailsByDate)) {
            if (daySubjects.length >= 3) {
              await storeSentimentAnalysis(email, 'gmail', date, lifeContext.sentiment);
            }
          }

          console.log(`[Gmail Fetch] Life context analysis complete: ${lifeContext.upcomingEvents.length} events, ${lifeContext.activePatterns.length} patterns detected`);
        } else {
          // Free tier: Basic keyword-based sentiment analysis per day
          const emailsByDate: Record<string, typeof emailData> = {};
          for (const emailItem of emailData) {
            const date = emailItem.timestamp.split('T')[0];
            if (!emailsByDate[date]) emailsByDate[date] = [];
            emailsByDate[date].push(emailItem);
          }

          let analyzedDays = 0;
          for (const [date, dayEmails] of Object.entries(emailsByDate)) {
            if (dayEmails.length < 3) continue;

            const subjects = dayEmails
              .filter(e => e.subject && e.subject.trim().length > 0)
              .map(e => ({
                subject: e.subject!,
                timestamp: e.timestamp,
                isAfterHours: e.isAfterHours
              }));

            if (subjects.length < 3) continue;

            const sentiment = await analyzeEmailSubjects(subjects);
            await storeSentimentAnalysis(email, 'gmail', date, sentiment);
            analyzedDays++;
          }

          console.log(`[Gmail Fetch] Sentiment analysis complete: ${analyzedDays} days analyzed`);
        }
      } else if (!sentimentEnabled) {
        console.log(`[Gmail Fetch] Content analysis skipped - user not opted in`);
      }
    } catch (sentimentError) {
      // Don't fail the entire request if analysis fails
      console.error('[Gmail Fetch] Content analysis error (non-fatal):', sentimentError);
    }

    // =====================================================
    // DEEP CONTENT ANALYSIS (tasks, urgency, interruptions)
    // =====================================================
    try {
      // Health-related keywords to prioritize
      const healthKeywords = ['sick', 'ill', 'flu', 'cold', 'fever', 'headache', 'tired', 'exhausted',
        'stressed', 'anxious', 'overwhelmed', 'burnout', 'unwell', 'doctor', 'hospital', 'medication',
        'not feeling well', 'taking a day off', 'working from home', 'need rest', 'appointment',
        'health', 'medical', 'prescription'];

      // Check if email contains health-related content
      const hasHealthContent = (subject: string, snippet: string) => {
        const combined = `${subject} ${snippet}`.toLowerCase();
        return healthKeywords.some(kw => combined.includes(kw));
      };

      // Prepare emails for deep analysis with full context
      // Priority: 1) Health-related emails, 2) Recent emails
      const emailsForDeepAnalysis = emailData
        .filter(e => e.subject && e.subject.trim().length > 0)
        .sort((a, b) => {
          // Prioritize health-related content
          const aHealth = hasHealthContent(a.subject || '', a.snippet || '') ? 1 : 0;
          const bHealth = hasHealthContent(b.subject || '', b.snippet || '') ? 1 : 0;
          if (aHealth !== bHealth) return bHealth - aHealth;

          // Then sort by recency
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        })
        .slice(0, 50)
        .map((e, i) => ({
          id: e.messageId || `gmail_${i}`,
          subject: e.subject!,
          snippet: e.snippet || '',
          from: e.from || '',
          timestamp: e.timestamp,
          isAfterHours: e.isAfterHours,
          isHealthRelated: hasHealthContent(e.subject || '', e.snippet || ''),
        }));

      // Log health-related emails found
      const healthEmails = emailsForDeepAnalysis.filter(e => e.isHealthRelated);
      if (healthEmails.length > 0) {
        console.log(`[Gmail Fetch] Found ${healthEmails.length} health-related emails`);
        healthEmails.slice(0, 3).forEach(e => {
          console.log(`[Gmail Fetch] Health email: "${e.subject?.substring(0, 60)}..."`);
        });
      }

      // Log sample to verify we have real data
      if (emailsForDeepAnalysis.length > 0) {
        const sample = emailsForDeepAnalysis[0];
        console.log(`[Gmail Fetch] Sample email for deep analysis: from="${sample.from}", subject="${sample.subject?.substring(0, 50)}...", snippet="${sample.snippet?.substring(0, 50)}..."`);
      }

      if (emailsForDeepAnalysis.length >= 5) {
        console.log(`[Gmail Fetch] Running deep content analysis on ${emailsForDeepAnalysis.length} emails with full context`);

        const deepAnalysis = await analyzeGmailDeepContent(emailsForDeepAnalysis, email);
        await storeDeepContentAnalysis(email, deepAnalysis);

        console.log(`[Gmail Fetch] Deep content analysis complete: ${deepAnalysis.pendingTasks.length} tasks, ${deepAnalysis.responseDebt.count} response debt`);
      }
    } catch (deepContentError) {
      // Don't fail the entire request if deep analysis fails
      console.error('[Gmail Fetch] Deep content analysis error (non-fatal):', deepContentError);
    }

    // Calculate metrics
    const stressScore =
      (patterns.stressIndicators.highEmailVolume ? 3 : 0) +
      (patterns.stressIndicators.frequentAfterHoursWork ? 3 : 0) +
      (patterns.stressIndicators.shortMeetingBreaks ? 2 : 0);

    const workLifeBalance =
      10 -
      (patterns.workHours.weekendActivity ? 2 : 0) -
      (patterns.emailVolume.afterHoursPercentage > 20 ? 2 : 0) -
      (patterns.meetingDensity.avgMeetingsPerDay > 8 ? 2 : 0);

    const metrics = {
      stressScore: Math.min(10, stressScore),
      workLifeBalance: Math.max(0, workLifeBalance),
      focusTimeAvailability: patterns.meetingDensity.backToBackPercentage > 50 ? 'low' :
                             patterns.meetingDensity.backToBackPercentage > 30 ? 'medium' : 'high',
      breakFrequency: patterns.meetingDensity.backToBackPercentage > 50 ? 'insufficient' : 'adequate'
    };

    // Store in database - use admin client since this may be called server-to-server
    const supabase = createAdminClient();

    // Check if pattern already exists for this user and source
    const { data: existingPattern } = await supabase
      .from('behavioral_patterns')
      .select('id')
      .eq('email', email)
      .eq('source', 'gmail')
      .single();

    if (existingPattern) {
      // Update existing pattern
      const { error: updateError } = await supabase
        .from('behavioral_patterns')
        .update({
          patterns,
          metrics,
          data_period_start: startDate.toISOString().split('T')[0],
          data_period_end: endDate.toISOString().split('T')[0],
          data_points_analyzed: calendarEvents.length + emailData.length,
          sync_date: new Date().toISOString()
        })
        .eq('id', existingPattern.id);

      if (updateError) {
        console.error('[Gmail Fetch] Database update error:', updateError);
      } else {
        console.log('[Gmail Fetch] Updated existing pattern in database');
      }
    } else {
      // Insert new pattern
      const { error: insertError } = await supabase
        .from('behavioral_patterns')
        .insert({
          email,
          source: 'gmail',
          patterns,
          metrics,
          data_period_start: startDate.toISOString().split('T')[0],
          data_period_end: endDate.toISOString().split('T')[0],
          data_points_analyzed: calendarEvents.length + emailData.length,
          sync_date: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Gmail Fetch] Database insert error:', insertError);
      } else {
        console.log('[Gmail Fetch] Stored new pattern in database');
      }
    }

    // =====================================================
    // DUAL-WRITE TO UNIFIED HEALTH DATA TABLE
    // =====================================================
    try {
      const unifiedRecord = transformGmailPatterns(email, {
        sync_date: new Date().toISOString(),
        patterns: {
          metrics: { stressScore: metrics.stressScore * 10 }, // Convert 0-10 to 0-100
          meetingDensity: patterns.meetingDensity,
          emailVolume: {
            total: emailData.length,
            afterHoursPercentage: patterns.emailVolume.afterHoursPercentage,
          },
          focusTime: patterns.focusTime,
        },
      });
      const dualWriteResult = await dualWriteUnifiedRecords([unifiedRecord], { logPrefix: 'Gmail' });
      if (dualWriteResult.success) {
        console.log(`[Gmail Fetch] Dual-write: ${dualWriteResult.written} unified records written`);
      }
    } catch (dualWriteError) {
      // Don't fail the request if dual-write fails
      console.error('[Gmail Fetch] Dual-write error (non-fatal):', dualWriteError);
    }

    console.log(`[Gmail Fetch] Successfully completed for ${email}`);

    return NextResponse.json({
      success: true,
      patterns,
      metrics,
      dataPointsAnalyzed: calendarEvents.length + emailData.length,
      dataPeriod: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('[Gmail Fetch] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Gmail data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint (legacy support) - redirects to use POST
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    error: 'Please use POST method with email in request body',
    example: { email: 'user@example.com' }
  }, { status: 400 });
}
