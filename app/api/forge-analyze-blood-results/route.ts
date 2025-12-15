import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import { devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';
import { File as NodeFile } from 'node:buffer';

// Polyfill for Node 18
if (typeof globalThis.File === 'undefined') {
  globalThis.File = NodeFile as unknown as typeof File;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
  }
  return new OpenAI({
    apiKey,
  });
}

// Helper function to analyze PDF files using Assistants API
async function analyzePDFWithAssistants(file: File, openai: OpenAI, userContext: string) {
  const systemPrompt = `You are an elite clinical laboratory specialist and longevity medicine expert. Analyze the blood test results PDF and provide a comprehensive, easy-to-understand summary.

${userContext}

Your analysis should include:

1. **Overall Summary** (2-3 sentences): High-level assessment of the blood work - are markers generally optimal, concerning, or need attention?

2. **COMPLETE Biomarkers Extraction**: Extract EVERY SINGLE biomarker visible in the document. Do NOT limit yourself to just the "important" ones - extract ALL of them.

   For EACH biomarker include:
   - Biomarker name (exact name as shown in the report)
   - Measured value with unit
   - Reference range (if provided in the report)
   - Status: "Optimal", "Excellent", "Good", "Normal", "Adequate", "Borderline", "High", "Low", "Critical", "Needs Optimization"
   - Clinical significance: What does this marker indicate?
   - Health implications: What does the current level mean for health/longevity?

   CRITICAL REQUIREMENTS:
   - Extract EVERY biomarker you can see - there is NO maximum limit
   - Include ALL panels: CBC, Metabolic, Lipid, Thyroid, Hormones, Vitamins, Minerals, Liver, Kidney, Inflammatory markers, etc.
   - Include calculated values (e.g., eGFR, LDL calculated, A/G ratio)
   - Include ALL individual components of panels (e.g., all WBC differentials, all lipid subfractions)
   - If a report has 50+ biomarkers, extract ALL 50+
   - Do NOT summarize or skip "normal" values - extract everything

3. **Areas of Concern**: Any markers that are out of optimal range and need attention

4. **Positive Findings**: Markers that are in excellent/optimal range

5. **Recommendations**:
   - Lifestyle interventions
   - Dietary modifications
   - Supplement considerations (if applicable)
   - Follow-up tests that may be beneficial
   - When to retest

${userContext ? `6. **Personalized Notes**: Specific considerations based on the user's age, gender, health goals, and current health status.` : ''}

Format your response as a JSON object with this structure:
{
  "summary": "Overall summary text",
  "biomarkers": [
    {
      "name": "Biomarker name",
      "value": "Measured value with unit",
      "referenceRange": "Reference range if available",
      "status": "Optimal|Normal|Borderline|High|Low",
      "significance": "What this marker indicates",
      "implications": "Health implications of current level"
    }
  ],
  "concerns": ["List of concerning findings"],
  "positives": ["List of positive findings"],
  "recommendations": {
    "lifestyle": ["Lifestyle recommendations"],
    "dietary": ["Dietary recommendations"],
    "supplements": ["Supplement considerations"],
    "followUp": ["Follow-up test recommendations"],
    "retestTiming": "When to retest"
  }${userContext ? `,
  "personalizedNotes": ["Personalized considerations based on user profile"]` : ''}
}

IMPORTANT:
- Be thorough but accessible - explain medical terms
- Focus on actionable insights
- Be evidence-based but not alarmist
- Consider optimal ranges for longevity, not just "normal" ranges
- Return ONLY valid JSON, no markdown formatting`;

  // Upload the PDF file to OpenAI
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const uploadableFile = await toFile(fileBuffer, file.name, { type: 'application/pdf' });
  const openaiFile = await openai.files.create({
    file: uploadableFile,
    purpose: 'assistants'
  });

  // Use Assistants API to analyze the PDF
  const assistant = await openai.beta.assistants.create({
    model: 'gpt-4o',
    instructions: systemPrompt,
    tools: [{ type: 'file_search' }]
  });

  const thread = await openai.beta.threads.create({
    messages: [{
      role: 'user',
      content: 'Please analyze the blood test PDF I uploaded and provide the analysis in the JSON format specified in your instructions.',
      attachments: [{ file_id: openaiFile.id, tools: [{ type: 'file_search' }] }]
    }]
  });

  const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
    assistant_id: assistant.id
  });

  if (run.status !== 'completed') {
    throw new Error(`Assistant run failed with status: ${run.status}`);
  }

  const messages = await openai.beta.threads.messages.list(thread.id);
  const assistantMessage = messages.data.find(m => m.role === 'assistant');

  if (!assistantMessage || assistantMessage.content[0].type !== 'text') {
    throw new Error('No valid response from assistant');
  }

  let responseText = assistantMessage.content[0].text.value;

  // Clean up
  await openai.files.delete(openaiFile.id);
  await openai.beta.assistants.delete(assistant.id);

  // Parse JSON response
  responseText = cleanAndParseJSON(responseText);
  return JSON.parse(responseText);
}

// Helper function to analyze image files using Vision API
async function analyzeImageWithVision(file: File, openai: OpenAI, userContext: string) {
  const systemPrompt = `You are an elite clinical laboratory specialist. Analyze this blood test results image and extract EVERY SINGLE biomarker visible.

${userContext}

CRITICAL: Extract ALL biomarkers you can see in the image - do NOT limit yourself to just the important ones.
- Extract EVERY row/line item with a value
- Include ALL panels: CBC, Metabolic, Lipid, Thyroid, Hormones, Vitamins, Minerals, Liver, Kidney, etc.
- Include calculated values and ratios
- If you see 30, 40, 50+ biomarkers, extract ALL of them
- Do NOT skip "normal" values - extract everything

Return the same JSON structure as specified for PDFs with ALL biomarkers included.`;

  // Convert image to base64
  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const base64Image = imageBuffer.toString('base64');
  const mimeType = file.type || 'image/jpeg';

  // Use GPT-4 Vision to analyze the image
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Please analyze this blood test results image and provide the analysis in the JSON format with biomarkers, summary, concerns, positives, and recommendations.'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 16384  // Increased to handle 50+ biomarkers
  });

  const responseText = response.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No response from Vision API');
  }

  const cleanedText = cleanAndParseJSON(responseText);
  return JSON.parse(cleanedText);
}

// Helper function to clean and parse JSON from AI responses
function cleanAndParseJSON(text: string): string {
  let cleaned = text.trim();

  // Strip markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  cleaned = cleaned.trim();

  // Extract JSON object
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
  }

  return cleaned;
}

// Helper function to merge multiple analyses into one
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeAnalyses(analyses: any[]) {
  if (analyses.length === 1) {
    return analyses[0];
  }

  // Combine summaries
  const summaries = analyses.map(a => a.summary).filter(Boolean);
  const summary = summaries.join(' ');

  // Merge biomarkers and deduplicate by name
  const biomarkersMap = new Map();
  for (const analysis of analyses) {
    for (const biomarker of analysis.biomarkers || []) {
      const key = biomarker.name.toLowerCase().trim();
      // Keep the first occurrence of each biomarker
      if (!biomarkersMap.has(key)) {
        biomarkersMap.set(key, biomarker);
      }
    }
  }
  const biomarkers = Array.from(biomarkersMap.values());

  // Merge concerns and deduplicate
  const concernsSet = new Set();
  for (const analysis of analyses) {
    for (const concern of analysis.concerns || []) {
      concernsSet.add(concern);
    }
  }
  const concerns = Array.from(concernsSet);

  // Merge positives and deduplicate
  const positivesSet = new Set();
  for (const analysis of analyses) {
    for (const positive of analysis.positives || []) {
      positivesSet.add(positive);
    }
  }
  const positives = Array.from(positivesSet);

  // Merge recommendations
  const recommendations = {
    lifestyle: [] as string[],
    dietary: [] as string[],
    supplements: [] as string[],
    followUp: [] as string[],
    retestTiming: analyses[0]?.recommendations?.retestTiming || '3-6 months'
  };

  for (const analysis of analyses) {
    if (analysis.recommendations) {
      recommendations.lifestyle.push(...(analysis.recommendations.lifestyle || []));
      recommendations.dietary.push(...(analysis.recommendations.dietary || []));
      recommendations.supplements.push(...(analysis.recommendations.supplements || []));
      recommendations.followUp.push(...(analysis.recommendations.followUp || []));
    }
  }

  // Deduplicate recommendations
  recommendations.lifestyle = Array.from(new Set(recommendations.lifestyle));
  recommendations.dietary = Array.from(new Set(recommendations.dietary));
  recommendations.supplements = Array.from(new Set(recommendations.supplements));
  recommendations.followUp = Array.from(new Set(recommendations.followUp));

  // Merge personalized notes if present
  const personalizedNotes = [];
  for (const analysis of analyses) {
    if (analysis.personalizedNotes) {
      personalizedNotes.push(...analysis.personalizedNotes);
    }
  }

  return {
    summary,
    biomarkers,
    concerns,
    positives,
    recommendations,
    ...(personalizedNotes.length > 0 ? { personalizedNotes: Array.from(new Set(personalizedNotes)) } : {})
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('FORGE BLOOD RESULTS ANALYSIS');
    console.log('='.repeat(80) + '\n');

    const formData = await request.formData();
    const bloodTestFiles = formData.getAll('bloodTests') as File[];
    const email = formData.get('email') as string | null;

    if (!bloodTestFiles || bloodTestFiles.length === 0) {
      return NextResponse.json(
        { error: 'No blood test files provided' },
        { status: 400 }
      );
    }

    console.log(`[1/4] Processing ${bloodTestFiles.length} file(s)...`);
    for (const file of bloodTestFiles) {
      console.log(`  - ${file.name} (${file.size} bytes, ${file.type})`);
    }
    console.log();

    // Get user context if email is provided
    let userContext = '';
    if (email) {
      console.log('[2/4] Fetching user profile for personalized analysis...');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const devData = devOnboardingStorage.get(email) as any;

      if (devData?.form_data) {
        const formData = devData.form_data;
        userContext = `
User Profile Context:
- Age: ${formData.age}, Gender: ${formData.gender}
- Weight: ${formData.weight}, Height: ${formData.height}
- Main Health Priority: ${formData.mainPriority}
- Driving Goal: ${formData.drivingGoal}
- Medical Conditions: ${formData.medicalConditions?.join(', ') || 'None'}
- Current Medications: ${formData.medications || 'None'}
- Current Supplements: ${formData.supplements || 'None'}
`;
        console.log('[OK] User profile retrieved\n');
      } else {
        // Try Supabase if dev storage doesn't have it
        const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
          try {
            const supabase = await createClient();
            const { data } = await supabase
              .from('forge_onboarding_data')
              .select('*')
              .eq('email', email)
              .single();

            if (data?.form_data) {
              const userData = data.form_data;
              userContext = `
User Profile Context:
- Age: ${userData.age}, Gender: ${userData.gender}
- Weight: ${userData.weight}, Height: ${userData.height}
- Main Health Priority: ${userData.mainPriority}
- Driving Goal: ${userData.drivingGoal}
- Medical Conditions: ${userData.medicalConditions?.join(', ') || 'None'}
- Current Medications: ${userData.medications || 'None'}
- Current Supplements: ${userData.supplements || 'None'}
`;
              console.log('[OK] User profile retrieved from database\n');
            }
          } catch (error) {
            console.log('[WARN] Could not fetch user profile from database\n');
          }
        }
      }
    }

    // Process each file and collect analyses
    console.log(`[3/4] Analyzing ${bloodTestFiles.length} file(s) with AI...`);
    const openai = getOpenAIClient();

    const allAnalyses = [];

    for (let i = 0; i < bloodTestFiles.length; i++) {
      const file = bloodTestFiles[i];
      const fileNum = i + 1;
      console.log(`\n[${fileNum}/${bloodTestFiles.length}] Processing: ${file.name}`);

      const isImage = file.type.startsWith('image/');
      const analysis = isImage
        ? await analyzeImageWithVision(file, openai, userContext)
        : await analyzePDFWithAssistants(file, openai, userContext);

      allAnalyses.push(analysis);
      console.log(`[OK] ${file.name} analyzed`);
    }

    // Merge all analyses into one comprehensive analysis
    console.log(`\n[4/4] Merging ${allAnalyses.length} analyses...`);
    const analysis = mergeAnalyses(allAnalyses);

    console.log('[OK] Blood analysis complete\n');
    console.log('='.repeat(80));
    console.log('[COMPLETE] ANALYSIS READY');
    console.log(`Total biomarkers extracted: ${analysis.biomarkers?.length || 0}`);
    console.log('='.repeat(80) + '\n');

    // Store analysis if email provided
    if (email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let devData = devOnboardingStorage.get(email) as any;

      if (!devData) {
        // Create new entry if it doesn't exist
        devData = { form_data: { email } };
      }

      devData.lab_file_analysis = analysis;
      devOnboardingStorage.set(email, devData);
      console.log('[OK] Blood analysis cached for user\n');

      // Also try to store in Supabase if configured
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();

          // First, get current form_data to update hasLabFile flag
          const { data: currentData } = await supabase
            .from('forge_onboarding_data')
            .select('form_data')
            .eq('email', email)
            .single();

          // Update both lab_file_analysis AND set hasLabFile flag in form_data
          const updatedFormData = currentData?.form_data
            ? { ...currentData.form_data, hasLabFile: true }
            : { hasLabFile: true };

          await supabase
            .from('forge_onboarding_data')
            .update({
              lab_file_analysis: analysis,
              form_data: updatedFormData
            })
            .eq('email', email);
          console.log('[OK] Blood analysis saved to database\n');
        } catch (error) {
          console.log('[WARN] Could not save to database:', error);
        }
      }

      // Also update dev storage hasLabFile flag
      if (devData?.form_data) {
        devData.form_data.hasLabFile = true;
        devOnboardingStorage.set(email, devData);
      }
    }

    return NextResponse.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Error analyzing blood results:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze blood results',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve cached blood analysis
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const email = searchParams.get('email');
    const identifier = code || email;

    if (!identifier) {
      return NextResponse.json(
        { error: 'Email or code parameter is required' },
        { status: 400 }
      );
    }

    // If we have a code, we need to find the email first
    let lookupEmail = email;

    if (code) {
      // Search dev storage for the code
      for (const [key, value] of devOnboardingStorage.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = value as any;
        if (data?.form_data?.uniqueCode === code) {
          lookupEmail = data.form_data.email || key;
          break;
        }
      }

      // If not found in dev storage, try Supabase
      if (!lookupEmail) {
        const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
          try {
            const supabase = await createClient();
            const { data } = await supabase
              .from('forge_onboarding_data')
              .select('email, lab_file_analysis')
              .eq('form_data->>uniqueCode', code)
              .single();

            if (data) {
              lookupEmail = data.email;
              // Return the analysis directly if found
              if (data.lab_file_analysis) {
                return NextResponse.json({
                  success: true,
                  analysis: data.lab_file_analysis
                });
              }
            }
          } catch (error) {
            console.error('Error fetching from database:', error);
          }
        }
      }
    }

    if (!lookupEmail) {
      return NextResponse.json(
        { error: 'No data found for this code' },
        { status: 404 }
      );
    }

    // Check dev storage with the email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(lookupEmail) as any;
    if (devData?.blood_analysis) {
      return NextResponse.json({
        success: true,
        analysis: devData.blood_analysis
      });
    }

    // Try Supabase with email
    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from('forge_onboarding_data')
          .select('lab_file_analysis')
          .eq('email', lookupEmail)
          .single();

        if (data?.lab_file_analysis) {
          return NextResponse.json({
            success: true,
            analysis: data.lab_file_analysis
          });
        }
      } catch (error) {
        console.error('Error fetching from database:', error);
      }
    }

    return NextResponse.json(
      { error: 'No blood analysis found for this email' },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error retrieving blood analysis:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve blood analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
