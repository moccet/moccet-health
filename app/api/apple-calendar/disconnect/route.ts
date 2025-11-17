import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear the Apple Calendar connection cookie
    const cookieStore = await cookies();
    cookieStore.delete('apple_calendar_connected');

    // In a real implementation, you would also:
    // 1. Revoke the OAuth token with Apple
    // 2. Remove calendar access permissions
    // 3. Clean up any cached calendar data
    // 4. Remove associated webhooks/subscriptions

    return NextResponse.json({
      success: true,
      message: 'Apple Calendar disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting Apple Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Apple Calendar' },
      { status: 500 }
    );
  }
}
