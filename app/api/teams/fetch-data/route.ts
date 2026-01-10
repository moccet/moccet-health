import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { SlackPatterns } from '@/lib/services/ecosystem-fetcher';
import { analyzeSlackForLifeContext, mergeAndStoreLifeContext } from '@/lib/services/content-sentiment-analyzer';

// Reuse SlackPatterns type since Teams chat patterns are structurally identical
type TeamsPatterns = SlackPatterns;

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

// Helper type for Teams message data
interface MessageData {
  timestamp: string;
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isAfterHours: boolean;
  chatId: string;
  content?: string; // Message content for life context analysis
}

// Microsoft Graph Chat type
interface MSChat {
  id: string;
  chatType: string;
  topic?: string;
}

// Microsoft Graph Message type
interface MSMessage {
  id: string;
  createdDateTime: string;
  from?: {
    user?: {
      id: string;
      displayName?: string;
    };
  };
  body?: {
    content: string;
    contentType: string;
  };
}

/**
 * Calculate message volume patterns from Teams messages
 */
function calculateMessageVolume(messages: MessageData[], totalDays: number): TeamsPatterns['messageVolume'] {
  if (messages.length === 0) {
    return {
      avgPerDay: 0,
      peakHours: [],
      afterHoursPercentage: 0
    };
  }

  // Count messages by hour
  const messagesByHour: Record<number, number> = {};
  let afterHoursCount = 0;

  messages.forEach(msg => {
    messagesByHour[msg.hour] = (messagesByHour[msg.hour] || 0) + 1;
    if (msg.isAfterHours) {
      afterHoursCount++;
    }
  });

  // Calculate average per day
  const avgPerDay = totalDays > 0 ? Math.round(messages.length / totalDays) : 0;

  // Find peak hours (top 3)
  const peakHours = Object.entries(messagesByHour)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => {
      const h = parseInt(hour);
      const endH = h + 1;
      return `${h.toString().padStart(2, '0')}:00-${endH.toString().padStart(2, '0')}:00`;
    });

  // Calculate after-hours percentage
  const afterHoursPercentage = Math.round((afterHoursCount / messages.length) * 100);

  return {
    avgPerDay,
    peakHours,
    afterHoursPercentage
  };
}

/**
 * Calculate work hours based on Teams message patterns
 */
function calculateWorkHours(messages: MessageData[]): TeamsPatterns['workHours'] {
  if (messages.length === 0) {
    return {
      start: '09:00',
      end: '17:00',
      weekendActivity: false
    };
  }

  // Filter to weekday messages only for start/end calculation
  const weekdayMessages = messages.filter(m => !m.isWeekend);

  if (weekdayMessages.length === 0) {
    return {
      start: '09:00',
      end: '17:00',
      weekendActivity: messages.some(m => m.isWeekend)
    };
  }

  // Calculate average start time (earliest 10% of messages)
  const sortedHours = weekdayMessages
    .map(m => m.hour)
    .sort((a, b) => a - b);

  const earlyMessages = sortedHours.slice(0, Math.max(1, Math.floor(sortedHours.length * 0.1)));
  const lateMessages = sortedHours.slice(Math.floor(sortedHours.length * 0.9));

  const avgStart = earlyMessages.reduce((sum, h) => sum + h, 0) / earlyMessages.length;
  const avgEnd = lateMessages.reduce((sum, h) => sum + h, 0) / lateMessages.length;

  const startHour = Math.floor(avgStart);
  const endHour = Math.floor(avgEnd);

  // Check for weekend activity
  const weekendActivity = messages.some(m => m.isWeekend);

  return {
    start: `${startHour.toString().padStart(2, '0')}:00`,
    end: `${endHour.toString().padStart(2, '0')}:00`,
    weekendActivity
  };
}

/**
 * Calculate collaboration intensity based on message patterns
 */
function calculateCollaborationIntensity(messages: MessageData[], totalDays: number): TeamsPatterns['collaborationIntensity'] {
  if (messages.length === 0) return 'low';

  const avgPerDay = messages.length / totalDays;
  const uniqueChats = new Set(messages.map(m => m.chatId)).size;

  // Calculate intensity score
  // High: >30 messages/day OR >8 active chats
  // Moderate: 10-30 messages/day OR 4-8 chats
  // Low: <10 messages/day OR <4 chats

  if (avgPerDay > 30 || uniqueChats > 8) {
    return 'high';
  } else if (avgPerDay > 10 || uniqueChats > 4) {
    return 'moderate';
  } else {
    return 'low';
  }
}

/**
 * Calculate stress indicators from Teams patterns
 */
function calculateStressIndicators(
  messageVolume: TeamsPatterns['messageVolume'],
  workHours: TeamsPatterns['workHours'],
  messages: MessageData[]
): TeamsPatterns['stressIndicators'] {
  // Constant availability: High after-hours percentage
  const constantAvailability = messageVolume.afterHoursPercentage > 30;

  // Late night messages: Messages between 10pm and 5am
  const lateNightMessages = messages.filter(m => m.hour >= 22 || m.hour < 5).length > 10;

  // No break periods: Check if there are consecutive hours with messages
  const messagesByHour = messages.reduce((acc, m) => {
    acc[m.hour] = (acc[m.hour] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  let consecutiveHours = 0;
  let maxConsecutiveHours = 0;

  for (let hour = 0; hour < 24; hour++) {
    if (messagesByHour[hour] && messagesByHour[hour] > 0) {
      consecutiveHours++;
      maxConsecutiveHours = Math.max(maxConsecutiveHours, consecutiveHours);
    } else {
      consecutiveHours = 0;
    }
  }

  // No breaks if messaging for 10+ consecutive hours
  const noBreakPeriods = maxConsecutiveHours >= 10;

  return {
    constantAvailability,
    lateNightMessages,
    noBreakPeriods
  };
}

/**
 * Generate insights from Teams patterns
 */
function generateInsights(patterns: Omit<TeamsPatterns, 'insights'>): string[] {
  const insights: string[] = [];

  // Message volume insights
  if (patterns.messageVolume.avgPerDay > 50) {
    insights.push(`Very high Teams activity with ${patterns.messageVolume.avgPerDay} messages per day`);
  } else if (patterns.messageVolume.avgPerDay > 30) {
    insights.push(`High Teams activity with ${patterns.messageVolume.avgPerDay} messages per day`);
  }

  if (patterns.messageVolume.afterHoursPercentage > 30) {
    insights.push(`${patterns.messageVolume.afterHoursPercentage}% of Teams messages sent outside work hours`);
  }

  // Collaboration intensity insights
  if (patterns.collaborationIntensity === 'high') {
    insights.push('High Teams collaboration intensity across multiple chats');
  }

  // Work-life balance insights
  if (patterns.workHours.weekendActivity) {
    insights.push('Regular weekend Teams activity detected');
  }

  // Stress indicators
  if (patterns.stressIndicators.constantAvailability) {
    insights.push('High availability pattern: frequent after-hours Teams messaging');
  }

  if (patterns.stressIndicators.lateNightMessages) {
    insights.push('Late-night Teams activity detected (after 10pm)');
  }

  if (patterns.stressIndicators.noBreakPeriods) {
    insights.push('Extended periods of continuous Teams messaging without breaks');
  }

  // Positive insights
  if (!patterns.stressIndicators.constantAvailability && patterns.messageVolume.afterHoursPercentage < 15) {
    insights.push('Good work-life boundaries with minimal after-hours Teams messaging');
  }

  // Default if no insights
  if (insights.length === 0) {
    insights.push('Moderate Teams usage with balanced communication patterns');
  }

  return insights;
}

/**
 * POST endpoint to fetch and analyze Microsoft Teams chat data
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Teams Fetch] Starting data fetch for ${email}`);

    // Get user code - use provided code or look it up from onboarding data
    const userCode = code || await getUserCode(email);
    if (userCode) {
      console.log(`[Teams Fetch] Using user code: ${userCode}`);
    }

    // Get access token using token-manager (handles refresh automatically)
    const { token, error: tokenError } = await getAccessToken(email, 'teams', userCode);

    if (!token || tokenError) {
      console.error('[Teams Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Teams', details: tokenError },
        { status: 401 }
      );
    }

    // Calculate date range (90 days)
    const endDate = new Date();
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const totalDays = 90;

    console.log(`[Teams Fetch] Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get user's chats from Microsoft Graph
    const chatsResponse = await fetch(
      'https://graph.microsoft.com/v1.0/me/chats?$top=50',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!chatsResponse.ok) {
      const errorText = await chatsResponse.text();
      console.error('[Teams Fetch] Chats API error:', chatsResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch Teams chats', details: errorText },
        { status: chatsResponse.status }
      );
    }

    const chatsData = await chatsResponse.json();
    const chats: MSChat[] = chatsData.value || [];
    console.log(`[Teams Fetch] Found ${chats.length} chats`);

    // Fetch message history from ALL chats (up to 100 for practical limits)
    const messageData: MessageData[] = [];
    const chatsToCheck = chats.slice(0, 100); // Increased from 20 to 100

    for (const chat of chatsToCheck) {
      try {
        // Filter messages by date
        const messagesUrl = `https://graph.microsoft.com/v1.0/me/chats/${chat.id}/messages?$top=100&$filter=createdDateTime ge ${startDate.toISOString()}`;

        const messagesResponse = await fetch(messagesUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json();
          const messages: MSMessage[] = messagesData.value || [];

          for (const message of messages) {
            // Only count user messages, skip system messages
            if (message.createdDateTime && message.from?.user) {
              const date = new Date(message.createdDateTime);
              const hour = date.getHours();
              const dayOfWeek = date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              const isAfterHours = hour < 7 || hour >= 19;

              messageData.push({
                timestamp: date.toISOString(),
                hour,
                dayOfWeek,
                isWeekend,
                isAfterHours,
                chatId: chat.id,
                content: message.body?.content || '', // Store message content for life context analysis
              });
            }
          }
        } else {
          console.log(`[Teams Fetch] Skipped chat ${chat.id}: ${messagesResponse.status}`);
        }
      } catch (err) {
        console.error(`[Teams Fetch] Error fetching chat ${chat.id}:`, err);
      }
    }

    console.log(`[Teams Fetch] Processed ${messageData.length} messages from ${chatsToCheck.length} chats`);

    // Calculate behavioral patterns
    const messageVolume = calculateMessageVolume(messageData, totalDays);
    const workHours = calculateWorkHours(messageData);
    const collaborationIntensity = calculateCollaborationIntensity(messageData, totalDays);
    const stressIndicators = calculateStressIndicators(messageVolume, workHours, messageData);

    const patterns: TeamsPatterns = {
      messageVolume,
      workHours,
      collaborationIntensity,
      stressIndicators,
      insights: []
    };

    // Generate insights
    patterns.insights = generateInsights(patterns);

    console.log('[Teams Fetch] Patterns calculated:', JSON.stringify(patterns, null, 2));

    // Calculate metrics
    const stressScore =
      (patterns.stressIndicators.constantAvailability ? 3 : 0) +
      (patterns.stressIndicators.lateNightMessages ? 3 : 0) +
      (patterns.stressIndicators.noBreakPeriods ? 2 : 0);

    const workLifeBalance =
      10 -
      (patterns.workHours.weekendActivity ? 2 : 0) -
      (patterns.messageVolume.afterHoursPercentage > 30 ? 3 : 0) -
      (patterns.collaborationIntensity === 'high' ? 2 : 0);

    const metrics = {
      stressScore: Math.min(10, stressScore),
      workLifeBalance: Math.max(0, workLifeBalance),
      collaborationLoad: patterns.collaborationIntensity,
      responsiveness: patterns.stressIndicators.constantAvailability ? 'always-on' : 'balanced'
    };

    // Store in database
    const supabase = await createClient();

    // Check if pattern already exists for this user and source
    const { data: existingPattern } = await supabase
      .from('behavioral_patterns')
      .select('id')
      .eq('email', email)
      .eq('source', 'teams')
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
          data_points_analyzed: messageData.length,
          sync_date: new Date().toISOString()
        })
        .eq('id', existingPattern.id);

      if (updateError) {
        console.error('[Teams Fetch] Database update error:', updateError);
      } else {
        console.log('[Teams Fetch] Updated existing pattern in database');
      }
    } else {
      // Insert new pattern
      const { error: insertError } = await supabase
        .from('behavioral_patterns')
        .insert({
          email,
          source: 'teams',
          patterns,
          metrics,
          data_period_start: startDate.toISOString().split('T')[0],
          data_period_end: endDate.toISOString().split('T')[0],
          data_points_analyzed: messageData.length,
          sync_date: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Teams Fetch] Database insert error:', insertError);
      } else {
        console.log('[Teams Fetch] Stored new pattern in database');
      }
    }

    console.log(`[Teams Fetch] Successfully completed for ${email}`);

    // =====================================================
    // TRIGGER LIFE CONTEXT ANALYSIS (Pro/Max feature)
    // Detect life events from Teams messages
    // =====================================================
    let lifeContextResult = null;
    try {
      const adminClient = createAdminClient();

      // Check if user is Pro/Max
      const { data: userData } = await adminClient
        .from('users')
        .select('subscription_tier')
        .eq('email', email)
        .single();

      const isPremium = userData?.subscription_tier === 'pro' || userData?.subscription_tier === 'max';

      if (isPremium && messageData.length > 0) {
        console.log(`[Teams Fetch] Running life context analysis for ${email} (${userData?.subscription_tier} tier)`);

        // Format Teams messages for life context analysis (reuse Slack analyzer)
        const messagesForAnalysis = messageData
          .filter(msg => msg.content && msg.content.length > 0)
          .map(msg => ({
            text: msg.content || '',
            timestamp: msg.timestamp,
            channel: msg.chatId,
            isAfterHours: msg.isAfterHours,
          }));

        if (messagesForAnalysis.length > 0) {
          lifeContextResult = await analyzeSlackForLifeContext(messagesForAnalysis);
          await mergeAndStoreLifeContext(email, lifeContextResult, 'teams');
          console.log(`[Teams Fetch] Life context analysis complete: ${lifeContextResult.upcomingEvents?.length || 0} events, ${lifeContextResult.activePatterns?.length || 0} patterns detected`);
        } else {
          console.log(`[Teams Fetch] No message content available for life context analysis`);
        }
      }
    } catch (analysisError) {
      // Don't fail the fetch if analysis fails
      console.error('[Teams Fetch] Life context analysis error (non-fatal):', analysisError);
    }

    return NextResponse.json({
      success: true,
      patterns,
      metrics,
      dataPointsAnalyzed: messageData.length,
      chatsAnalyzed: chatsToCheck.length,
      dataPeriod: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      lifeContext: lifeContextResult ? {
        eventsDetected: lifeContextResult.upcomingEvents?.length || 0,
        patternsDetected: lifeContextResult.activePatterns?.length || 0,
        sentiment: lifeContextResult.sentiment,
      } : null,
    });

  } catch (error) {
    console.error('[Teams Fetch] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Teams data',
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
