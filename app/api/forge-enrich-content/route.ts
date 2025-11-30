import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const maxDuration = 300; // 5 minutes max

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectEmptyOrPlaceholderSections(plan: any): string[] {
  const issues: string[] = [];

  // Check Training Philosophy sections
  if (plan.trainingPhilosophy) {
    const tp = plan.trainingPhilosophy;

    // Check if approach is generic/placeholder
    if (!tp.approach ||
        tp.approach.length < 50 ||
        tp.approach.includes('Evidence-based') && tp.approach.length < 100) {
      issues.push('Training Philosophy > Approach is too generic or empty');
    }

    // Check if key principles is empty or has no actual content
    if (!tp.keyPrinciples || tp.keyPrinciples.length === 0) {
      issues.push('Training Philosophy > Key Principles is empty');
    } else {
      const hasRealContent = tp.keyPrinciples.some((p: any) =>
        p.description && p.description.length > 30
      );
      if (!hasRealContent) {
        issues.push('Training Philosophy > Key Principles lacks detailed content');
      }
    }

    // Check progression strategy
    if (!tp.progressionStrategy || tp.progressionStrategy.length < 50) {
      issues.push('Training Philosophy > Progression Strategy is too brief or empty');
    }
  }

  // Check Weekly Structure
  if (plan.weeklyStructure) {
    const ws = plan.weeklyStructure;

    if (!ws.rationale || ws.rationale.length < 50 ||
        ws.rationale.includes('Data-driven') && ws.rationale.length < 100) {
      issues.push('Weekly Structure > Rationale is too generic or empty');
    }

    if (!ws.intensityFramework || ws.intensityFramework.length < 50) {
      issues.push('Weekly Structure > Intensity Framework is too brief or empty');
    }
  }

  // Check Nutrition Guidance
  if (plan.nutritionGuidance) {
    const ng = plan.nutritionGuidance;

    if (!ng.overview || ng.overview.length < 50) {
      issues.push('Nutrition Guidance > Overview is too brief or empty');
    }

    if (!ng.calorieGuidance || ng.calorieGuidance.length < 30) {
      issues.push('Nutrition Guidance > Calorie Guidance is missing or too brief');
    }
  }

  return issues;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEnrichmentPrompt(plan: any, issues: string[], userProfile: any, biomarkers: any, unifiedContext: any): string {
  return `You are an expert fitness and nutrition coach. You've been given a fitness plan that has some sections that are empty, too brief, or use generic placeholder text.

Your task is to enrich these specific sections with personalized, detailed content based on the user's profile, biomarkers, and training context.

## SECTIONS THAT NEED ENRICHMENT:
${issues.map(issue => `- ${issue}`).join('\n')}

## USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

## BIOMARKERS:
${JSON.stringify(biomarkers, null, 2)}

## CURRENT PLAN (for context):
${JSON.stringify(plan, null, 2)}

${unifiedContext ? `## ECOSYSTEM CONTEXT (Sage Journals, Health Trends, Behavioral Patterns):
This user has been actively tracking their health through the moccet ecosystem:
${JSON.stringify(unifiedContext, null, 2)}

Use this context to make recommendations highly personal and specific to their lifestyle, preferences, and patterns.
` : ''}

## FORMATTING REQUIREMENTS:
- DO NOT use emojis (⚠️, 🔥, 💡, 🧊, etc.) anywhere in your output
- DO NOT use colored text, HTML tags, or markdown color formatting
- DO NOT use priority labels like "HIGH Priority", "CRITICAL", "URGENT", etc.
- Use professional, clean, plain text only
- All content must be simple and readable without visual embellishments

## INSTRUCTIONS:

For each empty/placeholder section identified, you must provide:

1. **Training Philosophy > Approach**: Write 2-3 paragraphs explaining the specific training approach for THIS user, referencing their biomarkers, goals, experience level, and any injuries/limitations. Be specific - mention actual values from their biomarkers if relevant.

2. **Training Philosophy > Key Principles**: Provide 3-5 key principles, each with:
   - title: A clear principle name
   - description: 2-3 sentences explaining WHY this principle matters for THIS specific user

3. **Training Philosophy > Progression Strategy**: Write 2-3 paragraphs explaining the specific progression strategy, including:
   - How to progress (add weight, reps, sets, volume)
   - When to progress (every week, every 2 weeks, when certain metrics are hit)
   - How to handle plateaus
   - Deload strategy

4. **Weekly Structure > Rationale**: Write 2-3 paragraphs explaining WHY this specific weekly structure was chosen for THIS user. Reference their:
   - Training experience and goals
   - Recovery capacity (from biomarkers like hsCRP, HRV if available)
   - Schedule constraints
   - Injury history

5. **Weekly Structure > Intensity Framework**: Write 2-3 paragraphs explaining how to manage intensity across the week:
   - Heart rate zones or RPE ranges for different days
   - How to autoregulate based on recovery
   - When to push hard vs back off
   - Reference biomarkers like resting heart rate, HRV

6. **Nutrition Guidance > Overview**: Write 2-3 paragraphs providing a comprehensive nutrition overview:
   - Overall philosophy (performance, fat loss, muscle gain, health)
   - Meal timing and frequency recommendations
   - Food quality and sources
   - Hydration strategy

7. **Nutrition Guidance > Calorie Guidance**: Provide specific calorie recommendations:
   - Estimated TDEE based on their stats
   - Target calories based on their goal
   - How to adjust based on progress
   - Training day vs rest day variations if applicable

## OUTPUT FORMAT:

Return a JSON object with ONLY the enriched sections. Use this exact structure:

{
  "trainingPhilosophy": {
    "approach": "string (2-3 paragraphs)",
    "keyPrinciples": [
      {
        "title": "Principle Name",
        "description": "2-3 sentences"
      }
    ],
    "progressionStrategy": "string (2-3 paragraphs)"
  },
  "weeklyStructure": {
    "rationale": "string (2-3 paragraphs)",
    "intensityFramework": "string (2-3 paragraphs)"
  },
  "nutritionGuidance": {
    "overview": "string (2-3 paragraphs)",
    "calorieGuidance": "string (detailed guidance)"
  }
}

**IMPORTANT**:
- Only include sections that were identified as needing enrichment
- Be specific and personalized - reference actual biomarker values, goals, injuries
- Avoid generic advice - everything should be tailored to THIS user
- Write in a professional but approachable tone
- Use concrete numbers and ranges where appropriate`;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[ENRICHMENT-AGENT] Starting content enrichment...');

    const body = await request.json();
    const { plan, userProfile, biomarkers, unifiedContext } = body;

    if (!plan || !userProfile) {
      return NextResponse.json(
        { error: 'Missing required fields: plan and userProfile are required' },
        { status: 400 }
      );
    }

    // Detect empty or placeholder sections
    const issues = detectEmptyOrPlaceholderSections(plan);

    if (issues.length === 0) {
      console.log('[ENRICHMENT-AGENT] No issues found, plan is complete');
      return NextResponse.json({
        success: true,
        enrichedSections: {},
        issuesFound: 0
      });
    }

    console.log(`[ENRICHMENT-AGENT] Found ${issues.length} sections needing enrichment:`);
    issues.forEach(issue => console.log(`  - ${issue}`));

    const openai = getOpenAIClient();
    const prompt = buildEnrichmentPrompt(plan, issues, userProfile, biomarkers, unifiedContext);

    console.log('[ENRICHMENT-AGENT] Calling GPT-5 with high reasoning...');
    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'high' },
      text: { verbosity: 'high' }
    });

    let responseText = completion.output_text || '{}';

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    responseText = responseText.trim();

    const enrichedSections = JSON.parse(responseText);
    console.log('[ENRICHMENT-AGENT] ✅ Content enrichment completed successfully');
    console.log(`[ENRICHMENT-AGENT] Enriched sections: ${Object.keys(enrichedSections).join(', ')}`);

    return NextResponse.json({
      success: true,
      enrichedSections,
      issuesFound: issues.length,
      issuesResolved: issues
    });

  } catch (error) {
    console.error('[ENRICHMENT-AGENT] ❌ Error enriching content:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
