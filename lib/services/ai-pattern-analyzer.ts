/**
 * AI-Powered Pattern Analyzer
 *
 * Uses AI to find genuinely interesting, personalized correlations in ecosystem data
 * instead of hardcoded rules that produce generic insights.
 */

import OpenAI from 'openai';
import { EcosystemFetchResult } from './ecosystem-fetcher';
import { classifyInsights, ClassifiedInsight, UnclassifiedInsight } from './insight-classifier';
import { buildGoalsContext } from './goals-service';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

// Raw insight from AI (before classification)
export interface AIInsightRaw {
  title: string;
  finding: string;
  dataCited: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  actionableRecommendation: string;
  sources: string[];
  confidence?: number;
}

// Classified insight (after post-classification)
export interface AIInsight extends AIInsightRaw {
  designCategory: 'PREDICTION' | 'OPTIMIZATION' | 'ANALYSIS' | 'IKIGAI' | 'SOCIAL';
  classificationConfidence?: number;
  classificationReason?: string;
}

export interface AIAnalysisResult {
  insights: AIInsight[];
  summary: string;
  primaryConcern: string | null;
  hiddenPatterns: string[];
}

/**
 * Build a data summary for the AI to analyze
 */
function buildDataSummary(ecosystemData: EcosystemFetchResult): string {
  const parts: string[] = [];

  // Slack data
  if (ecosystemData.slack.available && ecosystemData.slack.data) {
    const slack = ecosystemData.slack.data as any;
    parts.push(`## SLACK DATA (${ecosystemData.slack.recordCount || 0} messages analyzed)
- Messages per day: ${slack.messageVolume?.avgPerDay || 'unknown'}
- After-hours percentage: ${slack.messageVolume?.afterHoursPercentage || 0}%
- Peak messaging hours: ${slack.messageVolume?.peakHours?.join(', ') || 'unknown'}
- Work hours detected: ${slack.workHours?.start || '?'} to ${slack.workHours?.end || '?'}
- Weekend activity: ${slack.workHours?.weekendActivity ? 'YES' : 'NO'}
- Late night messages (after 10pm): ${slack.stressIndicators?.lateNightMessages ? 'YES - SIGNIFICANT' : 'No'}
- Constant availability pattern: ${slack.stressIndicators?.constantAvailability ? 'YES' : 'No'}
- No break periods detected: ${slack.stressIndicators?.noBreakPeriods ? 'YES' : 'No'}
- Collaboration intensity: ${slack.collaborationIntensity || 'unknown'}`);
  }

  // Gmail data
  if (ecosystemData.gmail.available && ecosystemData.gmail.data) {
    const gmail = ecosystemData.gmail.data as any;
    parts.push(`## GMAIL/CALENDAR DATA
- Emails per day: ${gmail.emailVolume?.avgPerDay || 'unknown'}
- After-hours email percentage: ${gmail.emailVolume?.afterHoursPercentage || 0}%
- Peak email hours: ${gmail.emailVolume?.peakHours?.join(', ') || 'unknown'}
- Meetings per day: ${gmail.meetingDensity?.avgMeetingsPerDay || 'unknown'}
- Back-to-back meetings: ${gmail.meetingDensity?.backToBackPercentage || 0}%
- Peak meeting hours: ${gmail.meetingDensity?.peakHours?.join(', ') || 'unknown'}
- Short meeting breaks: ${gmail.stressIndicators?.shortMeetingBreaks ? 'YES' : 'No'}
- Frequent after-hours work: ${gmail.stressIndicators?.frequentAfterHoursWork ? 'YES' : 'No'}
- High email volume: ${gmail.stressIndicators?.highEmailVolume ? 'YES' : 'No'}
- Optimal meal windows: ${gmail.optimalMealWindows?.join(', ') || 'unknown'}`);
  }

  // Oura data
  if (ecosystemData.oura.available && ecosystemData.oura.data) {
    const oura = ecosystemData.oura.data as any;
    parts.push(`## OURA RING DATA (${ecosystemData.oura.daysOfData || 0} days)
- Average sleep: ${oura.avgSleepHours || 'unknown'} hours/night
- Sleep quality: ${oura.sleepQuality || 'unknown'}
- Average HRV: ${oura.avgHRV || 'unknown'} ms
- HRV trend: ${oura.hrvTrend || 'unknown'}
- Readiness score: ${oura.avgReadinessScore || 'unknown'}/100
- Activity level: ${oura.activityLevel || 'unknown'}
- Raw insights: ${oura.insights?.join('; ') || 'none'}`);
  }

  // Dexcom data
  if (ecosystemData.dexcom.available && ecosystemData.dexcom.data) {
    const dexcom = ecosystemData.dexcom.data as any;
    parts.push(`## DEXCOM CGM DATA
- Average glucose: ${dexcom.avgGlucose || 'unknown'} mg/dL
- Fasting glucose: ${dexcom.avgFastingGlucose || 'unknown'} mg/dL
- Glucose variability (SD): ${dexcom.glucoseVariability || 'unknown'}
- Time in range: ${dexcom.timeInRange || 'unknown'}%
- Spike times: ${dexcom.spikeTimes?.join(', ') || 'none detected'}
- Spike events: ${dexcom.spikeEvents?.map((e: any) => `${e.time}: ${e.value}mg/dL${e.trigger ? ` (${e.trigger})` : ''}`).join('; ') || 'none'}
- Trends: ${dexcom.trends?.join('; ') || 'none'}`);
  }

  // Vital data (Fitbit/Strava/etc)
  if (ecosystemData.vital.available && ecosystemData.vital.data) {
    const vital = ecosystemData.vital.data as any;
    parts.push(`## VITAL DATA (${vital.connectedProviders?.join(', ') || 'unknown providers'})
- Sleep data: ${JSON.stringify(vital.sleepData) || 'none'}
- Activity data: ${JSON.stringify(vital.activityData) || 'none'}
- Body data: ${JSON.stringify(vital.bodyData) || 'none'}
- Workout data: ${JSON.stringify(vital.workoutsData) || 'none'}`);
  }

  // Blood biomarkers
  if (ecosystemData.bloodBiomarkers.available && ecosystemData.bloodBiomarkers.data) {
    const bio = ecosystemData.bloodBiomarkers.data as any;
    const markers = bio.biomarkers || [];
    parts.push(`## BLOOD BIOMARKERS (${markers.length} markers)
${markers.map((m: any) => `- ${m.name}: ${m.value} (${m.status})${m.implications ? ` - ${m.implications}` : ''}`).join('\n')}
- Key concerns: ${bio.concerns?.join(', ') || 'none'}
- Optimization targets: ${bio.optimizations?.join(', ') || 'none'}`);
  }

  return parts.join('\n\n');
}

/**
 * Use AI to analyze ecosystem data and find genuinely interesting patterns
 * @param ecosystemData - The ecosystem data to analyze
 * @param email - Optional user email to fetch active goals for context
 */
export async function analyzeWithAI(ecosystemData: EcosystemFetchResult, email?: string): Promise<AIAnalysisResult> {
  const dataSummary = buildDataSummary(ecosystemData);

  // Fetch user's active goals for context injection
  let goalsContext = '';
  if (email) {
    try {
      goalsContext = await buildGoalsContext(email);
    } catch (e) {
      console.error('[AI-PATTERN-ANALYZER] Failed to fetch goals context:', e);
    }
  }

  // If no meaningful data, return empty
  if (!dataSummary || dataSummary.trim().length < 100) {
    return {
      insights: [],
      summary: 'Insufficient data for AI analysis',
      primaryConcern: null,
      hiddenPatterns: [],
    };
  }

  const openai = getOpenAIClient();

  const prompt = `You are an elite longevity and performance scientist. Analyze this person's ecosystem data and generate personalized, evidence-based insights focused on ENERGY, RECOVERY, FOCUS, and LONGEVITY.

Your insights must be grounded in the latest scientific research. DO NOT give generic advice. Find specific, personalized insights that connect multiple data points.

${dataSummary}
${goalsContext}

## CORE FOCUS AREAS (prioritize insights in these domains):

1. **ENERGY** - Mitochondrial health, glucose stability, circadian alignment, ATP production
2. **RECOVERY** - HRV optimization, sleep architecture, parasympathetic activation, inflammation markers
3. **FOCUS** - Cognitive performance, dopamine/norepinephrine balance, attention windows, deep work capacity
4. **LONGEVITY** - Metabolic health markers, cellular stress, autophagy triggers, biological age indicators

## YOUR TASK

Generate 1-7 insights based on what meaningful patterns actually exist in the data. Quality over quantity - only generate insights where you have HIGH CONFIDENCE in the pattern.

Aim for variety in your insights:
- Predictions about upcoming opportunities
- Small optimizations that could unlock better performance
- Patterns that reveal important health connections
- Connections between health and peak performance
- Social/connection-based health insights

## CRITICAL RULES

1. **TITLES must be ELEGANT, POSITIVE, and EASY TO UNDERSTAND**
   - Write titles like a wellness coach, not a scientist
   - Use positive, affirming language that inspires action
   - Keep it simple - no jargon, no complex terms
   - ❌ BAD: "HRV Drop Detected Post-Late-Night Digital Activity"
   - ❌ BAD: "Glucose Variability Correlates with Meeting Density"
   - ✅ GOOD: "Your Body Thrives When You Unplug by 10pm"
   - ✅ GOOD: "A Short Walk Could Transform Your Afternoon"

2. **CITE SCIENTIFIC EVIDENCE in the finding** (not the title):
   - "This is because..." (mechanism)
   - "Research shows..." (evidence)
   - Include journal/year when possible for credibility

3. **NEVER recommend continuing current behavior.** Every insight MUST suggest a CHANGE or NEW action.
   - ❌ BAD: "Keep up the great sleep schedule"
   - ✅ GOOD: "Adding 20min to your sleep could increase HRV by 8%"

4. **Focus on HIGH-LEVERAGE interventions** - small changes with outsized impact

5. **Be specific with timing and numbers in the finding** - cite exact values

6. **Connect multiple data sources when possible** - Cross-ecosystem insights are most valuable

7. **Only generate insights you're confident about** - if data is sparse, generate fewer insights

## EVIDENCE-BASED FRAMEWORKS TO APPLY:

- **Circadian optimization**: Light exposure, meal timing, temperature
- **Metabolic flexibility**: Glucose variability, fasting windows, insulin sensitivity
- **Autonomic balance**: HRV patterns, stress recovery, vagal tone
- **Sleep architecture**: Deep sleep, REM, sleep efficiency, consistency
- **Inflammation markers**: CRP, stress indicators, recovery patterns
- **Hormetic stress**: Exercise timing, cold/heat exposure, fasting

Examples of EXCELLENT insights:
- Title: "A Short Walk Could Transform Your Afternoon"
  Finding: "Your 2pm glucose spikes (+45 mg/dL) correlate with afternoon energy dips. A 15-min walk post-lunch activates GLUT4 transporters, potentially reducing this spike by 30% and extending your focus window by 2 hours."

- Title: "Your Body Thrives When You Unplug by 10pm"
  Finding: "HRV drops 23% after late-night screen time. Blue light suppresses melatonin by 50% (Journal of Pineal Research). Unplugging earlier could add 20 minutes of deep sleep."

- Title: "Your Best Focus Window Opens Tomorrow at 10am"
  Finding: "Based on your sleep patterns from the past week, tomorrow morning looks optimal for deep work. Your HRV typically peaks around this time after 7+ hours of sleep."

Return JSON:
{
  "insights": [
    {
      "title": "Elegant title (5-10 words)",
      "finding": "The specific pattern found with exact numbers (2-3 sentences)",
      "dataCited": ["Slack: 42% after-hours", "Oura: HRV 45ms declining", "etc"],
      "impact": "critical|high|medium|low",
      "actionableRecommendation": "Specific NEW action to take (1-2 sentences)",
      "sources": ["slack", "oura", "etc"],
      "confidence": 0.85
    }
  ],
  "summary": "2-3 sentence overview of the most important finding",
  "primaryConcern": "The single biggest issue to address first (or null if none)",
  "hiddenPatterns": ["Pattern 1 they probably haven't noticed", "Pattern 2", "etc"]
}

REMEMBER: Generate only high-confidence insights. Be brutally specific. No fluff. Cite exact numbers. Never recommend maintaining status quo.`;

  try {
    console.log('[AI-PATTERN-ANALYZER] Calling AI for pattern analysis...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an elite health data analyst. Return only valid JSON, no markdown.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';

    // Parse JSON response
    let parsed: AIAnalysisResult;
    try {
      // Clean markdown if present
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('[AI-PATTERN-ANALYZER] Failed to parse AI response:', parseError);
      return {
        insights: [],
        summary: 'AI analysis failed to parse',
        primaryConcern: null,
        hiddenPatterns: [],
      };
    }

    // Ensure insights is always an array (AI might return object/string unexpectedly)
    const rawInsights: UnclassifiedInsight[] = Array.isArray(parsed.insights) ? parsed.insights : [];
    const hiddenPatterns = Array.isArray(parsed.hiddenPatterns) ? parsed.hiddenPatterns : [];

    // Post-classify insights to assign design categories
    const classifiedInsights = classifyInsights(rawInsights);

    console.log(`[AI-PATTERN-ANALYZER] Generated ${rawInsights.length} AI insights, classified into categories`);

    return {
      insights: classifiedInsights,
      summary: parsed.summary || '',
      primaryConcern: parsed.primaryConcern || null,
      hiddenPatterns,
    };

  } catch (error) {
    console.error('[AI-PATTERN-ANALYZER] AI analysis error:', error);
    return {
      insights: [],
      summary: 'AI analysis failed',
      primaryConcern: null,
      hiddenPatterns: [],
    };
  }
}
