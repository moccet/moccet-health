import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

async function updateJobStatus(email: string, status: 'processing' | 'completed' | 'failed', error?: string) {
  try {
    const supabase = await createClient();
    await supabase
      .from('sage_onboarding_data')
      .update({
        plan_generation_status: status,
        plan_generation_error: error || null,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);
  } catch (error) {
    console.error('Failed to update job status:', error);
  }
}

// This is the webhook handler that QStash will call
async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode, fullName } = body;

    if (!email || !uniqueCode || !fullName) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🚀 [QSTASH] Starting plan generation for ${email} (code: ${uniqueCode})`);

    // Check if plan is already being generated or completed (idempotency check)
    try {
      const supabase = await createClient();
      const { data: existingData } = await supabase
        .from('sage_onboarding_data')
        .select('plan_generation_status, sage_plan')
        .eq('email', email)
        .single();

      if (existingData) {
        // If plan is already processing, skip to avoid duplicate generation
        if (existingData.plan_generation_status === 'processing') {
          console.log('⚠️ [QSTASH] Plan is already being generated. Skipping duplicate job.');
          return NextResponse.json({
            message: 'Plan generation already in progress',
            skipped: true
          }, { status: 200 });
        }

        // If plan is already completed and exists, skip
        if (existingData.plan_generation_status === 'completed' && existingData.sage_plan) {
          console.log('⚠️ [QSTASH] Plan already exists. Skipping duplicate job.');
          return NextResponse.json({
            message: 'Plan already generated',
            skipped: true
          }, { status: 200 });
        }
      }
    } catch (error) {
      console.warn('Failed to check existing plan status:', error);
      // Continue anyway - better to potentially duplicate than to fail
    }

    // Update status to processing
    await updateJobStatus(email, 'processing');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';
    const planUrl = `${baseUrl}/sage/personalised-plan?code=${uniqueCode}`;

    // Step 0: Wait for blood analysis to complete (if uploaded)
    console.log('[0/5] Checking for health data analysis...');

    let bloodAnalysisComplete = false;
    let pollCount = 0;
    const maxPolls = 20; // 20 polls * 30 seconds = 10 minutes max wait

    while (!bloodAnalysisComplete && pollCount < maxPolls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hasBloodAnalysis = false;

      // Check dev storage first using EMAIL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const devData = devOnboardingStorage.get(email) as any;
      if (devData?.blood_analysis) {
        hasBloodAnalysis = true;
        console.log('[OK] Blood analysis found in dev storage');
      } else {
        // Check Supabase
        const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
          try {
            const supabase = await createClient();
            const { data } = await supabase
              .from('sage_onboarding_data')
              .select('lab_file_analysis')
              .eq('email', email)
              .single();

            if (data?.lab_file_analysis) {
              hasBloodAnalysis = true;
              console.log('[OK] Blood analysis found in Supabase');
            }
          } catch (error) {
            // No blood analysis yet or no Supabase
          }
        }
      }

      // Check if user even uploaded a lab file
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userData = devData || (async () => {
        const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
          try {
            const supabase = await createClient();
            const { data } = await supabase
              .from('sage_onboarding_data')
              .select('*')
              .eq('email', email)
              .single();
            return data;
          } catch {
            return null;
          }
        }
        return null;
      })();

      const hasLabFile = userData?.form_data?.hasLabFile || devData?.form_data?.hasLabFile;

      if (!hasLabFile) {
        console.log('[INFO] No lab file uploaded, skipping blood analysis wait');
        bloodAnalysisComplete = true;
        break;
      }

      if (hasBloodAnalysis) {
        bloodAnalysisComplete = true;
        break;
      }

      pollCount++;
      if (pollCount < maxPolls) {
        console.log(`[INFO] Blood analysis not ready yet, waiting 30 seconds... (attempt ${pollCount}/${maxPolls})`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    if (!bloodAnalysisComplete && pollCount >= maxPolls) {
      console.log('[WARN] Blood analysis did not complete within 10 minutes, proceeding without it');
    } else {
      console.log('[OK] Ready to generate plan with all available data');
    }

    // Import the generation functions directly
    const generateSagePlan = (await import('../../../generate-sage-plan/route')).GET;

    console.log('[1/3] Generating main sage plan (with blood analysis data)...');

    // Create mock request objects for API calls
    const mockRequest = {
      url: `${baseUrl}/api/generate-sage-plan?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-sage-plan?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const sagePlanResponse = await generateSagePlan(mockRequest);
    if (sagePlanResponse.status !== 200) {
      throw new Error('Failed to generate sage plan');
    }
    console.log('[OK] Main sage plan generated');

    console.log('[2/3] Queueing additional plan generation jobs...');

    // Queue all additional generation jobs to run in parallel
    const qstashToken = process.env.QSTASH_TOKEN;
    const supabase = await createClient();

    // Initialize component statuses to 'pending' before queueing jobs
    await supabase
      .from('sage_onboarding_data')
      .update({
        meal_plan_status: 'pending',
        micronutrients_status: 'pending',
        lifestyle_status: 'pending',
        completion_check_count: 0,
        email_sent_at: null
      })
      .eq('email', email);

    if (qstashToken) {
      try {
        const { Client } = await import('@upstash/qstash');
        const client = new Client({ token: qstashToken });

        // Queue meal plan generation
        const mealPlanWebhookUrl = `${baseUrl}/api/webhooks/qstash/generate-meal-plan`;
        const mealPlanResult = await client.publishJSON({
          url: mealPlanWebhookUrl,
          body: { email, uniqueCode },
          retries: 2,
        });
        console.log(`[OK] Meal plan generation job queued (messageId: ${mealPlanResult.messageId})`);

        // Queue micronutrients generation
        const microWebhookUrl = `${baseUrl}/api/webhooks/qstash/generate-micronutrients`;
        const microResult = await client.publishJSON({
          url: microWebhookUrl,
          body: { email, uniqueCode },
          retries: 2,
        });
        console.log(`[OK] Micronutrients generation job queued (messageId: ${microResult.messageId})`);

        // Queue lifestyle generation
        const lifestyleWebhookUrl = `${baseUrl}/api/webhooks/qstash/generate-lifestyle`;
        const lifestyleResult = await client.publishJSON({
          url: lifestyleWebhookUrl,
          body: { email, uniqueCode },
          retries: 2,
        });
        console.log(`[OK] Lifestyle generation job queued (messageId: ${lifestyleResult.messageId})`);

        // Queue completion checker with 3-minute delay
        // This will check if all components are done and send the email
        const completionCheckUrl = `${baseUrl}/api/webhooks/qstash/check-sage-completion`;
        const completionResult = await client.publishJSON({
          url: completionCheckUrl,
          body: { email, uniqueCode, fullName },
          delay: 180, // 3 minutes delay to allow components to complete
          retries: 0, // No retries - components will trigger their own checks
        });
        console.log(`[OK] Completion checker queued with 3-min delay (messageId: ${completionResult.messageId})`);

      } catch (error) {
        console.error('[WARN] Failed to queue background jobs:', error);
        // Continue anyway - main plan is generated
      }
    } else {
      console.log('[WARN] QSTASH_TOKEN not configured, skipping background jobs');
    }

    // Return immediately - completion checker will send email when all components are ready
    console.log(`[OK] Main plan generated, component jobs queued. Completion checker will send email.`);

    return NextResponse.json({
      success: true,
      message: 'Main plan generated, component generation in progress',
    });

  } catch (error) {
    console.error('❌ [QSTASH] Plan generation failed:', error);

    // Try to update status to failed
    try {
      const body = await request.json();
      await updateJobStatus(body.email, 'failed', error instanceof Error ? error.message : 'Unknown error');
    } catch {
      // Ignore if we can't update status
    }

    return NextResponse.json(
      {
        error: 'Plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
