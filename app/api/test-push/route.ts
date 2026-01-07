import { NextRequest, NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/services/onesignal-service';

export async function POST(request: NextRequest) {
  try {
    const { email, title, body } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const sent = await sendPushNotification(email, {
      title: title || 'Test Notification',
      body: body || 'This is a test push notification from moccet',
      data: {
        test: 'true',
        timestamp: new Date().toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      sent,
      message: sent > 0 ? `Notification sent to ${sent} device(s)` : 'No devices found for this email'
    });
  } catch (error) {
    console.error('Test push error:', error);
    return NextResponse.json({
      error: 'Failed to send notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ error: 'Email required as query param' }, { status: 400 });
  }

  // Debug: Check what tokens exist for this user
  const { createAdminClient } = await import('@/lib/supabase/server');
  const supabase = createAdminClient();
  const { data: allTokens } = await supabase
    .from('user_device_tokens')
    .select('id, device_token, platform, provider, is_active')
    .eq('email', email)
    .eq('is_active', true)
    .eq('provider', 'onesignal');

  console.log(`[Test Push Debug] All tokens for ${email}:`, JSON.stringify(allTokens));

  // Extract player IDs for debug
  const playerIds = allTokens
    ?.filter((t: { device_token: string | null }) => t.device_token && t.device_token.length > 10)
    .map((t: { device_token: string }) => t.device_token) || [];

  const sent = await sendPushNotification(email, {
    title: 'Test Notification',
    body: 'This is a test push notification from moccet',
    data: { test: 'true' }
  });

  return NextResponse.json({
    success: true,
    sent,
    debug: {
      activeTokenCount: allTokens?.length || 0,
      playerIdsCount: playerIds.length,
      playerIdsSample: playerIds.slice(0, 3).map((id: string) => id.substring(0, 15) + '...'),
    },
    message: sent > 0 ? `Notification sent to ${sent} device(s)` : 'No devices found for this email'
  });
}
