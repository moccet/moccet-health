import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, provider } = await request.json();

    if (!email || !provider) {
      return NextResponse.json({ error: 'Email and provider are required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    console.log(`[Debug] Testing ${provider} sync for ${email}`);

    let syncUrl = '';
    switch (provider) {
      case 'oura':
        syncUrl = `${baseUrl}/api/oura/sync`;
        break;
      case 'dexcom':
        syncUrl = `${baseUrl}/api/dexcom/sync`;
        break;
      case 'vital':
        syncUrl = `${baseUrl}/api/vital/sync`;
        break;
      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    const startTime = Date.now();

    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
      }),
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: response.ok,
      provider,
      email,
      duration,
      statusCode: response.status,
      response: data,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Sync test failed',
      details: String(error)
    }, { status: 500 });
  }
}
