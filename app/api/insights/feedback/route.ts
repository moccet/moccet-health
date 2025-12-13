/**
 * Insight Feedback Endpoint
 *
 * Receives user feedback on insights and extracts learnable facts
 * to improve future personalization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/insights/feedback
 *
 * Save user feedback on an insight and extract learnable facts.
 *
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "insightId": "insight_123",
 *   "insightTitle": "You're sleeping late",
 *   "insightCategory": "Sleep",
 *   "feedback": "I work night shifts"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, insightId, insightTitle, insightCategory, feedback } = body;

    if (!email || !feedback) {
      return NextResponse.json(
        { error: 'email and feedback are required' },
        { status: 400 }
      );
    }

    console.log(`[Insight Feedback] Processing feedback from ${email}`);
    console.log(`[Insight Feedback] Insight: "${insightTitle}" (${insightCategory})`);
    console.log(`[Insight Feedback] Feedback: "${feedback}"`);

    // Save the raw feedback
    await supabase.from('insight_feedback').insert({
      user_email: email,
      insight_id: insightId,
      insight_title: insightTitle,
      insight_category: insightCategory,
      feedback_text: feedback,
      created_at: new Date().toISOString(),
    });

    // Use AI to extract learnable facts from the feedback
    const extractedFacts = await extractFactsFromFeedback(
      feedback,
      insightTitle,
      insightCategory
    );

    console.log(`[Insight Feedback] Extracted ${extractedFacts.length} facts`);

    // Save each extracted fact to user_learned_facts
    for (const fact of extractedFacts) {
      await supabase.from('user_learned_facts').upsert(
        {
          user_email: email,
          category: fact.category,
          fact_key: fact.key,
          fact_value: fact.value,
          confidence: fact.confidence,
          source: `insight_feedback:${insightId || 'unknown'}`,
          learned_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_email,category,fact_key',
        }
      );
    }

    // Also mark the insight as "not applicable" if relevant
    if (insightId) {
      await supabase.from('user_insight_dismissals').upsert(
        {
          user_email: email,
          insight_id: insightId,
          reason: feedback,
          dismissed_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_email,insight_id',
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback received and processed',
      factsLearned: extractedFacts.length,
      facts: extractedFacts,
    });
  } catch (error) {
    console.error('Error processing insight feedback:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}

/**
 * Extract learnable facts from user feedback using AI
 */
async function extractFactsFromFeedback(
  feedback: string,
  insightTitle: string,
  insightCategory: string
): Promise<Array<{ category: string; key: string; value: string; confidence: number }>> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an AI that extracts learnable facts from user feedback about health insights.

The user was shown an insight about "${insightTitle}" (category: ${insightCategory}) and provided feedback explaining why it may not apply to them or providing context.

Extract any facts we should remember about this user. Return a JSON array of objects with:
- category: one of "schedule", "medical", "lifestyle", "preference", "constraint", "goal", "dietary", "supplement", "other"
- key: a short snake_case identifier for the fact
- value: the human-readable fact we learned
- confidence: 0.7-1.0 based on how certain this fact is

Examples of facts to extract:
- "I work night shifts" → {category: "schedule", key: "works_night_shifts", value: "Works night shift schedule", confidence: 0.9}
- "I have a deadline" → {category: "schedule", key: "temporary_deadline", value: "Currently has work deadline (temporary)", confidence: 0.7}
- "I'm pregnant" → {category: "medical", key: "pregnancy", value: "Currently pregnant", confidence: 0.95}
- "I'm vegan" → {category: "dietary", key: "vegan", value: "Follows vegan diet", confidence: 0.9}
- "Already taking vitamin D" → {category: "supplement", key: "takes_vitamin_d", value: "Already supplementing with Vitamin D", confidence: 0.85}

Return ONLY valid JSON array. If no clear facts can be extracted, return [].`
        },
        {
          role: 'user',
          content: feedback
        }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '[]';

    // Parse the JSON response
    let facts = [];
    try {
      // Clean up the response if it has markdown code blocks
      let cleaned = content.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      facts = JSON.parse(cleaned);
    } catch (parseError) {
      console.warn('Failed to parse AI response:', content);
      facts = [];
    }

    // Validate the facts array
    if (!Array.isArray(facts)) {
      facts = [];
    }

    return facts.filter(
      (f: any) =>
        f.category &&
        f.key &&
        f.value &&
        typeof f.confidence === 'number' &&
        f.confidence >= 0.5 &&
        f.confidence <= 1.0
    );
  } catch (error) {
    console.error('Error extracting facts:', error);
    return [];
  }
}
