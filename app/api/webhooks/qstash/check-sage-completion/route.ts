import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { Client } from '@upstash/qstash';
import { createClient } from '@/lib/supabase/server';

// Quick check endpoint - should complete in under 30 seconds
export const maxDuration = 30;

const EMAIL_TEMPLATE = (name: string, planUrl: string, isPartial: boolean) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>sage - Your Personalized Plan is ${isPartial ? 'Partially ' : ''}Ready</title>
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
                                Hi ${name}, your personalized nutrition plan is ${isPartial ? 'partially ' : ''}ready.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                ${isPartial
                                  ? "We've generated the core parts of your plan. Some additional components are still being prepared and will be available soon when you refresh your plan page."
                                  : "We've analyzed your profile, health data, and goals to create a comprehensive plan tailored specifically for you. Your plan includes personalized meal recommendations, micronutrient guidance, and lifestyle integration strategies."
                                }
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

async function sendPlanReadyEmail(email: string, name: string, planUrl: string, isPartial: boolean) {
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'team@moccet.com';

  if (!sendGridApiKey) {
    console.error('[CHECK-COMPLETION] SENDGRID_API_KEY is not configured');
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
            subject: `Your Personalized sage Plan is ${isPartial ? 'Partially ' : ''}Ready`,
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
            value: EMAIL_TEMPLATE(name, planUrl, isPartial),
          },
        ],
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('[CHECK-COMPLETION] SendGrid error:', errorText);
      return false;
    }

    console.log(`[CHECK-COMPLETION] Email sent to ${email} (partial: ${isPartial})`);
    return true;
  } catch (error) {
    console.error('[CHECK-COMPLETION] Email send failed:', error);
    return false;
  }
}

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode, fullName, source } = body;

    if (!email || !uniqueCode) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n[CHECK-COMPLETION] Checking completion for ${email} (triggered by: ${source || 'scheduled'})`);

    const supabase = await createClient();

    // Fetch current state
    const { data, error } = await supabase
      .from('sage_onboarding_data')
      .select('meal_plan_status, micronutrients_status, lifestyle_status, sage_plan, email_sent_at, completion_check_count, form_data')
      .eq('email', email)
      .single();

    if (error || !data) {
      console.error('[CHECK-COMPLETION] Failed to fetch status:', error);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If email already sent, skip
    if (data.email_sent_at) {
      console.log('[CHECK-COMPLETION] Email already sent, skipping');
      return NextResponse.json({ success: true, skipped: true, reason: 'Email already sent' });
    }

    // Increment check count
    const checkCount = (data.completion_check_count || 0) + 1;
    await supabase
      .from('sage_onboarding_data')
      .update({ completion_check_count: checkCount })
      .eq('email', email);

    // Check completion status - a component is "done" if completed or failed
    const mealPlanDone = data.meal_plan_status === 'completed' || data.meal_plan_status === 'failed';
    const micronutrientsDone = data.micronutrients_status === 'completed' || data.micronutrients_status === 'failed';
    const lifestyleDone = data.lifestyle_status === 'completed' || data.lifestyle_status === 'failed';
    const hasSagePlan = !!data.sage_plan;

    const allComplete = mealPlanDone && micronutrientsDone && lifestyleDone;

    console.log(`[CHECK-COMPLETION] Status: meal=${data.meal_plan_status}, micro=${data.micronutrients_status}, lifestyle=${data.lifestyle_status}`);
    console.log(`[CHECK-COMPLETION] Check count: ${checkCount}, All complete: ${allComplete}, Has sage plan: ${hasSagePlan}`);

    // Decision logic: mark complete if all done OR after max checks (20 = ~10 minutes)
    const MAX_CHECKS = 20;
    const shouldComplete = allComplete || (checkCount >= MAX_CHECKS && hasSagePlan);

    if (shouldComplete) {
      // Determine if partial (any component failed OR not all done)
      const isPartial = !allComplete ||
        data.meal_plan_status === 'failed' ||
        data.micronutrients_status === 'failed' ||
        data.lifestyle_status === 'failed';

      // Update database - mark as completed but DON'T send email
      const finalStatus = allComplete ? 'completed' : 'partial';
      await supabase
        .from('sage_onboarding_data')
        .update({
          plan_generation_status: finalStatus
          // NOTE: email_sent_at not set - email disabled for manual review
        })
        .eq('email', email);

      // NOTE: Email sending disabled - plans should be reviewed before sending
      // To send email manually, use the /api/send-sage-email endpoint
      console.log(`[CHECK-COMPLETION] Final status: ${finalStatus} (email disabled - manual review required)`);

      return NextResponse.json({
        success: true,
        status: finalStatus,
        emailSent: false,
        isPartial,
        message: 'Email disabled - manual review required'
      });
    }

    // Not ready yet - reschedule check if we haven't exceeded max checks
    if (checkCount < MAX_CHECKS) {
      const qstashToken = process.env.QSTASH_TOKEN;
      if (qstashToken) {
        const client = new Client({ token: qstashToken });
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.moccet.ai';

        await client.publishJSON({
          url: `${baseUrl}/api/webhooks/qstash/check-sage-completion`,
          body: { email, uniqueCode, fullName, source: 'retry' },
          delay: 30, // 30 seconds
          retries: 0,
        });

        console.log(`[CHECK-COMPLETION] Rescheduled check in 30s (count: ${checkCount}/${MAX_CHECKS})`);
      }
    } else {
      console.log(`[CHECK-COMPLETION] Max checks reached (${checkCount}), no sage_plan available - giving up`);
    }

    return NextResponse.json({
      success: true,
      status: 'pending',
      checkCount,
      allComplete
    });

  } catch (error) {
    console.error('[CHECK-COMPLETION] Error:', error);
    return NextResponse.json({
      error: 'Check completion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Export with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
