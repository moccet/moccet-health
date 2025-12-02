import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

// This is the webhook handler that QStash will call for micronutrients generation
async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode } = body;

    if (!email || !uniqueCode) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n💊 [QSTASH] Starting micronutrients generation for ${email} (code: ${uniqueCode})`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';

    // Import the micronutrients generation function directly
    const generateMicronutrients = (await import('../../../generate-micronutrients/route')).GET;

    console.log('[1/1] Generating micronutrient recommendations...');
    const mockMicroRequest = {
      url: `${baseUrl}/api/generate-micronutrients?code=${uniqueCode}`,
      nextUrl: new URL(`${baseUrl}/api/generate-micronutrients?code=${uniqueCode}`)
    } as unknown as NextRequest;

    const microResponse = await generateMicronutrients(mockMicroRequest);

    if (microResponse.status === 200) {
      console.log(`\n✅ [QSTASH] Micronutrients generated successfully for ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Micronutrients generated successfully',
      });
    } else {
      throw new Error('Failed to generate micronutrients');
    }

  } catch (error) {
    console.error('❌ [QSTASH] Micronutrients generation failed:', error);

    return NextResponse.json(
      {
        error: 'Micronutrients generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the handler wrapped with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
