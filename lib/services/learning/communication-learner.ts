/**
 * Communication Style Learner
 *
 * Learns and adapts to user communication preferences from conversation patterns.
 * Analyzes message lengths, response times, terminology preferences, emoji usage,
 * and other signals to personalize agent responses.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================================================
// Types
// ============================================================================

export type VerbosityLevel = 'brief' | 'moderate' | 'detailed';
export type TonePreference = 'casual' | 'professional' | 'scientific' | 'encouraging' | 'direct';
export type DataPreference = 'numbers_first' | 'narrative_first' | 'balanced';
export type TimeOfDayPreference = 'morning' | 'afternoon' | 'evening' | 'night' | 'any';

export interface CommunicationStyle {
  // Response length preferences
  verbosity: VerbosityLevel;
  preferredResponseLength: 'short' | 'medium' | 'long';
  maxSentencesPreferred: number;

  // Tone and language
  tone: TonePreference;
  formalityLevel: number; // 0-1, 0 = very casual, 1 = very formal
  usesEmojis: boolean;
  emojiFrequency: 'never' | 'rarely' | 'sometimes' | 'often';

  // Content preferences
  dataPreference: DataPreference;
  wantsExplanations: boolean;
  wantsActionItems: boolean;
  prefersBulletPoints: boolean;

  // Scientific/technical preferences
  usesScientificTerms: boolean;
  wantsCitations: boolean;
  technicalDepth: 'basic' | 'intermediate' | 'advanced';

  // Interaction patterns
  preferredGreeting: 'none' | 'brief' | 'warm';
  likesFollowUpQuestions: boolean;
  responseTimePreference: TimeOfDayPreference;

  // Engagement signals
  engagedTopics: string[];
  disengagedTopics: string[];

  // Metadata
  confidenceScore: number;
  lastUpdated: string;
  sampleSize: number;
}

export interface StyleSignal {
  type: string;
  value: string | number | boolean;
  confidence: number;
  source: 'message_length' | 'vocabulary' | 'response_pattern' | 'explicit' | 'engagement';
}

export interface ConversationMetrics {
  avgUserMessageLength: number;
  avgUserWordCount: number;
  avgResponseTime: number;
  questionFrequency: number;
  emojiUsageRate: number;
  technicalTermRate: number;
  sentimentTrend: 'positive' | 'neutral' | 'negative';
  engagementScore: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// ============================================================================
// Default Style
// ============================================================================

const DEFAULT_STYLE: CommunicationStyle = {
  verbosity: 'moderate',
  preferredResponseLength: 'medium',
  maxSentencesPreferred: 5,
  tone: 'encouraging',
  formalityLevel: 0.4,
  usesEmojis: false,
  emojiFrequency: 'rarely',
  dataPreference: 'balanced',
  wantsExplanations: true,
  wantsActionItems: true,
  prefersBulletPoints: false,
  usesScientificTerms: false,
  wantsCitations: false,
  technicalDepth: 'basic',
  preferredGreeting: 'brief',
  likesFollowUpQuestions: true,
  responseTimePreference: 'any',
  engagedTopics: [],
  disengagedTopics: [],
  confidenceScore: 0.3,
  lastUpdated: new Date().toISOString(),
  sampleSize: 0,
};

// ============================================================================
// Signal Detection Patterns
// ============================================================================

const SCIENTIFIC_TERMS = [
  'hrv', 'heart rate variability', 'glucose', 'cortisol', 'melatonin',
  'circadian', 'rem', 'deep sleep', 'vo2', 'lactate', 'threshold',
  'macros', 'micronutrients', 'glycemic', 'insulin', 'metabolic',
  'sympathetic', 'parasympathetic', 'homeostasis', 'inflammation',
];

const CASUAL_MARKERS = [
  'lol', 'haha', 'yeah', 'nah', 'gonna', 'wanna', 'kinda', 'sorta',
  'btw', 'tbh', 'idk', 'ngl', 'imo', 'rn', 'omg', 'yep', 'nope',
];

const FORMAL_MARKERS = [
  'therefore', 'however', 'furthermore', 'additionally', 'consequently',
  'regarding', 'concerning', 'pursuant', 'accordingly', 'nevertheless',
];

const ENGAGEMENT_POSITIVE = [
  'thanks', 'great', 'helpful', 'interesting', 'perfect', 'awesome',
  'love', 'appreciate', 'exactly', 'yes', 'agree', 'makes sense',
];

const ENGAGEMENT_NEGATIVE = [
  'confused', 'don\'t understand', 'too long', 'tldr', 'skip',
  'whatever', 'nevermind', 'doesn\'t matter', 'boring', 'not helpful',
];

// ============================================================================
// Analysis Functions
// ============================================================================

function analyzeMessageLength(messages: Message[]): StyleSignal[] {
  const signals: StyleSignal[] = [];
  const userMessages = messages.filter(m => m.role === 'user');

  if (userMessages.length === 0) return signals;

  const lengths = userMessages.map(m => m.content.length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const wordCounts = userMessages.map(m => m.content.split(/\s+/).length);
  const avgWords = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;

  // Determine verbosity preference from user's own message style
  let verbosity: VerbosityLevel = 'moderate';
  if (avgWords < 10) {
    verbosity = 'brief';
  } else if (avgWords > 30) {
    verbosity = 'detailed';
  }

  signals.push({
    type: 'verbosity',
    value: verbosity,
    confidence: Math.min(0.9, 0.5 + (userMessages.length * 0.05)),
    source: 'message_length',
  });

  // Determine response length preference
  let responseLength: 'short' | 'medium' | 'long' = 'medium';
  if (avgLength < 50) {
    responseLength = 'short';
  } else if (avgLength > 200) {
    responseLength = 'long';
  }

  signals.push({
    type: 'preferredResponseLength',
    value: responseLength,
    confidence: Math.min(0.8, 0.4 + (userMessages.length * 0.05)),
    source: 'message_length',
  });

  return signals;
}

function analyzeVocabulary(messages: Message[]): StyleSignal[] {
  const signals: StyleSignal[] = [];
  const userMessages = messages.filter(m => m.role === 'user');

  if (userMessages.length === 0) return signals;

  const allText = userMessages.map(m => m.content.toLowerCase()).join(' ');
  const words = allText.split(/\s+/);
  const totalWords = words.length;

  // Check for scientific terms
  const scientificCount = SCIENTIFIC_TERMS.filter(term =>
    allText.includes(term.toLowerCase())
  ).length;

  if (scientificCount > 0) {
    signals.push({
      type: 'usesScientificTerms',
      value: true,
      confidence: Math.min(0.9, 0.5 + (scientificCount * 0.1)),
      source: 'vocabulary',
    });

    signals.push({
      type: 'technicalDepth',
      value: scientificCount > 5 ? 'advanced' : scientificCount > 2 ? 'intermediate' : 'basic',
      confidence: Math.min(0.8, 0.4 + (scientificCount * 0.08)),
      source: 'vocabulary',
    });
  }

  // Check formality level
  const casualCount = CASUAL_MARKERS.filter(marker =>
    allText.includes(marker)
  ).length;
  const formalCount = FORMAL_MARKERS.filter(marker =>
    allText.includes(marker)
  ).length;

  const formalityScore = totalWords > 0
    ? (formalCount - casualCount * 0.5) / Math.sqrt(totalWords) + 0.5
    : 0.5;

  signals.push({
    type: 'formalityLevel',
    value: Math.max(0, Math.min(1, formalityScore)),
    confidence: Math.min(0.7, 0.3 + (totalWords / 500)),
    source: 'vocabulary',
  });

  // Determine tone from vocabulary
  let tone: TonePreference = 'encouraging';
  if (formalityScore > 0.7) {
    tone = scientificCount > 3 ? 'scientific' : 'professional';
  } else if (formalityScore < 0.3) {
    tone = 'casual';
  } else if (casualCount === 0 && formalCount === 0) {
    tone = 'direct';
  }

  signals.push({
    type: 'tone',
    value: tone,
    confidence: Math.min(0.75, 0.4 + (userMessages.length * 0.05)),
    source: 'vocabulary',
  });

  return signals;
}

function analyzeEmojiUsage(messages: Message[]): StyleSignal[] {
  const signals: StyleSignal[] = [];
  const userMessages = messages.filter(m => m.role === 'user');

  if (userMessages.length === 0) return signals;

  // Regex to match common emojis (simplified pattern for broader compatibility)
  const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]+|[\u2600-\u27BF]/g;

  let totalEmojis = 0;
  for (const msg of userMessages) {
    const matches = msg.content.match(emojiRegex);
    totalEmojis += matches ? matches.length : 0;
  }

  const emojiRate = totalEmojis / userMessages.length;

  let emojiFrequency: 'never' | 'rarely' | 'sometimes' | 'often' = 'never';
  if (emojiRate > 2) {
    emojiFrequency = 'often';
  } else if (emojiRate > 1) {
    emojiFrequency = 'sometimes';
  } else if (emojiRate > 0) {
    emojiFrequency = 'rarely';
  }

  signals.push({
    type: 'usesEmojis',
    value: totalEmojis > 0,
    confidence: Math.min(0.9, 0.6 + (userMessages.length * 0.03)),
    source: 'vocabulary',
  });

  signals.push({
    type: 'emojiFrequency',
    value: emojiFrequency,
    confidence: Math.min(0.85, 0.5 + (userMessages.length * 0.04)),
    source: 'vocabulary',
  });

  return signals;
}

function analyzeEngagement(messages: Message[]): StyleSignal[] {
  const signals: StyleSignal[] = [];

  // Look for engagement patterns in user responses
  const userMessages = messages.filter(m => m.role === 'user');
  const allText = userMessages.map(m => m.content.toLowerCase()).join(' ');

  const positiveCount = ENGAGEMENT_POSITIVE.filter(term =>
    allText.includes(term)
  ).length;
  const negativeCount = ENGAGEMENT_NEGATIVE.filter(term =>
    allText.includes(term)
  ).length;

  // Detect if user wants shorter responses
  const wantsShorter = /too long|tldr|shorter|brief|quick/i.test(allText);
  if (wantsShorter) {
    signals.push({
      type: 'verbosity',
      value: 'brief',
      confidence: 0.9,
      source: 'explicit',
    });
  }

  // Detect if user wants more detail
  const wantsMore = /more detail|explain|elaborate|tell me more|why/i.test(allText);
  if (wantsMore) {
    signals.push({
      type: 'wantsExplanations',
      value: true,
      confidence: 0.85,
      source: 'explicit',
    });
  }

  // Detect bullet point preference
  const wantsBullets = /bullet|list|points|summarize/i.test(allText);
  if (wantsBullets) {
    signals.push({
      type: 'prefersBulletPoints',
      value: true,
      confidence: 0.8,
      source: 'explicit',
    });
  }

  // Detect question asking frequency
  const questionCount = userMessages.filter(m => m.content.includes('?')).length;
  const questionRate = questionCount / Math.max(1, userMessages.length);

  signals.push({
    type: 'likesFollowUpQuestions',
    value: questionRate > 0.3,
    confidence: Math.min(0.7, 0.4 + (questionRate * 0.5)),
    source: 'response_pattern',
  });

  return signals;
}

function analyzeTopicEngagement(messages: Message[]): { engaged: string[]; disengaged: string[] } {
  const engaged: string[] = [];
  const disengaged: string[] = [];

  const topics = [
    'sleep', 'exercise', 'nutrition', 'stress', 'weight', 'glucose',
    'heart', 'recovery', 'meditation', 'supplements', 'goals', 'streaks',
  ];

  // Simple heuristic: topics mentioned with positive engagement markers
  const userMessages = messages.filter(m => m.role === 'user');
  const allText = userMessages.map(m => m.content.toLowerCase()).join(' ');

  for (const topic of topics) {
    if (allText.includes(topic)) {
      // Check context around topic mention
      const hasPositive = ENGAGEMENT_POSITIVE.some(pos =>
        allText.includes(`${topic}`) && allText.includes(pos)
      );
      const hasNegative = ENGAGEMENT_NEGATIVE.some(neg =>
        allText.includes(`${topic}`) && allText.includes(neg)
      );

      if (hasPositive && !hasNegative) {
        engaged.push(topic);
      } else if (hasNegative && !hasPositive) {
        disengaged.push(topic);
      }
    }
  }

  return { engaged, disengaged };
}

function analyzeDataPreference(messages: Message[]): StyleSignal[] {
  const signals: StyleSignal[] = [];
  const userMessages = messages.filter(m => m.role === 'user');
  const allText = userMessages.map(m => m.content.toLowerCase()).join(' ');

  // Check for number-focused queries
  const numberQueries = /how much|how many|what's my|score|percentage|number/i.test(allText);
  // Check for story/context-focused queries
  const narrativeQueries = /why|how come|tell me about|explain|what happened/i.test(allText);

  let dataPreference: DataPreference = 'balanced';
  if (numberQueries && !narrativeQueries) {
    dataPreference = 'numbers_first';
  } else if (narrativeQueries && !numberQueries) {
    dataPreference = 'narrative_first';
  }

  signals.push({
    type: 'dataPreference',
    value: dataPreference,
    confidence: 0.6,
    source: 'response_pattern',
  });

  return signals;
}

// ============================================================================
// Main Learning Functions
// ============================================================================

export async function analyzeConversationStyle(
  messages: Message[]
): Promise<{ style: Partial<CommunicationStyle>; signals: StyleSignal[] }> {
  const allSignals: StyleSignal[] = [];

  // Run all analyzers
  allSignals.push(...analyzeMessageLength(messages));
  allSignals.push(...analyzeVocabulary(messages));
  allSignals.push(...analyzeEmojiUsage(messages));
  allSignals.push(...analyzeEngagement(messages));
  allSignals.push(...analyzeDataPreference(messages));

  // Extract topic engagement
  const { engaged, disengaged } = analyzeTopicEngagement(messages);

  // Aggregate signals into style
  const style: Partial<CommunicationStyle> = {
    engagedTopics: engaged,
    disengagedTopics: disengaged,
    sampleSize: messages.filter(m => m.role === 'user').length,
  };

  // Group signals by type and pick highest confidence
  const signalsByType = new Map<string, StyleSignal>();
  for (const signal of allSignals) {
    const existing = signalsByType.get(signal.type);
    if (!existing || signal.confidence > existing.confidence) {
      signalsByType.set(signal.type, signal);
    }
  }

  // Apply signals to style
  for (const [type, signal] of Array.from(signalsByType.entries())) {
    if (signal.confidence >= 0.5) {
      (style as unknown as Record<string, unknown>)[type] = signal.value;
    }
  }

  // Calculate overall confidence
  const confidenceValues = Array.from(signalsByType.values()).map(s => s.confidence);
  style.confidenceScore = confidenceValues.length > 0
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0.3;

  style.lastUpdated = new Date().toISOString();

  return { style, signals: allSignals };
}

export async function learnStyleFromConversation(
  userEmail: string,
  messages: Message[],
  supabase: SupabaseClient
): Promise<CommunicationStyle> {
  // Get existing style
  const currentStyle = await getUserCommunicationStyle(userEmail, supabase);

  // Analyze new conversation
  const { style: newSignals, signals } = await analyzeConversationStyle(messages);

  // Merge with existing style (weighted by sample size)
  const mergedStyle = mergeStyles(currentStyle, newSignals);

  // Store updated style
  await supabase
    .from('user_communication_styles')
    .upsert({
      user_email: userEmail,
      style: mergedStyle,
      signals: signals,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email',
    });

  return mergedStyle;
}

function mergeStyles(
  existing: CommunicationStyle,
  newSignals: Partial<CommunicationStyle>
): CommunicationStyle {
  const existingWeight = Math.min(0.8, existing.sampleSize / 50);
  const newWeight = 1 - existingWeight;

  const merged: CommunicationStyle = { ...existing };

  // Merge numeric values with weighted average
  if (typeof newSignals.formalityLevel === 'number') {
    merged.formalityLevel = existing.formalityLevel * existingWeight + newSignals.formalityLevel * newWeight;
  }

  if (typeof newSignals.maxSentencesPreferred === 'number') {
    merged.maxSentencesPreferred = Math.round(
      existing.maxSentencesPreferred * existingWeight + newSignals.maxSentencesPreferred * newWeight
    );
  }

  // Merge boolean values (prefer new if confident enough)
  const booleanFields: (keyof CommunicationStyle)[] = [
    'usesEmojis', 'wantsExplanations', 'wantsActionItems',
    'prefersBulletPoints', 'usesScientificTerms', 'wantsCitations',
    'likesFollowUpQuestions',
  ];

  for (const field of booleanFields) {
    if (newSignals[field] !== undefined && newWeight > 0.3) {
      (merged as unknown as Record<string, unknown>)[field] = newSignals[field];
    }
  }

  // Merge enum values (prefer new if confident enough)
  const enumFields: (keyof CommunicationStyle)[] = [
    'verbosity', 'preferredResponseLength', 'tone', 'emojiFrequency',
    'dataPreference', 'technicalDepth', 'preferredGreeting', 'responseTimePreference',
  ];

  for (const field of enumFields) {
    if (newSignals[field] !== undefined && newWeight > 0.3) {
      (merged as unknown as Record<string, unknown>)[field] = newSignals[field];
    }
  }

  // Merge arrays (union)
  if (newSignals.engagedTopics) {
    merged.engagedTopics = Array.from(new Set([...existing.engagedTopics, ...newSignals.engagedTopics]));
  }
  if (newSignals.disengagedTopics) {
    merged.disengagedTopics = Array.from(new Set([...existing.disengagedTopics, ...newSignals.disengagedTopics]));
  }

  // Update metadata
  merged.sampleSize = existing.sampleSize + (newSignals.sampleSize || 0);
  merged.confidenceScore = Math.min(0.95, existing.confidenceScore * 0.7 + (newSignals.confidenceScore || 0.5) * 0.3);
  merged.lastUpdated = new Date().toISOString();

  return merged;
}

// ============================================================================
// Style Retrieval and Application
// ============================================================================

export async function getUserCommunicationStyle(
  userEmail: string,
  supabase: SupabaseClient
): Promise<CommunicationStyle> {
  const { data } = await supabase
    .from('user_communication_styles')
    .select('style')
    .eq('user_email', userEmail)
    .single();

  if (!data) {
    return { ...DEFAULT_STYLE };
  }

  type StyleRow = { style: Partial<CommunicationStyle> };
  const row = data as StyleRow;

  return { ...DEFAULT_STYLE, ...row.style };
}

export async function updateUserStyleExplicitly(
  userEmail: string,
  updates: Partial<CommunicationStyle>,
  supabase: SupabaseClient
): Promise<CommunicationStyle> {
  const current = await getUserCommunicationStyle(userEmail, supabase);
  const updated: CommunicationStyle = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  await supabase
    .from('user_communication_styles')
    .upsert({
      user_email: userEmail,
      style: updated,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email',
    });

  return updated;
}

// ============================================================================
// Prompt Generation
// ============================================================================

export function buildStylePrompt(style: CommunicationStyle): string {
  const instructions: string[] = [];

  // Verbosity
  switch (style.verbosity) {
    case 'brief':
      instructions.push('Keep responses concise and to the point. Maximum 2-3 sentences.');
      break;
    case 'detailed':
      instructions.push('Provide thorough explanations with context and details.');
      break;
    default:
      instructions.push('Use moderate response length, around 4-5 sentences.');
  }

  // Tone
  switch (style.tone) {
    case 'casual':
      instructions.push('Use a friendly, conversational tone.');
      break;
    case 'professional':
      instructions.push('Maintain a professional, polished tone.');
      break;
    case 'scientific':
      instructions.push('Use precise scientific terminology and cite relevant research when applicable.');
      break;
    case 'encouraging':
      instructions.push('Be supportive and encouraging in your responses.');
      break;
    case 'direct':
      instructions.push('Be straightforward and direct. Skip pleasantries.');
      break;
  }

  // Data preference
  switch (style.dataPreference) {
    case 'numbers_first':
      instructions.push('Lead with specific numbers and metrics before explanation.');
      break;
    case 'narrative_first':
      instructions.push('Start with context and explanation, then support with data.');
      break;
  }

  // Format preferences
  if (style.prefersBulletPoints) {
    instructions.push('Use bullet points to organize information.');
  }

  if (style.wantsActionItems) {
    instructions.push('Include clear, actionable recommendations.');
  }

  if (!style.wantsExplanations) {
    instructions.push('Skip detailed explanations unless asked.');
  }

  // Technical depth
  switch (style.technicalDepth) {
    case 'advanced':
      instructions.push('Use technical terminology freely. User has advanced health literacy.');
      break;
    case 'intermediate':
      instructions.push('Use some technical terms but explain complex concepts briefly.');
      break;
    case 'basic':
      instructions.push('Use simple, accessible language. Avoid jargon.');
      break;
  }

  // Emoji usage
  if (style.usesEmojis && style.emojiFrequency !== 'never') {
    if (style.emojiFrequency === 'often') {
      instructions.push('Feel free to use emojis to add warmth.');
    } else if (style.emojiFrequency === 'sometimes') {
      instructions.push('Occasional emoji use is welcome.');
    }
  } else {
    instructions.push('Avoid using emojis.');
  }

  // Greeting preference
  switch (style.preferredGreeting) {
    case 'none':
      instructions.push('Skip greetings, get straight to the point.');
      break;
    case 'warm':
      instructions.push('Include a warm, personalized greeting.');
      break;
    default:
      instructions.push('Use brief greetings when appropriate.');
  }

  // Follow-up questions
  if (style.likesFollowUpQuestions) {
    instructions.push('End with a relevant follow-up question when appropriate.');
  } else {
    instructions.push('Avoid ending with questions unless essential.');
  }

  return `## Communication Style Preferences
${instructions.map(i => `- ${i}`).join('\n')}`;
}

export function formatStyleForAgent(style: CommunicationStyle): string {
  const lines = [
    '## User Communication Preferences',
    '',
    `**Verbosity**: ${style.verbosity} (max ~${style.maxSentencesPreferred} sentences)`,
    `**Tone**: ${style.tone}`,
    `**Data presentation**: ${style.dataPreference}`,
    `**Technical level**: ${style.technicalDepth}`,
    `**Wants explanations**: ${style.wantsExplanations ? 'Yes' : 'No'}`,
    `**Uses emojis**: ${style.usesEmojis ? style.emojiFrequency : 'Never'}`,
    `**Prefers bullet points**: ${style.prefersBulletPoints ? 'Yes' : 'No'}`,
    '',
  ];

  if (style.engagedTopics.length > 0) {
    lines.push(`**Engaged topics**: ${style.engagedTopics.join(', ')}`);
  }

  if (style.disengagedTopics.length > 0) {
    lines.push(`**Less interested in**: ${style.disengagedTopics.join(', ')}`);
  }

  lines.push('');
  lines.push(`*Confidence: ${Math.round(style.confidenceScore * 100)}% (based on ${style.sampleSize} messages)*`);

  return lines.join('\n');
}

// ============================================================================
// LLM-Based Style Analysis (for deeper analysis)
// ============================================================================

export async function analyzeStyleWithLLM(
  messages: Message[],
  openai: OpenAI
): Promise<Partial<CommunicationStyle>> {
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .slice(-10)
    .join('\n---\n');

  if (userMessages.length < 50) {
    return {};
  }

  const systemPrompt = `Analyze these user messages and infer their communication preferences.
Return ONLY a JSON object with these fields (all optional, only include what you can confidently infer):
{
  "verbosity": "brief" | "moderate" | "detailed",
  "tone": "casual" | "professional" | "scientific" | "encouraging" | "direct",
  "dataPreference": "numbers_first" | "narrative_first" | "balanced",
  "technicalDepth": "basic" | "intermediate" | "advanced",
  "usesEmojis": boolean,
  "prefersBulletPoints": boolean,
  "wantsExplanations": boolean
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessages },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return {};

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    return JSON.parse(jsonMatch[0]) as Partial<CommunicationStyle>;
  } catch (error) {
    console.error('Failed to analyze style with LLM:', error);
    return {};
  }
}
