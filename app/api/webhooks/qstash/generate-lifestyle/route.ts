import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { Client } from '@upstash/qstash';
import { createClient } from '@/lib/supabase/server';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

async function updateComponentStatus(
  email: string,
  status: 'processing' | 'completed' | 'failed'
) {
  try {
    const supabase = await createClient();
    await supabase
      .from('sage_onboarding_data')
      .update({ lifestyle_status: status })
      .eq('email', email);
  } catch (error) {
    console.error('[LIFESTYLE] Failed to update status:', error);
  }
}

async function triggerCompletionCheck(email: string, uniqueCode: string) {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.log('[LIFESTYLE] QSTASH_TOKEN not configured, skipping completion check');
    return;
  }

  try {
    const client = new Client({ token: qstashToken });
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.moccet.ai';

    await client.publishJSON({
      url: `${baseUrl}/api/webhooks/qstash/check-sage-completion`,
      body: { email, uniqueCode, source: 'lifestyle' },
      retries: 0,
    });

    console.log('[LIFESTYLE] Triggered completion check');
  } catch (error) {
    console.error('[LIFESTYLE] Failed to trigger completion check:', error);
  }
}

// This is the webhook handler that QStash will call for lifestyle generation
async function handler(request: NextRequest) {
  let email: string = '';
  let uniqueCode: string = '';

  try {
    const body = await request.json();
    email = body.email;
    uniqueCode = body.uniqueCode;

    if (!email || !uniqueCode) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n[LIFESTYLE] Starting lifestyle generation for ${email} (code: ${uniqueCode})`);

    // Mark as processing
    await updateComponentStatus(email, 'processing');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';

    // Import the lifestyle generation function directly
    const generateLifestyle = (await import('../../../generate-lifestyle-integration/route')).GET;

    console.log('[LIFESTYLE] Generating lifestyle integration...');
    const mockLifestyleRequest = {
      url: `${baseUrl}/api/generate-lifestyle-integration?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-lifestyle-integration?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const lifestyleResponse = await generateLifestyle(mockLifestyleRequest);

    if (lifestyleResponse.status === 200) {
      // Mark as completed
      await updateComponentStatus(email, 'completed');
      console.log(`[LIFESTYLE] Successfully completed for ${email}`);

      // Trigger completion check
      await triggerCompletionCheck(email, uniqueCode);

      return NextResponse.json({
        success: true,
        message: 'Lifestyle integration generated successfully',
      });
    } else {
      throw new Error('Failed to generate lifestyle integration');
    }

  } catch (error) {
    console.error('[LIFESTYLE] Generation failed:', error);

    // Mark as failed
    if (email) {
      await updateComponentStatus(email, 'failed');
      // Still trigger completion check so email can be sent with partial content
      if (uniqueCode) {
        await triggerCompletionCheck(email, uniqueCode);
      }
    }

    return NextResponse.json(
      {
        error: 'Lifestyle generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
