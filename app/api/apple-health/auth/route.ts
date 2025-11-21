import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // IMPORTANT: Apple Health data is NOT available via web OAuth
    // HealthKit only works in native iOS apps
    //
    // This endpoint provides "Sign in with Apple" for authentication only
    // For actual health data, users need to:
    // 1. Use the iOS Health app to export data
    // 2. Upload the export file to your app
    // OR
    // 3. Use your future iOS app with HealthKit integration

    const clientId = process.env.APPLE_SIGN_IN_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/apple-health/callback`;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Apple Health integration requires an iOS app. Please use the manual health data upload instead.',
        info: 'Apple HealthKit data is only accessible through native iOS apps, not web browsers.'
      });
    }

    // Apple Sign In with Apple OAuth URL (for authentication only)
    const authUrl = new URL('https://appleid.apple.com/auth/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code id_token');
    authUrl.searchParams.append('response_mode', 'form_post');
    authUrl.searchParams.append('scope', 'name email');
    authUrl.searchParams.append('state', generateRandomState());

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString(),
      note: 'This provides Sign in with Apple authentication. For health data, please export from your iPhone Health app.'
    });

  } catch (error) {
    console.error('Error initiating Apple Health auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Apple Health authentication' },
      { status: 500 }
    );
  }
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
