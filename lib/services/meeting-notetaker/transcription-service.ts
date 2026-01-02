/**
 * Transcription Service
 *
 * Handles audio transcription using Deepgram API with speaker diarization.
 * Supports custom words for improved accuracy on domain-specific terms.
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  TranscriptionResult,
  TranscriptSegment,
  SpeakerProfile,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

interface DeepgramConfig {
  model: string;
  language: string;
  diarize: boolean;
  punctuate: boolean;
  smart_format: boolean;
  utterances: boolean;
  keywords?: Array<{ keyword: string; intensifier: number }>;
}

const DEFAULT_CONFIG: DeepgramConfig = {
  model: 'nova-2',
  language: 'en',
  diarize: true,
  punctuate: true,
  smart_format: true,
  utterances: true,
};

// ============================================================================
// Main Transcription Function
// ============================================================================

/**
 * Transcribe audio file using Deepgram API
 *
 * @param audioUrl - URL to the audio file (S3, Supabase Storage, etc.)
 * @param customWords - User-defined vocabulary for improved accuracy
 * @param options - Additional transcription options
 * @returns Transcription result with segments and speaker profiles
 */
export async function transcribeAudio(
  audioUrl: string,
  customWords: string[] = [],
  options?: {
    language?: string;
    enableDiarization?: boolean;
  }
): Promise<TranscriptionResult> {
  const { language = 'en', enableDiarization = true } = options || {};

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error('[TranscriptionService] DEEPGRAM_API_KEY not configured');
    return { success: false, error: 'Transcription service not configured' };
  }

  // Build config with custom words as keywords
  const config: DeepgramConfig = {
    ...DEFAULT_CONFIG,
    language,
    diarize: enableDiarization,
  };

  // Add custom words as keywords with boost
  if (customWords.length > 0) {
    config.keywords = customWords.map((word) => ({
      keyword: word,
      intensifier: 2, // Boost these words in recognition
    }));
  }

  try {
    console.log('[TranscriptionService] Starting transcription for:', audioUrl);

    const response = await fetch(
      `https://api.deepgram.com/v1/listen?${buildQueryParams(config)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: audioUrl }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TranscriptionService] Deepgram API error:', response.status, errorText);
      return {
        success: false,
        error: `Transcription failed: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    // Parse the Deepgram response
    const segments = parseDeepgramSegments(result);
    const speakers = extractSpeakerProfiles(segments);
    const fullText = extractFullTranscript(result);
    const confidence = extractOverallConfidence(result);
    const detectedLanguage = result.results?.channels?.[0]?.detected_language || language;

    // Apply custom word corrections as post-processing
    const correctedText = applyCustomWordCorrections(fullText, customWords);
    const correctedSegments = applySegmentCorrections(segments, customWords);

    console.log('[TranscriptionService] Transcription complete:', {
      duration: result.metadata?.duration,
      speakers: speakers.length,
      segments: segments.length,
      confidence,
    });

    return {
      success: true,
      transcript: {
        fullText: correctedText,
        segments: correctedSegments,
        speakers,
        detectedLanguage,
        overallConfidence: confidence,
      },
    };
  } catch (error) {
    console.error('[TranscriptionService] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown transcription error',
    };
  }
}

// ============================================================================
// Custom Words
// ============================================================================

/**
 * Get custom words for a user from the database
 */
export async function getCustomWordsForUser(
  userEmail: string,
  userCode?: string
): Promise<string[]> {
  try {
    const supabase = createAdminClient();

    let query = supabase
      .from('meeting_custom_words')
      .select('word')
      .limit(100);

    if (userCode) {
      query = query.or(`user_email.eq.${userEmail},user_code.eq.${userCode}`);
    } else {
      query = query.eq('user_email', userEmail);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[TranscriptionService] Error fetching custom words:', error);
      return [];
    }

    return data?.map((row) => row.word) || [];
  } catch (error) {
    console.error('[TranscriptionService] Exception fetching custom words:', error);
    return [];
  }
}

/**
 * Add a custom word for a user
 */
export async function addCustomWord(
  userEmail: string,
  word: string,
  category?: string,
  userCode?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from('meeting_custom_words').upsert(
      {
        user_email: userEmail,
        user_code: userCode,
        word,
        category,
      },
      { onConflict: 'user_email,word' }
    );

    if (error) {
      console.error('[TranscriptionService] Error adding custom word:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[TranscriptionService] Exception adding custom word:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a custom word for a user
 */
export async function deleteCustomWord(
  userEmail: string,
  word: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('meeting_custom_words')
      .delete()
      .eq('user_email', userEmail)
      .eq('word', word);

    if (error) {
      console.error('[TranscriptionService] Error deleting custom word:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[TranscriptionService] Exception deleting custom word:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildQueryParams(config: DeepgramConfig): string {
  const params = new URLSearchParams();
  params.set('model', config.model);
  params.set('language', config.language);
  params.set('diarize', String(config.diarize));
  params.set('punctuate', String(config.punctuate));
  params.set('smart_format', String(config.smart_format));
  params.set('utterances', String(config.utterances));

  if (config.keywords) {
    config.keywords.forEach((kw) => {
      params.append('keywords', `${kw.keyword}:${kw.intensifier}`);
    });
  }

  return params.toString();
}

function parseDeepgramSegments(result: any): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Use utterances if available (better speaker grouping)
  const utterances = result.results?.utterances;
  if (utterances && utterances.length > 0) {
    for (const utterance of utterances) {
      segments.push({
        startTime: utterance.start,
        endTime: utterance.end,
        speaker: `Speaker ${utterance.speaker}`,
        text: utterance.transcript,
        confidence: utterance.confidence,
        isFinal: true,
      });
    }
    return segments;
  }

  // Fall back to word-level parsing with speaker grouping
  const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  let currentSegment: TranscriptSegment | null = null;

  for (const word of words) {
    const speakerLabel = `Speaker ${word.speaker ?? 0}`;

    if (!currentSegment || currentSegment.speaker !== speakerLabel) {
      // Save previous segment
      if (currentSegment) {
        segments.push(currentSegment);
      }

      // Start new segment
      currentSegment = {
        startTime: word.start,
        endTime: word.end,
        speaker: speakerLabel,
        text: word.punctuated_word || word.word,
        confidence: word.confidence,
        isFinal: true,
      };
    } else {
      // Extend current segment
      currentSegment.text += ' ' + (word.punctuated_word || word.word);
      currentSegment.endTime = word.end;
      // Running average of confidence
      currentSegment.confidence =
        (currentSegment.confidence + word.confidence) / 2;
    }
  }

  // Don't forget the last segment
  if (currentSegment) {
    segments.push(currentSegment);
  }

  return segments;
}

function extractSpeakerProfiles(segments: TranscriptSegment[]): SpeakerProfile[] {
  const speakerMap = new Map<
    string,
    { wordCount: number; speakingTime: number }
  >();

  for (const segment of segments) {
    const existing = speakerMap.get(segment.speaker);
    const wordCount = segment.text.split(/\s+/).filter(Boolean).length;
    const duration = segment.endTime - segment.startTime;

    if (existing) {
      existing.wordCount += wordCount;
      existing.speakingTime += duration;
    } else {
      speakerMap.set(segment.speaker, {
        wordCount,
        speakingTime: duration,
      });
    }
  }

  return Array.from(speakerMap.entries()).map(([label, stats], index) => ({
    index,
    label,
    wordCount: stats.wordCount,
    speakingTimeSeconds: Math.round(stats.speakingTime),
  }));
}

function extractFullTranscript(result: any): string {
  // Try to get from alternatives first
  const transcript =
    result.results?.channels?.[0]?.alternatives?.[0]?.transcript;
  if (transcript) {
    return transcript;
  }

  // Fall back to concatenating utterances
  const utterances = result.results?.utterances;
  if (utterances) {
    return utterances.map((u: any) => u.transcript).join(' ');
  }

  return '';
}

function extractOverallConfidence(result: any): number {
  const confidence =
    result.results?.channels?.[0]?.alternatives?.[0]?.confidence;
  return confidence ?? 0;
}

function applyCustomWordCorrections(text: string, customWords: string[]): string {
  if (!customWords.length) return text;

  let corrected = text;

  for (const word of customWords) {
    // Generate common phonetic variations
    const variations = generatePhoneticVariations(word);

    for (const variation of variations) {
      // Case-insensitive replacement
      const regex = new RegExp(`\\b${escapeRegex(variation)}\\b`, 'gi');
      corrected = corrected.replace(regex, word);
    }
  }

  return corrected;
}

function applySegmentCorrections(
  segments: TranscriptSegment[],
  customWords: string[]
): TranscriptSegment[] {
  if (!customWords.length) return segments;

  return segments.map((segment) => ({
    ...segment,
    text: applyCustomWordCorrections(segment.text, customWords),
  }));
}

function generatePhoneticVariations(word: string): string[] {
  const variations = [word.toLowerCase()];

  // Add common phonetic variations
  // This is a simplified version - production would use a phonetic library

  // Handle common substitutions
  const lowerWord = word.toLowerCase();

  // "ie" vs "y" (e.g., "Moccet" might be heard as "Mockit")
  if (lowerWord.includes('e')) {
    variations.push(lowerWord.replace(/e/g, 'i'));
  }

  // Double consonants
  variations.push(lowerWord.replace(/(.)\1/g, '$1'));

  // "ck" vs "k"
  if (lowerWord.includes('ck')) {
    variations.push(lowerWord.replace(/ck/g, 'k'));
  }

  return [...new Set(variations)];
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
