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

    // Try sage table first
    const sageQuery = supabase
      .from('sage_onboarding_data')
      .select('plan_generation_status, plan_generation_error, sage_plan, email');

    if (code) {
      sageQuery.eq('form_data->>uniqueCode', code);
    } else {
      sageQuery.eq('email', email);
    }

    const { data, error } = await sageQuery.single();

    // If not found in sage table, try forge table
    if (error || !data) {
      const forgeQuery = supabase
        .from('forge_onboarding_data')
        .select('plan_generation_status, plan_generation_error, forge_plan, email');

      if (code) {
        forgeQuery.eq('form_data->>uniqueCode', code);
      } else {
        forgeQuery.eq('email', email);
      }

      const forgeResult = await forgeQuery.single();

      if (forgeResult.error || !forgeResult.data) {
        return NextResponse.json(
          {
            status: 'not_found',
            message: 'No plan found for this user'
          },
          { status: 404 }
        );
      }

      // Determine the actual status for forge
      let status = forgeResult.data.plan_generation_status || 'unknown';

      // If no status is set but plan exists, mark as completed
      if (!forgeResult.data.plan_generation_status && forgeResult.data.forge_plan) {
        status = 'completed';
      }

      return NextResponse.json({
        status,
        error: forgeResult.data.plan_generation_error,
        hasPlan: !!forgeResult.data.forge_plan,
        email: forgeResult.data.email
      });
    }

    // Determine the actual status for sage
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
