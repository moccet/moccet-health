import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { SlackPatterns } from '@/lib/services/ecosystem-fetcher';
import {
  analyzeMessageBatch,
  storeSentimentAnalysis,
  analyzeSlackForLifeContext,
  mergeAndStoreLifeContext,
} from '@/lib/services/content-sentiment-analyzer';
import {
  analyzeSlackDeepContent,
  storeDeepContentAnalysis,
} from '@/lib/services/deep-content-analyzer';

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

// Helper type for Slack message data
interface MessageData {
  timestamp: string;
  hour: number;
  dayOfWeek: number;
  isWeekend: boolean;
  isAfterHours: boolean;
  channelId: string;
  channelName?: string;
  isThreadReply: boolean;
  isThreadStarter: boolean;
  mentions: string[]; // User IDs mentioned in message
  text?: string;
}

// User ID to name mapping
interface UserMap {
  [userId: string]: string;
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
 * Calculate thread patterns from messages
 */
function calculateThreadPatterns(messages: MessageData[]): SlackPatterns['threadPatterns'] {
  const threadsStarted = messages.filter(m => m.isThreadStarter).length;
  const threadsParticipatedIn = messages.filter(m => m.isThreadReply).length;
  const topLevelMessages = messages.filter(m => !m.isThreadReply && !m.isThreadStarter).length;

  const totalMessages = messages.length;
  const threadedMessages = threadsStarted + threadsParticipatedIn;
  const topLevelVsThreadedRatio = totalMessages > 0
    ? Math.round((topLevelMessages / totalMessages) * 100) / 100
    : 0;

  return {
    threadsStarted,
    threadsParticipatedIn,
    topLevelVsThreadedRatio
  };
}

/**
 * Calculate collaboration network from mentions
 */
function calculateCollaborationNetwork(
  messages: MessageData[],
  userMap: UserMap,
  currentUserId: string
): SlackPatterns['collaborationNetwork'] {
  // Count mentions given by user
  const mentionCounts: Record<string, number> = {};
  let totalMentions = 0;

  messages.forEach(msg => {
    msg.mentions.forEach(userId => {
      if (userId !== currentUserId) {
        mentionCounts[userId] = (mentionCounts[userId] || 0) + 1;
        totalMentions++;
      }
    });
  });

  // Get top collaborators
  const topCollaborators = Object.entries(mentionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, count]) => ({
      name: userMap[userId] || `User ${userId.slice(-4)}`,
      mentionCount: count
    }));

  return {
    topCollaborators,
    uniquePeopleMentioned: Object.keys(mentionCounts).length,
    mentionsReceived: 0 // Would need to search all messages for mentions of current user
  };
}

/**
 * Calculate channel behavior patterns
 */
function calculateChannelBehavior(
  messages: MessageData[],
  totalChannels: number
): SlackPatterns['channelBehavior'] {
  // Count messages per channel
  const channelCounts: Record<string, { count: number; name: string }> = {};

  messages.forEach(msg => {
    if (!channelCounts[msg.channelId]) {
      channelCounts[msg.channelId] = { count: 0, name: msg.channelName || msg.channelId };
    }
    channelCounts[msg.channelId].count++;
  });

  const activeChannels = Object.keys(channelCounts).length;

  // Get most active channels
  const mostActiveChannels = Object.entries(channelCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([, data]) => ({
      name: data.name,
      messageCount: data.count
    }));

  return {
    totalChannels,
    activeChannels,
    channelOverloadScore: totalChannels, // Simple score = total channels
    mostActiveChannels
  };
}

/**
 * Calculate focus metrics and deep work windows
 */
function calculateFocusMetrics(messages: MessageData[], totalDays: number): SlackPatterns['focusMetrics'] {
  if (messages.length === 0) {
    return {
      deepWorkWindows: totalDays * 2, // Assume 2 deep work windows per day if no messages
      longestFocusPeriod: 480, // 8 hours
      contextSwitchingScore: 'low'
    };
  }

  // Sort messages by timestamp
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Find gaps between messages (potential deep work windows)
  let deepWorkWindows = 0;
  let longestGap = 0;

  for (let i = 1; i < sortedMessages.length; i++) {
    const gap = new Date(sortedMessages[i].timestamp).getTime() -
                new Date(sortedMessages[i-1].timestamp).getTime();
    const gapMinutes = gap / (1000 * 60);

    // 2+ hour gaps during work hours (9am-5pm) count as deep work windows
    const prevHour = new Date(sortedMessages[i-1].timestamp).getHours();
    if (gapMinutes >= 120 && prevHour >= 9 && prevHour < 17) {
      deepWorkWindows++;
    }

    longestGap = Math.max(longestGap, gapMinutes);
  }

  // Calculate channel switches per hour
  const uniqueChannelSwitches = new Set<string>();
  let channelSwitchCount = 0;
  let lastChannel = '';

  sortedMessages.forEach(msg => {
    if (lastChannel && lastChannel !== msg.channelId) {
      channelSwitchCount++;
    }
    lastChannel = msg.channelId;
    uniqueChannelSwitches.add(msg.channelId);
  });

  // Messages spread over days
  const avgMessagesPerHour = messages.length / (totalDays * 8); // Assume 8 work hours
  const avgSwitchesPerHour = channelSwitchCount / (totalDays * 8);

  let contextSwitchingScore: 'high' | 'moderate' | 'low' = 'low';
  if (avgSwitchesPerHour > 5 || uniqueChannelSwitches.size > 15) {
    contextSwitchingScore = 'high';
  } else if (avgSwitchesPerHour > 2 || uniqueChannelSwitches.size > 8) {
    contextSwitchingScore = 'moderate';
  }

  return {
    deepWorkWindows,
    longestFocusPeriod: Math.round(longestGap),
    contextSwitchingScore
  };
}

/**
 * Generate insights from Slack patterns
 */
function generateInsights(patterns: Omit<SlackPatterns, 'insights'>): string[] {
  const insights: string[] = [];

  // Collaboration network insights
  if (patterns.collaborationNetwork?.topCollaborators && patterns.collaborationNetwork.topCollaborators.length > 0) {
    const topNames = patterns.collaborationNetwork.topCollaborators
      .slice(0, 3)
      .map(c => `${c.name} (${c.mentionCount})`)
      .join(', ');
    insights.push(`You collaborate most with ${topNames}`);
  }

  // Channel overload insights
  if (patterns.channelBehavior) {
    if (patterns.channelBehavior.totalChannels > 50) {
      insights.push(`You're in ${patterns.channelBehavior.totalChannels} channels but active in only ${patterns.channelBehavior.activeChannels} - consider leaving dormant channels to reduce noise`);
    } else if (patterns.channelBehavior.totalChannels > 30 && patterns.channelBehavior.activeChannels < patterns.channelBehavior.totalChannels * 0.3) {
      insights.push(`Active in ${patterns.channelBehavior.activeChannels} of ${patterns.channelBehavior.totalChannels} channels - many dormant memberships`);
    }
  }

  // Focus metrics insights
  if (patterns.focusMetrics) {
    if (patterns.focusMetrics.deepWorkWindows === 0) {
      insights.push(`No deep work periods detected - your longest focus was ${patterns.focusMetrics.longestFocusPeriod} minutes`);
    } else if (patterns.focusMetrics.deepWorkWindows < 5) {
      insights.push(`Only ${patterns.focusMetrics.deepWorkWindows} deep work windows (2+ hours) in the past 30 days`);
    }

    if (patterns.focusMetrics.contextSwitchingScore === 'high') {
      insights.push('High context-switching detected - frequently jumping between channels');
    }
  }

  // Thread pattern insights
  if (patterns.threadPatterns) {
    if (patterns.threadPatterns.topLevelVsThreadedRatio > 0.8) {
      insights.push(`${Math.round(patterns.threadPatterns.topLevelVsThreadedRatio * 100)}% of messages are top-level broadcasts - threading could improve focus`);
    }
    if (patterns.threadPatterns.threadsStarted > patterns.threadPatterns.threadsParticipatedIn * 2) {
      insights.push('You start threads more than you participate in them - initiator profile');
    }
  }

  // Engagement insights
  if (patterns.engagementMetrics) {
    const { reactionsGiven, reactionsReceived } = patterns.engagementMetrics;
    if (reactionsGiven > 0 && reactionsReceived > 0) {
      const ratio = reactionsGiven / reactionsReceived;
      if (ratio > 2) {
        insights.push(`You give ${Math.round(ratio)}x more reactions than you receive - high engagement giver`);
      } else if (ratio < 0.5) {
        insights.push('Your messages receive more reactions than you give - high visibility');
      }
    }
  }

  // Message volume insights
  if (patterns.messageVolume.avgPerDay > 50) {
    insights.push(`Very high Slack activity with ${patterns.messageVolume.avgPerDay} messages per day`);
  }

  if (patterns.messageVolume.afterHoursPercentage > 30) {
    insights.push(`${patterns.messageVolume.afterHoursPercentage}% of messages sent outside work hours (9am-5pm)`);
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
    const { email, code } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Slack Fetch] Starting data fetch for ${email}`);

    // Get user code - use provided code or look it up from onboarding data
    const userCode = code || await getUserCode(email);
    if (userCode) {
      console.log(`[Slack Fetch] Using user code: ${userCode}`);
    }

    // Get access token using token-manager (handles refresh automatically)
    const { token, error: tokenError } = await getAccessToken(email, 'slack', userCode);

    if (!token || tokenError) {
      console.error('[Slack Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Slack', details: tokenError },
        { status: 401 }
      );
    }

    // Get current user's Slack ID to filter only their messages
    const authResponse = await fetch('https://slack.com/api/auth.test', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const authData = await authResponse.json();
    const currentUserId = authData.user_id;
    console.log(`[Slack Fetch] Filtering messages for user: ${currentUserId}`);

    // Fetch users list for name mapping
    const userMap: UserMap = {};
    try {
      const usersResponse = await fetch('https://slack.com/api/users.list?limit=500', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const usersData = await usersResponse.json();
      if (usersData.ok && usersData.members) {
        usersData.members.forEach((user: { id: string; real_name?: string; name?: string }) => {
          userMap[user.id] = user.real_name || user.name || user.id;
        });
      }
    } catch (err) {
      console.warn('[Slack Fetch] Could not fetch user names:', err);
    }

    // Fetch reactions given by user
    let reactionsGiven = 0;
    try {
      const reactionsResponse = await fetch('https://slack.com/api/reactions.list?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const reactionsData = await reactionsResponse.json();
      if (reactionsData.ok && reactionsData.items) {
        reactionsGiven = reactionsData.items.length;
      }
    } catch (err) {
      console.warn('[Slack Fetch] Could not fetch reactions:', err);
    }

    // Calculate timestamp for 30 days ago
    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = Math.floor(startDate.getTime() / 1000);
    const totalDays = 30;

    console.log(`[Slack Fetch] Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get ALL user's conversations to count total channels
    const allChannelsResponse = await fetch(
      'https://slack.com/api/users.conversations?types=public_channel,private_channel&limit=500',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const allChannelsData = await allChannelsResponse.json();
    const totalChannels = allChannelsData.ok ? (allChannelsData.channels?.length || 0) : 0;
    console.log(`[Slack Fetch] User is member of ${totalChannels} total channels`);

    // Get user's conversations (channels, DMs, etc.) for message fetching
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
    console.log(`[Slack Fetch] Found ${channels.length} conversations to analyze`);

    // Create channel ID to name mapping
    const channelNameMap: Record<string, string> = {};
    channels.forEach((ch: { id: string; name?: string }) => {
      channelNameMap[ch.id] = ch.name || ch.id;
    });

    // Fetch message history from channels (limit to first 20 channels for performance)
    const messageData: MessageData[] = [];
    const channelsToCheck = channels.slice(0, 20);

    // Regex to extract @mentions from message text
    const mentionRegex = /<@([A-Z0-9]+)>/g;

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
            // Filter to current user's messages only (requires user token from user_scope OAuth)
            if (message.ts && !message.bot_id && message.user === currentUserId) {
              const date = new Date(parseFloat(message.ts) * 1000);
              const hour = date.getHours();
              const dayOfWeek = date.getDay();
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
              // FIXED: After-hours is now 9am-5pm (was 7am-7pm)
              const isAfterHours = hour < 9 || hour >= 17;

              // Extract mentions from message text
              const mentions: string[] = [];
              if (message.text) {
                const matches = message.text.matchAll(mentionRegex);
                for (const match of matches) {
                  mentions.push(match[1]);
                }
              }

              // Detect thread participation
              const threadTs = message.thread_ts;
              const isThreadReply = !!(threadTs && threadTs !== message.ts);
              const isThreadStarter = !!(threadTs && threadTs === message.ts);

              messageData.push({
                timestamp: date.toISOString(),
                hour,
                dayOfWeek,
                isWeekend,
                isAfterHours,
                channelId: channel.id,
                channelName: channelNameMap[channel.id],
                isThreadReply,
                isThreadStarter,
                mentions,
                text: message.text
              });
            }
          }
        }
      } catch (err) {
        console.error(`[Slack Fetch] Error fetching channel ${channel.id}:`, err);
      }
    }

    console.log(`[Slack Fetch] Processed ${messageData.length} of YOUR messages from ${channelsToCheck.length} channels`);

    // Calculate behavioral patterns
    const messageVolume = calculateMessageVolume(messageData, totalDays);
    const workHours = calculateWorkHours(messageData);
    const collaborationIntensity = calculateCollaborationIntensity(messageData, totalDays);
    const stressIndicators = calculateStressIndicators(messageVolume, workHours, messageData);

    // NEW: Calculate enhanced patterns
    const threadPatterns = calculateThreadPatterns(messageData);
    const collaborationNetwork = calculateCollaborationNetwork(messageData, userMap, currentUserId);
    const channelBehavior = calculateChannelBehavior(messageData, totalChannels);
    const focusMetrics = calculateFocusMetrics(messageData, totalDays);

    // Engagement metrics (reactions)
    const engagementMetrics: SlackPatterns['engagementMetrics'] = {
      reactionsGiven,
      reactionsReceived: 0, // Would need to scan all messages for reactions to user's messages
      avgReactionsPerMessage: messageData.length > 0 ? reactionsGiven / messageData.length : 0
    };

    const patterns: SlackPatterns = {
      messageVolume,
      workHours,
      collaborationIntensity,
      stressIndicators,
      // NEW fields
      threadPatterns,
      collaborationNetwork,
      channelBehavior,
      focusMetrics,
      engagementMetrics,
      insights: []
    };

    // Generate insights
    patterns.insights = generateInsights(patterns);

    console.log('[Slack Fetch] Patterns calculated:', JSON.stringify(patterns, null, 2));

    // ========================================================================
    // SENTIMENT & LIFE CONTEXT ANALYSIS (tier-based)
    // Free: Basic sentiment analysis
    // Pro/Max: Full life context detection (work events, team dynamics, patterns)
    // ========================================================================
    let sentimentAnalyzed = false;
    try {
      // Check user's subscription tier and preferences in parallel
      const [prefsResult, userResult] = await Promise.all([
        supabase
          .from('sentiment_analysis_preferences')
          .select('slack_content_analysis')
          .eq('user_email', email)
          .single(),
        supabase
          .from('users')
          .select('subscription_tier')
          .eq('email', email)
          .single()
      ]);

      const sentimentEnabled = prefsResult.data?.slack_content_analysis ?? false;
      const subscriptionTier = userResult.data?.subscription_tier || 'free';
      const isPremium = subscriptionTier === 'pro' || subscriptionTier === 'max';

      if (sentimentEnabled && messageData.length >= 10) {
        console.log(`[Slack Fetch] Running ${isPremium ? 'life context' : 'sentiment'} analysis (${subscriptionTier} tier)`);

        // Prepare all messages with text
        const messagesWithText = messageData
          .filter(msg => msg.text && msg.text.trim().length > 0)
          .map(msg => ({
            text: msg.text!,
            timestamp: msg.timestamp,
            channel: msg.channelName,
            isAfterHours: msg.isAfterHours,
          }));

        if (isPremium && messagesWithText.length >= 5) {
          // Pro/Max: Full life context analysis with AI
          // Analyze ALL messages together to detect patterns across time
          const lifeContext = await analyzeSlackForLifeContext(messagesWithText);

          // Store life context (merges with Gmail context if exists)
          await mergeAndStoreLifeContext(email, lifeContext, 'slack');

          // Also store daily sentiment for trend tracking
          const messagesByDate: Record<string, typeof messagesWithText> = {};
          for (const msg of messagesWithText) {
            const date = msg.timestamp.split('T')[0];
            if (!messagesByDate[date]) messagesByDate[date] = [];
            messagesByDate[date].push(msg);
          }

          for (const [date, dayMessages] of Object.entries(messagesByDate)) {
            if (dayMessages.length >= 3) {
              await storeSentimentAnalysis(email, 'slack', date, lifeContext.sentiment);
            }
          }

          console.log(`[Slack Fetch] Life context analysis complete: ${lifeContext.upcomingEvents.length} events, ${lifeContext.activePatterns.length} patterns detected`);
          sentimentAnalyzed = true;
        } else {
          // Free tier: Basic sentiment analysis per day
          const messagesByDate: Record<string, { text: string; timestamp: string; isAfterHours: boolean }[]> = {};

          for (const msg of messagesWithText) {
            const date = msg.timestamp.split('T')[0];
            if (!messagesByDate[date]) messagesByDate[date] = [];
            messagesByDate[date].push({
              text: msg.text,
              timestamp: msg.timestamp,
              isAfterHours: msg.isAfterHours,
            });
          }

          // Analyze each day's messages
          for (const [date, dayMessages] of Object.entries(messagesByDate)) {
            if (dayMessages.length >= 3) {
              const texts = dayMessages.map(m => m.text);
              const sentiment = await analyzeMessageBatch(texts, {
                source: 'slack',
                date,
                includeTimestamps: dayMessages,
              });

              await storeSentimentAnalysis(email, 'slack', date, sentiment);
            }
          }

          sentimentAnalyzed = true;
          console.log(`[Slack Fetch] Sentiment analysis complete for ${Object.keys(messagesByDate).length} days`);
        }
      } else if (!sentimentEnabled) {
        console.log('[Slack Fetch] Content analysis not enabled for user');
      }
    } catch (sentimentError) {
      console.error('[Slack Fetch] Content analysis error:', sentimentError);
      // Don't fail the whole request if analysis fails
    }

    // =====================================================
    // DEEP CONTENT ANALYSIS (tasks, urgency, interruptions)
    // =====================================================
    try {
      // Prepare messages for deep analysis
      const messagesForDeepAnalysis = messageData
        .filter(m => m.text && m.text.trim().length > 0)
        .slice(0, 50)
        .map((m, i) => ({
          id: `slack_${i}_${m.timestamp}`,
          text: m.text!,
          user: '', // We have channelId but not user ID readily available here
          userName: '', // Would need to map from userMap
          channel: m.channelId,
          channelName: m.channelName,
          timestamp: m.timestamp,
          isAfterHours: m.isAfterHours,
          threadTs: undefined,
          mentions: m.mentions,
        }));

      if (messagesForDeepAnalysis.length >= 5) {
        console.log(`[Slack Fetch] Running deep content analysis on ${messagesForDeepAnalysis.length} messages`);

        const deepAnalysis = await analyzeSlackDeepContent(messagesForDeepAnalysis, currentUserId);
        await storeDeepContentAnalysis(email, deepAnalysis);

        console.log(`[Slack Fetch] Deep content analysis complete: ${deepAnalysis.pendingTasks.length} tasks, ${deepAnalysis.responseDebt.count} response debt`);
      }
    } catch (deepContentError) {
      // Don't fail the entire request if deep analysis fails
      console.error('[Slack Fetch] Deep content analysis error (non-fatal):', deepContentError);
    }

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

    // Store in database - use admin client since this may be called server-to-server
    const supabase = createAdminClient();

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
      },
      sentimentAnalysis: {
        enabled: sentimentAnalyzed,
        message: sentimentAnalyzed
          ? 'Content sentiment analysis completed'
          : 'Sentiment analysis not enabled - opt in via settings'
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
