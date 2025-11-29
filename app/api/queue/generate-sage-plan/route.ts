import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devPlanStorage, devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';

// Queue consumer can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
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

// This is the queue consumer function that processes plan generation jobs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode, fullName } = body;

    if (!email || !uniqueCode || !fullName) {
      console.error('Invalid queue message - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🚀 [QUEUE] Starting plan generation for ${email} (code: ${uniqueCode})`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';
    const planUrl = `${baseUrl}/sage/personalised-plan?code=${uniqueCode}`;

    // Step 0: Wait for blood analysis to complete (if uploaded)
    console.log('[0/5] Checking for health data analysis...');

    let bloodAnalysisComplete = false;
    let pollCount = 0;
    const maxPolls = 20; // 20 polls * 30 seconds = 10 minutes max wait (we have 15 min total)

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
    const generateSagePlan = (await import('../../generate-sage-plan/route')).GET;
    const generateMealPlan = (await import('../../generate-meal-plan/route')).GET;
    const generateMicronutrients = (await import('../../generate-micronutrients/route')).GET;
    const generateLifestyle = (await import('../../generate-lifestyle-integration/route')).GET;

    console.log('[1/5] Generating main sage plan (with blood analysis data)...');

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

    console.log('[2/5] Generating detailed meal plan...');
    const mockMealRequest = {
      url: `${baseUrl}/api/generate-meal-plan?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-meal-plan?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const mealPlanResponse = await generateMealPlan(mockMealRequest);
    if (mealPlanResponse.status === 200) {
      console.log('[OK] Meal plan generated');
    } else {
      console.log('[WARN] Meal plan generation failed, continuing...');
    }

    console.log('[3/5] Generating micronutrient recommendations...');
    const mockMicroRequest = {
      url: `${baseUrl}/api/generate-micronutrients?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-micronutrients?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const microResponse = await generateMicronutrients(mockMicroRequest);
    if (microResponse.status === 200) {
      console.log('[OK] Micronutrients generated');
    } else {
      console.log('[WARN] Micronutrients generation failed, continuing...');
    }

    console.log('[4/5] Generating lifestyle integration...');
    const mockLifestyleRequest = {
      url: `${baseUrl}/api/generate-lifestyle-integration?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-lifestyle-integration?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const lifestyleResponse = await generateLifestyle(mockLifestyleRequest);
    if (lifestyleResponse.status === 200) {
      console.log('[OK] Lifestyle integration generated');
    } else {
      console.log('[WARN] Lifestyle integration failed, continuing...');
    }

    // Send email notification
    console.log('[5/5] Sending plan ready email...');
    const emailSent = await sendPlanReadyEmail(email, fullName, planUrl);

    if (emailSent) {
      console.log(`\n✅ [QUEUE] Complete plan generation finished and email sent to ${email}`);
    } else {
      console.log(`\n⚠️ [QUEUE] Plan generated but email failed for ${email}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Plan generation completed successfully',
    });

  } catch (error) {
    console.error('❌ [QUEUE] Plan generation failed:', error);
    return NextResponse.json(
      {
        error: 'Plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
