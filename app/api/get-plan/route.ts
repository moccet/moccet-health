import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const email = searchParams.get('email');

    console.log('[GET-PLAN] Received request with code:', code, 'email:', email);

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
      .select('sage_plan, lab_file_analysis, plan_generation_status, plan_generation_error, meal_plan, micronutrients, lifestyle_integration');

    if (code) {
      sageQuery.eq('form_data->>uniqueCode', code);
    } else {
      sageQuery.eq('email', email);
    }

    const { data, error } = await sageQuery.single();

    console.log('[GET-PLAN] Sage query result - error:', error, 'hasData:', !!data);

    // If not found in sage table, try forge table
    if (error || !data) {
      console.log('[GET-PLAN] Not found in sage table, trying forge table...');
      const forgeQuery = supabase
        .from('forge_onboarding_data')
        .select('forge_plan, lab_file_analysis, plan_generation_status, plan_generation_error');

      if (code) {
        forgeQuery.eq('form_data->>uniqueCode', code);
      } else {
        forgeQuery.eq('email', email);
      }

      const forgeResult = await forgeQuery.single();

      console.log('[GET-PLAN] Forge query result - error:', forgeResult.error, 'hasData:', !!forgeResult.data);

      if (forgeResult.error || !forgeResult.data) {
        console.log('[GET-PLAN] Not found in either table');
        return NextResponse.json(
          {
            success: false,
            error: 'No plan found for this user'
          },
          { status: 404 }
        );
      }

      // Return forge plan data
      console.log('[GET-PLAN] Returning forge plan data');
      return NextResponse.json({
        success: true,
        plan: forgeResult.data.forge_plan,
        bloodAnalysis: forgeResult.data.lab_file_analysis,
        status: forgeResult.data.plan_generation_status || 'completed',
        error: forgeResult.data.plan_generation_error
      });
    }

    // Return sage plan data
    console.log('[GET-PLAN] Returning sage plan data');
    return NextResponse.json({
      success: true,
      plan: data.sage_plan,
      bloodAnalysis: data.lab_file_analysis,
      mealPlan: data.meal_plan,
      micronutrients: data.micronutrients,
      lifestyleIntegration: data.lifestyle_integration,
      status: data.plan_generation_status || 'completed',
      error: data.plan_generation_error
    });

  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
