/**
 * TTS Service - ElevenLabs Text-to-Speech Integration
 *
 * Provides streaming text-to-speech conversion using ElevenLabs API.
 * Supports multiple voices and returns audio chunks for real-time playback.
 */

// ElevenLabs voice IDs - can be customized
export const ELEVENLABS_VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM', // Rachel - warm, professional
  domi: 'AZnzlk1XvdvUeBnXmlld',   // Domi - friendly, energetic
  bella: 'EXAVITQu4vr4xnSDxMaL',  // Bella - calm, soothing
  josh: 'TxGEqnHWrfWFTfGW9XjX',   // Josh - deep, narrator
  elli: 'MF3mGyEYCl7XYWbV9V6O',   // Elli - young, cheerful
} as const;

export type VoiceId = keyof typeof ELEVENLABS_VOICES;

interface TTSOptions {
  voiceId?: VoiceId | string; // Accept either key name or actual ElevenLabs voice ID
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<TTSOptions, 'voiceId'>> & { voiceId: VoiceId } = {
  voiceId: 'rachel',
  modelId: 'eleven_turbo_v2_5', // Updated from deprecated eleven_monolingual_v1
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  useSpeakerBoost: true,
};

/**
 * Resolve voice ID - accepts either a key name (e.g., 'bella') or actual ElevenLabs voice ID
 */
function resolveVoiceId(voiceIdOrKey: string | undefined): string {
  if (!voiceIdOrKey) {
    return ELEVENLABS_VOICES[DEFAULT_OPTIONS.voiceId];
  }
  // Check if it's a key in our voices map
  if (voiceIdOrKey in ELEVENLABS_VOICES) {
    return ELEVENLABS_VOICES[voiceIdOrKey as VoiceId];
  }
  // Otherwise assume it's an actual ElevenLabs voice ID
  return voiceIdOrKey;
}

/**
 * Generate speech from text using ElevenLabs
 * Returns the audio as a base64-encoded string
 */
export async function generateSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const voiceId = resolveVoiceId(opts.voiceId);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: opts.modelId,
        voice_settings: {
          stability: opts.stability,
          similarity_boost: opts.similarityBoost,
          style: opts.style,
          use_speaker_boost: opts.useSpeakerBoost,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[TTS] ElevenLabs API error:', error);
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  // Convert response to base64
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return base64;
}

/**
 * Generate speech with streaming - returns chunks as they become available
 * Uses ElevenLabs streaming API for lower latency
 */
export async function* streamSpeech(
  text: string,
  options: TTSOptions = {}
): AsyncGenerator<{ chunk: string; index: number; isFinal: boolean }> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const voiceId = resolveVoiceId(opts.voiceId);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: opts.modelId,
        voice_settings: {
          stability: opts.stability,
          similarity_boost: opts.similarityBoost,
          style: opts.style,
          use_speaker_boost: opts.useSpeakerBoost,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('[TTS] ElevenLabs streaming API error:', error);
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  if (!response.body) {
    throw new Error('No response body from ElevenLabs');
  }

  const reader = response.body.getReader();
  let index = 0;
  const chunks: Uint8Array[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Send the final chunk indicator
        if (chunks.length > 0) {
          const finalChunk = Buffer.concat(chunks.map(c => Buffer.from(c)));
          yield {
            chunk: finalChunk.toString('base64'),
            index,
            isFinal: true,
          };
        }
        break;
      }

      if (value && value.length > 0) {
        chunks.push(value);

        // Yield chunks periodically (every ~32KB for smooth playback)
        const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
        if (totalSize >= 32768) {
          const combinedChunk = Buffer.concat(chunks.map(c => Buffer.from(c)));
          yield {
            chunk: combinedChunk.toString('base64'),
            index,
            isFinal: false,
          };
          chunks.length = 0;
          index++;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Generate speech for multiple text segments in parallel
 * Useful for generating audio while text is still being streamed
 */
export async function generateSpeechBatch(
  texts: string[],
  options: TTSOptions = {}
): Promise<Array<{ text: string; audio: string; index: number }>> {
  const results = await Promise.all(
    texts.map(async (text, index) => {
      try {
        const audio = await generateSpeech(text, options);
        return { text, audio, index };
      } catch (error) {
        console.error(`[TTS] Error generating speech for segment ${index}:`, error);
        return { text, audio: '', index };
      }
    })
  );

  return results.filter(r => r.audio !== '');
}

/**
 * Pre-generate acknowledgment audio files
 * Call this once to create the acknowledgment audio files
 */
export async function generateAcknowledgmentAudios(
  phrases: string[],
  options: TTSOptions = {}
): Promise<Array<{ phrase: string; audio: string }>> {
  const results: Array<{ phrase: string; audio: string }> = [];

  for (const phrase of phrases) {
    try {
      console.log(`[TTS] Generating audio for: "${phrase}"`);
      const audio = await generateSpeech(phrase, options);
      results.push({ phrase, audio });
    } catch (error) {
      console.error(`[TTS] Error generating acknowledgment for "${phrase}":`, error);
    }
  }

  return results;
}

/**
 * Check if ElevenLabs API is configured
 */
export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}
