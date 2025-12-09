import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { GmailPatterns } from '@/lib/services/ecosystem-fetcher';

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

// Helper type for calendar events from Microsoft Graph
interface MSCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
}

// Helper type for email data
interface EmailData {
  timestamp: string;
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isAfterHours: boolean;
}

/**
 * Calculate meeting density patterns from calendar events
 */
function calculateMeetingDensity(events: MSCalendarEvent[]): GmailPatterns['meetingDensity'] {
  if (events.length === 0) {
    return {
      peakHours: [],
      avgMeetingsPerDay: 0,
      backToBackPercentage: 0
    };
  }

  // Group events by date and hour
  const eventsByDate: Record<string, MSCalendarEvent[]> = {};
  const eventsByHour: Record<number, number> = {};
  let backToBackCount = 0;

  const sortedEvents = events
    .filter(e => e.start?.dateTime && !e.isAllDay)
    .sort((a, b) => {
      const aTime = new Date(a.start.dateTime).getTime();
      const bTime = new Date(b.start.dateTime).getTime();
      return aTime - bTime;
    });

  sortedEvents.forEach((event, index) => {
    const startTime = new Date(event.start.dateTime);
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
      const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      const nextStartTime = new Date(sortedEvents[index + 1].start.dateTime);

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
function calculateWorkHours(events: MSCalendarEvent[], emailData: EmailData[]): GmailPatterns['workHours'] {
  const allTimes: Date[] = [];

  // Add calendar event times
  events.forEach(event => {
    if (event.start?.dateTime && !event.isAllDay) {
      allTimes.push(new Date(event.start.dateTime));
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
function findOptimalMealWindows(events: MSCalendarEvent[]): string[] {
  if (events.length === 0) {
    return ['12:00-13:00', '18:00-19:00'];
  }

  const mealWindows: string[] = [];

  // Filter events with dateTime and sort by start time
  const sortedEvents = events
    .filter(e => e.start?.dateTime && e.end?.dateTime && !e.isAllDay)
    .sort((a, b) => {
      const aTime = new Date(a.start.dateTime).getTime();
      const bTime = new Date(b.start.dateTime).getTime();
      return aTime - bTime;
    });

  if (sortedEvents.length === 0) {
    return ['12:00-13:00', '18:00-19:00'];
  }

  // Find gaps for lunch (11am-3pm)
  const lunchGaps: { start: Date; end: Date; duration: number }[] = [];

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const currentEnd = new Date(sortedEvents[i].end.dateTime);
    const nextStart = new Date(sortedEvents[i + 1].start.dateTime);
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
  const lastEventEnd = new Date(lastEvent.end.dateTime);
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
 * Generate insights from patterns
 */
function generateInsights(patterns: Omit<GmailPatterns, 'insights'>): string[] {
  const insights: string[] = [];

  // Meeting density insights
  if (patterns.meetingDensity.avgMeetingsPerDay > 8) {
    insights.push(`High meeting load with ${patterns.meetingDensity.avgMeetingsPerDay} meetings per day on average`);
  }
  if (patterns.meetingDensity.backToBackPercentage > 60) {
    insights.push(`${patterns.meetingDensity.backToBackPercentage}% of meetings are back-to-back, limiting break time`);
  }

  // Email volume insights
  if (patterns.emailVolume.avgPerDay > 60) {
    insights.push(`Very high email volume with ${patterns.emailVolume.avgPerDay} emails per day`);
  }
  if (patterns.emailVolume.afterHoursPercentage > 25) {
    insights.push(`${patterns.emailVolume.afterHoursPercentage}% of emails are sent/received outside work hours`);
  }

  // Work-life balance insights
  if (patterns.workHours.weekendActivity) {
    insights.push('Regular weekend work activity detected');
  }

  // Stress indicators
  if (patterns.stressIndicators.highEmailVolume && patterns.stressIndicators.shortMeetingBreaks) {
    insights.push('High stress indicators: heavy email load combined with limited meeting breaks');
  }

  // Positive insights
  if (patterns.optimalMealWindows.length > 0 && !patterns.stressIndicators.shortMeetingBreaks) {
    insights.push('Good calendar structure with identifiable meal windows');
  }

  // Default if no insights
  if (insights.length === 0) {
    insights.push('Moderate work activity with balanced schedule');
  }

  return insights;
}

/**
 * POST endpoint to fetch and analyze Outlook + Calendar data
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Outlook Fetch] Starting data fetch for ${email}`);

    // Get user code - use provided code or look it up from onboarding data
    const userCode = code || await getUserCode(email);
    if (userCode) {
      console.log(`[Outlook Fetch] Using user code: ${userCode}`);
    }

    // Get access token using token-manager (handles refresh automatically)
    const { token, error: tokenError } = await getAccessToken(email, 'outlook', userCode);

    if (!token || tokenError) {
      console.error('[Outlook Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Outlook', details: tokenError },
        { status: 401 }
      );
    }

    // Date ranges
    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days future
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    console.log(`[Outlook Fetch] Fetching data from ${startDate.toISOString()} to ${futureDate.toISOString()}`);

    // Fetch calendar events from Microsoft Graph
    const calendarUrl = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startDate.toISOString()}&endDateTime=${futureDate.toISOString()}&$top=500&$select=id,subject,start,end,isAllDay`;

    const [calendarResponse, emailResponse] = await Promise.all([
      fetch(calendarUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        console.error('[Outlook Fetch] Calendar error:', err);
        return { ok: false, json: async () => ({ value: [] }) };
      }),
      fetch(`https://graph.microsoft.com/v1.0/me/messages?$top=200&$select=receivedDateTime&$filter=receivedDateTime ge ${startDate.toISOString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }).catch(err => {
        console.error('[Outlook Fetch] Email error:', err);
        return { ok: false, json: async () => ({ value: [] }) };
      })
    ]);

    let calendarEvents: MSCalendarEvent[] = [];
    let emailMessages: Array<{ receivedDateTime: string }> = [];

    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarEvents = calendarData.value || [];
    } else {
      console.error('[Outlook Fetch] Calendar fetch failed:', await calendarResponse.json?.().catch(() => 'Unknown error'));
    }

    if (emailResponse.ok) {
      const emailData = await emailResponse.json();
      emailMessages = emailData.value || [];
    } else {
      console.error('[Outlook Fetch] Email fetch failed:', await emailResponse.json?.().catch(() => 'Unknown error'));
    }

    console.log(`[Outlook Fetch] Retrieved ${calendarEvents.length} calendar events and ${emailMessages.length} email messages`);

    // Process email metadata
    const emailData: EmailData[] = emailMessages.map(message => {
      const date = new Date(message.receivedDateTime);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isAfterHours = hour < 7 || hour >= 19;

      return {
        timestamp: date.toISOString(),
        hour,
        dayOfWeek,
        isWeekend,
        isAfterHours
      };
    });

    console.log(`[Outlook Fetch] Processed ${emailData.length} email metadata entries`);

    // Calculate behavioral patterns
    const meetingDensity = calculateMeetingDensity(calendarEvents);
    const emailVolume = calculateEmailVolume(emailData, totalDays);
    const workHours = calculateWorkHours(calendarEvents, emailData);
    const optimalMealWindows = findOptimalMealWindows(calendarEvents);
    const stressIndicators = calculateStressIndicators(meetingDensity, emailVolume, workHours);

    const patterns: GmailPatterns = {
      meetingDensity,
      emailVolume,
      workHours,
      optimalMealWindows,
      stressIndicators,
      insights: []
    };

    // Generate insights
    patterns.insights = generateInsights(patterns);

    console.log('[Outlook Fetch] Patterns calculated:', JSON.stringify(patterns, null, 2));

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

    // Store in database
    const supabase = await createClient();

    // Check if pattern already exists for this user and source
    const { data: existingPattern } = await supabase
      .from('behavioral_patterns')
      .select('id')
      .eq('email', email)
      .eq('source', 'outlook')
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
        console.error('[Outlook Fetch] Database update error:', updateError);
      } else {
        console.log('[Outlook Fetch] Updated existing pattern in database');
      }
    } else {
      // Insert new pattern
      const { error: insertError } = await supabase
        .from('behavioral_patterns')
        .insert({
          email,
          source: 'outlook',
          patterns,
          metrics,
          data_period_start: startDate.toISOString().split('T')[0],
          data_period_end: endDate.toISOString().split('T')[0],
          data_points_analyzed: calendarEvents.length + emailData.length,
          sync_date: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Outlook Fetch] Database insert error:', insertError);
      } else {
        console.log('[Outlook Fetch] Stored new pattern in database');
      }
    }

    console.log(`[Outlook Fetch] Successfully completed for ${email}`);

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
    console.error('[Outlook Fetch] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Outlook data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint (legacy support) - redirects to use POST
 */
export async function GET() {
  return NextResponse.json({
    error: 'Please use POST method with email in request body',
    example: { email: 'user@example.com' }
  }, { status: 400 });
}
