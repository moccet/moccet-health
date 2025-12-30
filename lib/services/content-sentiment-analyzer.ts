/**
 * Content Sentiment Analyzer
 *
 * Analyzes workplace communication content (Slack, Gmail) for emotional signals:
 * - Stress & burnout indicators
 * - Success & wins
 * - Work-life boundary violations
 *
 * Privacy-conscious: analyzes content, stores only scores, discards raw text.
 */

import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const openai = new OpenAI();

// ============================================================================
// TYPES
// ============================================================================

export interface StressSignals {
  urgentLanguage: boolean;
  deadlinePressure: boolean;
  conflictIndicators: boolean;
  overwhelmExpressions: boolean;
  anxietyMarkers: boolean;
  score: number; // 0-100
}

export interface SuccessSignals {
  praiseReceived: boolean;
  congratulations: boolean;
  projectCompletion: boolean;
  positiveOutcomes: boolean;
  recognitionGiven: boolean;
  score: number; // 0-100
}

export interface BoundaryViolations {
  personalInWork: boolean;
  workInPersonal: boolean;
  afterHoursUrgency: boolean;
  weekendWorkPressure: boolean;
  score: number; // 0-100
}

export interface SentimentAnalysis {
  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number; // -1 to 1

  stressSignals: StressSignals;
  successSignals: SuccessSignals;
  boundaryViolations: BoundaryViolations;

  // Categories of detected patterns (no raw phrases for privacy)
  triggerCategories: string[];

  // Trend compared to previous period
  trend: 'improving' | 'stable' | 'declining';

  // Metadata
  messageCount: number;
  analyzedAt: string;
}

export interface DailySentiment {
  date: string;
  source: 'slack' | 'gmail';
  sentiment: SentimentAnalysis;
}

export interface AggregatedSentiment {
  period: 'day' | 'week' | 'month';
  startDate: string;
  endDate: string;

  overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number;

  avgStressScore: number;
  avgSuccessScore: number;
  avgBoundaryScore: number;

  stressTrend: 'increasing' | 'stable' | 'decreasing';
  successTrend: 'increasing' | 'stable' | 'decreasing';

  topConcerns: string[];
  topWins: string[];

  dailyBreakdown: DailySentiment[];
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyze a batch of messages for sentiment and emotional signals
 */
export async function analyzeMessageBatch(
  messages: string[],
  options: {
    source: 'slack' | 'gmail';
    date: string;
    includeTimestamps?: { text: string; timestamp: string; isAfterHours: boolean }[];
  }
): Promise<SentimentAnalysis> {
  const { source, date, includeTimestamps } = options;

  // Combine messages for batch analysis (more efficient)
  const combinedText = messages.join('\n---\n');

  // Skip if too few messages
  if (messages.length < 3) {
    return getEmptySentiment(messages.length);
  }

  // Truncate if too long (token limits)
  const maxChars = 15000;
  const truncatedText = combinedText.length > maxChars
    ? combinedText.substring(0, maxChars) + '\n[...truncated]'
    : combinedText;

  // Analyze after-hours patterns if timestamps provided
  let afterHoursContext = '';
  if (includeTimestamps?.length) {
    const afterHoursMessages = includeTimestamps.filter(m => m.isAfterHours);
    const afterHoursPct = Math.round((afterHoursMessages.length / includeTimestamps.length) * 100);
    afterHoursContext = `\n\nTiming context: ${afterHoursPct}% of these messages were sent outside work hours (before 9am or after 6pm).`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Cost-effective for sentiment analysis
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing workplace communications for emotional and behavioral signals. Analyze the following ${source} messages for signs of stress, success, and work-life balance issues.

Be thorough but objective. Look for patterns, not isolated incidents.

## Detection Categories

### Stress & Burnout Indicators
- **Urgent language**: "ASAP", "urgent", "immediately", "critical", "emergency"
- **Deadline pressure**: "by EOD", "due tomorrow", "running late", "behind schedule", "crunch"
- **Conflict signals**: "concerned", "issue", "problem", "escalate", "disappointed", "frustrated"
- **Overwhelm expressions**: "swamped", "underwater", "too much", "can't keep up", "drowning", "overloaded"
- **Anxiety markers**: "worried", "stressed", "nervous", "afraid", "anxious", "panic"

### Success & Wins
- **Praise received**: "great job", "well done", "thank you", "appreciate", "excellent work"
- **Congratulations**: "congrats", "awesome", "nailed it", "amazing", "brilliant"
- **Project completion**: "shipped", "launched", "completed", "done", "finished", "delivered"
- **Positive outcomes**: "approved", "accepted", "succeeded", "won", "secured"
- **Recognition given**: User praising others - indicates positive team culture

### Work-Life Boundary Violations
- **Personal in work**: Health issues, family problems, or personal matters discussed in work context
- **Work in personal**: Urgent work requests during clearly personal time
- **After-hours urgency**: Pressing deadlines or urgent requests outside normal hours
- **Weekend pressure**: Work demands specifically mentioning weekends

## Output Format (JSON)
{
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentScore": -1 to 1 (negative to positive),
  "stressSignals": {
    "urgentLanguage": boolean,
    "deadlinePressure": boolean,
    "conflictIndicators": boolean,
    "overwhelmExpressions": boolean,
    "anxietyMarkers": boolean,
    "score": 0-100
  },
  "successSignals": {
    "praiseReceived": boolean,
    "congratulations": boolean,
    "projectCompletion": boolean,
    "positiveOutcomes": boolean,
    "recognitionGiven": boolean,
    "score": 0-100
  },
  "boundaryViolations": {
    "personalInWork": boolean,
    "workInPersonal": boolean,
    "afterHoursUrgency": boolean,
    "weekendWorkPressure": boolean,
    "score": 0-100
  },
  "triggerCategories": ["deadline_pressure", "praise_received", ...] // Categories detected, not raw phrases
}`,
        },
        {
          role: 'user',
          content: `Analyze these ${messages.length} ${source} messages from ${date}:${afterHoursContext}

---
${truncatedText}
---

Return JSON analysis only.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 800,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      overallSentiment: parsed.overallSentiment || 'neutral',
      sentimentScore: typeof parsed.sentimentScore === 'number' ? parsed.sentimentScore : 0,
      stressSignals: {
        urgentLanguage: parsed.stressSignals?.urgentLanguage || false,
        deadlinePressure: parsed.stressSignals?.deadlinePressure || false,
        conflictIndicators: parsed.stressSignals?.conflictIndicators || false,
        overwhelmExpressions: parsed.stressSignals?.overwhelmExpressions || false,
        anxietyMarkers: parsed.stressSignals?.anxietyMarkers || false,
        score: parsed.stressSignals?.score || 0,
      },
      successSignals: {
        praiseReceived: parsed.successSignals?.praiseReceived || false,
        congratulations: parsed.successSignals?.congratulations || false,
        projectCompletion: parsed.successSignals?.projectCompletion || false,
        positiveOutcomes: parsed.successSignals?.positiveOutcomes || false,
        recognitionGiven: parsed.successSignals?.recognitionGiven || false,
        score: parsed.successSignals?.score || 0,
      },
      boundaryViolations: {
        personalInWork: parsed.boundaryViolations?.personalInWork || false,
        workInPersonal: parsed.boundaryViolations?.workInPersonal || false,
        afterHoursUrgency: parsed.boundaryViolations?.afterHoursUrgency || false,
        weekendWorkPressure: parsed.boundaryViolations?.weekendWorkPressure || false,
        score: parsed.boundaryViolations?.score || 0,
      },
      triggerCategories: parsed.triggerCategories || [],
      trend: 'stable', // Will be calculated from historical data
      messageCount: messages.length,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Sentiment Analyzer] Error analyzing messages:', error);
    return getEmptySentiment(messages.length);
  }
}

/**
 * Analyze email subjects (lighter analysis for Gmail)
 */
export async function analyzeEmailSubjects(
  subjects: { subject: string; timestamp: string; isAfterHours: boolean }[]
): Promise<SentimentAnalysis> {
  if (subjects.length < 3) {
    return getEmptySentiment(subjects.length);
  }

  // Quick keyword-based pre-analysis (no AI needed for obvious patterns)
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'emergency', '!!!', 'eod', 'end of day'];
  const positiveKeywords = ['congrats', 'congratulations', 'great job', 'thank you', 'approved', 'accepted', 'welcome'];
  const stressKeywords = ['issue', 'problem', 'concerned', 'escalation', 'failed', 'delayed', 'blocked'];

  let urgentCount = 0;
  let positiveCount = 0;
  let stressCount = 0;
  let afterHoursUrgent = 0;

  for (const { subject, isAfterHours } of subjects) {
    const lower = subject.toLowerCase();

    if (urgentKeywords.some(kw => lower.includes(kw))) {
      urgentCount++;
      if (isAfterHours) afterHoursUrgent++;
    }
    if (positiveKeywords.some(kw => lower.includes(kw))) {
      positiveCount++;
    }
    if (stressKeywords.some(kw => lower.includes(kw))) {
      stressCount++;
    }
  }

  const total = subjects.length;
  const urgentPct = (urgentCount / total) * 100;
  const positivePct = (positiveCount / total) * 100;
  const stressPct = (stressCount / total) * 100;

  // Calculate overall sentiment
  let overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
  let sentimentScore = 0;

  if (positivePct > 20 && stressPct < 10) {
    overallSentiment = 'positive';
    sentimentScore = 0.5 + (positivePct / 100) * 0.5;
  } else if (stressPct > 20 || urgentPct > 30) {
    overallSentiment = 'negative';
    sentimentScore = -0.5 - (stressPct / 100) * 0.5;
  } else if (positivePct > 10 && stressPct > 10) {
    overallSentiment = 'mixed';
    sentimentScore = (positivePct - stressPct) / 100;
  }

  return {
    overallSentiment,
    sentimentScore,
    stressSignals: {
      urgentLanguage: urgentPct > 15,
      deadlinePressure: urgentPct > 20,
      conflictIndicators: stressPct > 15,
      overwhelmExpressions: urgentPct > 30,
      anxietyMarkers: false,
      score: Math.min(100, Math.round(urgentPct * 2 + stressPct * 1.5)),
    },
    successSignals: {
      praiseReceived: positivePct > 10,
      congratulations: positivePct > 15,
      projectCompletion: false,
      positiveOutcomes: positivePct > 20,
      recognitionGiven: false,
      score: Math.min(100, Math.round(positivePct * 3)),
    },
    boundaryViolations: {
      personalInWork: false,
      workInPersonal: false,
      afterHoursUrgency: afterHoursUrgent > 2,
      weekendWorkPressure: false, // Would need day-of-week info
      score: Math.min(100, Math.round((afterHoursUrgent / total) * 200)),
    },
    triggerCategories: [
      ...(urgentPct > 15 ? ['urgent_language'] : []),
      ...(stressPct > 15 ? ['stress_indicators'] : []),
      ...(positivePct > 10 ? ['positive_recognition'] : []),
      ...(afterHoursUrgent > 2 ? ['after_hours_urgency'] : []),
    ],
    trend: 'stable',
    messageCount: subjects.length,
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Store sentiment analysis results in database
 */
export async function storeSentimentAnalysis(
  email: string,
  source: 'slack' | 'gmail',
  date: string,
  sentiment: SentimentAnalysis
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from('content_sentiment_analysis').upsert(
    {
      user_email: email,
      source,
      analysis_date: date,
      overall_sentiment: sentiment.overallSentiment,
      sentiment_score: sentiment.sentimentScore,
      stress_score: sentiment.stressSignals.score,
      stress_signals: sentiment.stressSignals,
      success_score: sentiment.successSignals.score,
      success_signals: sentiment.successSignals,
      boundary_score: sentiment.boundaryViolations.score,
      boundary_signals: sentiment.boundaryViolations,
      trigger_categories: sentiment.triggerCategories,
      message_count: sentiment.messageCount,
    },
    { onConflict: 'user_email,source,analysis_date' }
  );

  if (error) {
    console.error('[Sentiment Analyzer] Error storing analysis:', error);
  }
}

/**
 * Get sentiment analysis for a user over a time period
 */
export async function getSentimentAnalysis(
  email: string,
  options: {
    days?: number;
    source?: 'slack' | 'gmail';
  } = {}
): Promise<AggregatedSentiment | null> {
  const { days = 7, source } = options;
  const supabase = await createClient();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('content_sentiment_analysis')
    .select('*')
    .eq('user_email', email)
    .gte('analysis_date', startDate.toISOString().split('T')[0])
    .order('analysis_date', { ascending: true });

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return null;
  }

  // Aggregate the daily data
  const totalDays = data.length;
  let totalSentimentScore = 0;
  let totalStressScore = 0;
  let totalSuccessScore = 0;
  let totalBoundaryScore = 0;
  const allCategories = new Set<string>();

  const dailyBreakdown: DailySentiment[] = [];

  for (const row of data) {
    totalSentimentScore += row.sentiment_score || 0;
    totalStressScore += row.stress_score || 0;
    totalSuccessScore += row.success_score || 0;
    totalBoundaryScore += row.boundary_score || 0;

    if (row.trigger_categories) {
      for (const cat of row.trigger_categories) {
        allCategories.add(cat);
      }
    }

    dailyBreakdown.push({
      date: row.analysis_date,
      source: row.source,
      sentiment: {
        overallSentiment: row.overall_sentiment,
        sentimentScore: row.sentiment_score,
        stressSignals: row.stress_signals,
        successSignals: row.success_signals,
        boundaryViolations: row.boundary_signals,
        triggerCategories: row.trigger_categories || [],
        trend: 'stable',
        messageCount: row.message_count || 0,
        analyzedAt: row.created_at,
      },
    });
  }

  // Calculate averages
  const avgSentiment = totalSentimentScore / totalDays;
  const avgStress = totalStressScore / totalDays;
  const avgSuccess = totalSuccessScore / totalDays;
  const avgBoundary = totalBoundaryScore / totalDays;

  // Determine overall sentiment
  let overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
  if (avgSentiment > 0.3) overallSentiment = 'positive';
  else if (avgSentiment < -0.3) overallSentiment = 'negative';
  else if (avgStress > 50 && avgSuccess > 40) overallSentiment = 'mixed';

  // Calculate trends (compare first half to second half)
  const midpoint = Math.floor(totalDays / 2);
  const firstHalfStress = data.slice(0, midpoint).reduce((sum, d) => sum + (d.stress_score || 0), 0) / midpoint;
  const secondHalfStress = data.slice(midpoint).reduce((sum, d) => sum + (d.stress_score || 0), 0) / (totalDays - midpoint);

  const firstHalfSuccess = data.slice(0, midpoint).reduce((sum, d) => sum + (d.success_score || 0), 0) / midpoint;
  const secondHalfSuccess = data.slice(midpoint).reduce((sum, d) => sum + (d.success_score || 0), 0) / (totalDays - midpoint);

  const stressTrend: 'increasing' | 'stable' | 'decreasing' =
    secondHalfStress > firstHalfStress + 10 ? 'increasing' :
    secondHalfStress < firstHalfStress - 10 ? 'decreasing' : 'stable';

  const successTrend: 'increasing' | 'stable' | 'decreasing' =
    secondHalfSuccess > firstHalfSuccess + 10 ? 'increasing' :
    secondHalfSuccess < firstHalfSuccess - 10 ? 'decreasing' : 'stable';

  // Identify top concerns and wins
  const categories = Array.from(allCategories);
  const topConcerns = categories.filter(c =>
    c.includes('stress') || c.includes('urgent') || c.includes('deadline') || c.includes('boundary')
  );
  const topWins = categories.filter(c =>
    c.includes('positive') || c.includes('praise') || c.includes('success') || c.includes('completion')
  );

  return {
    period: days <= 1 ? 'day' : days <= 7 ? 'week' : 'month',
    startDate: startDate.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    overallSentiment,
    sentimentScore: avgSentiment,
    avgStressScore: Math.round(avgStress),
    avgSuccessScore: Math.round(avgSuccess),
    avgBoundaryScore: Math.round(avgBoundary),
    stressTrend,
    successTrend,
    topConcerns,
    topWins,
    dailyBreakdown,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getEmptySentiment(messageCount: number): SentimentAnalysis {
  return {
    overallSentiment: 'neutral',
    sentimentScore: 0,
    stressSignals: {
      urgentLanguage: false,
      deadlinePressure: false,
      conflictIndicators: false,
      overwhelmExpressions: false,
      anxietyMarkers: false,
      score: 0,
    },
    successSignals: {
      praiseReceived: false,
      congratulations: false,
      projectCompletion: false,
      positiveOutcomes: false,
      recognitionGiven: false,
      score: 0,
    },
    boundaryViolations: {
      personalInWork: false,
      workInPersonal: false,
      afterHoursUrgency: false,
      weekendWorkPressure: false,
      score: 0,
    },
    triggerCategories: [],
    trend: 'stable',
    messageCount,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Format sentiment analysis for AI context
 */
export function formatSentimentForPrompt(sentiment: AggregatedSentiment | null): string {
  if (!sentiment) {
    return '';
  }

  const parts: string[] = [];

  parts.push(`## Communication Sentiment Analysis (Last ${sentiment.period})`);
  parts.push(`Period: ${sentiment.startDate} to ${sentiment.endDate}`);
  parts.push(`Overall Sentiment: ${sentiment.overallSentiment} (score: ${sentiment.sentimentScore.toFixed(2)})`);
  parts.push('');

  // Stress section
  parts.push('### Stress Indicators');
  parts.push(`- Stress Score: ${sentiment.avgStressScore}/100`);
  parts.push(`- Trend: ${sentiment.stressTrend}`);
  if (sentiment.topConcerns.length > 0) {
    parts.push(`- Detected patterns: ${sentiment.topConcerns.join(', ')}`);
  }
  parts.push('');

  // Success section
  parts.push('### Success & Wins');
  parts.push(`- Success Score: ${sentiment.avgSuccessScore}/100`);
  parts.push(`- Trend: ${sentiment.successTrend}`);
  if (sentiment.topWins.length > 0) {
    parts.push(`- Detected patterns: ${sentiment.topWins.join(', ')}`);
  }
  parts.push('');

  // Boundary section
  if (sentiment.avgBoundaryScore > 20) {
    parts.push('### Work-Life Boundary Concerns');
    parts.push(`- Boundary Score: ${sentiment.avgBoundaryScore}/100 (higher = more violations)`);
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================================
// LIFE CONTEXT ANALYSIS (Pro/Max only)
// Detects actual life events and patterns from email subjects
// ============================================================================

export interface LifeEvent {
  type: 'travel' | 'health' | 'social' | 'work' | 'finance' | 'recruitment';
  summary: string; // "Flight to NYC", "Interview at Google"
  date?: string; // ISO date if detected
  confidence: number; // 0-1
}

export interface LifePattern {
  type: string; // "job_search", "trip_planning", "busy_period"
  description: string;
  evidenceCount: number;
  firstSeen?: string;
  lastSeen?: string;
}

export interface LifeContextAnalysis {
  upcomingEvents: LifeEvent[];
  activePatterns: LifePattern[];
  sentiment: SentimentAnalysis;
  analyzedAt: string;
}

/**
 * Analyze emails for life context - detects actual events and patterns
 * Pro/Max tier feature - uses AI for deep understanding
 */
export async function analyzeEmailsForLifeContext(
  emails: { subject: string; timestamp: string; isAfterHours: boolean }[]
): Promise<LifeContextAnalysis> {
  // Also get basic sentiment
  const sentiment = await analyzeEmailSubjects(emails);

  if (emails.length < 5) {
    return {
      upcomingEvents: [],
      activePatterns: [],
      sentiment,
      analyzedAt: new Date().toISOString(),
    };
  }

  // Prepare subjects with dates for context
  const subjectsWithDates = emails
    .map(e => {
      const date = new Date(e.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `[${dateStr}] ${e.subject}`;
    })
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are analyzing email subjects to understand what's happening in someone's life. Extract specific events and identify patterns.

## Detection Categories

### Upcoming Events (with dates if visible)
1. **Travel**: Flight bookings, hotel confirmations, trip reminders, check-in notifications
2. **Health**: Doctor appointments, prescription ready, lab results, dental visits
3. **Social**: Event invitations, RSVPs, dinner reservations, party confirmations
4. **Work**: Important deadlines, key meetings, project milestones
5. **Finance**: Bill due dates, large purchase confirmations, subscription renewals
6. **Recruitment**: Interview confirmations, job application updates, offer letters

### Active Patterns (ongoing situations)
- **job_search**: Multiple recruiter emails, interview confirmations, application updates
- **trip_planning**: Destination research, multiple booking confirmations, visa/passport
- **busy_period**: Many meeting notifications, deadline mentions, overtime signals
- **health_focus**: Multiple medical emails, pharmacy notifications
- **moving**: Address changes, utility setup, moving company emails
- **major_purchase**: Research emails, financing confirmations, delivery tracking

## Rules
- Only report events/patterns with reasonable confidence
- Extract specific details (destinations, company names, dates) when visible
- Don't invent information not present in subjects
- Focus on actionable, meaningful life context

## Output JSON:
{
  "upcomingEvents": [
    {"type": "travel", "summary": "Flight to NYC", "date": "2024-01-15", "confidence": 0.9},
    {"type": "health", "summary": "Dentist appointment", "date": "2024-01-12", "confidence": 0.85}
  ],
  "activePatterns": [
    {"type": "job_search", "description": "Active interview process with 3+ companies", "evidenceCount": 5}
  ]
}`,
        },
        {
          role: 'user',
          content: `Analyze these ${emails.length} email subjects from the last 30 days:

${subjectsWithDates}

Extract life events and patterns. Return JSON only.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      upcomingEvents: (parsed.upcomingEvents || []).map((e: LifeEvent) => ({
        type: e.type || 'work',
        summary: e.summary || 'Unknown event',
        date: e.date,
        confidence: typeof e.confidence === 'number' ? e.confidence : 0.7,
      })),
      activePatterns: (parsed.activePatterns || []).map((p: LifePattern) => ({
        type: p.type || 'unknown',
        description: p.description || '',
        evidenceCount: p.evidenceCount || 1,
      })),
      sentiment,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Life Context Analyzer] Error:', error);
    return {
      upcomingEvents: [],
      activePatterns: [],
      sentiment,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Store life context analysis results
 */
export async function storeLifeContext(
  email: string,
  context: LifeContextAnalysis
): Promise<void> {
  const supabase = await createClient();

  // Upsert main context record
  const { error: contextError } = await supabase
    .from('user_life_context')
    .upsert(
      {
        user_email: email,
        upcoming_events: context.upcomingEvents,
        active_patterns: context.activePatterns,
        last_analysis_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' }
    );

  if (contextError) {
    console.error('[Life Context] Error storing context:', contextError);
  }

  // Also store individual events in history for tracking
  for (const event of context.upcomingEvents) {
    if (event.date) {
      await supabase
        .from('life_events_history')
        .upsert(
          {
            user_email: email,
            event_type: event.type,
            event_summary: event.summary,
            event_date: event.date,
            confidence: event.confidence,
            source: 'gmail',
            detected_at: new Date().toISOString(),
          },
          { onConflict: 'user_email,event_type,event_summary,event_date' }
        )
        .then(({ error }) => {
          if (error) console.error('[Life Context] Error storing event:', error);
        });
    }
  }
}

/**
 * Get life context for a user
 */
export async function getLifeContext(email: string): Promise<LifeContextAnalysis | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_life_context')
    .select('*')
    .eq('user_email', email)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    upcomingEvents: data.upcoming_events || [],
    activePatterns: data.active_patterns || [],
    sentiment: {
      overallSentiment: 'neutral',
      sentimentScore: 0,
      stressSignals: { urgentLanguage: false, deadlinePressure: false, conflictIndicators: false, overwhelmExpressions: false, anxietyMarkers: false, score: 0 },
      successSignals: { praiseReceived: false, congratulations: false, projectCompletion: false, positiveOutcomes: false, recognitionGiven: false, score: 0 },
      boundaryViolations: { personalInWork: false, workInPersonal: false, afterHoursUrgency: false, weekendWorkPressure: false, score: 0 },
      triggerCategories: [],
      trend: 'stable',
      messageCount: 0,
      analyzedAt: data.last_analysis_date,
    },
    analyzedAt: data.last_analysis_date,
  };
}

/**
 * Format life context for AI prompts
 */
export function formatLifeContextForPrompt(context: LifeContextAnalysis | null): string {
  if (!context) {
    return '';
  }

  const parts: string[] = [];
  parts.push('## Life Context (from Email Analysis)');
  parts.push('');

  // Upcoming events
  if (context.upcomingEvents.length > 0) {
    parts.push('### Upcoming Events');
    for (const event of context.upcomingEvents) {
      const dateStr = event.date ? ` on ${event.date}` : '';
      parts.push(`- **${event.type}**: ${event.summary}${dateStr}`);
    }
    parts.push('');
  }

  // Active patterns
  if (context.activePatterns.length > 0) {
    parts.push('### Current Life Patterns');
    for (const pattern of context.activePatterns) {
      parts.push(`- **${pattern.type}**: ${pattern.description}`);
    }
    parts.push('');
  }

  if (context.upcomingEvents.length === 0 && context.activePatterns.length === 0) {
    parts.push('No significant life events or patterns detected recently.');
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================================
// SLACK LIFE CONTEXT ANALYSIS (Pro/Max only)
// Detects work events, team dynamics, and personal context from Slack
// ============================================================================

/**
 * Analyze Slack messages for life context - detects work events and patterns
 * Pro/Max tier feature - uses AI for deep understanding
 */
export async function analyzeSlackForLifeContext(
  messages: { text: string; timestamp: string; channel?: string; isAfterHours?: boolean }[]
): Promise<LifeContextAnalysis> {
  // Also get basic sentiment
  const sentiment = await analyzeMessageBatch(
    messages.map(m => m.text),
    { source: 'slack', date: new Date().toISOString().split('T')[0] }
  );

  if (messages.length < 5) {
    return {
      upcomingEvents: [],
      activePatterns: [],
      sentiment,
      analyzedAt: new Date().toISOString(),
    };
  }

  // Prepare messages with timestamps for context
  const messagesWithDates = messages
    .slice(0, 100) // Limit for token efficiency
    .map(m => {
      const date = new Date(parseFloat(m.timestamp) * 1000);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const channel = m.channel ? `[#${m.channel}]` : '';
      return `${channel}[${dateStr}] ${m.text}`;
    })
    .join('\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are analyzing Slack messages to understand what's happening in someone's work life. Extract work events, team dynamics, and personal context shared at work.

## Detection Categories

### Work Events & Status
1. **Project launches/releases**: "shipping tomorrow", "going live", "deployment"
2. **Deadlines**: "due by EOD", "deadline Friday", "need this by..."
3. **Incidents/issues**: "production issue", "site is down", "bug in..."
4. **Meetings**: important meetings, all-hands, reviews
5. **Milestones**: "we hit the goal", "project complete", "sprint done"

### Team Dynamics & Recognition
- **Praise received**: "great job", "kudos", "thanks for..."
- **Praise given**: User recognizing others (positive culture)
- **Collaboration**: working closely with someone, active threads
- **Team celebrations**: "team lunch", "happy hour", "celebration"

### Personal Context at Work
- **PTO/Vacation**: "I'll be out", "taking off", "vacation next week"
- **Appointments**: "doctor's appointment", "leaving early for..."
- **Life events**: "moving", "wedding", "baby", major life changes
- **Work travel**: "flying to conference", "in the office next week"

### Active Patterns
- **busy_period**: Multiple deadline mentions, long hours signals
- **project_crunch**: Intense focus on one project
- **interviewing**: (If they're hiring) multiple interview mentions
- **transitioning**: Role changes, team changes

## Rules
- Only report events/patterns with reasonable confidence
- Focus on work-relevant context that an AI assistant should know
- Note dates when mentioned ("next Tuesday", "this Friday")
- Don't invent information not present in messages

## Output JSON:
{
  "upcomingEvents": [
    {"type": "work", "summary": "Product launch scheduled", "date": "2024-01-15", "confidence": 0.85},
    {"type": "travel", "summary": "Conference trip to Austin", "date": "2024-01-20", "confidence": 0.9}
  ],
  "activePatterns": [
    {"type": "project_crunch", "description": "Intense focus on Q1 launch - multiple late nights", "evidenceCount": 4},
    {"type": "team_celebration", "description": "Team achieved major milestone", "evidenceCount": 2}
  ]
}`,
        },
        {
          role: 'user',
          content: `Analyze these ${messages.length} Slack messages from the last 30 days:

${messagesWithDates}

Extract work events, team dynamics, and patterns. Return JSON only.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      upcomingEvents: (parsed.upcomingEvents || []).map((e: LifeEvent) => ({
        type: e.type || 'work',
        summary: e.summary || 'Unknown event',
        date: e.date,
        confidence: typeof e.confidence === 'number' ? e.confidence : 0.7,
      })),
      activePatterns: (parsed.activePatterns || []).map((p: LifePattern) => ({
        type: p.type || 'unknown',
        description: p.description || '',
        evidenceCount: p.evidenceCount || 1,
      })),
      sentiment,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Slack Life Context] Error:', error);
    return {
      upcomingEvents: [],
      activePatterns: [],
      sentiment,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Merge life context from multiple sources (Gmail + Slack)
 */
export async function mergeAndStoreLifeContext(
  email: string,
  newContext: LifeContextAnalysis,
  source: 'gmail' | 'slack' | 'outlook' | 'teams'
): Promise<void> {
  const supabase = await createClient();

  // Get existing context
  const { data: existing } = await supabase
    .from('user_life_context')
    .select('upcoming_events, active_patterns')
    .eq('user_email', email)
    .single();

  let mergedEvents = newContext.upcomingEvents;
  let mergedPatterns = newContext.activePatterns;

  if (existing) {
    // Merge events (dedupe by summary similarity)
    const existingEvents = (existing.upcoming_events || []) as LifeEvent[];
    const existingPatterns = (existing.active_patterns || []) as LifePattern[];

    // Add source to new events for tracking
    const taggedNewEvents = newContext.upcomingEvents.map(e => ({
      ...e,
      source,
    }));

    // Filter out duplicates (same type + similar summary)
    const uniqueNewEvents = taggedNewEvents.filter(newEvent =>
      !existingEvents.some(existing =>
        existing.type === newEvent.type &&
        existing.summary.toLowerCase().includes(newEvent.summary.toLowerCase().split(' ')[0])
      )
    );

    mergedEvents = [...existingEvents, ...uniqueNewEvents];

    // Merge patterns (update evidence count if same type exists)
    const patternMap = new Map<string, LifePattern>();
    for (const p of existingPatterns) {
      patternMap.set(p.type, p);
    }
    for (const p of newContext.activePatterns) {
      const existing = patternMap.get(p.type);
      if (existing) {
        // Merge - take higher evidence count and combine descriptions
        patternMap.set(p.type, {
          ...existing,
          evidenceCount: Math.max(existing.evidenceCount, p.evidenceCount),
          description: existing.description.length > p.description.length ? existing.description : p.description,
        });
      } else {
        patternMap.set(p.type, p);
      }
    }
    mergedPatterns = Array.from(patternMap.values());
  }

  // Store merged context
  const { error } = await supabase
    .from('user_life_context')
    .upsert(
      {
        user_email: email,
        upcoming_events: mergedEvents,
        active_patterns: mergedPatterns,
        last_analysis_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' }
    );

  if (error) {
    console.error('[Life Context] Error storing merged context:', error);
  }

  // Store individual events in history
  for (const event of newContext.upcomingEvents) {
    if (event.date) {
      await supabase
        .from('life_events_history')
        .upsert(
          {
            user_email: email,
            event_type: event.type,
            event_summary: event.summary,
            event_date: event.date,
            confidence: event.confidence,
            source,
            detected_at: new Date().toISOString(),
          },
          { onConflict: 'user_email,event_type,event_summary,event_date' }
        );
    }
  }
}
