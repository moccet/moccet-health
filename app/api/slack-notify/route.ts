import { NextResponse } from 'next/server';

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

export async function POST(request: Request) {
  try {
    const { type, data } = await request.json();

    if (!SLACK_WEBHOOK_URL) {
      console.error('Slack webhook URL not configured');
      return NextResponse.json({ success: true });
    }

    let message = '';

    switch (type) {
      case 'waitlist':
        message = `🎉 New Waitlist Signup!\n` +
          `• Name: ${data.name}\n` +
          `• Email: ${data.email}\n` +
          `• Reason: ${data.reason || 'Not provided'}`;
        break;

      case 'developer':
        message = `👨‍💻 New Developer Interest!\n` +
          `• Name: ${data.name}\n` +
          `• Email: ${data.email}\n` +
          `• Company: ${data.company || 'Not provided'}\n` +
          `• Use Case: ${data.useCase || 'Not provided'}`;
        break;

      case 'signup':
        message = `🆕 New User Signup!\n` +
          `• Email: ${data.email}`;
        break;

      default:
        message = `📬 New Form Submission\n` +
          `• Type: ${type}\n` +
          `• Data: ${JSON.stringify(data, null, 2)}`;
    }

    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message,
        username: 'Moccet Bot',
        icon_emoji: '🤖'
      }),
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return NextResponse.json({ success: true });
  }
}