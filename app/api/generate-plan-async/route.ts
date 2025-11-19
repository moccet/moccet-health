import { NextRequest, NextResponse } from 'next/server';

// This endpoint will be updated to use Vercel Queue once properly configured
// For now, it accepts the job and responds immediately
// The actual queue processing happens in /api/queue/generate-sage-plan

export async function POST(request: NextRequest) {
  try {
    const { email, uniqueCode, fullName } = await request.json();

    if (!email || !uniqueCode || !fullName) {
      return NextResponse.json(
        { error: 'Email, uniqueCode, and fullName are required' },
        { status: 400 }
      );
    }

    console.log(`📬 Plan generation requested for ${email} (code: ${uniqueCode})`);

    // TODO: Once Vercel Queue is properly configured in production,
    // this will enqueue the job instead of processing synchronously

    // For now, trigger the queue consumer directly
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';

    // Call the queue consumer endpoint
    fetch(`${baseUrl}/api/queue/generate-sage-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        uniqueCode,
        fullName,
      }),
    }).catch(error => {
      console.error('Error triggering queue consumer:', error);
    });

    console.log(`✅ Plan generation started for ${email}`);

    return NextResponse.json({
      success: true,
      message: 'Plan generation has been started. You will receive an email when your plan is ready.',
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
