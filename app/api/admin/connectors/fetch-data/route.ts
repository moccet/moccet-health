import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, Provider } from '@/lib/services/token-manager';

interface ProviderDataFetcher {
  name: string;
  fetchData: (accessToken: string) => Promise<any>;
}

const providerFetchers: Record<string, ProviderDataFetcher> = {
  oura: {
    name: 'Oura Ring',
    fetchData: async (accessToken: string) => {
      // Fetch personal info and recent sleep data
      const [personalInfo, sleepData, readinessData, activityData] = await Promise.all([
        fetch('https://api.ouraring.com/v2/usercollection/personal_info', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch(
          `https://api.ouraring.com/v2/usercollection/daily_sleep?start_date=${getDateDaysAgo(7)}&end_date=${getToday()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then((r) => r.json()),
        fetch(
          `https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=${getDateDaysAgo(7)}&end_date=${getToday()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then((r) => r.json()),
        fetch(
          `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${getDateDaysAgo(7)}&end_date=${getToday()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then((r) => r.json()),
      ]);

      return {
        personalInfo,
        sleepData: sleepData.data?.slice(0, 3) || [],
        readinessData: readinessData.data?.slice(0, 3) || [],
        activityData: activityData.data?.slice(0, 3) || [],
        _meta: {
          sleepCount: sleepData.data?.length || 0,
          readinessCount: readinessData.data?.length || 0,
          activityCount: activityData.data?.length || 0,
        },
      };
    },
  },

  fitbit: {
    name: 'Fitbit',
    fetchData: async (accessToken: string) => {
      const today = getToday();
      const [profile, sleepLog, activitySummary, heartRate] = await Promise.all([
        fetch('https://api.fitbit.com/1/user/-/profile.json', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${today}.json`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch(`https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
      ]);

      return {
        profile: profile.user
          ? {
              displayName: profile.user.displayName,
              memberSince: profile.user.memberSince,
              timezone: profile.user.timezone,
            }
          : null,
        sleepLog: sleepLog.sleep?.slice(0, 2) || [],
        activitySummary: activitySummary.summary || null,
        heartRate: heartRate['activities-heart']?.[0] || null,
      };
    },
  },

  strava: {
    name: 'Strava',
    fetchData: async (accessToken: string) => {
      const [athlete, activities, stats] = await Promise.all([
        fetch('https://www.strava.com/api/v3/athlete', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://www.strava.com/api/v3/athlete/activities?per_page=5', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://www.strava.com/api/v3/athletes/{id}/stats', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => r.json())
          .catch(() => null),
      ]);

      return {
        athlete: athlete
          ? {
              id: athlete.id,
              firstname: athlete.firstname,
              lastname: athlete.lastname,
              city: athlete.city,
              country: athlete.country,
              premium: athlete.premium,
            }
          : null,
        recentActivities: (activities || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          distance: a.distance,
          moving_time: a.moving_time,
          start_date: a.start_date,
        })),
        stats,
      };
    },
  },

  dexcom: {
    name: 'Dexcom',
    fetchData: async (accessToken: string) => {
      const baseUrl =
        process.env.NODE_ENV === 'production'
          ? 'https://api.dexcom.com'
          : 'https://sandbox-api.dexcom.com';

      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [egvs, devices] = await Promise.all([
        fetch(
          `${baseUrl}/v3/users/self/egvs?startDate=${startDate}&endDate=${endDate}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
          .then((r) => r.json())
          .catch(() => ({ records: [] })),
        fetch(`${baseUrl}/v3/users/self/devices`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => r.json())
          .catch(() => ({ records: [] })),
      ]);

      return {
        glucoseReadings: egvs.records?.slice(0, 10) || [],
        devices: devices.records || [],
        _meta: {
          totalReadings: egvs.records?.length || 0,
          dateRange: { startDate, endDate },
        },
      };
    },
  },

  gmail: {
    name: 'Gmail',
    fetchData: async (accessToken: string) => {
      const [profile, messages, labels] = await Promise.all([
        fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
      ]);

      // Get message details for the first few messages
      const messageDetails = [];
      if (messages.messages) {
        for (const msg of messages.messages.slice(0, 3)) {
          const detail = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          ).then((r) => r.json());

          const headers = detail.payload?.headers || [];
          messageDetails.push({
            id: detail.id,
            snippet: detail.snippet?.substring(0, 100),
            subject: headers.find((h: any) => h.name === 'Subject')?.value,
            from: headers.find((h: any) => h.name === 'From')?.value,
            date: headers.find((h: any) => h.name === 'Date')?.value,
          });
        }
      }

      return {
        profile: {
          email: profile.emailAddress,
          messagesTotal: profile.messagesTotal,
          threadsTotal: profile.threadsTotal,
        },
        recentMessages: messageDetails,
        labelCount: labels.labels?.length || 0,
      };
    },
  },

  outlook: {
    name: 'Outlook Calendar',
    fetchData: async (accessToken: string) => {
      const [profile, calendars, events] = await Promise.all([
        fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://graph.microsoft.com/v1.0/me/calendars', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch(
          `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${new Date().toISOString()}&endDateTime=${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}&$top=5`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then((r) => r.json()),
      ]);

      return {
        profile: {
          displayName: profile.displayName,
          mail: profile.mail,
          userPrincipalName: profile.userPrincipalName,
        },
        calendars: calendars.value?.map((c: any) => ({
          name: c.name,
          color: c.color,
          isDefaultCalendar: c.isDefaultCalendar,
        })),
        upcomingEvents: events.value?.map((e: any) => ({
          subject: e.subject,
          start: e.start,
          end: e.end,
          isAllDay: e.isAllDay,
          location: e.location?.displayName,
        })),
      };
    },
  },

  slack: {
    name: 'Slack',
    fetchData: async (accessToken: string) => {
      const [authTest, channels, conversations] = await Promise.all([
        fetch('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=10', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://slack.com/api/conversations.list?types=im&limit=5', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
      ]);

      return {
        user: {
          userId: authTest.user_id,
          userName: authTest.user,
          teamId: authTest.team_id,
          team: authTest.team,
        },
        channels: channels.channels?.slice(0, 5).map((c: any) => ({
          name: c.name,
          id: c.id,
          numMembers: c.num_members,
          isMember: c.is_member,
        })),
        directMessages: conversations.channels?.length || 0,
      };
    },
  },

  teams: {
    name: 'Microsoft Teams',
    fetchData: async (accessToken: string) => {
      const [profile, teams, chats] = await Promise.all([
        fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json()),
        fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => r.json())
          .catch(() => ({ value: [] })),
        fetch('https://graph.microsoft.com/v1.0/me/chats?$top=5', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then((r) => r.json())
          .catch(() => ({ value: [] })),
      ]);

      return {
        profile: {
          displayName: profile.displayName,
          mail: profile.mail,
          jobTitle: profile.jobTitle,
        },
        teams: teams.value?.map((t: any) => ({
          displayName: t.displayName,
          description: t.description,
        })),
        recentChats: chats.value?.length || 0,
      };
    },
  },
};

// Helper functions
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, provider } = body;

    if (!email || !provider) {
      return NextResponse.json(
        { error: 'Email and provider are required' },
        { status: 400 }
      );
    }

    // Get the access token
    const { token, error: tokenError } = await getAccessToken(email, provider as Provider);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: tokenError || `No token found for ${provider}`,
          notConnected: true,
        },
        { status: 200 }
      );
    }

    // Get the fetcher for this provider
    const fetcher = providerFetchers[provider];
    if (!fetcher) {
      return NextResponse.json(
        {
          success: false,
          error: `Data fetching not implemented for ${provider}`,
        },
        { status: 200 }
      );
    }

    // Fetch the data
    const data = await fetcher.fetchData(token);

    return NextResponse.json({
      success: true,
      provider,
      providerName: fetcher.name,
      data,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Connectors Fetch Data] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    );
  }
}
