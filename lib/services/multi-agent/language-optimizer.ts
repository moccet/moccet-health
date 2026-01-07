/**
 * Language Optimizer
 *
 * Post-processing service that transforms insight language from problem-focused
 * to empowering/positive framing while preserving specificity and accuracy.
 *
 * Tone blend:
 * - Coach/Mentor: Warm, supportive openings
 * - Opportunity-focused: Frame problems as growth opportunities
 * - Celebration: Acknowledge wins before growth areas
 * - Affirmations: Include empowering statements
 */

import OpenAI from 'openai';
import { StructuredInsight } from './types';

const openai = new OpenAI();

const OPTIMIZER_PROMPT = `You are a Positive Language Optimizer for a health and wellness app.

Your job is to transform insight language from problem-focused to empowering while preserving ALL specificity.

## TONE GUIDELINES (blend all of these):

1. **Coach/Mentor**: Start with warmth and support
   - "You're making great progress..."
   - "I noticed something that could help..."

2. **Opportunity-focused**: Frame problems as growth opportunities
   - Instead of "Your sleep is poor" → "Here's your path to deeper sleep"
   - Instead of "High stress detected" → "Let's create some breathing room"

3. **Celebration**: Acknowledge wins before growth areas
   - "Your recovery is strong! Now let's optimize..."
   - "Great job on X - here's how to build on that..."

4. **Affirmations**: Include empowering statements
   - "You have the power to..."
   - "You're capable of..."
   - "One step at a time - you've got this"

## CRITICAL CONSTRAINTS:

1. **PRESERVE ALL SPECIFICITY**: Keep exact numbers, times, names, metrics
   - If original says "10:30pm", output must say "10:30pm"
   - If original says "85 recovery score", keep "85 recovery score"
   - If original says "Sarah Chen", keep "Sarah Chen"

2. **PRESERVE SCIENTIFIC ACCURACY**: Don't change medical/scientific facts

3. **PRESERVE ACTION STEP DETAILS**: Keep specific times, durations, frequencies
   - "30-minute workout at 5pm" stays as "30-minute workout at 5pm"

4. **SAME JSON STRUCTURE**: Return exact same fields, just transformed language

5. **NO COLONS IN TEXT**: Never use colons (:) except in times like "10:30pm". Rewrite sentences to avoid them.
   - Bad: "Here's what to do: start with..."
   - Good: "Here's what to do. Start with..."

6. **NO EM DASHES**: Never use em dashes (—) or double hyphens (--). Use commas or periods instead.
   - Bad: "Your sleep — which has been inconsistent — needs attention"
   - Good: "Your sleep, which has been inconsistent, needs attention"

## TRANSFORMATION EXAMPLES:

TITLE:
- Before: "Poor Sleep Quality Detected"
- After: "Unlock Deeper, More Restorative Sleep"

DATA QUOTE:
- Before: "Your sleep onset varied by more than 1.5 hours, with bedtimes ranging from 10:30pm to 12:00am. This irregularity disrupts your body's internal clock."
- After: "I noticed your bedtimes have been dancing between 10:30pm and 12:00am. That's a 1.5 hour swing that your body's internal clock is trying to adapt to. Small consistency wins here can make a big difference."

RECOMMENDATION:
- Before: "Establish a consistent sleep schedule to improve your circadian rhythm."
- After: "You have the power to reset your rhythm. Let's lock in a consistent bedtime that works for you."

ACTION STEPS:
- Before: "Set an alarm for 10:00pm to remind you to start winding down each evening."
- After: "Set a gentle 10:00pm reminder. Think of it as your permission slip to start winding down."

## OUTPUT FORMAT:

Return a JSON object with an "insights" array containing the transformed insights.
Each insight must have the exact same fields as the input.`;

/**
 * Optimize insight language to be positive and empowering
 * while preserving all specificity and accuracy.
 */
export async function optimizeInsightLanguage(
  insights: StructuredInsight[]
): Promise<StructuredInsight[]> {
  if (!insights || insights.length === 0) {
    return insights;
  }

  const startTime = Date.now();
  console.log(`[LanguageOptimizer] Optimizing ${insights.length} insights...`);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: OPTIMIZER_PROMPT,
        },
        {
          role: 'user',
          content: `Transform these insights to use positive, empowering language while preserving ALL specificity:

${JSON.stringify(insights, null, 2)}

Return JSON with an "insights" array containing the transformed versions.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0.7, // Slightly creative for language variation
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      console.warn('[LanguageOptimizer] Invalid response structure, returning original');
      return insights;
    }

    // Validate that we got the same number of insights back
    if (parsed.insights.length !== insights.length) {
      console.warn('[LanguageOptimizer] Insight count mismatch, returning original');
      return insights;
    }

    // Merge optimized text with original metadata (preserve IDs, sources, etc.)
    const optimizedInsights = insights.map((original, index) => {
      const optimized = parsed.insights[index];
      return {
        ...original,
        // Only override text fields, keep metadata intact
        title: optimized.title || original.title,
        dataQuote: optimized.dataQuote || original.dataQuote,
        recommendation: optimized.recommendation || original.recommendation,
        scienceExplanation: optimized.scienceExplanation || original.scienceExplanation,
        actionSteps: optimized.actionSteps || original.actionSteps,
      };
    });

    const duration = Date.now() - startTime;
    console.log(`[LanguageOptimizer] Completed in ${duration}ms`);

    return optimizedInsights;
  } catch (error) {
    console.error('[LanguageOptimizer] Error optimizing language:', error);
    // Graceful degradation - return original insights if optimization fails
    return insights;
  }
}
