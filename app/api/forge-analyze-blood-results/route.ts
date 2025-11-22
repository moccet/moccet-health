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
    console.log('FORGE BLOOD RESULTS ANALYSIS');
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
- Primary Fitness Goal: ${formData.primaryGoal}
- Time Horizon: ${formData.timeHorizon}
- Training Days Per Week: ${formData.trainingDays}
- Medical Conditions: ${formData.medicalConditions?.join(', ') || 'None'}
- Current/Recent Injuries: ${formData.injuries?.join(', ') || 'None'}
- Movement Restrictions: ${formData.movementRestrictions || 'None'}
- Training Experience: ${formData.trainingExperience || 'Not specified'}
- Sleep Quality (1-10): ${formData.sleepQuality || 'Not specified'}
- Stress Level (1-10): ${formData.stressLevel || 'Not specified'}
- Daily Activity Level: ${formData.dailyActivity || 'Not specified'}
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
- Primary Fitness Goal: ${userData.primaryGoal}
- Time Horizon: ${userData.timeHorizon}
- Training Days Per Week: ${userData.trainingDays}
- Medical Conditions: ${userData.medicalConditions?.join(', ') || 'None'}
- Current/Recent Injuries: ${userData.injuries?.join(', ') || 'None'}
- Movement Restrictions: ${userData.movementRestrictions || 'None'}
- Training Experience: ${userData.trainingExperience || 'Not specified'}
- Sleep Quality (1-10): ${userData.sleepQuality || 'Not specified'}
- Stress Level (1-10): ${userData.stressLevel || 'Not specified'}
- Daily Activity Level: ${userData.dailyActivity || 'Not specified'}
`;
              console.log('[OK] User profile retrieved from database\n');
            }
          } catch (error) {
            console.log('[WARN] Could not fetch user profile from database\n');
          }
        }
      }
    }

    // Generate comprehensive blood analysis for fitness/performance
    console.log('[3/3] Analyzing biomarkers with AI...');
    const openai = getOpenAIClient();

    const systemPrompt = `You are an elite sports medicine physician and performance optimization expert. Analyze the blood test results PDF and provide a comprehensive, easy-to-understand summary focused on athletic performance, recovery, and fitness optimization.

${userContext}

Your analysis should include:

1. **Overall Summary** (2-3 sentences): High-level assessment of the blood work - are markers generally optimal for performance, concerning, or need attention for training optimization?

2. **Key Biomarkers Analysis**: Extract and analyze AT LEAST 10-15 biomarkers from the results. Include ALL of the following:
   - Biomarker name
   - Measured value
   - Reference range (if provided in the report)
   - Status: "Optimal for Performance", "Excellent", "Good", "Normal", "Adequate", "Borderline", "High", "Low", "Needs Optimization"
   - Performance significance: What does this marker indicate for athletic performance?
   - Training implications: What does the current level mean for training capacity, recovery, and performance?

   CRITICAL: You MUST include markers across ALL categories:
   - Markers that are HIGH (above range)
   - Markers that are LOW (below range)
   - Markers that are NORMAL but could be OPTIMIZED for athletic performance
   - Markers that are in OPTIMAL/EXCELLENT range for training
   - Minimum 10-15 biomarkers total - extract as many as possible from the PDF

   Focus on performance-relevant markers:
   - Testosterone, Free Testosterone, SHBG
   - Iron, Ferritin, TIBC (oxygen transport)
   - Vitamin D, B12, Folate (recovery, energy)
   - Cortisol (stress, recovery)
   - Creatine Kinase, LDH (muscle damage, recovery)
   - Thyroid markers (metabolism)
   - Inflammatory markers (CRP, ESR)
   - Metabolic markers (glucose, insulin, lipids)

3. **Performance Impact**: How current biomarker levels may affect:
   - Training capacity and intensity tolerance
   - Recovery between sessions
   - Injury risk
   - Muscle building and strength gains
   - Endurance and stamina
   - Energy levels

4. **Areas of Concern**: Any markers that are out of optimal range and could impact training or recovery

5. **Positive Findings**: Markers that are in excellent/optimal range for athletic performance

6. **Recommendations**:
   - Training modifications based on current biomarkers
   - Recovery optimization strategies
   - Dietary modifications for performance
   - Supplement considerations (if applicable)
   - Follow-up tests that may be beneficial for athletes
   - When to retest

${userContext ? `7. **Personalized Performance Notes**: Specific considerations based on the user's training goals, current fitness level, injury history, and training capacity.` : ''}

Format your response as a JSON object with this structure:
{
  "summary": "Overall summary text focused on performance",
  "biomarkers": [
    {
      "name": "Biomarker name",
      "value": "Measured value with unit",
      "referenceRange": "Reference range if available",
      "status": "Optimal for Performance|Normal|Borderline|High|Low",
      "significance": "What this marker indicates for performance",
      "implications": "Training and performance implications"
    }
  ],
  "performanceImpact": {
    "trainingCapacity": "Assessment of training capacity",
    "recovery": "Assessment of recovery markers",
    "injuryRisk": "Assessment of injury risk factors",
    "muscleBuilding": "Assessment for muscle growth potential",
    "endurance": "Assessment for endurance capacity",
    "energy": "Assessment of energy markers"
  },
  "concerns": ["List of concerning findings that may impact training"],
  "positives": ["List of positive findings for performance"],
  "recommendations": {
    "training": ["Training modification recommendations"],
    "recovery": ["Recovery optimization recommendations"],
    "dietary": ["Dietary recommendations for performance"],
    "supplements": ["Supplement considerations for athletes"],
    "followUp": ["Follow-up test recommendations"],
    "retestTiming": "When to retest"
  }${userContext ? `,
  "personalizedNotes": ["Personalized performance considerations based on user profile"]` : ''}
}

IMPORTANT:
- Focus on athletic performance, recovery, and training optimization
- Be thorough but accessible - explain medical terms
- Focus on actionable insights for athletes
- Be evidence-based but not alarmist
- Consider optimal ranges for performance, not just "normal" ranges
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
            .from('forge_onboarding_data')
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
