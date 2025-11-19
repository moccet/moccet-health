import { NextRequest, NextResponse } from 'next/server';

// This endpoint will be updated to use Vercel Queue once properly configured
// For now, it accepts the job and responds immediately
// The actual queue processing happens in /api/queue/generate-sage-plan

export async function POST(request: NextRequest) {
  try {
    // Handle both JSON and FormData
    const contentType = request.headers.get('content-type');
    let email, uniqueCode, fullName, labFile;

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      email = formData.get('email') as string;
      uniqueCode = formData.get('uniqueCode') as string;
      fullName = formData.get('fullName') as string;
      labFile = formData.get('labFile') as File | null;
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

    console.log(`📬 Plan generation requested for ${email} (code: ${uniqueCode})`);

    // If lab file provided, analyze it first
    if (labFile) {
      console.log(`🩸 Lab file provided, triggering blood analysis...`);
      const analysisFormData = new FormData();
      analysisFormData.append('bloodTest', labFile);
      analysisFormData.append('email', email);

      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';
        const analysisResponse = await fetch(`${baseUrl}/api/analyze-blood-results`, {
          method: 'POST',
          body: analysisFormData,
        });

        if (analysisResponse.ok) {
          console.log('✅ Blood analysis completed');
        } else {
          console.log('⚠️ Blood analysis failed, continuing without it');
        }
      } catch (error) {
        console.error('Error analyzing blood results:', error);
        // Continue anyway
      }
    }

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
