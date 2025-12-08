import { NextRequest, NextResponse } from 'next/server';
import { revokeToken, Provider } from '@/lib/services/token-manager';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, provider } = body;

    if (!email || !provider) {
      return NextResponse.json(
        { error: 'Email and provider are required' },
        { status: 400 }
      );
    }

    const result = await revokeToken(email, provider as Provider);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully disconnected ${provider}`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Connectors Disconnect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
