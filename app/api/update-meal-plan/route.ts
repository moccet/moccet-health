import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, email, updates } = body;

    console.log('[UPDATE-MEAL-PLAN] Received request with code:', code, 'email:', email);

    if (!code && !email) {
      return NextResponse.json(
        { error: 'Either code or email parameter is required' },
        { status: 400 }
      );
    }

    if (!updates) {
      return NextResponse.json(
        { error: 'Updates object is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (updates.mealPlan) {
      updateData.meal_plan = updates.mealPlan;
    }
    if (updates.micronutrients) {
      updateData.micronutrients = updates.micronutrients;
    }
    if (updates.lifestyleIntegration) {
      updateData.lifestyle_integration = updates.lifestyleIntegration;
    }
    if (updates.sagePlan) {
      updateData.sage_plan = updates.sagePlan;
    }

    // Try sage table first
    const sageQuery = supabase
      .from('sage_onboarding_data')
      .select('id, form_data');

    if (code) {
      sageQuery.eq('form_data->>uniqueCode', code);
    } else {
      sageQuery.eq('email', email);
    }

    const { data: existingData, error: fetchError } = await sageQuery.single();

    if (fetchError || !existingData) {
      console.log('[UPDATE-MEAL-PLAN] Not found in sage table, trying forge table...');

      // Try forge table
      const forgeQuery = supabase
        .from('forge_onboarding_data')
        .select('id, form_data');

      if (code) {
        forgeQuery.eq('form_data->>uniqueCode', code);
      } else {
        forgeQuery.eq('email', email);
      }

      const { data: forgeData, error: forgeError } = await forgeQuery.single();

      if (forgeError || !forgeData) {
        return NextResponse.json(
          {
            success: false,
            error: 'No plan found for this user'
          },
          { status: 404 }
        );
      }

      // Update forge table (if needed)
      const forgeUpdateData: Record<string, unknown> = {
        updated_at: new Date().toISOString()
      };

      if (updates.forgePlan) {
        forgeUpdateData.forge_plan = updates.forgePlan;
      }

      const { error: updateError } = await supabase
        .from('forge_onboarding_data')
        .update(forgeUpdateData)
        .eq('id', forgeData.id);

      if (updateError) {
        console.error('[UPDATE-MEAL-PLAN] Error updating forge plan:', updateError);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update plan',
            message: updateError.message
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Forge plan updated successfully'
      });
    }

    // Update sage table
    const { error: updateError } = await supabase
      .from('sage_onboarding_data')
      .update(updateData)
      .eq('id', existingData.id);

    if (updateError) {
      console.error('[UPDATE-MEAL-PLAN] Error updating sage plan:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update plan',
          message: updateError.message
        },
        { status: 500 }
      );
    }

    console.log('[UPDATE-MEAL-PLAN] Sage plan updated successfully');
    return NextResponse.json({
      success: true,
      message: 'Sage plan updated successfully'
    });

  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
