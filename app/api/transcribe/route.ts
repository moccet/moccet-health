/**
 * Speech-to-Text API using Deepgram
 *
 * Accepts audio data and returns transcription using Deepgram's nova-2 model.
 * Optimized for health/medical terminology.
 */

import { NextRequest, NextResponse } from 'next/server';

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string;
        confidence?: number;
        words?: Array<{
          word: string;
          start: number;
          end: number;
          confidence: number;
        }>;
      }>;
    }>;
  };
  metadata?: {
    duration?: number;
    channels?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      console.error('[Transcribe] DEEPGRAM_API_KEY not configured');
      return NextResponse.json(
        { error: 'Transcription service not configured' },
        { status: 500 }
      );
    }

    // Get the audio data from the request
    const contentType = request.headers.get('content-type') || '';
    let audioData: ArrayBuffer;
    let mimeType = 'audio/wav';

    if (contentType.includes('multipart/form-data')) {
      // Handle form data with file upload
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;
      if (!audioFile) {
        return NextResponse.json(
          { error: 'No audio file provided' },
          { status: 400 }
        );
      }
      audioData = await audioFile.arrayBuffer();
      mimeType = audioFile.type || 'audio/wav';
    } else if (contentType.includes('application/json')) {
      // Handle base64 encoded audio
      const body = await request.json();
      if (!body.audio) {
        return NextResponse.json(
          { error: 'No audio data provided' },
          { status: 400 }
        );
      }
      // Decode base64 audio
      const base64Audio = body.audio.replace(/^data:audio\/\w+;base64,/, '');
      audioData = Buffer.from(base64Audio, 'base64');
      mimeType = body.mimeType || 'audio/wav';
    } else {
      // Handle raw audio data
      audioData = await request.arrayBuffer();
      mimeType = contentType || 'audio/wav';
    }

    console.log('[Transcribe] Processing audio:', {
      size: audioData.byteLength,
      mimeType,
    });

    // Build Deepgram query params
    const params = new URLSearchParams({
      model: 'nova-2',          // Best accuracy model
      language: 'en',
      punctuate: 'true',
      smart_format: 'true',
      diarize: 'false',         // Single speaker for voice input
      filler_words: 'false',    // Remove "um", "uh", etc.
      profanity_filter: 'false',
    });

    // Add health/medical keywords for better accuracy
    const healthKeywords = [
      'glucose', 'HRV', 'heart rate', 'sleep', 'recovery',
      'calories', 'steps', 'workout', 'nutrition', 'supplement',
      'vitamin', 'magnesium', 'omega', 'biomarker', 'blood pressure',
      'cholesterol', 'insulin', 'cortisol', 'melatonin', 'circadian',
      'REM', 'deep sleep', 'readiness', 'strain', 'Oura', 'Whoop',
      'Dexcom', 'CGM', 'moccet'
    ];

    healthKeywords.forEach(keyword => {
      params.append('keywords', `${keyword}:2`);
    });

    // Call Deepgram API
    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${params.toString()}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': mimeType,
        },
        body: audioData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Transcribe] Deepgram API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Transcription failed: ${response.status}` },
        { status: response.status }
      );
    }

    const result: DeepgramResponse = await response.json();

    // Extract transcript
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
    const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const duration = result.metadata?.duration || 0;

    console.log('[Transcribe] Success:', {
      transcript: transcript.substring(0, 50) + '...',
      confidence,
      duration,
      wordCount: words.length,
    });

    return NextResponse.json({
      success: true,
      transcript,
      confidence,
      words,
      duration,
    });

  } catch (error) {
    console.error('[Transcribe] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
