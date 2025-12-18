import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { devOnboardingStorage, devPlanStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';
import { runSageOrchestrator, SageOrchestratorInput } from '@/lib/sage-orchestrator';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

// Helper for fetch with timeout (for context aggregation)
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 60000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

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

    // Step 0: Check if blood analysis is available (no polling needed)
    // EVENT-DRIVEN: This webhook is now triggered by blood analysis completion if lab files were uploaded
    // Or immediately if no lab files were uploaded - so no waiting needed!
    console.log('[0/3] Checking for blood analysis data...');

    // Quick check if blood data exists (no waiting)
    let hasBloodAnalysis = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(email) as any;

    if (devData?.blood_analysis) {
      hasBloodAnalysis = true;
      console.log('[OK] Blood analysis found in dev storage');
    } else {
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
            console.log('[OK] Blood analysis found in database');
          }
        } catch {
          // No blood analysis available
        }
      }
    }

    if (hasBloodAnalysis) {
      console.log('[OK] Proceeding with blood analysis data');
    } else {
      console.log('[INFO] No blood analysis data - generating plan without it');
    }

    // Fetch user's onboarding data from storage
    console.log('[1/4] Fetching user onboarding data...');

    let formData;
    let bloodAnalysisData;

    // Check dev storage first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userData = devOnboardingStorage.get(email) as any;
    if (userData) {
      formData = userData.form_data;
      bloodAnalysisData = userData.lab_file_analysis;
      console.log('[OK] Retrieved data from dev storage');
    } else {
      // Try Supabase
      const hasSupabaseConfig = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabaseConfig && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();
          const { data } = await supabase
            .from('sage_onboarding_data')
            .select('*')
            .eq('email', email)
            .single();

          if (data) {
            formData = data.form_data;
            bloodAnalysisData = data.lab_file_analysis;
            console.log('[OK] Retrieved data from Supabase');
          }
        } catch (error) {
          console.error('Error fetching from Supabase:', error);
          throw new Error('Could not fetch user data');
        }
      }
    }

    if (!formData) {
      throw new Error('No user data found');
    }

    // Aggregate ecosystem context for the orchestrator
    console.log('[2/4] Aggregating ecosystem context...');
    let ecosystemData: Record<string, unknown> | undefined;

    if (formData.email) {
      try {
        const contextResponse = await fetchWithTimeout(`${baseUrl}/api/aggregate-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            contextType: 'sage',
            forceRefresh: false,
          }),
        }, 15000); // 15s timeout - context is nice to have but not critical

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          ecosystemData = contextData.context;
          console.log('[OK] Ecosystem context aggregated');
        }
      } catch (error) {
        console.warn('[WARN] Ecosystem context timed out or failed, proceeding without it');
      }
    }

    // Generate comprehensive nutrition plan using multi-agent orchestrator
    console.log('[3/4] Generating nutrition plan with multi-agent orchestrator...');
    console.log('[INFO] Using GPT-4o + GPT-4o-mini agents (cost: ~$0.15-0.20)');

    const orchestratorInput: SageOrchestratorInput = {
      onboardingData: formData,
      bloodAnalysis: bloodAnalysisData,
      ecosystemData,
    };

    const orchestratorResult = await runSageOrchestrator(orchestratorInput);
    const sagePlan = orchestratorResult.plan;

    console.log('[OK] Main sage plan generated');
    console.log(`[INFO] Estimated cost: $${orchestratorResult.metadata.agentCosts.total.toFixed(4)}`);
    console.log(`[INFO] Validation: ${orchestratorResult.metadata.validationResult.isValid ? 'PASSED' : 'HAS ISSUES'}`);

    // Store the generated plan
    console.log('[4/4] Storing plan and queueing additional jobs...');

    // Store in dev storage
    devPlanStorage.set(uniqueCode, sagePlan);

    // Store in Supabase
    const hasSupabaseForStore = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (hasSupabaseForStore && process.env.FORCE_DEV_MODE !== 'true') {
      try {
        const supabase = await createClient();
        await supabase
          .from('sage_onboarding_data')
          .update({
            sage_plan: sagePlan,
            updated_at: new Date().toISOString()
          })
          .eq('email', email);
        console.log('[OK] Plan stored in Supabase');
      } catch (error) {
        console.error('Error storing in Supabase:', error);
      }
    }

    console.log('[OK] Queueing additional plan generation jobs...');

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
