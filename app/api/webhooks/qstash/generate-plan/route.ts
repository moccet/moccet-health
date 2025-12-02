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
    <title>sage - Your Personalized Plan is Ready</title>
    <meta name="description" content="sage - Personalized nutrition plans based on your biology, metabolic data, and microbiome" />
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a;">

    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 0;">

                <!-- Hero Image - Full Width -->
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0; text-align: center; background-color: #f5f5f5;">
                            <img src="https://c.animaapp.com/ArhZSyxG/img/frank-sepulveda-st9ymbaqqg4-unsplash.jpg" alt="sage gradient" style="width: 100%; max-width: 100%; height: 240px; object-fit: cover; display: block;" />
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
                                We've analyzed your profile, health data, and goals to create a comprehensive plan tailored specifically for you. Your plan includes personalized meal recommendations, micronutrient guidance, and lifestyle integration strategies.
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
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'team@moccet.com';

  if (!sendGridApiKey) {
    console.error('SENDGRID_API_KEY is not configured');
    return false;
  }

  try {
    const sendGridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email }],
            subject: 'Your Personalized sage Plan is Ready',
          },
        ],
        from: {
          email: fromEmail,
          name: 'sage',
        },
        reply_to: {
          email: fromEmail,
        },
        content: [
          {
            type: 'text/html',
            value: EMAIL_TEMPLATE(name, planUrl),
          },
        ],
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('Failed to send email via SendGrid:', errorText);
      return false;
    }

    console.log(`✅ Plan ready email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending plan ready email:', error);
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
      } catch (error) {
        console.error('[WARN] Failed to queue background jobs:', error);
        // Continue anyway - jobs are not critical for initial email
      }
    } else {
      console.log('[WARN] QSTASH_TOKEN not configured, skipping background jobs');
    }

    // Wait for background jobs to complete before sending email
    console.log('[3/3] Waiting for all components to complete...');
    const supabase = await createClient();
    const maxWaitTime = 15 * 60 * 1000; // 15 minutes
    const pollInterval = 15000; // 15 seconds
    const startTime = Date.now();
    let allComplete = false;

    while (Date.now() - startTime < maxWaitTime) {
      const { data: checkData, error: checkError } = await supabase
        .from('sage_onboarding_data')
        .select('micronutrients, meal_plan, lifestyle_integration')
        .eq('email', email)
        .single();

      if (!checkError && checkData) {
        const hasMicronutrients = !!checkData.micronutrients;
        const hasMealPlan = !!checkData.meal_plan;
        const hasLifestyle = !!checkData.lifestyle_integration;

        console.log(`[POLL] Micronutrients: ${hasMicronutrients ? '✓' : '✗'}, Meal Plan: ${hasMealPlan ? '✓' : '✗'}, Lifestyle: ${hasLifestyle ? '✓' : '✗'}`);

        if (hasMicronutrients && hasMealPlan && hasLifestyle) {
          allComplete = true;
          console.log('[OK] All components complete!');
          break;
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    if (!allComplete) {
      console.warn('[WARN] Timeout waiting for components, sending email anyway');
    }

    // Send email notification
    console.log('[4/4] Sending plan ready email...');
    console.log(`Email details: to=${email}, name=${fullName}, planUrl=${planUrl}`);
    const emailSent = await sendPlanReadyEmail(email, fullName, planUrl);

    // Update status to completed
    await updateJobStatus(email, 'completed');

    if (emailSent) {
      console.log(`\n✅ [QSTASH] Complete plan generation finished and email sent to ${email}`);
    } else {
      console.error(`\n⚠️ [QSTASH] Plan generated but EMAIL FAILED for ${email}`);
      console.error('Check: 1) SENDGRID_API_KEY is set, 2) SENDGRID_FROM_EMAIL is verified in SendGrid dashboard');
    }

    return NextResponse.json({
      success: true,
      message: 'Plan generation completed successfully',
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
