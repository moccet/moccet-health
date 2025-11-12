import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate the incoming data
    if (!data) {
      return NextResponse.json(
        { error: 'No data provided' },
        { status: 400 }
      );
    }

    // Log the onboarding data (for now)
    console.log('Sage onboarding data received:', {
      timestamp: data.timestamp,
      completed: data.completed,
      dataKeys: Object.keys(data),
    });

    // TODO: Store the onboarding data in a database
    // TODO: Trigger nutrition plan generation workflow
    // TODO: Send confirmation email to user
    // TODO: Integrate with AI service for personalized plan

    // For now, just acknowledge receipt
    return NextResponse.json(
      {
        success: true,
        message: 'Onboarding data received successfully',
        data: {
          received: true,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing sage onboarding:', error);
    return NextResponse.json(
      {
        error: 'Failed to process onboarding data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle GET requests (optional - for testing)
export async function GET() {
  return NextResponse.json(
    {
      message: 'Sage onboarding API endpoint',
      methods: ['POST'],
      description: 'Submit sage onboarding data via POST request',
    },
    { status: 200 }
  );
}
