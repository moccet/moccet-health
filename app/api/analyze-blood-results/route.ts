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

export async function POST(request: NextRequest) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('SAGE BLOOD RESULTS ANALYSIS');
    console.log('='.repeat(80) + '\n');

    const formData = await request.formData();
    const bloodTestFile = formData.get('bloodTest') as File | null;
    const email = formData.get('email') as string | null;

    if (!bloodTestFile) {
      return NextResponse.json(
        { error: 'No blood test file provided' },
        { status: 400 }
      );
    }

    console.log('[1/3] Preparing PDF for upload...');
    console.log(`[OK] PDF ready (${bloodTestFile.size} bytes)\n`);

    // Get user context if email is provided
    let userContext = '';
    if (email) {
      console.log('[2/3] Fetching user profile for personalized analysis...');
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
              .from('sage_onboarding_data')
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

    // Generate comprehensive blood analysis
    console.log('[3/3] Analyzing biomarkers with AI...');
    const openai = getOpenAIClient();

    const systemPrompt = `You are an elite clinical laboratory specialist and longevity medicine expert. Analyze the blood test results PDF and provide a comprehensive, easy-to-understand summary.

${userContext}

Your analysis should include:

1. **Overall Summary** (2-3 sentences): High-level assessment of the blood work - are markers generally optimal, concerning, or need attention?

2. **Key Biomarkers Analysis**: Extract and analyze AT LEAST 10-15 biomarkers from the results. Include ALL of the following:
   - Biomarker name
   - Measured value
   - Reference range (if provided in the report)
   - Status: "Optimal", "Excellent", "Good", "Normal", "Adequate", "Borderline", "High", "Low", "Needs Optimization"
   - Clinical significance: What does this marker indicate?
   - Health implications: What does the current level mean for health/longevity?

   CRITICAL: You MUST include markers across ALL categories:
   - Markers that are HIGH (above range)
   - Markers that are LOW (below range)
   - Markers that are NORMAL but could be OPTIMIZED for longevity
   - Markers that are in OPTIMAL/EXCELLENT range
   - Minimum 10-15 biomarkers total - extract as many as possible from the PDF

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
    const fileBuffer = Buffer.from(await bloodTestFile.arrayBuffer());
    const uploadableFile = await toFile(fileBuffer, bloodTestFile.name, { type: 'application/pdf' });
    const file = await openai.files.create({
      file: uploadableFile,
      purpose: 'assistants'
    });

    console.log('[AI] PDF uploaded to OpenAI, file ID:', file.id);

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
        attachments: [{ file_id: file.id, tools: [{ type: 'file_search' }] }]
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
    await openai.files.delete(file.id);
    await openai.beta.assistants.delete(assistant.id);

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    responseText = responseText.trim();

    // Remove any non-JSON text before the first {
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      responseText = responseText.substring(jsonStart, jsonEnd + 1);
    }

    let analysis;
    try {
      analysis = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      console.error('Response text (first 500 chars):', responseText.substring(0, 500));
      console.error('Response text (last 500 chars):', responseText.substring(Math.max(0, responseText.length - 500)));
      return NextResponse.json(
        { error: 'Failed to generate valid analysis. AI returned invalid JSON.' },
        { status: 500 }
      );
    }

    console.log('[OK] Blood analysis complete\n');
    console.log('='.repeat(80));
    console.log('[COMPLETE] ANALYSIS READY');
    console.log('='.repeat(80) + '\n');

    // Store analysis if email provided
    if (email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let devData = devOnboardingStorage.get(email) as any;

      if (!devData) {
        // Create new entry if it doesn't exist
        devData = { form_data: { email } };
      }

      devData.blood_analysis = analysis;
      devOnboardingStorage.set(email, devData);
      console.log('[OK] Blood analysis cached for user\n');

      // Also try to store in Supabase if configured
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();
          await supabase
            .from('sage_onboarding_data')
            .update({ lab_file_analysis: analysis })
            .eq('email', email);
          console.log('[OK] Blood analysis saved to database\n');
        } catch (error) {
          console.log('[WARN] Could not save to database\n');
        }
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
              .from('sage_onboarding_data')
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
          .from('sage_onboarding_data')
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
