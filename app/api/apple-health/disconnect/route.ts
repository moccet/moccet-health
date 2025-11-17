import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    // Clear the Apple Health connection cookie
    const cookieStore = await cookies();
    cookieStore.delete('apple_health_connected');

    // In a real implementation, you would also:
    // 1. Revoke the OAuth token with Apple
    // 2. Remove stored health data from your database
    // 3. Clean up any associated user preferences

    return NextResponse.json({
      success: true,
      message: 'Apple Health disconnected successfully'
    });

  } catch (error) {
    console.error('Error disconnecting Apple Health:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Apple Health' },
      { status: 500 }
    );
  }
}
