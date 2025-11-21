import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { chatId, message, channelId, teamId } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    if (!chatId && (!channelId || !teamId)) {
      return NextResponse.json(
        { error: 'Either chatId or (channelId + teamId) is required' },
        { status: 400 }
      );
    }

    // Get access token from cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('teams_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Teams not connected. Please connect Microsoft Teams first.' },
        { status: 401 }
      );
    }

    let sendUrl: string;
    let logContext: string;

    if (chatId) {
      // Send to a chat
      sendUrl = `https://graph.microsoft.com/v1.0/chats/${chatId}/messages`;
      logContext = `chat ${chatId}`;
    } else {
      // Send to a channel
      sendUrl = `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`;
      logContext = `channel ${channelId} in team ${teamId}`;
    }

    console.log(`[Teams] Sending message to ${logContext}`);

    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          content: message,
          contentType: 'text', // or 'html' for rich text
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Teams] Send message failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to send message', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log(`[Teams] Message sent successfully to ${logContext}`);

    return NextResponse.json({
      success: true,
      messageId: data.id,
      message: 'Message sent successfully',
    });

  } catch (error) {
    console.error('[Teams] Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
