import { NextRequest, NextResponse } from 'next/server';

const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to moccet</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a;">

    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 0;">

                <!-- Hero Image - Full Width -->
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0; text-align: center; background-color: #f5f5f5;">
                            <img src="https://c.animaapp.com/uupO8NOC/img/3d-render-7snii6tu-68-unsplash.jpg" alt="moccet gradient" style="width: 100%; max-width: 100%; height: auto; max-height: 280px; object-fit: cover; display: block;" />
                        </td>
                    </tr>
                </table>

                <!-- Content Container -->
                <table role="presentation" style="max-width: 560px; width: 100%; margin: 0 auto; border-collapse: collapse;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 48px 20px 40px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 400; letter-spacing: -0.3px; color: #000000;">moccet</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 20px;">

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                Thank you for joining the waitlist.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                moccet is your personal health AI. It connects everything about your biology—blood work, wearables, calendar, email, location, medical records—and tells you exactly what to do to feel better, perform better, and live better every single day.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                No more guessing if something is working. No more generic advice that doesn't fit your body. You'll see in real-time how your sleep affects your recovery, how stress changes what you should eat, how your training should adapt to your current state. The system learns your biology and adjusts your protocols as you change.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                This is what AI was meant to do: give you the tools to understand and optimize the most complex system you'll ever operate—yourself.
                            </p>

                            <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                While you're on the waitlist, you can try the tools we've already released:
                            </p>

                            <p style="margin: 0 0 8px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                <a href="https://moccet.ai/forge" style="color: #0066cc; text-decoration: none;">forge ↗</a> — Training programs from your biomarkers
                            </p>

                            <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                <a href="https://moccet.ai/sage" style="color: #0066cc; text-decoration: none;">sage ↗</a> — Nutrition plans from your metabolic state
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                We'll send you updates as we get closer to launch, and you'll get pre-release access before anyone else.
                            </p>

                            <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                If moccet helps you, share it with people you care about. This is the future of health, and it should belong to everyone.
                            </p>

                            <p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                Omar Elalfy MD & Sofian Youssef MD
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 48px 20px 32px; text-align: center;">
                            <p style="margin: 0; font-size: 13px; color: #666666;">
                                <a href="{{unsubscribe_url}}" style="color: #666666; text-decoration: none;">Unsubscribe</a>
                            </p>
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
