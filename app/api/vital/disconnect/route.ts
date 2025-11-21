import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, provider } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.VITAL_API_KEY;
    const environment = process.env.VITAL_ENVIRONMENT || 'sandbox';
    const region = process.env.VITAL_REGION || 'us';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Vital API key not configured' },
        { status: 500 }
      );
    }

    // Vital API base URL
    const baseUrl = region === 'eu'
      ? `https://api.eu.vital.io`
      : `https://api.${environment}.tryvital.io`;

    // Deregister provider or entire user
    const endpoint = provider
      ? `${baseUrl}/v2/user/provider/${userId}/${provider}`
      : `${baseUrl}/v2/user/${userId}`;

    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        'X-Vital-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vital] Disconnect failed:', errorText);
      return NextResponse.json(
        { error: 'Failed to disconnect from Vital' },
        { status: response.status }
      );
    }

    console.log(`[Vital] Disconnected ${provider || 'all providers'} for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: provider ? `${provider} disconnected successfully` : 'All providers disconnected successfully',
    });

  } catch (error) {
    console.error('[Vital] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
