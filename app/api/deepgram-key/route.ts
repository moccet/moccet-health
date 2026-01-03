/**
 * Deepgram API Key Endpoint
 * Returns the Deepgram API key for client-side WebSocket connections.
 * In production, consider implementing short-lived tokens instead.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Deepgram API key not configured' },
      { status: 500 }
    );
  }

  // Return the API key for WebSocket connection
  // Note: In production, consider creating temporary project keys
  // via Deepgram's API for enhanced security
  return NextResponse.json({
    apiKey,
  });
}
