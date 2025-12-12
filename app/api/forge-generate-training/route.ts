import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildTrainingProgramPrompt } from '@/lib/prompts/training-program-prompt';

export const maxDuration = 300; // 5 minutes max

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({
    apiKey,
    timeout: 240000, // 4 minutes timeout (leave 1 min buffer for maxDuration)
    maxRetries: 2,
  });
}

/**
 * Attempt to repair truncated or malformed JSON
 * This handles cases where GPT-5 response gets cut off mid-stream
 */
function repairJSON(jsonString: string): string {
  let repaired = jsonString.trim();

  // Count open vs close braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
  }

  // If we're still in a string, close it
  if (inString) {
    repaired += '"';
  }

  // Remove any trailing incomplete property (e.g., "key": or "key":  )
  repaired = repaired.replace(/,?\s*"[^"]*":\s*$/, '');
  repaired = repaired.replace(/,?\s*"[^"]*$/, '');

  // Remove trailing comma before closing
  repaired = repaired.replace(/,(\s*)$/, '$1');

  // Add missing closing brackets and braces
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }

  return repaired;
}

/**
 * Try to parse JSON with multiple repair attempts
 */
function parseJSONWithRepair(jsonString: string): any {
  // First, try parsing as-is
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.log('[TRAINING-AGENT] Initial parse failed, attempting repair...');
  }

  // Try repairing the JSON
  const repaired = repairJSON(jsonString);
  try {
    const result = JSON.parse(repaired);
    console.log('[TRAINING-AGENT] ✅ JSON repaired successfully');
    return result;
  } catch (e) {
    console.log('[TRAINING-AGENT] Repair attempt 1 failed, trying aggressive repair...');
  }

  // Aggressive repair: find the last valid closing brace
  let lastValidEnd = jsonString.length;
  for (let i = jsonString.length - 1; i >= 0; i--) {
    const substring = jsonString.substring(0, i + 1);
    // Try to find a point where JSON could be valid
    if (substring.endsWith('}') || substring.endsWith('}]') || substring.endsWith('"}')) {
      try {
        const testRepair = repairJSON(substring);
        const result = JSON.parse(testRepair);
        console.log(`[TRAINING-AGENT] ✅ JSON repaired by truncating at position ${i + 1}`);
        return result;
      } catch (e) {
        // Keep trying
      }
    }
  }

  // Last resort: throw the original error
  throw new Error('Could not repair JSON after multiple attempts');
}

/**
 * Build a minimal prompt for retry (just weeklyProgram, no philosophy sections)
 */
function buildMinimalPrompt(userProfile: any, trainingProtocol: any): string {
  return `You are a fitness coach. Generate a simple 7-day workout program.

USER: ${userProfile.name}, ${userProfile.age} years old, ${userProfile.gender}
GOALS: ${userProfile.goals?.join(', ') || 'General fitness'}
EQUIPMENT: ${userProfile.equipment?.join(', ') || 'Full gym'}
${userProfile.currentBests ? `CURRENT BESTS (5RM): ${userProfile.currentBests}` : ''}

Return ONLY this JSON structure (under 12,000 characters):
{
  "executiveSummary": "2-3 sentences about this plan (50 words max)",
  "weeklyProgram": {
    "monday": { "dayName": "Monday", "focus": "...", "duration": "...", "warmup": {...}, "mainWorkout": [...], "cooldown": {...} },
    "tuesday": { "dayName": "Tuesday", "focus": "Rest Day", "activities": "Light stretching" },
    ... (all 7 days)
  }
}

Each exercise MUST include all fields:
{ "exercise": "Name", "sets": "4 sets", "reps": "6-8 reps", "weight": "60 kg", "rest": "90 seconds", "tempo": "Lower 2 sec, lift 1 sec", "intensity": "Effort description", "notes": "Form cue", "progressionNotes": "How to advance" }

WEIGHT RULES: Calculate from user's 5RM - use 70-75% for 6-8 reps, 60-70% for 8-12 reps.

Return ONLY valid JSON.`;
}

/**
 * Clean and parse JSON response
 */
function cleanAndParseResponse(responseText: string): any {
  let cleaned = responseText.trim();

  // Strip markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  cleaned = cleaned.trim();

  // Additional sanitization
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  cleaned = cleaned.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  return parseJSONWithRepair(cleaned);
}

export async function POST(request: NextRequest) {
  try {
    console.log('[TRAINING-AGENT] Starting training program generation...');

    const body = await request.json();
    const { userProfile, biomarkers, recommendations, unifiedContext } = body;

    if (!userProfile || !recommendations) {
      return NextResponse.json(
        { error: 'Missing required fields: userProfile and recommendations are required' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    // Build the specialized training prompt
    const trainingProtocol = recommendations.training_protocol || {};
    const promptInput = {
      userProfile,
      trainingProtocol,
      biomarkers: biomarkers || {}
    };

    const basePrompt = buildTrainingProgramPrompt(promptInput);

    // Enrich with unified context if available (but keep it shorter)
    let prompt = basePrompt;
    if (unifiedContext) {
      console.log('[TRAINING-AGENT] Enriching prompt with unified ecosystem context');

      // Build a rich context summary from all connected sources
      const parts: string[] = [];

      // Connected data sources
      const dataSources = unifiedContext.dataSourcesUsed || unifiedContext.dataSources || {};
      const connectedSources = Object.entries(dataSources)
        .filter(([_, v]: [string, any]) => v?.available)
        .map(([k]) => k);
      if (connectedSources.length > 0) {
        parts.push(`**Connected Integrations:** ${connectedSources.join(', ')}`);
      }

      // Extract raw patterns from ecosystem data (preserves actual stats)
      const rawPatterns = unifiedContext.rawPatterns || unifiedContext.ecosystemPatterns || {};
      const slackPatterns = rawPatterns.slack || unifiedContext.slackPatterns || {};
      const gmailPatterns = rawPatterns.gmail || unifiedContext.gmailPatterns || {};

      // Behavioral patterns from Gmail/Slack/Outlook - with ACTUAL stats from raw data
      const behavioral = unifiedContext.unifiedProfile?.behavioral;
      if (behavioral?.workPatterns || slackPatterns?.messageVolume || gmailPatterns?.emailVolume) {
        const wp = behavioral?.workPatterns || {};

        // Get actual percentages from raw Slack data
        const afterHoursPercent = slackPatterns?.messageVolume?.afterHoursPercentage
          || gmailPatterns?.emailVolume?.afterHoursPercentage
          || null;
        const avgMessagesPerDay = slackPatterns?.messageVolume?.avgPerDay || null;
        const slackPeakHours = slackPatterns?.messageVolume?.peakHours || [];
        const workStart = slackPatterns?.workHours?.start || gmailPatterns?.workHours?.start || null;
        const workEnd = slackPatterns?.workHours?.end || gmailPatterns?.workHours?.end || null;
        const lateNightMessages = slackPatterns?.stressIndicators?.lateNightMessages || false;
        const weekendActivity = slackPatterns?.workHours?.weekendActivity || false;

        // Get actual meeting stats from Gmail
        const avgMeetingsPerDay = gmailPatterns?.meetingDensity?.avgPerDay || null;
        const backToBackPercent = gmailPatterns?.meetingDensity?.backToBackPercentage || null;
        const meetingPeakHours = gmailPatterns?.meetingDensity?.peakHours || [];

        let workPatternsText = `**Work Patterns (from Gmail/Slack/Outlook) - CITE THESE EXACT STATS:**\n`;
        workPatternsText += `- Stress Level: ${wp.stressLevel || 'moderate'}\n`;
        workPatternsText += `- Work-Life Balance: ${wp.workLifeBalance || 'moderate'}\n`;

        // Use ACTUAL stats, not placeholders
        if (afterHoursPercent !== null) {
          workPatternsText += `- After-hours Activity: ${afterHoursPercent}% of messages sent outside work hours\n`;
        }
        if (avgMessagesPerDay !== null) {
          workPatternsText += `- Slack Activity: ${avgMessagesPerDay} messages/day average\n`;
        }
        if (slackPeakHours.length > 0) {
          workPatternsText += `- Peak Messaging Hours: ${slackPeakHours.join(', ')}\n`;
        }
        if (lateNightMessages) {
          workPatternsText += `- ⚠️ LATE NIGHT ACTIVITY: Significant messaging detected after 10pm (affects recovery!)\n`;
        }
        if (weekendActivity) {
          workPatternsText += `- Weekend Work: Active on weekends (impacts rest days)\n`;
        }
        if (workStart && workEnd) {
          workPatternsText += `- Actual Work Hours: ${workStart} to ${workEnd}\n`;
        }
        if (avgMeetingsPerDay !== null) {
          workPatternsText += `- Meeting Density: ${avgMeetingsPerDay} meetings/day average\n`;
        }
        if (backToBackPercent !== null) {
          workPatternsText += `- Back-to-back Meetings: ${backToBackPercent}% with no breaks\n`;
        }
        if (meetingPeakHours.length > 0) {
          workPatternsText += `- Peak Meeting Hours: ${meetingPeakHours.join(', ')}\n`;
        }
        workPatternsText += `- Best Training Windows: ${wp.optimalMealWindows?.join(', ') || 'Before work hours or after meetings end'}`;

        parts.push(workPatternsText);
      }

      // Sleep/Recovery from Oura/Fitbit - with ACTUAL stats from raw data
      const physiological = unifiedContext.unifiedProfile?.physiological;
      const ouraRaw = rawPatterns.oura || {};

      if (physiological?.sleep?.avgHours || ouraRaw?.avgSleepHours) {
        let recoveryText = `**Recovery Data (from Oura/Fitbit) - CITE THESE EXACT STATS:**\n`;

        // Use raw Oura data for actual numbers
        const avgSleep = ouraRaw?.avgSleepHours || physiological?.sleep?.avgHours;
        const avgHRV = ouraRaw?.avgHRV || null;
        const readiness = ouraRaw?.avgReadinessScore || physiological?.recovery?.readinessScore;
        const hrvTrend = ouraRaw?.hrvTrend || null;
        const sleepQuality = ouraRaw?.sleepQuality || physiological?.sleep?.quality;
        const activityLevel = ouraRaw?.activityLevel || null;

        if (avgSleep) {
          recoveryText += `- Average Sleep: ${avgSleep}h/night\n`;
        }
        if (sleepQuality) {
          recoveryText += `- Sleep Quality: ${sleepQuality}\n`;
        }
        if (avgHRV) {
          recoveryText += `- HRV: ${avgHRV}ms average\n`;
        }
        if (hrvTrend) {
          recoveryText += `- HRV Trend: ${hrvTrend} (${hrvTrend === 'declining' ? '⚠️ recovery compromised' : hrvTrend === 'improving' ? 'good progress' : 'stable'})\n`;
        }
        if (physiological?.sleep?.sleepDebt && physiological.sleep.sleepDebt > 0) {
          recoveryText += `- ⚠️ Sleep Debt: ${physiological.sleep.sleepDebt}h accumulated\n`;
        }
        if (readiness) {
          recoveryText += `- Readiness Score: ${readiness}/100\n`;
        }
        if (activityLevel) {
          recoveryText += `- Activity Level: ${activityLevel}\n`;
        }
        if (physiological?.recovery?.overtrainingRisk) {
          recoveryText += `- ⚠️ OVERTRAINING RISK: Elevated - reduce training volume\n`;
        }

        // Add Oura insights if available
        if (ouraRaw?.insights && ouraRaw.insights.length > 0) {
          recoveryText += `- Insights: ${ouraRaw.insights.slice(0, 2).join('; ')}`;
        }

        parts.push(recoveryText);
      }

      // Glucose/CGM Data from Dexcom - with ACTUAL stats
      const dexcomRaw = rawPatterns.dexcom || {};
      const glucoseData = physiological?.glucose || {};

      if (dexcomRaw?.avgGlucose || glucoseData?.avgGlucose) {
        let glucoseText = `**Glucose Data (from Dexcom CGM) - CITE THESE EXACT STATS:**\n`;

        const avgGlucose = dexcomRaw?.avgGlucose || glucoseData?.avgGlucose;
        const fastingGlucose = dexcomRaw?.avgFastingGlucose || null;
        const variability = dexcomRaw?.glucoseVariability || null;
        const timeInRange = dexcomRaw?.timeInRange || null;
        const spikeTimes = dexcomRaw?.spikeTimes || [];
        const spikeEvents = dexcomRaw?.spikeEvents || [];

        if (avgGlucose) {
          const status = avgGlucose > 115 ? '⚠️ elevated' : avgGlucose > 100 ? 'slightly elevated' : 'optimal';
          glucoseText += `- Average Glucose: ${avgGlucose} mg/dL (${status})\n`;
        }
        if (fastingGlucose) {
          glucoseText += `- Fasting Glucose: ${fastingGlucose} mg/dL\n`;
        }
        if (variability) {
          const varStatus = variability > 35 ? 'high - unstable' : variability > 20 ? 'moderate' : 'low - stable';
          glucoseText += `- Glucose Variability: ${variability} (${varStatus})\n`;
        }
        if (timeInRange) {
          glucoseText += `- Time in Range: ${timeInRange}% ${timeInRange < 70 ? '(⚠️ below target of 70%)' : '(good)'}\n`;
        }
        if (spikeTimes.length > 0) {
          glucoseText += `- Spike Times: ${spikeTimes.join(', ')} (avoid carbs before these times)\n`;
        }
        if (spikeEvents.length > 0) {
          const topSpikes = spikeEvents.slice(0, 3).map((e: any) => `${e.time}: ${e.value}mg/dL${e.trigger ? ` (${e.trigger})` : ''}`);
          glucoseText += `- Recent Spike Events: ${topSpikes.join('; ')}\n`;
        }

        // Add Dexcom insights if available
        if (dexcomRaw?.insights && dexcomRaw.insights.length > 0) {
          glucoseText += `- Insights: ${dexcomRaw.insights.slice(0, 2).join('; ')}`;
        }

        parts.push(glucoseText);
      }

      // Vital Data (Fitbit/Strava/Garmin/etc.) - with actual stats
      const vitalRaw = rawPatterns.vital || {};

      if (vitalRaw?.connectedProviders && vitalRaw.connectedProviders.length > 0) {
        let vitalText = `**Wearable Data (from ${vitalRaw.connectedProviders.join(', ')}) - CITE THESE STATS:**\n`;

        // Activity data
        if (vitalRaw?.activityData) {
          const activity = vitalRaw.activityData;
          if (activity.steps) vitalText += `- Daily Steps: ${activity.steps} average\n`;
          if (activity.calories) vitalText += `- Calories Burned: ${activity.calories} kcal/day\n`;
          if (activity.activeMinutes) vitalText += `- Active Minutes: ${activity.activeMinutes} min/day\n`;
        }

        // Sleep data (if not from Oura)
        if (vitalRaw?.sleepData && !ouraRaw?.avgSleepHours) {
          const sleep = vitalRaw.sleepData;
          if (sleep.duration) vitalText += `- Sleep Duration: ${sleep.duration}h average\n`;
          if (sleep.efficiency) vitalText += `- Sleep Efficiency: ${sleep.efficiency}%\n`;
        }

        // Workout data
        if (vitalRaw?.workoutsData) {
          const workouts = vitalRaw.workoutsData;
          if (workouts.weeklyCount) vitalText += `- Workouts/Week: ${workouts.weeklyCount}\n`;
          if (workouts.avgDuration) vitalText += `- Avg Workout Duration: ${workouts.avgDuration} min\n`;
          if (workouts.types) vitalText += `- Workout Types: ${workouts.types.join(', ')}\n`;
        }

        // Body data
        if (vitalRaw?.bodyData) {
          const body = vitalRaw.bodyData;
          if (body.weight) vitalText += `- Weight: ${body.weight} kg\n`;
          if (body.bodyFat) vitalText += `- Body Fat: ${body.bodyFat}%\n`;
        }

        // Insights
        if (vitalRaw?.insights && vitalRaw.insights.length > 0) {
          vitalText += `- Insights: ${vitalRaw.insights.slice(0, 2).join('; ')}`;
        }

        parts.push(vitalText);
      }

      // Blood Biomarkers - with actual values
      const biomarkersRaw = rawPatterns.bloodBiomarkers || {};

      if (biomarkersRaw?.biomarkers && biomarkersRaw.biomarkers.length > 0) {
        let bioText = `**Blood Biomarkers - CITE THESE EXACT VALUES:**\n`;

        // Show top biomarkers with their values and status
        const topMarkers = biomarkersRaw.biomarkers.slice(0, 8);
        topMarkers.forEach((marker: any) => {
          const statusIcon = marker.status === 'low' || marker.status === 'high' ? '⚠️ ' : '';
          bioText += `- ${marker.name}: ${marker.value} (${statusIcon}${marker.status})\n`;
        });

        // Show concerns if any
        if (biomarkersRaw?.concerns && biomarkersRaw.concerns.length > 0) {
          bioText += `- ⚠️ Key Concerns: ${biomarkersRaw.concerns.join(', ')}\n`;
        }

        // Show optimizations if any
        if (biomarkersRaw?.optimizations && biomarkersRaw.optimizations.length > 0) {
          bioText += `- Optimization Targets: ${biomarkersRaw.optimizations.slice(0, 3).join(', ')}`;
        }

        parts.push(bioText);
      }

      // AI-Powered Insights (prioritize these - they're genuinely interesting)
      const aiAnalysis = unifiedContext.aiAnalysis || {};
      if (aiAnalysis.insights && aiAnalysis.insights.length > 0) {
        let aiText = `**AI-DISCOVERED PATTERNS (Non-obvious correlations - MUST CITE IN YOUR RESPONSE):**\n`;

        if (aiAnalysis.primaryConcern) {
          aiText += `\n⚠️ PRIMARY CONCERN: ${aiAnalysis.primaryConcern}\n\n`;
        }

        aiAnalysis.insights.forEach((insight: any, idx: number) => {
          aiText += `\n${idx + 1}. **${insight.title}** (Impact: ${insight.impact})\n`;
          aiText += `   Finding: ${insight.finding}\n`;
          aiText += `   Data: ${insight.dataCited?.join(', ') || 'N/A'}\n`;
          aiText += `   Action: ${insight.actionableRecommendation}\n`;
        });

        if (aiAnalysis.hiddenPatterns && aiAnalysis.hiddenPatterns.length > 0) {
          aiText += `\n**Hidden Patterns You Probably Haven't Noticed:**\n`;
          aiAnalysis.hiddenPatterns.forEach((pattern: string) => {
            aiText += `- ${pattern}\n`;
          });
        }

        parts.push(aiText);
      }

      // Fallback to rule-based insights if no AI insights
      if (!aiAnalysis.insights || aiAnalysis.insights.length === 0) {
        const insights = unifiedContext.keyInsights?.slice(0, 3) || [];
        if (insights.length > 0) {
          parts.push(`**Cross-Source Insights:**\n${insights.map((i: any) => `- ${i.insight || i}`).join('\n')}`);
        }
      }

      const contextEnrichment = `\n\n## ECOSYSTEM DATA (Use this to personalize intros and recommendations)

${parts.join('\n\n')}

**IMPORTANT:** Reference the connected integrations and their data in your executiveSummary and trainingPhilosophy sections. For example:
- "Based on your Gmail calendar showing high meeting density..."
- "Your Oura data indicates sleep averaging X hours..."
- "With Slack showing after-hours activity..."

Keep response under 20,000 characters.`;
      prompt = basePrompt + contextEnrichment;
    }

    console.log('[TRAINING-AGENT] Calling GPT-5 with medium reasoning...');
    let aiResponse;
    let usedMinimalPrompt = false;

    try {
      const completion = await openai.responses.create({
        model: 'gpt-5',
        input: prompt,
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' }
      });

      const responseText = completion.output_text || '{}';
      console.log('[TRAINING-AGENT] Response length:', responseText.length);

      aiResponse = cleanAndParseResponse(responseText);
    } catch (firstError) {
      console.log('[TRAINING-AGENT] ⚠️ First attempt failed, retrying with minimal prompt...');
      console.log('[TRAINING-AGENT] Error:', firstError instanceof Error ? firstError.message : 'Unknown');

      // Retry with minimal prompt
      usedMinimalPrompt = true;
      const minimalPrompt = buildMinimalPrompt(userProfile, trainingProtocol);

      try {
        const retryCompletion = await openai.responses.create({
          model: 'gpt-5',
          input: minimalPrompt,
          reasoning: { effort: 'low' },  // Lower effort for simpler prompt
          text: { verbosity: 'low' }     // Lower verbosity for shorter output
        });

        const retryText = retryCompletion.output_text || '{}';
        console.log('[TRAINING-AGENT] Retry response length:', retryText.length);

        aiResponse = cleanAndParseResponse(retryText);
        console.log('[TRAINING-AGENT] ✅ Retry successful with minimal prompt');
      } catch (retryError) {
        console.error('[TRAINING-AGENT] ❌ Retry also failed:', retryError);
        throw new Error(`Failed to parse training program after retry: ${retryError instanceof Error ? retryError.message : 'Unknown'}`);
      }
    }

    // Extract all training sections from AI response
    const executiveSummary = aiResponse.executiveSummary;
    const weeklyProgram = aiResponse.weeklyProgram || aiResponse;
    const trainingPhilosophy = aiResponse.trainingPhilosophy;
    const weeklyStructure = aiResponse.weeklyStructure;

    console.log('[TRAINING-AGENT] ✅ Training program generated successfully');
    console.log('[TRAINING-AGENT] Used minimal prompt:', usedMinimalPrompt);
    console.log('[TRAINING-AGENT] Has executiveSummary:', !!executiveSummary);
    console.log('[TRAINING-AGENT] Has weeklyProgram:', !!weeklyProgram);
    console.log('[TRAINING-AGENT] Has trainingPhilosophy:', !!trainingPhilosophy);
    console.log('[TRAINING-AGENT] Has weeklyStructure:', !!weeklyStructure);

    return NextResponse.json({
      success: true,
      executiveSummary,
      weeklyProgram,
      trainingPhilosophy,
      weeklyStructure,
      usedMinimalPrompt
    });

  } catch (error) {
    console.error('[TRAINING-AGENT] ❌ Error generating training program:', error);
    console.error('[TRAINING-AGENT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[TRAINING-AGENT] Error message:', error instanceof Error ? error.message : 'No message');

    // Log more details about the error with proper serialization
    if (error && typeof error === 'object') {
      try {
        console.error('[TRAINING-AGENT] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (serializationError) {
        console.error('[TRAINING-AGENT] Could not serialize error:', serializationError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor?.name || 'Unknown'
      },
      { status: 500 }
    );
  }
}
