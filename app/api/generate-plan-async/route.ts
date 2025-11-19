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

    // Directly import and call the queue consumer function
    // This keeps the connection alive and ensures the job runs
    try {
      const { POST: queueConsumer } = await import('../queue/generate-sage-plan/route');

      // Create a mock request for the queue consumer
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';
      const mockRequest = new Request(`${baseUrl}/api/queue/generate-sage-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          uniqueCode,
          fullName,
        }),
      });

      // AWAIT the queue consumer to keep the connection alive
      // This ensures the plan generation completes even if user closes the tab
      // The browser's keepalive:true will maintain the request
      console.log(`⏳ Starting plan generation (keeping connection alive)...`);

      await queueConsumer(mockRequest as NextRequest);

      console.log(`✅ Plan generation completed for ${email}`);

      return NextResponse.json({
        success: true,
        message: 'Plan generation completed successfully!',
      });
    } catch (importError) {
      console.error('Failed to import queue consumer:', importError);
      return NextResponse.json(
        { error: 'Failed to start plan generation' },
        { status: 500 }
      );
    }

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
