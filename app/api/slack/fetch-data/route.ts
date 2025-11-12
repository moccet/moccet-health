import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const userToken = request.cookies.get('slack_user_token')?.value;

    if (!userToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Calculate timestamp for 30 days ago
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

    // Get user's conversations
    const conversationsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel,im', {
      headers: {
        'Authorization': `Bearer ${userToken}`,
      },
    });

    const conversationsData = await conversationsResponse.json();

    if (!conversationsData.ok) {
      console.error('Slack API error:', conversationsData.error);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    const messageTimestamps: Array<{timestamp: string, hour: number, dayOfWeek: number, isWeekend: boolean}> = [];

    // Fetch message history from channels (limit to first 10 channels for performance)
    const channelsToCheck = conversationsData.channels?.slice(0, 10) || [];

    for (const channel of channelsToCheck) {
      try {
        const historyResponse = await fetch(
          `https://slack.com/api/conversations.history?channel=${channel.id}&oldest=${thirtyDaysAgo}&limit=100`,
          {
            headers: {
              'Authorization': `Bearer ${userToken}`,
            },
          }
        );

        const historyData = await historyResponse.json();

        if (historyData.ok && historyData.messages) {
          for (const message of historyData.messages) {
            if (message.ts) {
              const date = new Date(parseFloat(message.ts) * 1000);
              const dayOfWeek = date.getDay();
              messageTimestamps.push({
                timestamp: date.toISOString(),
                hour: date.getHours(),
                dayOfWeek,
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6
              });
            }
          }
        }
      } catch (err) {
        console.error('Error fetching channel history:', err);
      }
    }

    // Analyze patterns
    const analysis = {
      totalMessages: messageTimestamps.length,
      avgHourOfDay: messageTimestamps.reduce((sum, m) => sum + m.hour, 0) / messageTimestamps.length || 0,
      earlyMorningMessages: messageTimestamps.filter(m => m.hour >= 5 && m.hour < 9).length,
      lateNightMessages: messageTimestamps.filter(m => m.hour >= 22 || m.hour < 5).length,
      weekendMessages: messageTimestamps.filter(m => m.isWeekend).length,
      workHoursMessages: messageTimestamps.filter(m => m.hour >= 9 && m.hour < 17 && !m.isWeekend).length,
      afterHoursMessages: messageTimestamps.filter(m => (m.hour < 9 || m.hour >= 17) && !m.isWeekend).length,
      hourDistribution: messageTimestamps.reduce((acc, m) => {
        acc[m.hour] = (acc[m.hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    };

    return NextResponse.json({
      success: true,
      data: analysis,
      rawData: messageTimestamps
    });

  } catch (error) {
    console.error('Error fetching Slack data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Slack data' },
      { status: 500 }
    );
  }
}
