import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

// This is the webhook handler that QStash will call for meal plan generation
async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode } = body;

    if (!email || !uniqueCode) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🍽️ [QSTASH] Starting meal plan generation for ${email} (code: ${uniqueCode})`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';

    // Import the meal plan generation function directly
    const generateMealPlan = (await import('../../../generate-meal-plan/route')).GET;

    console.log('[1/1] Generating detailed meal plan...');
    const mockMealRequest = {
      url: `${baseUrl}/api/generate-meal-plan?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-meal-plan?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const mealPlanResponse = await generateMealPlan(mockMealRequest);

    if (mealPlanResponse.status === 200) {
      console.log(`\n✅ [QSTASH] Meal plan generated successfully for ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Meal plan generated successfully',
      });
    } else {
      throw new Error('Failed to generate meal plan');
    }

  } catch (error) {
    console.error('❌ [QSTASH] Meal plan generation failed:', error);

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
