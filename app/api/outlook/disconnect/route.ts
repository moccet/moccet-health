import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear the Outlook connection cookie
    const cookieStore = await cookies();
    cookieStore.delete('outlook_email');

    // In a real implementation, you would also:
    // 1. Revoke the OAuth token with Microsoft
    // 2. Remove calendar access permissions
    // 3. Clean up any cached calendar data
    // 4. Remove associated webhooks/subscriptions

    return NextResponse.json({
      success: true,
      message: 'Outlook disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting Outlook:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Outlook' },
      { status: 500 }
    );
  }
}
