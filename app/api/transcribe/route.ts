/**
 * Transcription Endpoint - OpenAI Whisper API
 *
 * Provides speech-to-text transcription using OpenAI's Whisper model.
 * Better accuracy than native mobile STT, especially for medical terminology.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/transcribe
 *
 * Transcribe audio to text using OpenAI Whisper.
 *
 * Request: multipart/form-data with 'audio' file
 * Response: { text: string, language?: string, duration?: number }
 */
export async function POST(request: NextRequest) {
  console.log('[TRANSCRIBE] ========== NEW TRANSCRIPTION REQUEST ==========');

  try {
    // Get the form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      console.log('[TRANSCRIBE] ERROR: No audio file provided');
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    console.log('[TRANSCRIBE] Audio file received:', {
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    });

    // Optional parameters
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null;

    // Convert File to Buffer for OpenAI API
    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create a File-like object for OpenAI
    const file = new File([buffer], audioFile.name || 'audio.webm', {
      type: audioFile.type || 'audio/webm',
    });

    console.log('[TRANSCRIBE] Calling OpenAI Whisper API...');
    const startTime = Date.now();

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: language || undefined,
      prompt: prompt || 'Health, medical terminology, wellness, sleep, glucose, HRV, supplements, vitamins',
      response_format: 'verbose_json',
    });

    const duration = Date.now() - startTime;
    console.log('[TRANSCRIBE] Transcription complete in', duration, 'ms');
    console.log('[TRANSCRIBE] Result:', transcription.text?.substring(0, 100));

    return NextResponse.json({
      text: transcription.text,
      language: transcription.language,
      duration: transcription.duration,
      processingTime: duration,
    });
  } catch (error) {
    console.error('[TRANSCRIBE] ========== ERROR ==========');
    console.error('[TRANSCRIBE] Error:', error);

    if (error instanceof Error) {
      // Check for specific OpenAI errors
      if (error.message.includes('Invalid file format')) {
        return NextResponse.json(
          { error: 'Invalid audio format. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transcribe
 *
 * Health check and supported formats info
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'OpenAI Whisper Transcription',
    supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
    maxFileSize: '25MB',
    features: [
      'High accuracy for medical terminology',
      'Multiple language support',
      'Custom prompts for context',
    ],
  });
}
