/**
 * TTS Preview Endpoint
 *
 * Generates a voice preview sample using ElevenLabs TTS.
 * Used by the voice selection modal to let users hear voice samples.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech } from '@/lib/services/tts-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { voiceId, text } = body;

    if (!voiceId) {
      return NextResponse.json(
        { error: 'voiceId is required' },
        { status: 400 }
      );
    }

    const previewText = text || 'Hello! I am your personal health assistant from Moccet.';

    // Generate speech using the TTS service (now accepts direct voice IDs)
    const audioBase64 = await generateSpeech(previewText, {
      voiceId: voiceId,
    });

    return NextResponse.json({
      success: true,
      audio: audioBase64,
    });
  } catch (error) {
    console.error('[TTS Preview] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
