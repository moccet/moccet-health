import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const origin = requestUrl.origin;

  console.log('Auth callback received:', { code: !!code, token_hash: !!token_hash, type });

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Handle PKCE code exchange (OAuth and some magic links)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(`${origin}/moccet-mail/auth?error=auth_failed`);
    }
    console.log('Code exchange successful');
  }

  // Handle magic link token verification
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'magiclink',
    });
    if (error) {
      console.error('Error verifying OTP:', error);
      return NextResponse.redirect(`${origin}/moccet-mail/auth?error=auth_failed`);
    }
    console.log('OTP verification successful');
  }

  // Verify we have a session
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session after auth:', !!session);

  if (!session) {
    console.error('No session after authentication');
    return NextResponse.redirect(`${origin}/moccet-mail/auth?error=no_session`);
  }

  // Redirect to moccet-mail onboarding after sign in
  return NextResponse.redirect(`${origin}/moccet-mail/onboarding`);
}
