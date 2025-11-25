import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import OpenAI from 'openai';
import { devPlanStorage, devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
  }
  return new OpenAI({
    apiKey,
  });
}

const EMAIL_TEMPLATE = (name: string, planUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>forge - Your Personalized Fitness Plan is Ready</title>
    <meta name="description" content="forge - Personalized fitness plans based on your biology, training data, and performance metrics" />
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a;">

    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 0;">

                <!-- Hero Image - Full Width -->
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0; text-align: center; background-color: #f5f5f5;">
                            <img src="https://c.animaapp.com/EVbz3TeZ/img/susan-wilkinson-eo76daedyim-unsplash.jpg" alt="forge gradient" style="width: 100%; max-width: 100%; height: 240px; object-fit: cover; display: block;" />
                        </td>
                    </tr>
                </table>

                <!-- Content Container -->
                <table role="presentation" style="max-width: 560px; width: 100%; margin: 0 auto; border-collapse: collapse;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 48px 20px 40px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 400; letter-spacing: -0.3px; color: #000000;">forge</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 20px;">

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                Hi ${name}, your personalized fitness plan is ready.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                We've analyzed your profile, training history, and goals to create a comprehensive plan tailored specifically for you. Your plan includes personalized workout programming, recovery strategies, and performance optimization guidance.
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
        email: process.env.SENDGRID_FROM_EMAIL || 'superintelligence@moccet.com',
        name: 'forge'
      },
      subject: 'Your Personalized Fitness Plan is Ready',
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
      .from('forge_onboarding_data')
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

    console.log(`\n🚀 [QSTASH] Starting fitness plan generation for ${email} (code: ${uniqueCode})`);

    // Check if plan is already being generated or completed (idempotency check)
    try {
      const supabase = await createClient();
      const { data: existingData } = await supabase
        .from('forge_onboarding_data')
        .select('plan_generation_status, forge_plan')
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
        if (existingData.plan_generation_status === 'completed' && existingData.forge_plan) {
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
    const planUrl = `${baseUrl}/forge/personalised-plan?code=${uniqueCode}`;

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
              .from('forge_onboarding_data')
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
              .from('forge_onboarding_data')
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

    // Fetch user's onboarding data from storage
    console.log('[1/3] Fetching user onboarding data...');

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
            .from('forge_onboarding_data')
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

    // Generate comprehensive fitness plan
    console.log('[2/5] Generating comprehensive fitness plan with AI...');

    const planResponse = await fetch(`${baseUrl}/api/generate-forge-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData,
        bloodAnalysis: bloodAnalysisData
      })
    });

    if (!planResponse.ok) {
      throw new Error('Failed to generate fitness plan');
    }

    const planResult = await planResponse.json();

    if (!planResult.success || !planResult.plan) {
      throw new Error('Invalid plan generation response');
    }

    console.log('[OK] Comprehensive fitness plan generated');

    // Generate personalized supplement recommendations
    console.log('[3/5] Generating personalized supplement recommendations...');

    const supplementsResponse = await fetch(`${baseUrl}/api/forge-generate-supplements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData,
        bloodAnalysis: bloodAnalysisData
      })
    });

    let supplementRecommendations = null;
    if (supplementsResponse.ok) {
      const supplementResult = await supplementsResponse.json();
      if (supplementResult.success) {
        supplementRecommendations = supplementResult.supplementRecommendations;
        console.log('[OK] Supplement recommendations generated');
      }
    } else {
      console.warn('[WARN] Failed to generate supplement recommendations, will use default');
    }

    // Generate personalized recovery protocol
    console.log('[4/5] Generating personalized recovery protocol...');

    // Check if user has calendar connected (we'll need to fetch this from integrations)
    const calendarData = formData.integrations?.includes('apple-calendar') ||
                        formData.integrations?.includes('google-calendar') ?
                        { connected: true } : null;

    const recoveryResponse = await fetch(`${baseUrl}/api/forge-generate-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formData,
        bloodAnalysis: bloodAnalysisData,
        calendarData
      })
    });

    let recoveryProtocol = null;
    if (recoveryResponse.ok) {
      const recoveryResult = await recoveryResponse.json();
      if (recoveryResult.success) {
        recoveryProtocol = recoveryResult.recoveryProtocol;
        console.log('[OK] Recovery protocol generated');
      }
    } else {
      console.warn('[WARN] Failed to generate recovery protocol, will use default');
    }

    // Merge the new personalized sections into the plan
    const enhancedPlan = {
      ...planResult.plan,
      ...(supplementRecommendations && { supplementRecommendations }),
      ...(recoveryProtocol && { recoveryProtocol })
    };

    console.log('[OK] Enhanced plan with personalized supplements and recovery');

    // Store the generated plan
    console.log('[5/5] Storing fitness plan...');

    // Store in dev storage
    devPlanStorage.set(uniqueCode, {
      email,
      uniqueCode,
      fullName,
      status: 'completed',
      generatedAt: new Date().toISOString(),
      plan: enhancedPlan
    });

    // Store in Supabase if available
    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
      try {
        const supabase = await createClient();
        await supabase
          .from('forge_onboarding_data')
          .update({
            forge_plan: enhancedPlan,
            plan_generation_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('email', email);
        console.log('[OK] Plan stored in Supabase');
      } catch (error) {
        console.error('Error storing in Supabase:', error);
      }
    }

    console.log('[OK] Fitness plan stored successfully');

    // Send email notification
    console.log('[4/4] Sending plan ready email...');
    console.log(`Email details: to=${email}, name=${fullName}, planUrl=${planUrl}`);
    const emailSent = await sendPlanReadyEmail(email, fullName, planUrl);

    // Update status to completed
    await updateJobStatus(email, 'completed');

    if (emailSent) {
      console.log(`\n✅ [QSTASH] Complete fitness plan generation finished and email sent to ${email}`);
    } else {
      console.error(`\n⚠️ [QSTASH] Plan generated but EMAIL FAILED for ${email}`);
      console.error('Check: 1) SENDGRID_API_KEY is set, 2) SENDGRID_FROM_EMAIL is verified in SendGrid dashboard');
    }

    return NextResponse.json({
      success: true,
      message: 'Fitness plan generation completed successfully',
    });

  } catch (error) {
    console.error('❌ [QSTASH] Fitness plan generation failed:', error);

    // Try to update status to failed
    try {
      const body = await request.json();
      await updateJobStatus(body.email, 'failed', error instanceof Error ? error.message : 'Unknown error');
    } catch {
      // Ignore if we can't update status
    }

    return NextResponse.json(
      {
        error: 'Fitness plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
