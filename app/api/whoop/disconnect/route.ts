import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Delete Whoop-related cookies
    cookieStore.delete('whoop_access_token');
    cookieStore.delete('whoop_refresh_token');
    cookieStore.delete('whoop_user_id');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Whoop:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Whoop' },
      { status: 500 }
    );
  }
}
