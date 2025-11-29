import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

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

    let vitalUserId: string;

    if (createUserResponse.ok) {
      const userData = await createUserResponse.json();
      vitalUserId = userData.user_id;
      console.log(`[Vital API] Created user. Vital user_id: ${vitalUserId}`);
    } else if (createUserResponse.status === 409 || createUserResponse.status === 400) {
      // User already exists (409) or duplicate user (400), need to resolve their Vital user_id
      const errorText = await createUserResponse.text();

      // Check if it's a "user already exists" error
      const isUserExists = errorText.includes('already exists') || errorText.includes('INVALID_REQUEST');

      if (isUserExists) {
        console.log(`[Vital API] User already exists (${createUserResponse.status}), resolving user_id...`);
        const resolveResponse = await fetch(`${baseUrl}/v2/user/resolve/${encodeURIComponent(userId)}`, {
          headers: {
            'X-Vital-API-Key': apiKey,
          },
        });

        if (!resolveResponse.ok) {
          const resolveErrorText = await resolveResponse.text();
          console.error('[Vital API] Failed to resolve user_id:', resolveErrorText);
          return NextResponse.json(
            { error: 'Failed to resolve existing user' },
            { status: 500 }
          );
        }

        const resolveData = await resolveResponse.json();
        vitalUserId = resolveData.user_id;
        console.log(`[Vital API] Resolved existing user. Vital user_id: ${vitalUserId}`);
      } else {
        // It's a different kind of 400 error
        console.error('[Vital API] Failed to create user:', createUserResponse.status, errorText);
        return NextResponse.json(
          { error: 'Failed to create Vital user', details: errorText },
          { status: createUserResponse.status }
        );
      }
    } else {
      const errorText = await createUserResponse.text();
      console.error('[Vital API] Failed to create user:', createUserResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create Vital user', details: errorText },
        { status: createUserResponse.status }
      );
    }

    // Create a Link Token using Vital's user_id (UUID), not client_user_id
    // Documentation: https://docs.tryvital.io/wearables/guides/link_widget
    console.log('[Vital API] Creating link token for Vital user_id:', vitalUserId);
    const linkTokenBody = {
      user_id: vitalUserId, // IMPORTANT: Use Vital's UUID, not client_user_id
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

    console.log(`[Vital API] Created link token for client_user_id: ${userId}, vital_user_id: ${vitalUserId}`);
    console.log(`[Vital API] Full response data:`, JSON.stringify(data, null, 2));
    console.log(`[Vital API] Link token: ${data.link_token}`);
    console.log(`[Vital API] Link web URL: ${data.link_web_url || 'NOT PROVIDED'}`);

    return NextResponse.json({
      success: true,
      linkToken: data.link_token,
      linkUrl: data.link_web_url, // The full URL provided by Vital/Junction
      environment,
      region,
      vitalUserId, // Return this so frontend can store it if needed
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Vital] Error creating link token:', error);
    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500, headers: corsHeaders }
    );
  }
}
