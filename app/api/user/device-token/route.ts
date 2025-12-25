import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/user/device-token
 * Register a device token for push notifications
 *
 * Body:
 * - email (required): User email
 * - device_token (required): FCM or OneSignal device token
 * - platform (required): 'ios' or 'android'
 * - provider (optional): 'fcm' or 'onesignal' (defaults to 'fcm')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, device_token, platform, provider = 'fcm' } = body;

    if (!email || !device_token || !platform) {
      return NextResponse.json(
        { error: 'email, device_token, and platform are required' },
        { status: 400 }
      );
    }

    if (!['ios', 'android'].includes(platform)) {
      return NextResponse.json(
        { error: 'platform must be ios or android' },
        { status: 400 }
      );
    }

    if (!['fcm', 'onesignal'].includes(provider)) {
      return NextResponse.json(
        { error: 'provider must be fcm or onesignal' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Upsert the device token (insert or update if exists)
    const { data, error } = await supabase
      .from('user_device_tokens')
      .upsert(
        {
          email,
          device_token,
          platform,
          provider,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'email,device_token',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('[Device Token API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[Device Token API] Registered ${provider} token for ${email} (${platform})`);

    return NextResponse.json({
      success: true,
      message: 'Device token registered',
    });
  } catch (error) {
    console.error('[Device Token API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/device-token
 * Unregister a device token (e.g., on logout)
 *
 * Body:
 * - email (required): User email
 * - device_token (required): FCM device token to remove
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, device_token } = body;

    if (!email || !device_token) {
      return NextResponse.json(
        { error: 'email and device_token are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Mark the token as inactive instead of deleting
    const { error } = await supabase
      .from('user_device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('email', email)
      .eq('device_token', device_token);

    if (error) {
      console.error('[Device Token API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`[Device Token API] Unregistered token for ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Device token unregistered',
    });
  } catch (error) {
    console.error('[Device Token API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/device-token
 * Get device tokens for a user (for debugging)
 *
 * Query params:
 * - email (required): User email
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_device_tokens')
      .select('id, platform, provider, is_active, created_at, updated_at')
      .eq('email', email);

    if (error) {
      console.error('[Device Token API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tokens: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error('[Device Token API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
