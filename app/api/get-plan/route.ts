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
      .select('sage_plan, lab_file_analysis, plan_generation_status, plan_generation_error, meal_plan, micronutrients, lifestyle_integration');

    if (code) {
      query.eq('form_data->>uniqueCode', code);
    } else {
      query.eq('email', email);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          error: 'No plan found for this user'
        },
        { status: 404 }
      );
    }

    // Return all plan data
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
