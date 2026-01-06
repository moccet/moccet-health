import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Delete Whoop-related cookies (legacy)
    cookieStore.delete('whoop_access_token');
    cookieStore.delete('whoop_refresh_token');
    cookieStore.delete('whoop_user_id');

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
      console.log(`[Whoop Disconnect] Revoking token for ${email}`);
      const result = await revokeToken(email, 'whoop');
      if (!result.success) {
        console.error(`[Whoop Disconnect] Failed to revoke token: ${result.error}`);
      }
    }

    // Also delete from user_connectors table if userId provided
    if (userId) {
      const supabase = createAdminClient();
      await supabase
        .from('user_connectors')
        .update({ whoop_connected: false, whoop_token: null })
        .eq('user_id', userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Whoop:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Whoop' },
      { status: 500 }
    );
  }
}
