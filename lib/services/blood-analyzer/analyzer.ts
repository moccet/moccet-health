/**
 * Blood Analyzer - Analysis Generator
 * Uses GPT-4o to generate comprehensive insights from extracted biomarkers
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { Biomarker, BloodAnalysisResult, Recommendations, ANALYSIS_MODEL } from './types';
import { getConcerningBiomarkers, getOptimalBiomarkers, groupByCategory } from './validator';

const openai = new OpenAI();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Get user context for personalized analysis
 */
async function getUserContext(email: string): Promise<string> {
  try {
    const { data: userData } = await supabase
      .from('sage_onboarding_data')
      .select('health_goals, medical_conditions, medications, supplements, dietary_preferences, age, gender')
      .eq('email', email)
      .maybeSingle();

    if (!userData) {
      return 'No user health profile available.';
    }

    const context: string[] = [];

    if (userData.age) context.push(`Age: ${userData.age}`);
    if (userData.gender) context.push(`Gender: ${userData.gender}`);
    if (userData.health_goals) context.push(`Health goals: ${JSON.stringify(userData.health_goals)}`);
    if (userData.medical_conditions) context.push(`Medical conditions: ${JSON.stringify(userData.medical_conditions)}`);
    if (userData.medications) context.push(`Current medications: ${JSON.stringify(userData.medications)}`);
    if (userData.supplements) context.push(`Current supplements: ${JSON.stringify(userData.supplements)}`);
    if (userData.dietary_preferences) context.push(`Dietary preferences: ${JSON.stringify(userData.dietary_preferences)}`);

    return context.length > 0
      ? context.join('\n')
      : 'No detailed health profile available.';
  } catch (error) {
    console.error('[Blood Analyzer] Error fetching user context:', error);
    return 'Unable to retrieve user health profile.';
  }
}

/**
 * Generate comprehensive analysis from biomarkers using GPT-4o
 */
export async function generateAnalysis(
  biomarkers: Biomarker[],
  userEmail: string,
  confidence: number
): Promise<Omit<BloodAnalysisResult, 'processingTimeMs' | 'batchResults'>> {
  console.log(`[Blood Analyzer] Generating analysis for ${biomarkers.length} biomarkers`);

  const userContext = await getUserContext(userEmail);
  const concerningMarkers = getConcerningBiomarkers(biomarkers);
  const optimalMarkers = getOptimalBiomarkers(biomarkers);
  const groupedMarkers = groupByCategory(biomarkers);

  const systemPrompt = `You are a clinical health specialist analyzing blood test results. Provide a comprehensive, personalized analysis.

## User Profile:
${userContext}

## Analysis Guidelines:
1. Start with a 2-3 sentence summary of overall health status
2. Highlight concerning markers that need attention
3. Acknowledge positive/optimal results
4. Provide specific, actionable recommendations
5. Be empathetic but direct about health implications
6. Consider the user's health goals and current supplements/medications
7. Flag any interactions or considerations with their current regimen

## Important Notes:
- This analysis is for informational purposes only
- Recommend consulting a healthcare provider for concerning results
- Be specific in recommendations (e.g., "increase omega-3 intake to 2g/day" not just "eat more fish")
- Consider the relationship between different markers (e.g., iron status affects energy levels)

## Output Format (JSON):
{
  "summary": "2-3 sentence overview of results",
  "concerns": ["Specific concern 1 with marker name and value", ...],
  "positives": ["Positive finding 1 with marker name", ...],
  "recommendations": {
    "lifestyle": ["Specific lifestyle recommendation 1", ...],
    "dietary": ["Specific dietary recommendation 1", ...],
    "supplements": ["Supplement recommendation with dosage if applicable", ...],
    "followUp": ["Follow-up test or action recommended", ...]
  }
}`;

  const userPrompt = `Analyze these ${biomarkers.length} blood test biomarkers:

## Biomarkers by Category:
${Object.entries(groupedMarkers).map(([category, markers]) => {
  return `### ${category.replace(/_/g, ' ').toUpperCase()}
${markers.map(m => `- ${m.name}: ${m.value} ${m.unit} (ref: ${m.referenceRange}) - ${m.status.toUpperCase()}`).join('\n')}`;
}).join('\n\n')}

## Summary Stats:
- Total biomarkers: ${biomarkers.length}
- Concerning markers: ${concerningMarkers.length}
- Optimal/Normal markers: ${optimalMarkers.length}
- Extraction confidence: ${confidence}%

${concerningMarkers.length > 0 ? `
## Markers Needing Attention:
${concerningMarkers.map(m => `- ${m.name}: ${m.value} ${m.unit} (${m.status}) - ${m.implications || 'Needs review'}`).join('\n')}
` : ''}

Provide a comprehensive analysis with personalized recommendations based on the user's profile.`;

  try {
    const response = await openai.chat.completions.create({
      model: ANALYSIS_MODEL,
      max_tokens: 4000,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No analysis content returned from GPT-4o');
    }

    const analysis = JSON.parse(content);

    // Ensure all fields exist with defaults
    const result: Omit<BloodAnalysisResult, 'processingTimeMs' | 'batchResults'> = {
      summary: analysis.summary || 'Analysis complete.',
      biomarkers,
      totalCount: biomarkers.length,
      concerns: analysis.concerns || [],
      positives: analysis.positives || [],
      recommendations: {
        lifestyle: analysis.recommendations?.lifestyle || [],
        dietary: analysis.recommendations?.dietary || [],
        supplements: analysis.recommendations?.supplements || [],
        followUp: analysis.recommendations?.followUp || []
      },
      confidence
    };

    console.log(`[Blood Analyzer] Analysis generated:`);
    console.log(`  - Concerns: ${result.concerns.length}`);
    console.log(`  - Positives: ${result.positives.length}`);
    console.log(`  - Lifestyle recs: ${result.recommendations.lifestyle.length}`);
    console.log(`  - Dietary recs: ${result.recommendations.dietary.length}`);
    console.log(`  - Supplement recs: ${result.recommendations.supplements.length}`);
    console.log(`  - Follow-up recs: ${result.recommendations.followUp.length}`);

    return result;
  } catch (error) {
    console.error('[Blood Analyzer] Error generating analysis:', error);

    // Return a basic analysis on error
    return {
      summary: `Analysis of ${biomarkers.length} biomarkers completed. ${concerningMarkers.length} markers require attention.`,
      biomarkers,
      totalCount: biomarkers.length,
      concerns: concerningMarkers.map(m => `${m.name}: ${m.value} ${m.unit} (${m.status})`),
      positives: optimalMarkers.slice(0, 5).map(m => `${m.name}: ${m.value} ${m.unit} (${m.status})`),
      recommendations: {
        lifestyle: ['Review results with a healthcare provider'],
        dietary: [],
        supplements: [],
        followUp: ['Schedule follow-up blood work in 3-6 months']
      },
      confidence
    };
  }
}

/**
 * Save analysis result to database
 */
export async function saveAnalysisToDatabase(
  email: string,
  analysis: BloodAnalysisResult
): Promise<void> {
  console.log(`[Blood Analyzer] Saving analysis to database for ${email}`);

  try {
    // Check if record exists
    const { data: existing } = await supabase
      .from('sage_onboarding_data')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    const labFileAnalysis = {
      biomarkers: analysis.biomarkers,
      summary: analysis.summary,
      concerns: analysis.concerns,
      positives: analysis.positives,
      recommendations: analysis.recommendations,
      totalCount: analysis.totalCount,
      confidence: analysis.confidence,
      analyzedAt: new Date().toISOString(),
      processingTimeMs: analysis.processingTimeMs
    };

    if (existing) {
      await supabase
        .from('sage_onboarding_data')
        .update({
          lab_file_analysis: labFileAnalysis,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);

      console.log(`[Blood Analyzer] Updated existing record with analysis`);
    } else {
      await supabase
        .from('sage_onboarding_data')
        .insert({
          email,
          lab_file_analysis: labFileAnalysis,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      console.log(`[Blood Analyzer] Created new record with analysis`);
    }
  } catch (error) {
    console.error('[Blood Analyzer] Error saving analysis to database:', error);
    throw error;
  }
}
