import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { createClient } from '@/lib/supabase/server';
import { notifyPlanQueued } from '@/lib/slack';

// This endpoint publishes fitness plan generation jobs to Upstash QStash
// QStash will call our webhook endpoint to process the job in the background

export async function POST(request: NextRequest) {
  try {
    // Handle both JSON and FormData (but lab file is now uploaded separately)
    const contentType = request.headers.get('content-type');
    let email, uniqueCode, fullName;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      email = formData.get('email') as string;
      uniqueCode = formData.get('uniqueCode') as string;
      fullName = formData.get('fullName') as string;
    } else {
      const body = await request.json();
      email = body.email;
      uniqueCode = body.uniqueCode;
      fullName = body.fullName;
    }

    if (!email || !uniqueCode || !fullName) {
      return NextResponse.json(
        { error: 'Email, uniqueCode, and fullName are required' },
        { status: 400 }
      );
    }

    console.log(`📬 Fitness plan generation requested for ${email} (code: ${uniqueCode})`);

    // Initialize QStash client
    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) {
      console.error('QSTASH_TOKEN is not configured');
      return NextResponse.json(
        { error: 'QStash is not configured. Please set QSTASH_TOKEN environment variable.' },
        { status: 500 }
      );
    }

    const client = new Client({
      token: qstashToken,
    });

    // Set initial status in database
    try {
      const supabase = await createClient();
      await supabase
        .from('forge_onboarding_data')
        .update({
          plan_generation_status: 'queued',
          updated_at: new Date().toISOString()
        })
        .eq('email', email);
    } catch (error) {
      console.warn('Failed to update initial status:', error);
      // Continue anyway - this is not critical
    }

    // Publish job to QStash
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';
    const webhookUrl = `${baseUrl}/api/webhooks/qstash/forge-generate-plan`;

    try {
      const result = await client.publishJSON({
        url: webhookUrl,
        body: {
          email,
          uniqueCode,
          fullName,
        },
        retries: 2, // Retry up to 2 times if it fails
      });

      console.log(`✅ Fitness plan generation job queued for ${email} (messageId: ${result.messageId})`);

      // Send Slack notification
      try {
        await notifyPlanQueued(email, 'Forge', uniqueCode, fullName);
      } catch (slackError) {
        console.warn('Failed to send Slack notification:', slackError);
        // Don't fail the request if Slack notification fails
      }

      return NextResponse.json({
        success: true,
        message: 'Fitness plan generation started. You will receive an email when your plan is ready.',
        messageId: result.messageId,
      });
    } catch (qstashError) {
      console.error('Failed to publish to QStash:', qstashError);
      return NextResponse.json(
        {
          error: 'Failed to queue fitness plan generation',
          message: qstashError instanceof Error ? qstashError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error starting fitness plan generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to start fitness plan generation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
