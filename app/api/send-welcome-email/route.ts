import { NextRequest, NextResponse } from 'next/server';

const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta charset="utf-8" />
    <meta
      name="description"
      content="moccet - Your personal health AI connecting your biology to optimize your health and performance."
    />
    <title>Welcome to moccet - Personal Health AI</title>
    <style>
      * {
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: "Inter", Helvetica, Arial, sans-serif;
      }
      a {
        text-decoration: none;
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #ffffff;">
    <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
      <tr>
        <td style="padding: 0;">
          <!-- Hero Image -->
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 0; height: 553px; background-image: url('https://c.animaapp.com/uupO8NOC/img/3d-render-7snii6tu-68-unsplash.jpg'); background-size: cover; background-position: 50% 50%; background-repeat: no-repeat;">
                <!--[if mso]>
                <v:image xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="border: 0; display: inline-block; width: 600px; height: 553px;" src="https://c.animaapp.com/uupO8NOC/img/3d-render-7snii6tu-68-unsplash.jpg" />
                <![endif]-->
              </td>
            </tr>
          </table>

          <!-- Content Section -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f7f7f7;">
            <tr>
              <td style="padding: 100px 20px 50px; text-align: center;">
                <table role="presentation" style="max-width: 678px; width: 100%; margin: 0 auto; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 0;">

                      <!-- Title -->
                      <h1 style="margin: 0 0 80px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 900; color: #000000; font-size: 48px; letter-spacing: -0.96px; line-height: normal; text-align: center;">moccet</h1>

                      <!-- Body Content -->
                      <div style="max-width: 627px; margin: 0 auto; text-align: left;">
                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          Thank you for joining the waitlist.
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          moccet is your personal health AI. It connects everything about your biology—blood work, wearables, calendar, email, location, medical records—and tells you exactly what to do to feel better, perform better, and live better every single day.
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          No more guessing if something is working. No more generic advice that doesn't fit your body. You'll see in real-time how your sleep affects your recovery, how stress changes what you should eat, how your training should adapt to your current state. The system learns your biology and adjusts your protocols as you change.
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          This is what AI was meant to do: give you the tools to understand and optimize the most complex system you'll ever operate—yourself.
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          While you're on the waitlist, you can try the tools we've already released:
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          <a href="https://moccet.ai/forge" target="_blank" rel="noopener noreferrer" style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; text-decoration: underline;">forge ↗</a>
                          <span style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px;"> — Training programs from your biomarkers</span>
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          <a href="https://moccet.ai/sage" target="_blank" rel="noopener noreferrer" style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; text-decoration: underline;">sage ↗</a>
                          <span style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px;"> — Nutrition plans from your metabolic state</span>
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          We'll send you updates as we get closer to launch, and you'll get pre-release access before anyone else.
                        </p>

                        <p style="margin: 0 0 24px 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          If moccet helps you, share it with people you care about. This is the future of health, and it should belong to everyone.
                        </p>

                        <p style="margin: 48px 0 0 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-weight: 300; color: #000000; font-size: 20px; letter-spacing: 0; line-height: 1.5;">
                          Omar Elalfy MD &amp; Sofian Youssef MD
                        </p>
                      </div>

                      <!-- Logo -->
                      <div style="margin-top: 60px; text-align: center;">
                        <div style="position: relative; display: inline-block; width: 97.31px; height: 84.44px; transform: rotate(180deg);">
                          <div style="position: absolute; top: 0; left: 7px; width: 84px; height: 84px; border-radius: 42.22px; border: 0.4px solid #000000;"></div>
                          <div style="position: absolute; top: 2px; left: 9px; width: 80px; height: 80px; border-radius: 40.11px; border: 0.4px solid #000000;"></div>
                          <div style="position: absolute; top: 5px; left: 12px; width: 74px; height: 74px; border-radius: 36.94px; border: 0.4px solid #000000;"></div>
                          <div style="position: absolute; top: 16px; left: 22px; width: 53px; height: 53px; border-radius: 26.39px; border: 0.4px solid #000000;"></div>
                          <div style="position: absolute; top: 26px; left: 33px; width: 32px; height: 32px; border-radius: 15.83px; border: 0.4px solid #000000;"></div>
                          <div style="position: absolute; top: 32px; left: -2px; width: 97px; height: 21px; border-radius: 48.66px / 10.55px; border: 0.4px solid #000000; transform: rotate(-45deg);"></div>
                          <div style="position: absolute; top: 32px; left: 0; width: 97px; height: 21px; border-radius: 48.66px / 10.55px; border: 0.4px solid #000000;"></div>
                        </div>
                      </div>

                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`;

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get SendGrid API key from environment variables
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'superintelligence@moccet.com';

    if (!sendGridApiKey) {
      console.error('SENDGRID_API_KEY is not configured');
      // Don't fail the request if SendGrid is not configured
      return NextResponse.json({ success: true });
    }

    // Send email via SendGrid API
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
            subject: 'Welcome to moccet',
          },
        ],
        from: {
          email: fromEmail,
          name: 'moccet',
        },
        reply_to: {
          email: fromEmail,
        },
        content: [
          {
            type: 'text/html',
            value: EMAIL_TEMPLATE,
          },
        ],
      }),
    });

    if (!sendGridResponse.ok) {
      const errorText = await sendGridResponse.text();
      console.error('Failed to send email via SendGrid:', errorText);
      // Don't fail the request if email sending fails
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't fail the request if there's an error
    return NextResponse.json({ success: true });
  }
}
