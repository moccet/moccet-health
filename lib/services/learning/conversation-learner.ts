/**
 * Conversation Learner Service
 * Automatically extracts learnable facts from user conversations
 * and updates the user's knowledge profile.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// =============================================================================
// TYPES
// =============================================================================

export type FactCategory =
  | 'preference'      // User preferences (likes/dislikes)
  | 'constraint'      // Things they can't/won't do
  | 'medical'         // Health conditions, medications
  | 'lifestyle'       // Daily routines, habits
  | 'dietary'         // Food-related facts
  | 'schedule'        // Work schedule, availability
  | 'goal'            // Stated goals and intentions
  | 'supplement'      // Supplements they take
  | 'allergy'         // Allergies and intolerances
  | 'equipment'       // Equipment they have access to
  | 'social'          // Social preferences
  | 'other';

export interface ExtractedFact {
  fact: string;
  category: FactCategory;
  confidence: number;          // 0-1
  sourceMessageId?: string;
  sourceText: string;          // The text that led to this extraction
  isNegation: boolean;         // "I don't like X" vs "I like X"
}

export interface StoredFact {
  id: string;
  userEmail: string;
  factKey: string;             // Normalized key for deduplication
  factValue: string;           // The actual fact
  category: FactCategory;
  confidence: number;
  source: 'conversation' | 'onboarding' | 'feedback' | 'explicit';
  sourceMessageId?: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;           // Can be "unlearned"
}

export interface ConversationMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface LearningResult {
  factsExtracted: ExtractedFact[];
  factsStored: number;
  factsUpdated: number;
  factsSkipped: number;        // Low confidence or duplicates
}

// =============================================================================
// FACT EXTRACTION PATTERNS
// =============================================================================

// Regex patterns for rule-based extraction (fast, no LLM needed)
const EXTRACTION_PATTERNS: Array<{
  pattern: RegExp;
  category: FactCategory;
  extractor: (match: RegExpMatchArray) => { fact: string; isNegation: boolean } | null;
  confidence: number;
}> = [
  // Dietary patterns
  {
    pattern: /i('m| am) (vegan|vegetarian|pescatarian|keto|paleo|gluten[ -]free|dairy[ -]free|lactose intolerant)/i,
    category: 'dietary',
    extractor: (m) => ({ fact: `follows_${m[2].toLowerCase().replace(/[ -]/g, '_')}_diet`, isNegation: false }),
    confidence: 0.95,
  },
  {
    pattern: /i (can't|cannot|don't|do not|won't|never) eat (\w+(?:\s+\w+)?)/i,
    category: 'dietary',
    extractor: (m) => ({ fact: `cannot_eat_${m[2].toLowerCase()}`, isNegation: true }),
    confidence: 0.9,
  },
  {
    pattern: /i('m| am) allergic to (\w+(?:\s+\w+)?)/i,
    category: 'allergy',
    extractor: (m) => ({ fact: `allergic_to_${m[2].toLowerCase()}`, isNegation: false }),
    confidence: 0.95,
  },
  {
    pattern: /i have (?:a |an )?(\w+) allergy/i,
    category: 'allergy',
    extractor: (m) => ({ fact: `allergic_to_${m[1].toLowerCase()}`, isNegation: false }),
    confidence: 0.9,
  },

  // Medical patterns
  {
    pattern: /i have (diabetes|type [12] diabetes|hypertension|high blood pressure|hypothyroidism|hyperthyroidism|ibs|crohn'?s?|celiac)/i,
    category: 'medical',
    extractor: (m) => ({ fact: `has_condition_${m[1].toLowerCase().replace(/[' ]/g, '_')}`, isNegation: false }),
    confidence: 0.95,
  },
  {
    pattern: /i('m| am) on (\w+(?:\s+\w+)?)(?: medication)?/i,
    category: 'medical',
    extractor: (m) => {
      const med = m[2].toLowerCase();
      // Filter out non-medication phrases
      if (['a diet', 'the go', 'my way', 'vacation', 'a trip'].includes(med)) return null;
      return { fact: `takes_medication_${med}`, isNegation: false };
    },
    confidence: 0.7,
  },
  {
    pattern: /i take (\w+)(?: for (\w+))?/i,
    category: 'supplement',
    extractor: (m) => {
      const item = m[1].toLowerCase();
      // Filter common non-supplements
      if (['care', 'time', 'breaks', 'naps', 'walks'].includes(item)) return null;
      return { fact: `takes_${item}`, isNegation: false };
    },
    confidence: 0.6,
  },

  // Schedule patterns
  {
    pattern: /i (work|start work|finish work|get off work) (?:at |around )?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    category: 'schedule',
    extractor: (m) => ({ fact: `${m[1].replace(/ /g, '_')}_at_${m[2].toLowerCase()}`, isNegation: false }),
    confidence: 0.85,
  },
  {
    pattern: /i work (\w+(?:\s+to\s+\w+)?)/i,
    category: 'schedule',
    extractor: (m) => {
      const schedule = m[1].toLowerCase();
      if (['out', 'hard', 'well'].includes(schedule)) return null;
      return { fact: `work_schedule_${schedule}`, isNegation: false };
    },
    confidence: 0.7,
  },
  {
    pattern: /i('m| am) a (night owl|morning person|early riser|late sleeper)/i,
    category: 'lifestyle',
    extractor: (m) => ({ fact: `chronotype_${m[2].toLowerCase().replace(/ /g, '_')}`, isNegation: false }),
    confidence: 0.9,
  },

  // Preference patterns
  {
    pattern: /i (prefer|like|love|enjoy) (\w+(?:\s+\w+)?)/i,
    category: 'preference',
    extractor: (m) => ({ fact: `prefers_${m[2].toLowerCase().replace(/ /g, '_')}`, isNegation: false }),
    confidence: 0.7,
  },
  {
    pattern: /i (don't like|hate|dislike|can't stand) (\w+(?:\s+\w+)?)/i,
    category: 'preference',
    extractor: (m) => ({ fact: `dislikes_${m[2].toLowerCase().replace(/ /g, '_')}`, isNegation: true }),
    confidence: 0.75,
  },

  // Constraint patterns
  {
    pattern: /i (can't|cannot|don't have access to|don't have) (?:a |an )?(\w+(?:\s+\w+)?)/i,
    category: 'constraint',
    extractor: (m) => {
      const item = m[2].toLowerCase();
      if (['time', 'idea', 'clue', 'problem'].includes(item)) return null;
      return { fact: `no_access_to_${item.replace(/ /g, '_')}`, isNegation: true };
    },
    confidence: 0.7,
  },
  {
    pattern: /i have (?:a |an )?(\w+(?:\s+\w+)?) at home/i,
    category: 'equipment',
    extractor: (m) => ({ fact: `has_${m[1].toLowerCase().replace(/ /g, '_')}`, isNegation: false }),
    confidence: 0.8,
  },

  // Goal patterns
  {
    pattern: /i want to (lose|gain|maintain|improve|increase|decrease|build|get) (\w+(?:\s+\w+)?)/i,
    category: 'goal',
    extractor: (m) => ({ fact: `goal_${m[1]}_${m[2].toLowerCase().replace(/ /g, '_')}`, isNegation: false }),
    confidence: 0.8,
  },
  {
    pattern: /my goal is to (\w+(?:\s+\w+)?)/i,
    category: 'goal',
    extractor: (m) => ({ fact: `goal_${m[1].toLowerCase().replace(/ /g, '_')}`, isNegation: false }),
    confidence: 0.85,
  },

  // Social patterns
  {
    pattern: /i (live alone|live with|have a partner|am single|am married)/i,
    category: 'social',
    extractor: (m) => ({ fact: `${m[1].toLowerCase().replace(/ /g, '_')}`, isNegation: false }),
    confidence: 0.85,
  },
];

// =============================================================================
// RULE-BASED EXTRACTION
// =============================================================================

/**
 * Extract facts using pattern matching (fast, no LLM)
 */
function extractFactsWithPatterns(message: string): ExtractedFact[] {
  const facts: ExtractedFact[] = [];

  for (const { pattern, category, extractor, confidence } of EXTRACTION_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const result = extractor(match);
      if (result) {
        facts.push({
          fact: result.fact,
          category,
          confidence,
          sourceText: match[0],
          isNegation: result.isNegation,
        });
      }
    }
  }

  return facts;
}

// =============================================================================
// LLM-BASED EXTRACTION
// =============================================================================

const EXTRACTION_PROMPT = `You are analyzing a user message to extract learnable facts about them.

Extract ONLY concrete, specific facts that would be useful for personalizing health and wellness recommendations.

Categories:
- preference: Likes/dislikes (e.g., "prefers morning workouts")
- constraint: Things they can't/won't do (e.g., "can't do high-impact exercise")
- medical: Health conditions, medications (e.g., "has type 2 diabetes")
- lifestyle: Daily routines, habits (e.g., "works night shifts")
- dietary: Food-related (e.g., "is vegetarian")
- schedule: Work/availability (e.g., "works 9-5")
- goal: Stated goals (e.g., "wants to lose 10 pounds")
- supplement: Supplements taken (e.g., "takes vitamin D")
- allergy: Allergies (e.g., "allergic to shellfish")
- equipment: Equipment access (e.g., "has a treadmill at home")
- social: Social situation (e.g., "lives alone")

Rules:
1. Only extract EXPLICIT facts stated by the user
2. Don't infer or assume
3. Assign confidence 0.6-1.0 based on how explicit the statement is
4. Skip vague or ambiguous statements
5. Return empty array if no clear facts

User message: "{message}"

Respond with a JSON array:
[
  {
    "fact": "short_key_style_fact",
    "value": "Human readable description",
    "category": "category_name",
    "confidence": 0.8,
    "source_text": "the exact phrase from the message"
  }
]

Only return the JSON array, nothing else.`;

/**
 * Extract facts using LLM (more thorough, for important messages)
 */
async function extractFactsWithLLM(
  message: string,
  openai: OpenAI
): Promise<ExtractedFact[]> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT.replace('{message}', message),
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim() || '[]';

    // Parse JSON response
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => ({
      fact: item.fact || item.value,
      category: item.category as FactCategory,
      confidence: item.confidence || 0.7,
      sourceText: item.source_text || message,
      isNegation: item.fact?.includes('not_') || item.fact?.includes('no_') || false,
    }));
  } catch (error) {
    console.error('[ConversationLearner] LLM extraction failed:', error);
    return [];
  }
}

// =============================================================================
// FACT STORAGE
// =============================================================================

/**
 * Normalize a fact key for deduplication
 */
function normalizeFactKey(fact: string, category: FactCategory): string {
  return `${category}:${fact.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;
}

/**
 * Store extracted facts in the database
 */
async function storeFacts(
  userEmail: string,
  facts: ExtractedFact[],
  supabase: ReturnType<typeof createClient>
): Promise<{ stored: number; updated: number; skipped: number }> {
  let stored = 0;
  let updated = 0;
  let skipped = 0;

  for (const fact of facts) {
    // Skip low confidence facts
    if (fact.confidence < 0.6) {
      skipped++;
      continue;
    }

    const factKey = normalizeFactKey(fact.fact, fact.category);

    // Check if fact already exists
    const { data: existing } = await supabase
      .from('user_learned_facts')
      .select('id, confidence')
      .eq('user_email', userEmail)
      .eq('fact_key', factKey)
      .maybeSingle();

    if (existing) {
      // Update if new confidence is higher
      if (fact.confidence > (existing as any).confidence) {
        await (supabase.from('user_learned_facts') as any)
          .update({
            fact_value: fact.fact,
            confidence: fact.confidence,
            updated_at: new Date().toISOString(),
          })
          .eq('id', (existing as any).id);
        updated++;
      } else {
        skipped++;
      }
    } else {
      // Insert new fact
      await (supabase.from('user_learned_facts') as any).insert({
        id: crypto.randomUUID(),
        user_email: userEmail,
        fact_key: factKey,
        fact_value: fact.fact,
        category: fact.category,
        confidence: fact.confidence,
        source: 'conversation',
        source_text: fact.sourceText,
        is_negation: fact.isNegation,
        learned_at: new Date().toISOString(),
        is_active: true,
      });
      stored++;
    }
  }

  return { stored, updated, skipped };
}

// =============================================================================
// MAIN LEARNING FUNCTIONS
// =============================================================================

/**
 * Learn from a single user message (rule-based only, fast)
 */
export async function learnFromMessage(
  userEmail: string,
  message: string,
  messageId: string | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<LearningResult> {
  // Extract facts using patterns
  const facts = extractFactsWithPatterns(message);

  if (facts.length === 0) {
    return {
      factsExtracted: [],
      factsStored: 0,
      factsUpdated: 0,
      factsSkipped: 0,
    };
  }

  // Add message ID to facts
  facts.forEach(f => f.sourceMessageId = messageId);

  // Store facts
  const { stored, updated, skipped } = await storeFacts(userEmail, facts, supabase);

  return {
    factsExtracted: facts,
    factsStored: stored,
    factsUpdated: updated,
    factsSkipped: skipped,
  };
}

/**
 * Learn from a conversation (with LLM extraction for important messages)
 */
export async function learnFromConversation(
  userEmail: string,
  messages: ConversationMessage[],
  supabase: ReturnType<typeof createClient>,
  openai: OpenAI,
  options: {
    useLLM?: boolean;
    minMessageLength?: number;
  } = {}
): Promise<LearningResult> {
  const { useLLM = true, minMessageLength = 20 } = options;

  const allFacts: ExtractedFact[] = [];
  let totalStored = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  // Filter to user messages only
  const userMessages = messages.filter(m =>
    m.role === 'user' && m.content.length >= minMessageLength
  );

  for (const message of userMessages) {
    // First, try rule-based extraction (fast)
    const patternFacts = extractFactsWithPatterns(message.content);
    allFacts.push(...patternFacts);

    // If LLM enabled and message is substantial, try LLM extraction
    if (useLLM && message.content.length > 50 && patternFacts.length === 0) {
      const llmFacts = await extractFactsWithLLM(message.content, openai);
      allFacts.push(...llmFacts);
    }
  }

  // Deduplicate facts by key
  const uniqueFacts = new Map<string, ExtractedFact>();
  for (const fact of allFacts) {
    const key = normalizeFactKey(fact.fact, fact.category);
    const existing = uniqueFacts.get(key);
    if (!existing || fact.confidence > existing.confidence) {
      uniqueFacts.set(key, fact);
    }
  }

  const factsToStore = Array.from(uniqueFacts.values());

  // Store facts
  const { stored, updated, skipped } = await storeFacts(userEmail, factsToStore, supabase);

  return {
    factsExtracted: factsToStore,
    factsStored: stored,
    factsUpdated: updated,
    factsSkipped: skipped,
  };
}

// =============================================================================
// FACT MANAGEMENT
// =============================================================================

/**
 * Get all active learned facts for a user
 */
export async function getLearnedFacts(
  userEmail: string,
  supabase: ReturnType<typeof createClient>,
  options: {
    category?: FactCategory;
    minConfidence?: number;
  } = {}
): Promise<StoredFact[]> {
  let query = supabase
    .from('user_learned_facts')
    .select('*')
    .eq('user_email', userEmail)
    .eq('is_active', true);

  if (options.category) {
    query = query.eq('category', options.category);
  }

  if (options.minConfidence) {
    query = query.gte('confidence', options.minConfidence);
  }

  const { data } = await query.order('confidence', { ascending: false });

  return ((data as any[]) || []).map(row => ({
    id: row.id,
    userEmail: row.user_email,
    factKey: row.fact_key,
    factValue: row.fact_value,
    category: row.category,
    confidence: row.confidence,
    source: row.source,
    sourceMessageId: row.source_message_id,
    createdAt: row.learned_at,
    updatedAt: row.updated_at || row.learned_at,
    isActive: row.is_active,
  }));
}

/**
 * Deactivate a learned fact (user correction)
 */
export async function unlearFact(
  userEmail: string,
  factId: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  const { error } = await (supabase.from('user_learned_facts') as any)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', factId)
    .eq('user_email', userEmail);

  return !error;
}

/**
 * Add an explicit fact (user told us directly)
 */
export async function addExplicitFact(
  userEmail: string,
  fact: string,
  category: FactCategory,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const factKey = normalizeFactKey(fact, category);

  const { data, error } = await (supabase.from('user_learned_facts') as any)
    .insert({
      id: crypto.randomUUID(),
      user_email: userEmail,
      fact_key: factKey,
      fact_value: fact,
      category,
      confidence: 1.0,
      source: 'explicit',
      learned_at: new Date().toISOString(),
      is_active: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

// =============================================================================
// FORMAT FOR PROMPTS
// =============================================================================

/**
 * Format learned facts for inclusion in agent prompts
 */
export function formatLearnedFactsForPrompt(facts: StoredFact[]): string {
  if (facts.length === 0) return '';

  const sections: string[] = ['## Learned Facts About This User\n'];
  sections.push('The following facts have been learned from past conversations. Respect these in your recommendations:\n');

  // Group by category
  const byCategory = new Map<FactCategory, StoredFact[]>();
  for (const fact of facts) {
    const list = byCategory.get(fact.category) || [];
    list.push(fact);
    byCategory.set(fact.category, list);
  }

  const categoryLabels: Record<FactCategory, string> = {
    preference: 'Preferences',
    constraint: 'Constraints',
    medical: 'Medical',
    lifestyle: 'Lifestyle',
    dietary: 'Dietary',
    schedule: 'Schedule',
    goal: 'Goals',
    supplement: 'Supplements',
    allergy: 'Allergies',
    equipment: 'Equipment',
    social: 'Social',
    other: 'Other',
  };

  for (const [category, categoryFacts] of byCategory) {
    sections.push(`### ${categoryLabels[category]}`);
    for (const fact of categoryFacts) {
      const confidence = fact.confidence >= 0.9 ? '✓' : fact.confidence >= 0.7 ? '~' : '?';
      sections.push(`- ${fact.factValue} ${confidence}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
