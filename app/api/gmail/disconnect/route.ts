import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Get email from request body or cookies
    let email: string | null = null;
    let userId: string | null = null;

    try {
      const body = await request.json();
      email = body.email;
      userId = body.userId;
    } catch {
      // No body provided
    }

    // Try to get email from cookie if not in body
    if (!email) {
      email = cookieStore.get('user_email')?.value || null;
    }

    // Delete token from database
    if (email) {
      console.log(`[Gmail Disconnect] Revoking token for ${email}`);
      const result = await revokeToken(email, 'gmail');
      if (!result.success) {
        console.error(`[Gmail Disconnect] Failed to revoke token: ${result.error}`);
      }
    }

    // Also delete from user_connectors table if userId provided
    if (userId) {
      const supabase = createAdminClient();
      await supabase
        .from('user_connectors')
        .update({ gmail_connected: false, gmail_token: null })
        .eq('user_id', userId);
    }

    // Clear all Gmail cookies (legacy)
    const response = NextResponse.json({ success: true });
    response.cookies.delete('gmail_access_token');
    response.cookies.delete('gmail_refresh_token');
    response.cookies.delete('gmail_email');

    return response;
  } catch (error) {
    console.error('Error disconnecting Gmail:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail' },
      { status: 500 }
    );
  }
}
