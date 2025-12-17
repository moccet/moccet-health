import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { Client } from '@upstash/qstash';
import { createClient } from '@/lib/supabase/server';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

async function updateComponentStatus(
  email: string,
  status: 'processing' | 'completed' | 'failed'
) {
  try {
    const supabase = await createClient();
    await supabase
      .from('sage_onboarding_data')
      .update({ meal_plan_status: status })
      .eq('email', email);
  } catch (error) {
    console.error('[MEAL-PLAN] Failed to update status:', error);
  }
}

async function triggerCompletionCheck(email: string, uniqueCode: string) {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.log('[MEAL-PLAN] QSTASH_TOKEN not configured, skipping completion check');
    return;
  }

  try {
    const client = new Client({ token: qstashToken });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.moccet.ai';

    await client.publishJSON({
      url: `${baseUrl}/api/webhooks/qstash/check-sage-completion`,
      body: { email, uniqueCode, source: 'meal-plan' },
      retries: 0,
    });

    console.log('[MEAL-PLAN] Triggered completion check');
  } catch (error) {
    console.error('[MEAL-PLAN] Failed to trigger completion check:', error);
  }
}

// This is the webhook handler that QStash will call for meal plan generation
async function handler(request: NextRequest) {
  let email: string = '';
  let uniqueCode: string = '';

  try {
    const body = await request.json();
    email = body.email;
    uniqueCode = body.uniqueCode;

    if (!email || !uniqueCode) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n[MEAL-PLAN] Starting meal plan generation for ${email} (code: ${uniqueCode})`);

    // Mark as processing
    await updateComponentStatus(email, 'processing');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';

    // Import the meal plan generation function directly
    const generateMealPlan = (await import('../../../generate-meal-plan/route')).GET;

    console.log('[MEAL-PLAN] Generating detailed meal plan...');
    const mockMealRequest = {
      url: `${baseUrl}/api/generate-meal-plan?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-meal-plan?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const mealPlanResponse = await generateMealPlan(mockMealRequest);

    if (mealPlanResponse.status === 200) {
      // Mark as completed
      await updateComponentStatus(email, 'completed');
      console.log(`[MEAL-PLAN] Successfully completed for ${email}`);

      // Trigger completion check
      await triggerCompletionCheck(email, uniqueCode);

      return NextResponse.json({
        success: true,
        message: 'Meal plan generated successfully',
      });
    } else {
      throw new Error('Failed to generate meal plan');
    }

  } catch (error) {
    console.error('[MEAL-PLAN] Generation failed:', error);

    // Mark as failed
    if (email) {
      await updateComponentStatus(email, 'failed');
      // Still trigger completion check so email can be sent with partial content
      if (uniqueCode) {
        await triggerCompletionCheck(email, uniqueCode);
      }
    }

    return NextResponse.json(
      {
        error: 'Meal plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
