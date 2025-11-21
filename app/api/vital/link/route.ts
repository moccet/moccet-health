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

    // Create a Link Token
    // Documentation: https://docs.tryvital.io/wearables/guides/link_widget
    const response = await fetch(`${baseUrl}/v2/link/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vital-API-Key': apiKey,
      },
      body: JSON.stringify({
        user_id: userId,
        ...(provider && { provider }), // Optional: specify a specific provider
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vital] Failed to create link token:', errorText);
      return NextResponse.json(
        { error: 'Failed to create Vital link token' },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log(`[Vital] Created link token for user ${userId}`);

    return NextResponse.json({
      success: true,
      linkToken: data.link_token,
      environment,
      region,
    });

  } catch (error) {
    console.error('[Vital] Error creating link token:', error);
    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    );
  }
}
