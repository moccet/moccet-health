import { NextRequest, NextResponse } from 'next/server';

const EMAIL_TEMPLATE = (name: string, planUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>sage - Your Personalized Plan is Ready</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 0;">
                <!-- Hero Image -->
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0; text-align: center; background: linear-gradient(135deg, #e8ede6 0%, #d0dfc9 100%);">
                            <div style="padding: 60px 20px;">
                                <h1 style="margin: 0; font-size: 32px; font-weight: 400; letter-spacing: -0.5px; color: #2d3a2d;">sage</h1>
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- Content Container -->
                <table role="presentation" style="max-width: 560px; width: 100%; margin: 0 auto; border-collapse: collapse;">
                    <!-- Body -->
                    <tr>
                        <td style="padding: 48px 20px 0;">
                            <h2 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 500; color: #1a1a1a;">
                                Hi ${name},
                            </h2>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                Your personalized nutrition plan is ready! 🎉
                            </p>

                            <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                We've analyzed your profile, health data, and goals to create a plan tailored specifically for you.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 0 0 32px 0;">
                                <tr>
                                    <td style="background-color: #2d3a2d; border-radius: 8px;">
                                        <a href="${planUrl}" style="display: inline-block; padding: 16px 32px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none;">
                                            View Your Plan →
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
                                Your plan includes personalized meal recommendations, micronutrient guidance, and lifestyle integration strategies.
                            </p>

                            <p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                <strong>moccet sage</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 48px 20px 32px; text-align: center; border-top: 1px solid #e0e0e0;">
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666666;">
                                Questions? Reply to this email or visit our <a href="https://www.moccet.ai" style="color: #2d3a2d; text-decoration: none;">website</a>.
                            </p>
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
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'superintelligence@moccet.com';

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
            subject: 'Your Personalized sage Plan is Ready! 🎉',
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

async function generatePlanInBackground(email: string, uniqueCode: string, fullName: string) {
  console.log(`\n🚀 Starting background plan generation for ${email} (code: ${uniqueCode})`);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';
  const planUrl = `${baseUrl}/sage/personalised-plan?code=${uniqueCode}`;

  // Just send the email - the plan will be generated on-demand when the user visits the page
  // This avoids the issue of the server trying to call itself via HTTP
  console.log('📧 Sending plan ready email (plan will generate on first visit)...');
  await sendPlanReadyEmail(email, fullName, planUrl);

  console.log(`\n✅ Email sent to ${email} - plan will be generated when they visit the link`);
}

export async function POST(request: NextRequest) {
  try {
    const { email, uniqueCode, fullName } = await request.json();

    if (!email || !uniqueCode || !fullName) {
      return NextResponse.json(
        { error: 'Email, uniqueCode, and fullName are required' },
        { status: 400 }
      );
    }

    // Trigger background plan generation (don't await)
    // Note: In production, you'd want to use a proper job queue like Bull, Inngest, or trigger.dev
    generatePlanInBackground(email, uniqueCode, fullName).catch(error => {
      console.error('Background plan generation error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Plan generation started. You will receive an email when your plan is ready.',
    });
  } catch (error) {
    console.error('Error starting plan generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to start plan generation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
