import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log to console (will appear in Vercel logs)
    console.log('[MOBILE DEBUG]', JSON.stringify(body, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MOBILE DEBUG ERROR]', error);
    return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
  }
}
