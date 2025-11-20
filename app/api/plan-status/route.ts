import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const email = searchParams.get('email');

    if (!code && !email) {
      return NextResponse.json(
        { error: 'Either code or email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const query = supabase
      .from('sage_onboarding_data')
      .select('plan_generation_status, plan_generation_error, sage_plan, email');

    if (code) {
      query.eq('form_data->>uniqueCode', code);
    } else {
      query.eq('email', email);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json(
        {
          status: 'not_found',
          message: 'No plan found for this user'
        },
        { status: 404 }
      );
    }

    // Determine the actual status
    let status = data.plan_generation_status || 'unknown';

    // If no status is set but plan exists, mark as completed
    if (!data.plan_generation_status && data.sage_plan) {
      status = 'completed';
    }

    return NextResponse.json({
      status,
      error: data.plan_generation_error,
      hasPlan: !!data.sage_plan,
      email: data.email
    });

  } catch (error) {
    console.error('Error checking plan status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check plan status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
