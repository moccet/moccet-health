import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check integration_tokens table (where tokens are actually stored)
    const { data: tokens, error } = await supabase
      .from('integration_tokens')
      .select('*')
      .eq('user_email', email)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({
        error: 'Failed to fetch tokens',
        details: error.message
      }, { status: 500 });
    }

    // Mask sensitive data
    const maskedTokens = tokens?.map(t => ({
      provider: t.provider,
      hasAccessToken: !!t.access_token,
      hasRefreshToken: !!t.refresh_token,
      expiresAt: t.expires_at,
      scopes: t.scopes,
      providerUserId: t.provider_user_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json({
      success: true,
      email,
      tokenCount: tokens?.length || 0,
      tokens: maskedTokens,
      connectedProviders: tokens?.map(t => t.provider) || [],
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Internal error',
      details: String(error)
    }, { status: 500 });
  }
}
