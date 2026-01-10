/**
 * AI Wisdom Generator
 *
 * Generates personalized wisdom using RAG with the user's health context.
 * Uses the existing wisdom library as inspiration/knowledge base.
 *
 * @module lib/services/ai-wisdom-generator
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { WisdomCategory, WisdomEntry } from './wisdom-library-service';
import OpenAI from 'openai';

const logger = createLogger('AIWisdomGenerator');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Health context for wisdom generation
 */
export interface WisdomHealthContext {
  recovery?: number;
  strain?: number;
  hrv?: number;
  hrvTrend?: 'rising' | 'stable' | 'declining';
  sleepHours?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  readiness?: number;
  glucoseInRange?: number;
  stressLevel: 'low' | 'moderate' | 'high';
  energyLevel: 'low' | 'moderate' | 'high';
  recommendedFocus: WisdomCategory;
  recentPatterns?: string[]; // e.g., "sleep has been declining", "recovery improving"
  dayOfWeek?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
}

/**
 * Generated wisdom output
 */
export interface GeneratedWisdom {
  title: string;
  content: string;
  actionableTip: string;
  theme: string;
  category: WisdomCategory;
  inspiredBy: string[]; // Sources that inspired this wisdom
  personalizedFor: string[]; // Health factors it was personalized for
}

/**
 * System prompt for wisdom generation
 */
const WISDOM_SYSTEM_PROMPT = `You are a wise, warm health companion who generates personalized daily wisdom.

Your wisdom should be:
- PERSONALIZED: Directly reference the user's actual health metrics and patterns
- ACTIONABLE: Include specific, doable advice for today
- INSPIRING: Draw from timeless wisdom traditions, science, and great thinkers
- CONCISE: 2-3 sentences of wisdom, 1 sentence actionable tip
- WARM but not preachy: Like advice from a knowledgeable friend

You'll receive:
1. The user's current health context (metrics, energy, stress, patterns)
2. Relevant wisdom excerpts from our library for inspiration

Generate wisdom that weaves together their health state with timeless insights.

IMPORTANT RULES:
- Never be generic. Always reference their specific numbers or patterns.
- Never lecture or moralize. Be a supportive companion.
- Vary your style: sometimes philosophical, sometimes practical, sometimes motivational
- The actionable tip should be specific and doable TODAY
- Don't repeat the same advice patterns

Output JSON with this structure:
{
  "title": "Short, memorable title (3-6 words)",
  "content": "2-3 sentences of personalized wisdom",
  "actionableTip": "One specific action they can take today",
  "theme": "The main theme (e.g., rest, momentum, resilience, focus)",
  "personalizedFor": ["array", "of", "health factors used"]
}`;

/**
 * Get relevant wisdom entries from the library for RAG context
 */
async function getWisdomForRAG(
  category: WisdomCategory,
  energyLevel: 'low' | 'moderate' | 'high',
  stressLevel: 'low' | 'moderate' | 'high',
  limit: number = 5
): Promise<WisdomEntry[]> {
  const supabase = createAdminClient();

  // Build query based on context
  let query = supabase
    .from('wisdom_library')
    .select('*')
    .eq('is_active', true);

  // Get entries from the recommended category + some variety
  const { data: categoryEntries } = await query
    .eq('category', category)
    .order('avg_engagement', { ascending: false })
    .limit(3);

  // Get some from adjacent categories for variety
  const adjacentCategories = getAdjacentCategories(category, energyLevel, stressLevel);
  const { data: adjacentEntries } = await supabase
    .from('wisdom_library')
    .select('*')
    .eq('is_active', true)
    .in('category', adjacentCategories)
    .order('avg_engagement', { ascending: false })
    .limit(2);

  const allEntries = [...(categoryEntries || []), ...(adjacentEntries || [])];

  // Shuffle and return
  return shuffleArray(allEntries).slice(0, limit) as WisdomEntry[];
}

/**
 * Get adjacent categories based on context
 */
function getAdjacentCategories(
  primary: WisdomCategory,
  energyLevel: string,
  stressLevel: string
): WisdomCategory[] {
  const categoryMap: Record<WisdomCategory, WisdomCategory[]> = {
    self_development: ['productivity', 'life_advice'],
    fitness: ['self_development', 'cooking'],
    cooking: ['fitness', 'life_advice'],
    productivity: ['self_development', 'life_advice'],
    life_advice: ['self_development', 'productivity'],
  };

  // Adjust based on state
  if (energyLevel === 'low') {
    return ['self_development', 'life_advice']; // Rest-focused
  }
  if (stressLevel === 'high') {
    return ['self_development', 'life_advice']; // Calm-focused
  }

  return categoryMap[primary] || ['life_advice', 'self_development'];
}

/**
 * Build the prompt for wisdom generation
 */
function buildWisdomPrompt(
  healthContext: WisdomHealthContext,
  ragWisdom: WisdomEntry[]
): string {
  // Build health context section
  const healthLines: string[] = [];

  if (healthContext.recovery !== undefined) {
    const recoveryDesc =
      healthContext.recovery >= 67
        ? 'well-recovered'
        : healthContext.recovery >= 40
          ? 'moderately recovered'
          : 'under-recovered';
    healthLines.push(`Recovery: ${healthContext.recovery}% (${recoveryDesc})`);
  }

  if (healthContext.sleepHours !== undefined) {
    const sleepDesc =
      healthContext.sleepHours >= 7.5
        ? 'great sleep'
        : healthContext.sleepHours >= 6
          ? 'adequate sleep'
          : 'sleep deficit';
    healthLines.push(`Sleep: ${healthContext.sleepHours.toFixed(1)} hours (${sleepDesc})`);
  }

  if (healthContext.hrv !== undefined) {
    healthLines.push(
      `HRV: ${healthContext.hrv}ms${healthContext.hrvTrend ? ` (${healthContext.hrvTrend})` : ''}`
    );
  }

  if (healthContext.strain !== undefined) {
    healthLines.push(`Recent strain: ${healthContext.strain.toFixed(1)}`);
  }

  if (healthContext.readiness !== undefined) {
    healthLines.push(`Readiness score: ${healthContext.readiness}`);
  }

  if (healthContext.glucoseInRange !== undefined) {
    healthLines.push(`Glucose time in range: ${healthContext.glucoseInRange}%`);
  }

  healthLines.push(`Energy level: ${healthContext.energyLevel}`);
  healthLines.push(`Stress level: ${healthContext.stressLevel}`);

  if (healthContext.recentPatterns && healthContext.recentPatterns.length > 0) {
    healthLines.push(`Recent patterns: ${healthContext.recentPatterns.join(', ')}`);
  }

  if (healthContext.dayOfWeek) {
    healthLines.push(`Day: ${healthContext.dayOfWeek}`);
  }

  // Build RAG wisdom section
  const wisdomExamples = ragWisdom
    .map(
      (w, i) =>
        `${i + 1}. "${w.title}" (${w.source}): ${w.content}${w.actionable_tip ? `\n   Tip: ${w.actionable_tip}` : ''}`
    )
    .join('\n\n');

  return `## User's Health Context Today

${healthLines.join('\n')}

## Wisdom Library Examples (for inspiration, don't copy directly)

${wisdomExamples}

---

Generate personalized wisdom that:
1. References their specific metrics (e.g., "With ${healthContext.recovery}% recovery..." or "After ${healthContext.sleepHours?.toFixed(1)} hours of sleep...")
2. Draws inspiration from the themes above but creates something fresh
3. Fits their current state (${healthContext.energyLevel} energy, ${healthContext.stressLevel} stress)
4. Includes an actionable tip they can actually do today

Remember: Be a wise friend, not a lecturer.`;
}

/**
 * Generate personalized wisdom using AI
 */
export async function generatePersonalizedWisdom(
  healthContext: WisdomHealthContext
): Promise<GeneratedWisdom | null> {
  try {
    logger.info('Generating personalized wisdom', {
      category: healthContext.recommendedFocus,
      energyLevel: healthContext.energyLevel,
      stressLevel: healthContext.stressLevel,
    });

    // Step 1: Get relevant wisdom from library for RAG
    const ragWisdom = await getWisdomForRAG(
      healthContext.recommendedFocus,
      healthContext.energyLevel,
      healthContext.stressLevel,
      5
    );

    if (ragWisdom.length === 0) {
      logger.warn('No wisdom found in library for RAG');
      // Continue anyway - AI can still generate without examples
    }

    // Step 2: Build the prompt
    const userPrompt = buildWisdomPrompt(healthContext, ragWisdom);

    // Step 3: Generate with AI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: WISDOM_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85, // High creativity
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      logger.error('Empty response from AI');
      return null;
    }

    const generated = JSON.parse(content);

    // Validate required fields
    if (!generated.title || !generated.content || !generated.actionableTip) {
      logger.error('Invalid AI response structure', { generated });
      return null;
    }

    const result: GeneratedWisdom = {
      title: generated.title,
      content: generated.content,
      actionableTip: generated.actionableTip,
      theme: generated.theme || healthContext.recommendedFocus,
      category: healthContext.recommendedFocus,
      inspiredBy: ragWisdom.map((w) => w.source),
      personalizedFor: generated.personalizedFor || [],
    };

    logger.info('Generated personalized wisdom', {
      title: result.title,
      theme: result.theme,
      inspiredBy: result.inspiredBy,
      personalizedFor: result.personalizedFor,
    });

    return result;
  } catch (error) {
    logger.error('Error generating wisdom', { error });
    return null;
  }
}

/**
 * Store generated wisdom for analytics/learning
 */
export async function storeGeneratedWisdom(
  email: string,
  wisdom: GeneratedWisdom,
  healthContext: WisdomHealthContext
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('generated_wisdom_history')
      .insert({
        user_email: email,
        title: wisdom.title,
        content: wisdom.content,
        actionable_tip: wisdom.actionableTip,
        theme: wisdom.theme,
        category: wisdom.category,
        inspired_by: wisdom.inspiredBy,
        personalized_for: wisdom.personalizedFor,
        health_context: {
          recovery: healthContext.recovery,
          sleepHours: healthContext.sleepHours,
          hrv: healthContext.hrv,
          energyLevel: healthContext.energyLevel,
          stressLevel: healthContext.stressLevel,
        },
        generated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      // Table might not exist yet
      logger.warn('Could not store generated wisdom', { error: error.message });
      return null;
    }

    return data?.id || null;
  } catch (error) {
    logger.warn('Error storing generated wisdom', { error });
    return null;
  }
}

/**
 * Update engagement for generated wisdom (for learning)
 */
export async function updateWisdomEngagement(
  wisdomId: string,
  signal: 'like' | 'share' | 'save' | 'dismiss'
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const engagementScore =
      signal === 'like' ? 3 : signal === 'share' ? 10 : signal === 'save' ? 5 : -1;

    await supabase
      .from('generated_wisdom_history')
      .update({
        engagement_signal: signal,
        engagement_score: engagementScore,
        engaged_at: new Date().toISOString(),
      })
      .eq('id', wisdomId);
  } catch (error) {
    logger.warn('Error updating wisdom engagement', { error });
  }
}

// Utility functions
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const AIWisdomGenerator = {
  generate: generatePersonalizedWisdom,
  store: storeGeneratedWisdom,
  updateEngagement: updateWisdomEngagement,
};
