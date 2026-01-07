import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import {
  registerDeviceTokenSchema,
  unregisterDeviceTokenSchema,
  deviceTokenQuerySchema,
  validateBody,
  validateQuery,
  formatZodError,
} from '@/lib/validation/schemas';

const logger = createLogger('DeviceTokenAPI');

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

    // Validate request body
    const validation = validateBody(body, registerDeviceTokenSchema);
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 });
    }

    const { email, device_token, platform, provider } = validation.data;

    const supabase = createAdminClient();

    // Upsert the device token (insert or update if exists)
    const { error } = await supabase
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
      logger.error('Error registering device token', error, { email, platform });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info('Device token registered', { email, platform, provider });

    return NextResponse.json({
      success: true,
      message: 'Device token registered',
    });
  } catch (error) {
    logger.error('Error registering device token', error);
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

    // Validate request body
    const validation = validateBody(body, unregisterDeviceTokenSchema);
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 });
    }

    const { email, device_token } = validation.data;

    const supabase = createAdminClient();

    // Mark the token as inactive instead of deleting
    const { error } = await supabase
      .from('user_device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('email', email)
      .eq('device_token', device_token);

    if (error) {
      logger.error('Error unregistering device token', error, { email });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    logger.info('Device token unregistered', { email });

    return NextResponse.json({
      success: true,
      message: 'Device token unregistered',
    });
  } catch (error) {
    logger.error('Error unregistering device token', error);
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

    // Validate query parameters
    const validation = validateQuery(searchParams, deviceTokenQuerySchema);
    if (!validation.success) {
      return NextResponse.json(formatZodError(validation.error), { status: 400 });
    }

    const { email } = validation.data;

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('user_device_tokens')
      .select('id, device_token, platform, provider, is_active, created_at, updated_at')
      .eq('email', email);

    if (error) {
      logger.error('Error fetching device tokens', error, { email });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tokens: data || [],
      count: data?.length || 0,
    });
  } catch (error) {
    logger.error('Error fetching device tokens', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
