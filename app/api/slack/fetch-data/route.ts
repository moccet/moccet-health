import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createClient } from '@/lib/supabase/server';
import type { SlackPatterns } from '@/lib/services/ecosystem-fetcher';

// Helper type for Slack message data
interface MessageData {
  timestamp: string;
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isAfterHours: boolean;
  channelId: string;
}

/**
 * Calculate message volume patterns from Slack messages
 */
function calculateMessageVolume(messages: MessageData[], totalDays: number): SlackPatterns['messageVolume'] {
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
 * Calculate work hours based on Slack message patterns
 */
function calculateWorkHours(messages: MessageData[]): SlackPatterns['workHours'] {
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
function calculateCollaborationIntensity(messages: MessageData[], totalDays: number): SlackPatterns['collaborationIntensity'] {
  if (messages.length === 0) return 'low';

  const avgPerDay = messages.length / totalDays;
  const uniqueChannels = new Set(messages.map(m => m.channelId)).size;

  // Calculate intensity score
  // High: >30 messages/day OR >8 active channels
  // Moderate: 10-30 messages/day OR 4-8 channels
  // Low: <10 messages/day OR <4 channels

  if (avgPerDay > 30 || uniqueChannels > 8) {
    return 'high';
  } else if (avgPerDay > 10 || uniqueChannels > 4) {
    return 'moderate';
  } else {
    return 'low';
  }
}

/**
 * Calculate stress indicators from Slack patterns
 */
function calculateStressIndicators(
  messageVolume: SlackPatterns['messageVolume'],
  workHours: SlackPatterns['workHours'],
  messages: MessageData[]
): SlackPatterns['stressIndicators'] {
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
 * Generate insights from Slack patterns
 */
function generateInsights(patterns: Omit<SlackPatterns, 'insights'>): string[] {
  const insights: string[] = [];

  // Message volume insights
  if (patterns.messageVolume.avgPerDay > 50) {
    insights.push(`Very high Slack activity with ${patterns.messageVolume.avgPerDay} messages per day`);
  } else if (patterns.messageVolume.avgPerDay > 30) {
    insights.push(`High Slack activity with ${patterns.messageVolume.avgPerDay} messages per day`);
  }

  if (patterns.messageVolume.afterHoursPercentage > 30) {
    insights.push(`${patterns.messageVolume.afterHoursPercentage}% of messages sent outside work hours`);
  }

  // Collaboration intensity insights
  if (patterns.collaborationIntensity === 'high') {
    insights.push('High collaboration intensity across multiple channels');
  }

  // Work-life balance insights
  if (patterns.workHours.weekendActivity) {
    insights.push('Regular weekend Slack activity detected');
  }

  // Stress indicators
  if (patterns.stressIndicators.constantAvailability) {
    insights.push('High availability pattern: frequent after-hours messaging');
  }

  if (patterns.stressIndicators.lateNightMessages) {
    insights.push('Late-night Slack activity detected (after 10pm)');
  }

  if (patterns.stressIndicators.noBreakPeriods) {
    insights.push('Extended periods of continuous messaging without breaks');
  }

  // Positive insights
  if (!patterns.stressIndicators.constantAvailability && patterns.messageVolume.afterHoursPercentage < 15) {
    insights.push('Good work-life boundaries with minimal after-hours messaging');
  }

  // Default if no insights
  if (insights.length === 0) {
    insights.push('Moderate Slack usage with balanced communication patterns');
  }

  return insights;
}

/**
 * POST endpoint to fetch and analyze Slack message data
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Slack Fetch] Starting data fetch for ${email}`);

    // Get access token using token-manager (handles refresh automatically)
    const { token, error: tokenError } = await getAccessToken(email, 'slack');

    if (!token || tokenError) {
      console.error('[Slack Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Slack', details: tokenError },
        { status: 401 }
      );
    }

    // Calculate timestamp for 30 days ago
    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Math.floor(startDate.getTime() / 1000);
    const totalDays = 30;

    console.log(`[Slack Fetch] Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get user's conversations (channels, DMs, etc.)
    const conversationsResponse = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel,im&limit=100',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const conversationsData = await conversationsResponse.json();

    if (!conversationsData.ok) {
      console.error('[Slack Fetch] Conversations API error:', conversationsData.error);
      return NextResponse.json(
        { error: 'Failed to fetch Slack conversations', details: conversationsData.error },
        { status: 500 }
      );
    }

    const channels = conversationsData.channels || [];
    console.log(`[Slack Fetch] Found ${channels.length} conversations`);

    // Fetch message history from channels (limit to first 20 channels for performance)
    const messageData: MessageData[] = [];
    const channelsToCheck = channels.slice(0, 20);

    for (const channel of channelsToCheck) {
      try {
        const historyResponse = await fetch(
          `https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${thirtyDaysAgo}&limit=200`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const historyData = await historyResponse.json();

        if (historyData.ok && historyData.messages) {
          for (const message of historyData.messages) {
            // Only count user messages, not bot messages
            if (message.ts && !message.bot_id) {
              const date = new Date(parseFloat(message.ts) * 1000);
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
                channelId: channel.id
              });
            }
          }
        }
      } catch (err) {
        console.error(`[Slack Fetch] Error fetching channel ${channel.id}:`, err);
      }
    }

    console.log(`[Slack Fetch] Processed ${messageData.length} messages from ${channelsToCheck.length} channels`);

    // Calculate behavioral patterns
    const messageVolume = calculateMessageVolume(messageData, totalDays);
    const workHours = calculateWorkHours(messageData);
    const collaborationIntensity = calculateCollaborationIntensity(messageData, totalDays);
    const stressIndicators = calculateStressIndicators(messageVolume, workHours, messageData);

    const patterns: SlackPatterns = {
      messageVolume,
      workHours,
      collaborationIntensity,
      stressIndicators,
      insights: []
    };

    // Generate insights
    patterns.insights = generateInsights(patterns);

    console.log('[Slack Fetch] Patterns calculated:', JSON.stringify(patterns, null, 2));

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
      .eq('source', 'slack')
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
        console.error('[Slack Fetch] Database update error:', updateError);
      } else {
        console.log('[Slack Fetch] Updated existing pattern in database');
      }
    } else {
      // Insert new pattern
      const { error: insertError } = await supabase
        .from('behavioral_patterns')
        .insert({
          email,
          source: 'slack',
          patterns,
          metrics,
          data_period_start: startDate.toISOString().split('T')[0],
          data_period_end: endDate.toISOString().split('T')[0],
          data_points_analyzed: messageData.length,
          sync_date: new Date().toISOString()
        });

      if (insertError) {
        console.error('[Slack Fetch] Database insert error:', insertError);
      } else {
        console.log('[Slack Fetch] Stored new pattern in database');
      }
    }

    console.log(`[Slack Fetch] Successfully completed for ${email}`);

    return NextResponse.json({
      success: true,
      patterns,
      metrics,
      dataPointsAnalyzed: messageData.length,
      channelsAnalyzed: channelsToCheck.length,
      dataPeriod: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('[Slack Fetch] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Slack data',
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
