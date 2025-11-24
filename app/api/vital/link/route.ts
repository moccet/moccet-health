import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, provider } = await request.json();

    console.log('[Vital API] Request received with userId:', userId);

    if (!userId) {
      console.error('[Vital API] Missing userId in request');
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.VITAL_API_KEY;
    const environment = process.env.VITAL_ENVIRONMENT || 'sandbox';
    const region = process.env.VITAL_REGION || 'us';

    console.log('[Vital API] Config - environment:', environment, 'region:', region, 'apiKey exists:', !!apiKey);

    if (!apiKey) {
      console.error('[Vital API] VITAL_API_KEY environment variable not set');
      return NextResponse.json(
        { error: 'Vital API key not configured' },
        { status: 500 }
      );
    }

    // Vital API base URL
    const baseUrl = region === 'eu'
      ? `https://api.eu.vital.io`
      : `https://api.${environment}.tryvital.io`;

    // First, create or get the user in Vital
    // Documentation: https://docs.tryvital.io/wearables/guides/user_management
    console.log('[Vital API] Creating user with baseUrl:', baseUrl);
    const createUserResponse = await fetch(`${baseUrl}/v2/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vital-API-Key': apiKey,
      },
      body: JSON.stringify({
        client_user_id: userId,
      }),
    });

    console.log('[Vital API] Create user response status:', createUserResponse.status);

    // User might already exist, which is fine
    if (!createUserResponse.ok && createUserResponse.status !== 409) {
      const errorText = await createUserResponse.text();
      console.error('[Vital API] Failed to create user:', createUserResponse.status, errorText);
      // Continue anyway - user might already exist
    } else if (createUserResponse.ok) {
      const userData = await createUserResponse.json();
      console.log(`[Vital API] Created/verified user: ${userData.user_id}`);
    } else if (createUserResponse.status === 409) {
      console.log('[Vital API] User already exists (409), continuing...');
    }

    // Create a Link Token
    // Documentation: https://docs.tryvital.io/wearables/guides/link_widget
    console.log('[Vital API] Creating link token for userId:', userId);
    const linkTokenBody = {
      user_id: userId,
      ...(provider && { provider }), // Optional: specify a specific provider
    };
    console.log('[Vital API] Link token request body:', JSON.stringify(linkTokenBody));

    const response = await fetch(`${baseUrl}/v2/link/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vital-API-Key': apiKey,
      },
      body: JSON.stringify(linkTokenBody),
    });

    console.log('[Vital API] Link token response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vital API] Failed to create link token. Status:', response.status, 'Error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create Vital link token', details: errorText },
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
