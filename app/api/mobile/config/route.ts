import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * API endpoint for mobile app to fetch AI configuration (API keys).
 * Requires valid Supabase user authentication.
 *
 * This allows the mobile app to get API keys from Vercel environment variables
 * instead of bundling them in the app.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authorization header (Supabase JWT token)
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the token with Supabase
    const supabase = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.log('[Mobile Config] Auth error:', authError?.message);
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    console.log(`[Mobile Config] Fetching config for user: ${user.email}`);

    // Return AI API keys from environment variables
    const config = {
      openai_api_key: process.env.OPENAI_API_KEY || '',
      anthropic_api_key: process.env.ANTHROPIC_API_KEY || '',
      google_api_key: process.env.GOOGLE_API_KEY || '',
    };

    // Log which keys are available (not the actual keys)
    console.log(`[Mobile Config] Keys available - OpenAI: ${!!config.openai_api_key}, Anthropic: ${!!config.anthropic_api_key}, Google: ${!!config.google_api_key}`);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[Mobile Config] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
