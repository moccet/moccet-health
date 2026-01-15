/**
 * Parallel TTS Service
 *
 * Optimizes text-to-speech generation by:
 * 1. Starting TTS as soon as first sentence is available (not waiting for full response)
 * 2. Processing sentences in parallel batches
 * 3. Streaming audio chunks as they complete (not waiting for all)
 * 4. Caching common phrases for instant playback
 * 5. Providing progress callbacks for real-time streaming
 */

import { generateSpeech, isElevenLabsConfigured, VoiceId } from './tts-service';

// ============================================================================
// Types
// ============================================================================

export interface TTSOptions {
  voiceId?: VoiceId;
  maxParallelRequests?: number;
  enableCaching?: boolean;
  priority?: 'speed' | 'quality';
}

export interface AudioChunk {
  index: number;
  text: string;
  audio: string; // Base64 encoded
  durationMs?: number;
  isFinal: boolean;
}

export interface TTSProgress {
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  currentIndex: number;
}

export type OnChunkReady = (chunk: AudioChunk) => void;
export type OnProgress = (progress: TTSProgress) => void;
export type OnError = (error: Error, index: number) => void;

export interface ParallelTTSResult {
  chunks: AudioChunk[];
  totalDurationMs: number;
  successRate: number;
  generationTimeMs: number;
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MAX_PARALLEL = 5; // ElevenLabs allows ~5 concurrent requests
const SENTENCE_END_PAUSE_MS = 200; // Pause between sentences

// Common acknowledgment phrases - pre-cached for instant playback
const CACHED_PHRASES: Map<string, string> = new Map();

// ============================================================================
// Sentence Splitting
// ============================================================================

/**
 * Split text into optimal chunks for TTS
 * Balances between natural breaks and parallel processing efficiency
 */
export function splitForTTS(text: string): string[] {
  if (!text) return [];

  const chunks: string[] = [];
  let current = '';

  // First split by paragraphs (double newline)
  const paragraphs = text.split(/\n\n+/);

  for (const paragraph of paragraphs) {
    // Then split each paragraph into sentences
    const sentences = splitIntoSentences(paragraph);

    for (const sentence of sentences) {
      // If sentence is very long, split at commas or semicolons
      if (sentence.length > 200) {
        const subParts = sentence.split(/(?<=[,;])\s+/);
        for (const part of subParts) {
          if (part.trim()) {
            chunks.push(part.trim());
          }
        }
      } else if (sentence.trim()) {
        chunks.push(sentence.trim());
      }
    }
  }

  // Merge very short chunks with the next one
  const mergedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.length < 30 && i < chunks.length - 1) {
      // Merge with next chunk
      chunks[i + 1] = `${chunk} ${chunks[i + 1]}`;
    } else {
      mergedChunks.push(chunk);
    }
  }

  return mergedChunks;
}

function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    current += text[i];

    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      const nextChar = text[i + 1];
      if (!nextChar || nextChar === ' ' || nextChar === '\n') {
        // Check for abbreviations
        const lastWord = current.trim().split(/\s+/).pop() || '';
        const abbreviations = ['dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'vs', 'etc', 'i.e', 'e.g', 'no', 'vol'];
        const isAbbreviation = abbreviations.some(abbr =>
          lastWord.toLowerCase().replace('.', '') === abbr
        );

        if (!isAbbreviation) {
          sentences.push(current.trim());
          current = '';
          if (nextChar === ' ') i++;
        }
      }
    }
  }

  if (current.trim()) {
    sentences.push(current.trim());
  }

  return sentences;
}

// ============================================================================
// Parallel TTS Generation
// ============================================================================

/**
 * Generate TTS for multiple chunks in parallel with streaming callbacks
 *
 * @param chunks - Array of text chunks to convert
 * @param options - TTS options
 * @param callbacks - Optional callbacks for streaming
 */
export async function generateParallelTTS(
  chunks: string[],
  options: TTSOptions = {},
  callbacks?: {
    onChunkReady?: OnChunkReady;
    onProgress?: OnProgress;
    onError?: OnError;
  }
): Promise<ParallelTTSResult> {
  const startTime = Date.now();
  const {
    voiceId = 'rachel',
    maxParallelRequests = DEFAULT_MAX_PARALLEL,
    enableCaching = true,
  } = options;

  if (!isElevenLabsConfigured()) {
    console.warn('[ParallelTTS] ElevenLabs not configured');
    return {
      chunks: [],
      totalDurationMs: 0,
      successRate: 0,
      generationTimeMs: 0,
    };
  }

  const results: AudioChunk[] = [];
  let completedCount = 0;
  let failedCount = 0;

  // Process in batches for parallel execution
  for (let batchStart = 0; batchStart < chunks.length; batchStart += maxParallelRequests) {
    const batchEnd = Math.min(batchStart + maxParallelRequests, chunks.length);
    const batch = chunks.slice(batchStart, batchEnd);

    const batchPromises = batch.map(async (text, batchIndex) => {
      const globalIndex = batchStart + batchIndex;
      const isFinal = globalIndex === chunks.length - 1;

      try {
        // Check cache first
        if (enableCaching) {
          const cached = getCachedAudio(text, voiceId);
          if (cached) {
            const chunk: AudioChunk = {
              index: globalIndex,
              text,
              audio: cached,
              isFinal,
            };
            completedCount++;

            // Callback immediately for cached chunks
            if (callbacks?.onChunkReady) {
              callbacks.onChunkReady(chunk);
            }

            return chunk;
          }
        }

        // Generate TTS
        const audio = await generateSpeech(text, { voiceId });

        // Cache common short phrases
        if (enableCaching && text.length < 100) {
          setCachedAudio(text, voiceId, audio);
        }

        const chunk: AudioChunk = {
          index: globalIndex,
          text,
          audio,
          durationMs: estimateDuration(text),
          isFinal,
        };

        completedCount++;

        // Callback as soon as chunk is ready
        if (callbacks?.onChunkReady) {
          callbacks.onChunkReady(chunk);
        }

        if (callbacks?.onProgress) {
          callbacks.onProgress({
            totalChunks: chunks.length,
            completedChunks: completedCount,
            failedChunks: failedCount,
            currentIndex: globalIndex,
          });
        }

        return chunk;
      } catch (error) {
        failedCount++;
        console.error(`[ParallelTTS] Failed chunk ${globalIndex}:`, error);

        if (callbacks?.onError) {
          callbacks.onError(error instanceof Error ? error : new Error(String(error)), globalIndex);
        }

        if (callbacks?.onProgress) {
          callbacks.onProgress({
            totalChunks: chunks.length,
            completedChunks: completedCount,
            failedChunks: failedCount,
            currentIndex: globalIndex,
          });
        }

        return null;
      }
    });

    // Wait for batch to complete before starting next
    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result) {
        results.push(result);
      }
    }
  }

  // Sort results by index
  results.sort((a, b) => a.index - b.index);

  // Calculate total duration
  const totalDurationMs = results.reduce((sum, r) => sum + (r.durationMs || 0), 0);

  return {
    chunks: results,
    totalDurationMs,
    successRate: chunks.length > 0 ? completedCount / chunks.length : 0,
    generationTimeMs: Date.now() - startTime,
  };
}

/**
 * Stream TTS generation - starts immediately with first chunk
 * Returns an async generator that yields chunks as they complete
 */
export async function* streamTTS(
  textOrChunks: string | string[],
  options: TTSOptions = {}
): AsyncGenerator<AudioChunk> {
  const chunks = typeof textOrChunks === 'string'
    ? splitForTTS(textOrChunks)
    : textOrChunks;

  if (chunks.length === 0) return;

  const {
    voiceId = 'rachel',
    maxParallelRequests = DEFAULT_MAX_PARALLEL,
    enableCaching = true,
  } = options;

  if (!isElevenLabsConfigured()) {
    console.warn('[ParallelTTS] ElevenLabs not configured');
    return;
  }

  // Create a queue for results
  const resultQueue: (AudioChunk | null)[] = new Array(chunks.length).fill(null);
  let nextToYield = 0;
  let completedCount = 0;

  // Process chunks with limited concurrency
  const inFlight = new Set<number>();
  let currentIndex = 0;

  while (nextToYield < chunks.length) {
    // Start new requests up to max parallel
    while (inFlight.size < maxParallelRequests && currentIndex < chunks.length) {
      const index = currentIndex++;
      inFlight.add(index);

      // Don't await - fire and handle result
      processChunk(index).then(result => {
        resultQueue[index] = result;
        inFlight.delete(index);
        completedCount++;
      }).catch(err => {
        console.error(`[ParallelTTS] Stream error chunk ${index}:`, err);
        inFlight.delete(index);
        completedCount++;
      });
    }

    // Check if next chunk is ready to yield
    if (resultQueue[nextToYield] !== null) {
      const chunk = resultQueue[nextToYield];
      if (chunk) {
        yield chunk;
      }
      nextToYield++;
    } else {
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  async function processChunk(index: number): Promise<AudioChunk | null> {
    const text = chunks[index];
    const isFinal = index === chunks.length - 1;

    try {
      // Check cache
      if (enableCaching) {
        const cached = getCachedAudio(text, voiceId);
        if (cached) {
          return {
            index,
            text,
            audio: cached,
            isFinal,
          };
        }
      }

      const audio = await generateSpeech(text, { voiceId });

      if (enableCaching && text.length < 100) {
        setCachedAudio(text, voiceId, audio);
      }

      return {
        index,
        text,
        audio,
        durationMs: estimateDuration(text),
        isFinal,
      };
    } catch (error) {
      console.error(`[ParallelTTS] Failed to generate chunk ${index}:`, error);
      return null;
    }
  }
}

// ============================================================================
// Caching Functions
// ============================================================================

function getCacheKey(text: string, voiceId: VoiceId): string {
  return `${voiceId}:${text.toLowerCase().trim()}`;
}

function getCachedAudio(text: string, voiceId: VoiceId): string | null {
  return CACHED_PHRASES.get(getCacheKey(text, voiceId)) || null;
}

function setCachedAudio(text: string, voiceId: VoiceId, audio: string): void {
  const key = getCacheKey(text, voiceId);

  // Limit cache size
  if (CACHED_PHRASES.size > 100) {
    // Remove oldest entries
    const keysToDelete = Array.from(CACHED_PHRASES.keys()).slice(0, 20);
    keysToDelete.forEach(k => CACHED_PHRASES.delete(k));
  }

  CACHED_PHRASES.set(key, audio);
}

/**
 * Pre-cache common acknowledgment phrases
 */
export async function warmupCache(voiceId: VoiceId = 'rachel'): Promise<void> {
  const commonPhrases = [
    "Let me check that for you.",
    "I'll look that up.",
    "Good question, let me see.",
    "Here's what I found.",
    "Based on your data...",
    "I recommend...",
    "Let me explain.",
    "In summary...",
  ];

  if (!isElevenLabsConfigured()) {
    console.warn('[ParallelTTS] Cannot warmup cache - ElevenLabs not configured');
    return;
  }

  console.log('[ParallelTTS] Warming up TTS cache...');

  const promises = commonPhrases.map(async (phrase) => {
    if (!getCachedAudio(phrase, voiceId)) {
      try {
        const audio = await generateSpeech(phrase, { voiceId });
        setCachedAudio(phrase, voiceId, audio);
      } catch (err) {
        console.error(`[ParallelTTS] Failed to cache phrase: ${phrase}`, err);
      }
    }
  });

  await Promise.all(promises);
  console.log('[ParallelTTS] Cache warmup complete');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Estimate audio duration based on text length
 * Average speaking rate: ~150 words per minute
 */
function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const baseMs = (words / 150) * 60 * 1000;

  // Add pause for sentence endings
  const sentenceEndings = (text.match(/[.!?]/g) || []).length;
  const pauseMs = sentenceEndings * SENTENCE_END_PAUSE_MS;

  return Math.round(baseMs + pauseMs);
}

/**
 * Get total estimated duration for text
 */
export function estimateTotalDuration(text: string): number {
  const chunks = splitForTTS(text);
  return chunks.reduce((sum, chunk) => sum + estimateDuration(chunk), 0);
}

/**
 * Check if TTS is available
 */
export function isTTSAvailable(): boolean {
  return isElevenLabsConfigured();
}

// ============================================================================
// Integration Helper for Chat Route
// ============================================================================

/**
 * Create a TTS processor for use in chat routes
 * Handles the streaming pattern with SSE events
 */
export function createTTSProcessor(
  sendEvent: (event: string, data: unknown) => void,
  options: TTSOptions = {}
) {
  let chunksSent = 0;

  return {
    /**
     * Process text and send audio events as chunks complete
     */
    async processText(text: string): Promise<void> {
      if (!isTTSAvailable()) {
        console.warn('[TTSProcessor] TTS not available');
        return;
      }

      const chunks = splitForTTS(text);

      await generateParallelTTS(chunks, options, {
        onChunkReady: (chunk) => {
          sendEvent('audio_chunk', {
            audio: chunk.audio,
            index: chunk.index,
            isFinal: chunk.isFinal,
            text: chunk.text,
          });
          chunksSent++;
        },
        onError: (error, index) => {
          console.error(`[TTSProcessor] Error on chunk ${index}:`, error.message);
        },
      });
    },

    /**
     * Process a single sentence/chunk immediately
     * Useful for acknowledgments or short responses
     */
    async processSingle(text: string): Promise<string | null> {
      if (!isTTSAvailable()) return null;

      try {
        const audio = await generateSpeech(text, { voiceId: options.voiceId || 'rachel' });
        sendEvent('audio_chunk', {
          audio,
          index: -1, // Indicate single/acknowledgment
          isFinal: true,
          text,
        });
        return audio;
      } catch (err) {
        console.error('[TTSProcessor] Single chunk error:', err);
        return null;
      }
    },

    /**
     * Get stats
     */
    getStats() {
      return { chunksSent };
    },
  };
}
