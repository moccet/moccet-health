import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { devPlanStorage, devOnboardingStorage } from '@/lib/dev-storage';
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

const EMAIL_TEMPLATE = (name: string, planUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>sage - Your Personalized Nutrition Plan is Ready</title>
    <meta name="description" content="sage - Personalized nutrition plans based on your biology, lifestyle data, and health goals" />
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a;">

    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 0;">

                <!-- Hero Image - Full Width -->
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0; text-align: center; background-color: #f5f5f5;">
                            <img src="https://c.animaapp.com/EVbz3TeZ/img/susan-wilkinson-eo76daedyim-unsplash.jpg" alt="sage gradient" style="width: 100%; max-width: 100%; height: 240px; object-fit: cover; display: block;" />
                        </td>
                    </tr>
                </table>

                <!-- Content Container -->
                <table role="presentation" style="max-width: 560px; width: 100%; margin: 0 auto; border-collapse: collapse;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 48px 20px 40px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 400; letter-spacing: -0.3px; color: #000000;">sage</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 20px;">

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                Hi ${name}, your personalized nutrition plan is ready.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                We've analyzed your profile, biomarkers, and health goals to create a comprehensive nutrition plan tailored specifically for you. Your plan includes personalized meal recommendations, micronutrient guidance, and lifestyle protocols.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 0 0 32px 0;">
                                <tr>
                                    <td style="background-color: #000000; border-radius: 4px; text-align: center;">
                                        <a href="${planUrl}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none;">
                                            View Your Plan
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                <strong>moccet</strong>
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 48px 20px 32px; text-align: center;">
                            <p style="margin: 0; font-size: 13px; color: #666666;">
                                <a href="<%asm_group_unsubscribe_raw_url%>" style="color: #666666; text-decoration: none;">Unsubscribe</a>
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>`;

async function sendPlanReadyEmail(email: string, name: string, planUrl: string) {
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      console.error('[EMAIL] SendGrid API key not configured');
      return false;
    }

    sgMail.setApiKey(apiKey);

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'team@moccet.com',
        name: 'sage'
      },
      subject: 'Your Personalized Nutrition Plan is Ready',
      html: EMAIL_TEMPLATE(name, planUrl),
    };

    await sgMail.send(msg);
    console.log(`[EMAIL] ✅ Plan ready email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send email:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.error('[EMAIL] SendGrid error details:', (error as any).response?.body);
    }
    return false;
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
  } catch (err) {
    console.warn(`Failed to update job status to ${status}:`, err);
  }
}

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode, fullName } = body;

    if (!email || !uniqueCode || !fullName) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🚀 [QSTASH] Starting nutrition plan generation for ${email} (code: ${uniqueCode})`);

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

    // Step 0: Check if user uploaded a lab file BEFORE polling
    console.log('[0/4] Checking for health data analysis...');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let initialUserData: any = devOnboardingStorage.get(email);

    if (!initialUserData) {
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();
          const { data } = await supabase
            .from('sage_onboarding_data')
            .select('form_data, lab_file_analysis')
            .eq('email', email)
            .single();
          initialUserData = data;
        } catch {
          // Continue without initial data
        }
      }
    }

    const hasLabFile = initialUserData?.form_data?.hasLabFile;
    const hasExistingAnalysis = !!initialUserData?.lab_file_analysis;

    // Skip polling entirely if no lab file was uploaded AND no analysis exists
    if (!hasLabFile && !hasExistingAnalysis) {
      console.log('[INFO] No lab file uploaded, skipping blood analysis wait');
      console.log('[OK] Ready to generate plan with all available data');
    } else if (hasExistingAnalysis) {
      console.log('[OK] Blood analysis already available, proceeding immediately');
    } else {
      // EVENT-DRIVEN: This webhook is triggered by blood analysis completion if lab files were uploaded
      // No polling needed - if we get here with a lab file, blood analysis should be ready
      // (or the user wants to proceed without it)
      console.log('[INFO] Lab file was uploaded - checking if blood analysis is ready...');

      if (initialUserData?.lab_file_analysis) {
        console.log('[OK] Blood analysis already available - proceeding with data');
      } else {
        console.log('[INFO] Blood analysis not yet available - proceeding without it');
      }
    }

    // Fetch user's onboarding data from storage
    console.log('[1/4] Fetching user onboarding data...');

    let formData;
    let bloodAnalysisData;

    // Check dev storage first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(email) as any;
    if (devData) {
      formData = devData.form_data;
      bloodAnalysisData = devData.lab_file_analysis;
      console.log('[OK] Retrieved data from dev storage');
    } else {
      // Try Supabase
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
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
    // OPTIMIZED: Reduced timeout from 60s to 15s - context is nice to have but not critical
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
        }, 15000); // Reduced from 60s to 15s

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          ecosystemData = contextData.context;
          console.log('[OK] Ecosystem context aggregated');
        }
      } catch (error) {
        console.warn('[WARN] Ecosystem context timed out or failed, proceeding without it');
      }
    }

    // Generate comprehensive nutrition plan using the new multi-agent orchestrator
    console.log('[3/4] Generating nutrition plan with multi-agent orchestrator...');
    console.log('[INFO] Using GPT-4o + GPT-4o-mini agents (cost: ~$0.15-0.20)');

    const orchestratorInput: SageOrchestratorInput = {
      onboardingData: formData,
      bloodAnalysis: bloodAnalysisData,
      ecosystemData,
    };

    const orchestratorResult = await runSageOrchestrator(orchestratorInput);

    const sagePlan = orchestratorResult.plan;

    console.log('[OK] Nutrition plan generated successfully');
    console.log(`[INFO] Estimated cost: $${orchestratorResult.metadata.agentCosts.total.toFixed(4)}`);
    console.log(`[INFO] Validation: ${orchestratorResult.metadata.validationResult.isValid ? 'PASSED' : 'HAS ISSUES'}`);
    if (orchestratorResult.metadata.validationResult.warnings.length > 0) {
      console.warn(`[WARN] ${orchestratorResult.metadata.validationResult.warnings.length} validation warnings`);
    }

    // Store the generated plan
    console.log('[4/4] Storing comprehensive nutrition plan...');

    // Store in dev storage
    devPlanStorage.set(uniqueCode, {
      email,
      uniqueCode,
      fullName,
      status: 'completed',
      generatedAt: new Date().toISOString(),
      plan: sagePlan
    });

    // Store in Supabase if available
    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
      try {
        const supabase = await createClient();
        await supabase
          .from('sage_onboarding_data')
          .update({
            sage_plan: sagePlan,
            plan_generation_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('email', email);
        console.log('[OK] Plan stored in Supabase');
      } catch (error) {
        console.error('Error storing in Supabase:', error);
      }
    }

    console.log('[OK] Nutrition plan stored successfully');

    // Update status to completed
    await updateJobStatus(email, 'completed');

    // NOTE: Email sending disabled - plans should be reviewed before sending
    // To send email manually, use the /api/send-sage-email endpoint
    console.log(`\n✅ [QSTASH] Nutrition plan generated for ${email} (email disabled - manual review required)`);

    return NextResponse.json({
      success: true,
      message: 'Nutrition plan generation completed successfully (email disabled)',
      metadata: {
        estimatedCost: orchestratorResult.metadata.agentCosts.total,
        validationPassed: orchestratorResult.metadata.validationResult.isValid,
      }
    });

  } catch (error) {
    console.error('❌ [QSTASH] Nutrition plan generation failed:', error);

    // Try to update status to failed
    try {
      const body = await request.json();
      await updateJobStatus(body.email, 'failed', error instanceof Error ? error.message : 'Unknown error');
    } catch {
      // Ignore if we can't update status
    }

    return NextResponse.json(
      {
        error: 'Nutrition plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the handler with conditional QStash signature verification
// In dev mode or when X-Dev-Mode header is present, skip verification
export async function POST(request: NextRequest) {
  const isDevMode = process.env.NODE_ENV === 'development' || request.headers.get('X-Dev-Mode') === 'true';

  if (isDevMode) {
    console.log('🚀 [DEV] Skipping QStash signature verification - running in dev mode');
    return handler(request);
  }

  // In production, verify QStash signature
  const verifiedHandler = verifySignatureAppRouter(handler);
  return verifiedHandler(request);
}
