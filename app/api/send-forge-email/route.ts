import { NextRequest, NextResponse } from 'next/server';

const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>forge - Access Request Confirmation</title>
    <meta name="description" content="You requested access to forge. We're building training programs that adapt to your biology." />
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
                                You requested access to forge. We're glad you're here.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                Training programs that adapt to your biology, not generic templates. forge learns from your biomarkers, wearable data, and daily patterns to create programs matched to your current metabolic state.
                            </p>

                            <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                We're bringing on users gradually to ensure everyone gets the best experience. We'll email you as soon as you can start.
                            </p>

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
            subject: 'forge - Access Request Confirmation',
          },
        ],
        from: {
          email: fromEmail,
          name: 'forge',
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
    console.error('Error sending forge email:', error);
    // Don't fail the request if there's an error
    return NextResponse.json({ success: true });
  }
}
