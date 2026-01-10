import { NextRequest, NextResponse } from 'next/server';
import { revokeToken } from '@/lib/services/token-manager';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(request: NextRequest) {
  try {
    const { email, userId } = await request.json();

    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Email or userId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    let userEmail = email;

    // Look up email from userId if needed
    if (!userEmail && userId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        const { data: userData } = await supabase.auth.admin.getUserById(userId);
        if (userData?.user?.email) {
          userEmail = userData.user.email;
        }
      } catch (e) {
        console.log('[Linear Disconnect] Could not look up email from userId:', e);
      }
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Could not determine user email' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Delete the token from the database
    const deleteResult = await revokeToken(userEmail, 'linear');

    if (!deleteResult.success) {
      console.error('[Linear Disconnect] Failed to revoke token:', deleteResult.error);
      return NextResponse.json(
        { error: 'Failed to disconnect Linear' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Update user_connectors table
    if (userId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: userId,
          user_email: userEmail,
          connector_name: 'Linear',
          is_connected: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Linear Disconnect] Updated user_connectors for user ${userId}`);
      } catch (connectorError) {
        console.error('[Linear Disconnect] Failed to update user_connectors:', connectorError);
      }
    }

    console.log(`[Linear Disconnect] Successfully disconnected for ${userEmail}`);

    // Create response that clears cookies
    const response = NextResponse.json(
      { success: true, message: 'Linear disconnected successfully' },
      { headers: corsHeaders }
    );

    // Clear cookies
    response.cookies.set('linear_access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    response.cookies.set('linear_organization', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0
    });

    return response;
  } catch (error) {
    console.error('Error disconnecting Linear:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Linear' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
