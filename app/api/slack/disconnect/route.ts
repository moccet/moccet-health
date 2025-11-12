import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear all Slack cookies
  response.cookies.delete('slack_access_token');
  response.cookies.delete('slack_user_token');
  response.cookies.delete('slack_team');

  return response;
}
