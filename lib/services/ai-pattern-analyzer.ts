/**
 * AI-Powered Pattern Analyzer
 *
 * Uses AI to find genuinely interesting, personalized correlations in ecosystem data
 * instead of hardcoded rules that produce generic insights.
 */

import OpenAI from 'openai';
import { EcosystemFetchResult } from './ecosystem-fetcher';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

export interface AIInsight {
  title: string;
  finding: string;
  dataCited: string[];
  impact: 'critical' | 'high' | 'medium' | 'low';
  actionableRecommendation: string;
  sources: string[];
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
 */
export async function analyzeWithAI(ecosystemData: EcosystemFetchResult): Promise<AIAnalysisResult> {
  const dataSummary = buildDataSummary(ecosystemData);

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

  const prompt = `You are an elite health data analyst. Analyze this person's ecosystem data and find GENUINELY INTERESTING, NON-OBVIOUS patterns and correlations.

DO NOT give generic advice like "you work late" or "sleep more". Find specific, personalized insights that connect multiple data points.

${dataSummary}

## YOUR TASK

Find 3-5 insights that are:
1. **SPECIFIC** - cite exact numbers from the data
2. **CROSS-SOURCE** - connect patterns across different data sources (e.g., Slack activity timing + glucose spikes + sleep quality)
3. **NON-OBVIOUS** - things the person probably hasn't noticed themselves
4. **ACTIONABLE** - with a specific recommendation

Examples of GOOD insights:
- "Your glucose spikes at 14:00-15:00 coincide with your back-to-back meeting blocks (68%). The stress-cortisol response is likely amplifying post-lunch glucose. Try a 10-min walk between meetings."
- "Your HRV drops 23% on days following late-night Slack activity (after 11pm). The 2-3am messaging pattern is directly impacting next-day recovery."
- "Despite 7h sleep, your readiness is only 62/100. Your peak email hours (8-10pm) overlap with your wind-down window, suppressing melatonin."

Examples of BAD insights (too generic):
- "You work after hours which affects sleep"
- "High meeting load causes stress"
- "Try to sleep more"

Return JSON:
{
  "insights": [
    {
      "title": "Short, catchy title (5-8 words)",
      "finding": "The specific pattern found with exact numbers (2-3 sentences)",
      "dataCited": ["Slack: 42% after-hours", "Oura: HRV 45ms declining", "etc"],
      "impact": "critical|high|medium|low",
      "actionableRecommendation": "Specific action to take (1-2 sentences)",
      "sources": ["slack", "oura", "etc"]
    }
  ],
  "summary": "2-3 sentence overview of the most important finding",
  "primaryConcern": "The single biggest issue to address first (or null if none)",
  "hiddenPatterns": ["Pattern 1 they probably haven't noticed", "Pattern 2", "etc"]
}

Be brutally specific. No fluff. Cite exact numbers.`;

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

    console.log(`[AI-PATTERN-ANALYZER] Generated ${parsed.insights?.length || 0} AI insights`);

    return {
      insights: parsed.insights || [],
      summary: parsed.summary || '',
      primaryConcern: parsed.primaryConcern || null,
      hiddenPatterns: parsed.hiddenPatterns || [],
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
