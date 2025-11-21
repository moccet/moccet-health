import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 25 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
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

    console.log(`[Teams] Searching for: "${query}"`);

    // Search for messages across chats and channels using Microsoft Graph
    // Documentation: https://learn.microsoft.com/en-us/graph/api/chatmessage-delta
    const searchUrl = `https://graph.microsoft.com/v1.0/me/chats/getAllMessages?$filter=contains(body/content,'${encodeURIComponent(query)}')&$top=${limit}`;

    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Teams] Search failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to search messages', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const messages = data.value || [];

    console.log(`[Teams] Found ${messages.length} messages`);

    // Format messages for response
    const formattedMessages = messages.map((msg: {
      id: string;
      chatId: string;
      from?: { user?: { displayName?: string } };
      body?: { content?: string };
      createdDateTime: string;
      messageType: string;
    }) => ({
      id: msg.id,
      chatId: msg.chatId,
      from: msg.from?.user?.displayName || 'Unknown',
      content: msg.body?.content || '',
      createdDateTime: msg.createdDateTime,
      messageType: msg.messageType,
    }));

    return NextResponse.json({
      success: true,
      messages: formattedMessages,
      count: formattedMessages.length,
    });

  } catch (error) {
    console.error('[Teams] Error searching messages:', error);
    return NextResponse.json(
      { error: 'Failed to search messages' },
      { status: 500 }
    );
  }
}
