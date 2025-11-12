import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear all Gmail cookies
  response.cookies.delete('gmail_access_token');
  response.cookies.delete('gmail_refresh_token');
  response.cookies.delete('gmail_email');

  return response;
}
