/**
 * Test Anthropic API Key
 * GET /api/test-anthropic
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'ANTHROPIC_API_KEY not set in environment',
      });
    }

    // Check key format
    const keyInfo = {
      present: true,
      startsWithSk: apiKey.startsWith('sk-ant-'),
      length: apiKey.length,
      preview: apiKey.substring(0, 15) + '...',
    };

    // Try to make a simple API call
    const anthropic = new Anthropic({ apiKey });

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Cheapest, fastest model
        max_tokens: 50,
        messages: [
          {
            role: 'user',
            content: 'Say hello in 3 words',
          },
        ],
      });

      return NextResponse.json({
        success: true,
        keyInfo,
        testResponse: response,
        message: 'API key works! Model: claude-3-haiku-20240307',
      });
    } catch (apiError: any) {
      return NextResponse.json({
        success: false,
        keyInfo,
        error: 'API call failed',
        details: apiError.message || String(apiError),
        fullError: JSON.stringify(apiError, null, 2),
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
