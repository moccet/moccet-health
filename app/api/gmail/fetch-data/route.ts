import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('gmail_access_token')?.value;
    const refreshToken = request.cookies.get('gmail_refresh_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback'
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch last 100 messages for pattern analysis
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 100,
      q: 'newer_than:30d' // Last 30 days
    });

    const messages = messagesResponse.data.messages || [];

    // Fetch message details
    const emailData: Array<{timestamp: string, hour: number, dayOfWeek: number}> = [];

    for (const message of messages.slice(0, 50)) { // Limit to 50 for performance
      try {
        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['Date']
        });

        const dateHeader = messageDetail.data.payload?.headers?.find(
          h => h.name?.toLowerCase() === 'date'
        );

        if (dateHeader?.value) {
          const date = new Date(dateHeader.value);
          emailData.push({
            timestamp: date.toISOString(),
            hour: date.getHours(),
            dayOfWeek: date.getDay()
          });
        }
      } catch (err) {
        console.error('Error fetching message:', err);
      }
    }

    // Analyze email patterns
    const analysis = {
      totalEmails: emailData.length,
      avgHourOfDay: emailData.reduce((sum, e) => sum + e.hour, 0) / emailData.length || 0,
      earlyMorningEmails: emailData.filter(e => e.hour >= 5 && e.hour < 9).length,
      lateNightEmails: emailData.filter(e => e.hour >= 22 || e.hour < 5).length,
      weekendEmails: emailData.filter(e => e.dayOfWeek === 0 || e.dayOfWeek === 6).length,
      hourDistribution: emailData.reduce((acc, e) => {
        acc[e.hour] = (acc[e.hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>)
    };

    return NextResponse.json({
      success: true,
      data: analysis,
      rawData: emailData
    });

  } catch (error) {
    console.error('Error fetching Gmail data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Gmail data' },
      { status: 500 }
    );
  }
}
