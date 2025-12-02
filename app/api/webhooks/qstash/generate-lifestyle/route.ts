import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

// This is the webhook handler that QStash will call for lifestyle generation
async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode } = body;

    if (!email || !uniqueCode) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🎯 [QSTASH] Starting lifestyle generation for ${email} (code: ${uniqueCode})`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';

    // Import the lifestyle generation function directly
    const generateLifestyle = (await import('../../../generate-lifestyle-integration/route')).GET;

    console.log('[1/1] Generating lifestyle integration...');
    const mockLifestyleRequest = {
      url: `${baseUrl}/api/generate-lifestyle-integration?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-lifestyle-integration?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const lifestyleResponse = await generateLifestyle(mockLifestyleRequest);

    if (lifestyleResponse.status === 200) {
      console.log(`\n✅ [QSTASH] Lifestyle integration generated successfully for ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Lifestyle integration generated successfully',
      });
    } else {
      throw new Error('Failed to generate lifestyle integration');
    }

  } catch (error) {
    console.error('❌ [QSTASH] Lifestyle generation failed:', error);

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
