import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import OpenAI from 'openai';
import { devPlanStorage, devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';
import { buildFitnessPlanPrompt, buildSystemPrompt } from '@/lib/prompts/unified-context-prompt';
import { buildForgePlanPrompt } from '@/app/api/generate-forge-plan/route';

// This endpoint can run for up to 13 minutes 20 seconds on Vercel Pro (800s max)
// QStash will handle retries if it fails
export const maxDuration = 800;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
  }
  return new OpenAI({
    apiKey,
  });
}

// Inline fitness plan generation to avoid timeout issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateFitnessPlanInline(formData: any, bloodAnalysis: any, baseUrl: string) {
  console.log('[FORGE-PLAN] Generating comprehensive fitness plan...');

  // Step 1: Aggregate unified context from ecosystem
  console.log('[FORGE-PLAN] Aggregating unified context from ecosystem data...');
  let unifiedContext = null;
  const userEmail = formData.email;

  if (userEmail) {
    try {
      const contextResponse = await fetch(`${baseUrl}/api/aggregate-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          contextType: 'forge',
          forceRefresh: false,
        }),
      });

      if (contextResponse.ok) {
        const contextData = await contextResponse.json();
        unifiedContext = contextData.context;
        console.log('[FORGE-PLAN] ✅ Unified context aggregated');
        console.log(`[FORGE-PLAN] Data Quality: ${contextData.qualityMessage?.split('\n')[0] || 'Unknown'}`);
      } else {
        console.log('[FORGE-PLAN] ⚠️ Context aggregation failed, using standard prompt');
      }
    } catch (error) {
      console.error('[FORGE-PLAN] Error aggregating context:', error);
      console.log('[FORGE-PLAN] Proceeding with standard prompt');
    }
  }

  const openai = getOpenAIClient();

  // Build the prompt (ecosystem-enriched or standard)
  const prompt = unifiedContext
    ? buildFitnessPlanPrompt(unifiedContext, formData)
    : buildForgePlanPrompt(formData, bloodAnalysis);

  const systemPrompt = unifiedContext
    ? buildSystemPrompt()
    : `You are an elite strength and conditioning coach and fitness expert. You create comprehensive, personalized fitness plans that are safe, effective, and scientifically grounded. You consider the client's complete profile including training history, goals, injuries, available equipment, and biomarkers when available.

Your plans are detailed, progressive, and designed for long-term results. You provide specific exercises, sets, reps, rest periods, and progression strategies. You also include recovery protocols, mobility work, and supplement recommendations when appropriate.`;

  console.log(`[FORGE-PLAN] Using ${unifiedContext ? 'ECOSYSTEM-ENRICHED' : 'STANDARD'} prompt`);
  console.log(`[FORGE-PLAN] Model: GPT-5 for superior reasoning and personalization`);

  const completion = await openai.responses.create({
    model: 'gpt-5',
    input: `${systemPrompt}\n\n${prompt}`,
    reasoning: { effort: 'high' },
    text: { verbosity: 'medium' }  // Reduced from 'high' - word count limits enforce conciseness
  });

  let planContent = completion.output_text || '{}';

  // Strip markdown code blocks if present
  planContent = planContent.trim();
  if (planContent.startsWith('```json')) {
    planContent = planContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (planContent.startsWith('```')) {
    planContent = planContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  planContent = planContent.trim();

  // Additional JSON sanitization to handle common GPT formatting issues
  // Remove any trailing commas before closing braces/brackets
  planContent = planContent.replace(/,(\s*[}\]])/g, '$1');
  // Remove JavaScript-style comments (// and /* */)
  planContent = planContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  let plan;
  try {
    plan = JSON.parse(planContent);
    console.log('[FORGE-PLAN] ✅ Fitness plan generated successfully with GPT-5');
  } catch (parseError) {
    console.error('[FORGE-PLAN] ❌ Failed to parse GPT-5 response as JSON:', parseError);
    console.error('[FORGE-PLAN] First 500 chars of response:', planContent.substring(0, 500));
    console.error('[FORGE-PLAN] Last 200 chars of response:', planContent.substring(Math.max(0, planContent.length - 200)));
    throw new Error(`Failed to parse fitness plan from GPT-5: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
  }

  return {
    success: true,
    plan,
    unifiedContext // Return the context so specialized agents can use it
  };
}

const EMAIL_TEMPLATE = (name: string, planUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>forge - Your Personalized Fitness Plan is Ready</title>
    <meta name="description" content="forge - Personalized fitness plans based on your biology, training data, and performance metrics" />
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1a1a1a;">

    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 0;">

                <!-- Hero Image - Full Width -->
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 0; text-align: center; background-color: #f5f5f5;">
                            <img src="https://c.animaapp.com/EVbz3TeZ/img/susan-wilkinson-eo76daedyim-unsplash.jpg" alt="forge gradient" style="width: 100%; max-width: 100%; height: 240px; object-fit: cover; display: block;" />
                        </td>
                    </tr>
                </table>

                <!-- Content Container -->
                <table role="presentation" style="max-width: 560px; width: 100%; margin: 0 auto; border-collapse: collapse;">

                    <!-- Logo -->
                    <tr>
                        <td style="padding: 48px 20px 40px; text-align: center;">
                            <h1 style="margin: 0; font-size: 28px; font-weight: 400; letter-spacing: -0.3px; color: #000000;">forge</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 0 20px;">

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                Hi ${name}, your personalized fitness plan is ready.
                            </p>

                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                We've analyzed your profile, training history, and goals to create a comprehensive plan tailored specifically for you. Your plan includes personalized workout programming, recovery strategies, and performance optimization guidance.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" style="margin: 0 0 32px 0;">
                                <tr>
                                    <td style="background-color: #000000; border-radius: 4px; text-align: center;">
                                        <a href="${planUrl}" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 500; color: #ffffff; text-decoration: none;">
                                            View Your Plan
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 4px 0; font-size: 16px; line-height: 1.6; color: #1a1a1a;">
                                <strong>moccet</strong>
                            </p>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 48px 20px 32px; text-align: center;">
                            <p style="margin: 0; font-size: 13px; color: #666666;">
                                <a href="<%asm_group_unsubscribe_raw_url%>" style="color: #666666; text-decoration: none;">Unsubscribe</a>
                            </p>
                        </td>
                    </tr>

                </table>

            </td>
        </tr>
    </table>

</body>
</html>`;

async function sendPlanReadyEmail(email: string, name: string, planUrl: string) {
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      console.error('[EMAIL] SendGrid API key not configured');
      return false;
    }

    sgMail.setApiKey(apiKey);

    const msg = {
      to: email,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'team@moccet.com',
        name: 'forge'
      },
      subject: 'Your Personalized Fitness Plan is Ready',
      html: EMAIL_TEMPLATE(name, planUrl),
    };

    await sgMail.send(msg);
    console.log(`[EMAIL] ✅ Plan ready email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[EMAIL] ❌ Failed to send email:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.error('[EMAIL] SendGrid error details:', (error as any).response?.body);
    }
    return false;
  }
}

async function updateJobStatus(email: string, status: 'processing' | 'completed' | 'failed', error?: string) {
  try {
    const supabase = await createClient();
    await supabase
      .from('forge_onboarding_data')
      .update({
        plan_generation_status: status,
        plan_generation_error: error || null,
        updated_at: new Date().toISOString()
      })
      .eq('email', email);
  } catch (err) {
    console.warn(`Failed to update job status to ${status}:`, err);
  }
}

async function handler(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, uniqueCode, fullName } = body;

    if (!email || !uniqueCode || !fullName) {
      console.error('Invalid webhook payload - missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`\n🚀 [QSTASH] Starting fitness plan generation for ${email} (code: ${uniqueCode})`);

    // Check if plan is already being generated or completed (idempotency check)
    try {
      const supabase = await createClient();
      const { data: existingData } = await supabase
        .from('forge_onboarding_data')
        .select('plan_generation_status, forge_plan')
        .eq('email', email)
        .single();

      if (existingData) {
        // If plan is already processing, skip to avoid duplicate generation
        if (existingData.plan_generation_status === 'processing') {
          console.log('⚠️ [QSTASH] Plan is already being generated. Skipping duplicate job.');
          return NextResponse.json({
            message: 'Plan generation already in progress',
            skipped: true
          }, { status: 200 });
        }

        // If plan is already completed and exists, skip
        if (existingData.plan_generation_status === 'completed' && existingData.forge_plan) {
          console.log('⚠️ [QSTASH] Plan already exists. Skipping duplicate job.');
          return NextResponse.json({
            message: 'Plan already generated',
            skipped: true
          }, { status: 200 });
        }
      }
    } catch (error) {
      console.warn('Failed to check existing plan status:', error);
      // Continue anyway - better to potentially duplicate than to fail
    }

    // Update status to processing
    await updateJobStatus(email, 'processing');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.moccet.ai';
    const planUrl = `${baseUrl}/forge/personalised-plan?code=${uniqueCode}`;

    // Step 0: Wait for blood analysis to complete (if uploaded)
    console.log('[0/5] Checking for health data analysis...');

    let bloodAnalysisComplete = false;
    let pollCount = 0;
    const maxPolls = 20; // 20 polls * 30 seconds = 10 minutes max wait

    while (!bloodAnalysisComplete && pollCount < maxPolls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hasBloodAnalysis = false;

      // Check dev storage first using EMAIL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const devData = devOnboardingStorage.get(email) as any;
      if (devData?.blood_analysis) {
        hasBloodAnalysis = true;
        console.log('[OK] Blood analysis found in dev storage');
      } else {
        // Check Supabase
        const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
          try {
            const supabase = await createClient();
            const { data } = await supabase
              .from('forge_onboarding_data')
              .select('lab_file_analysis')
              .eq('email', email)
              .single();

            if (data?.lab_file_analysis) {
              hasBloodAnalysis = true;
              console.log('[OK] Blood analysis found in Supabase');
            }
          } catch (error) {
            // No blood analysis yet or no Supabase
          }
        }
      }

      // Check if user even uploaded a lab file
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userData = devData || (async () => {
        const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
          try {
            const supabase = await createClient();
            const { data } = await supabase
              .from('forge_onboarding_data')
              .select('*')
              .eq('email', email)
              .single();
            return data;
          } catch {
            return null;
          }
        }
        return null;
      })();

      const hasLabFile = userData?.form_data?.hasLabFile || devData?.form_data?.hasLabFile;

      if (!hasLabFile) {
        console.log('[INFO] No lab file uploaded, skipping blood analysis wait');
        bloodAnalysisComplete = true;
        break;
      }

      if (hasBloodAnalysis) {
        bloodAnalysisComplete = true;
        break;
      }

      pollCount++;
      if (pollCount < maxPolls) {
        console.log(`[INFO] Blood analysis not ready yet, waiting 30 seconds... (attempt ${pollCount}/${maxPolls})`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    if (!bloodAnalysisComplete && pollCount >= maxPolls) {
      console.log('[WARN] Blood analysis did not complete within 10 minutes, proceeding without it');
    } else {
      console.log('[OK] Ready to generate plan with all available data');
    }

    // Fetch user's onboarding data from storage
    console.log('[1/3] Fetching user onboarding data...');

    let formData;
    let bloodAnalysisData;

    // Check dev storage first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(email) as any;
    if (devData) {
      formData = devData.form_data;
      bloodAnalysisData = devData.lab_file_analysis;
      console.log('[OK] Retrieved data from dev storage');
    } else {
      // Try Supabase
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();
          const { data } = await supabase
            .from('forge_onboarding_data')
            .select('*')
            .eq('email', email)
            .single();

          if (data) {
            formData = data.form_data;
            bloodAnalysisData = data.lab_file_analysis;
            console.log('[OK] Retrieved data from Supabase');
          }
        } catch (error) {
          console.error('Error fetching from Supabase:', error);
          throw new Error('Could not fetch user data');
        }
      }
    }

    if (!formData) {
      throw new Error('No user data found');
    }

    // Generate comprehensive fitness plan (base protocols)
    console.log('[2/7] Generating base protocols (assessment + recommendations)...');

    // INLINE AI GENERATION - Don't call separate endpoint to avoid timeout issues
    const planResult = await generateFitnessPlanInline(formData, bloodAnalysisData, baseUrl);

    console.log('[OK] Base protocols generated');

    // Extract structured data for specialized agents
    const basePlan = planResult.plan;
    const unifiedContext = planResult.unifiedContext; // Get the rich ecosystem context

    const userProfile = {
      name: formData.fullName || formData.name || 'User',
      age: parseInt(formData.age) || 30,
      gender: formData.gender || 'not specified',
      weight: parseFloat(formData.weight) || 70,
      height: parseFloat(formData.height) || 170,
      fitnessLevel: formData.fitnessLevel || formData.trainingExperience || 'intermediate',
      experienceLevel: formData.trainingExperience || 'intermediate',
      currentActivity: formData.currentActivity || 'Not specified',
      goals: formData.goals || (formData.primaryGoal ? [formData.primaryGoal] : ['general fitness']),
      equipment: formData.equipment || ['bodyweight'],
      timeAvailable: parseInt(formData.sessionLength) || 60,
      sessionsPerWeek: parseInt(formData.trainingDays) || 3,
      injuries: formData.injuries || [],
      preferences: formData.preferences || [],
      activityLevel: formData.activityLevel || 'Moderate',
      dietaryPreferences: formData.dietaryPreferences || [],
      allergies: formData.allergies || [],
      restrictions: formData.dietaryRestrictions || [],
      lifestyle: formData.lifestyle || 'Standard'
    };

    const biomarkers = bloodAnalysisData?.biomarkers || {};
    const recommendations = basePlan?.recommendations || {};

    // Ensure nested recommendation structures exist with defaults
    if (!recommendations.nutrition_protocol) {
      recommendations.nutrition_protocol = {
        objectives: ['Optimize nutrition for health and performance'],
        specificRecommendations: []
      };
    }
    if (!recommendations.training_protocol) {
      recommendations.training_protocol = {
        phase: 'General Fitness',
        recommendations: [
          {
            name: 'Balanced Strength Training',
            frequency_per_week: userProfile.sessionsPerWeek,
            session_duration_min: userProfile.timeAvailable,
            intensity: 'Moderate',
            volume: 'Standard',
            structure: 'Full body or split routine',
            instructions: 'Focus on compound movements with progressive overload',
            causal_rationale: 'Build strength and improve overall fitness based on user goals'
          }
        ]
      };
    }

    // Call specialized agents IN PARALLEL with FULL UNIFIED CONTEXT
    console.log('[3/7] Calling 4 specialized agents in parallel with unified context...');
    if (unifiedContext) {
      console.log('[CONTEXT] Passing ecosystem data to specialized agents (Sage journals, health trends, behavioral patterns)');
    }

    const [trainingResult, nutritionResult, recoveryResult, adaptationResult] = await Promise.all([
      // Training Agent
      fetch(`${baseUrl}/api/forge-generate-training`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile,
          biomarkers,
          recommendations,
          unifiedContext // Pass the full ecosystem context
        })
      }).then(res => res.json()).catch(err => {
        console.error('[TRAINING-AGENT] Error:', err);
        return { success: false };
      }),

      // Nutrition Agent
      fetch(`${baseUrl}/api/forge-generate-nutrition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile,
          biomarkers,
          recommendations,
          unifiedContext // Pass the full ecosystem context
        })
      }).then(res => res.json()).catch(err => {
        console.error('[NUTRITION-AGENT] Error:', err);
        return { success: false };
      }),

      // Recovery Agent
      fetch(`${baseUrl}/api/forge-generate-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile,
          biomarkers,
          recommendations,
          unifiedContext // Pass the full ecosystem context
        })
      }).then(res => res.json()).catch(err => {
        console.error('[RECOVERY-AGENT] Error:', err);
        return { success: false };
      }),

      // Adaptation Agent (needs training program, so we'll use a placeholder for now)
      fetch(`${baseUrl}/api/forge-generate-adaptation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile,
          biomarkers,
          trainingProgram: { weeklyProgram: {} }, // Will be populated after training agent
          unifiedContext // Pass the full ecosystem context
        })
      }).then(res => res.json()).catch(err => {
        console.error('[ADAPTATION-AGENT] Error:', err);
        return { success: false };
      })
    ]);

    console.log('[OK] All specialized agents completed');
    console.log(`  Training: ${trainingResult.success ? '✅' : '❌'}`);
    console.log(`  Nutrition: ${nutritionResult.success ? '✅' : '❌'}`);
    console.log(`  Recovery: ${recoveryResult.success ? '✅' : '❌'}`);
    console.log(`  Adaptation: ${adaptationResult.success ? '✅' : '❌'}`);

    // DEBUG: Log what each agent actually returned
    console.log('[DEBUG] Training agent returned:', JSON.stringify(trainingResult, null, 2).substring(0, 1000));
    console.log('[DEBUG] Nutrition agent returned:', JSON.stringify(nutritionResult, null, 2).substring(0, 500));
    console.log('[DEBUG] Recovery agent returned:', JSON.stringify(recoveryResult, null, 2).substring(0, 500));
    console.log('[DEBUG] Adaptation agent returned:', JSON.stringify(adaptationResult, null, 2).substring(0, 500));

    // CRITICAL: Check if training agent failed
    if (!trainingResult.success) {
      console.error('[CRITICAL] ❌ Training agent FAILED - weeklyProgram will be missing!');
      console.error('[CRITICAL] Training error:', trainingResult.error || 'Unknown error');
    }
    if (trainingResult.success && !trainingResult.weeklyProgram) {
      console.error('[CRITICAL] ⚠️  Training agent succeeded but returned NO weeklyProgram data!');
      console.error('[CRITICAL] Full training result:', JSON.stringify(trainingResult, null, 2));
    }

    // Merge all specialized agent results into the comprehensive plan
    console.log('[4/7] Merging all agent results into comprehensive plan...');

    // IMPORTANT: Prioritize specialized agent outputs over base plan
    // Only keep metadata from base plan (profile, insights, safety flags)
    const enhancedPlan = {
      // Keep base plan metadata and context
      profile: basePlan.profile,
      insights: basePlan.insights,
      assumptions: basePlan.assumptions,
      safety_flags: basePlan.safety_flags,
      contingencies: basePlan.contingencies,
      data_status: basePlan.data_status,
      data_gaps_and_requests: basePlan.data_gaps_and_requests,
      cross_source_integration_notes: basePlan.cross_source_integration_notes,
      next_steps_week_0: basePlan.next_steps_week_0,
      derived_metrics: basePlan.derived_metrics,

      // Use specialized agent outputs (agents now return clean, non-nested structure)
      executiveSummary: trainingResult.success && trainingResult.executiveSummary ?
        trainingResult.executiveSummary : undefined,

      weeklyProgram: trainingResult.success && trainingResult.weeklyProgram ?
        trainingResult.weeklyProgram : undefined,

      trainingPhilosophy: trainingResult.success && trainingResult.trainingPhilosophy ?
        trainingResult.trainingPhilosophy : undefined,

      weeklyStructure: trainingResult.success && trainingResult.weeklyStructure ?
        trainingResult.weeklyStructure : undefined,

      nutritionGuidance: nutritionResult.success && nutritionResult.nutritionGuidance ?
        nutritionResult.nutritionGuidance : undefined,

      progressTracking: recoveryResult.success && recoveryResult.progressTracking ?
        recoveryResult.progressTracking : undefined,

      injuryPrevention: recoveryResult.success && recoveryResult.injuryPrevention ?
        recoveryResult.injuryPrevention : undefined,

      recoveryProtocol: recoveryResult.success && recoveryResult.recoveryProtocol ?
        recoveryResult.recoveryProtocol : undefined,

      adaptiveFeatures: adaptationResult.success && adaptationResult.adaptiveFeatures ?
        adaptationResult.adaptiveFeatures : undefined,

      // Map supplements from nutrition agent (properly structured)
      supplementRecommendations: nutritionResult.success && nutritionResult.nutritionGuidance?.supplements ? {
        essentialSupplements: nutritionResult.nutritionGuidance.supplements.filter((s: any) =>
          ['Omega-3', 'EPA/DHA', 'Fish Oil', 'Vitamin D', 'Vitamin D3', 'Magnesium'].some(name =>
            s.name.includes(name)
          )
        ),
        optionalSupplements: nutritionResult.nutritionGuidance.supplements.filter((s: any) =>
          !['Omega-3', 'EPA/DHA', 'Fish Oil', 'Vitamin D', 'Vitamin D3', 'Magnesium'].some(name =>
            s.name.includes(name)
          )
        )
      } : undefined,

      // Keep the raw base plan data for reference (nested under 'plan')
      plan: basePlan.plan
    };

    console.log('[OK] Comprehensive plan assembled with all specialized sections');

    // DEBUG: Log what's actually in the enhanced plan
    console.log('[DEBUG] Enhanced plan top-level keys:', Object.keys(enhancedPlan));
    console.log('[DEBUG] Has weeklyProgram:', !!enhancedPlan.weeklyProgram);
    console.log('[DEBUG] Has nutritionGuidance:', !!enhancedPlan.nutritionGuidance);
    console.log('[DEBUG] Has progressTracking:', !!enhancedPlan.progressTracking);
    console.log('[DEBUG] Has injuryPrevention:', !!enhancedPlan.injuryPrevention);
    console.log('[DEBUG] Has adaptiveFeatures:', !!enhancedPlan.adaptiveFeatures);
    console.log('[DEBUG] Has sleep_recovery_protocol:', !!enhancedPlan.sleep_recovery_protocol);

    // Call content enrichment agent to fill empty/placeholder sections
    console.log('[4.5/7] Running content enrichment agent to fill empty sections...');
    try {
      const enrichmentResult = await fetch(`${baseUrl}/api/forge-enrich-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: enhancedPlan,
          userProfile,
          biomarkers,
          unifiedContext
        })
      }).then(res => res.json()).catch(err => {
        console.error('[ENRICHMENT-AGENT] Error:', err);
        return { success: false };
      });

      if (enrichmentResult.success && enrichmentResult.enrichedSections) {
        console.log(`[ENRICHMENT-AGENT] ✅ Enriched ${enrichmentResult.issuesFound} sections`);

        // Merge enriched content into the plan
        if (enrichmentResult.enrichedSections.trainingPhilosophy) {
          enhancedPlan.trainingPhilosophy = {
            ...enhancedPlan.trainingPhilosophy,
            ...enrichmentResult.enrichedSections.trainingPhilosophy
          };
        }

        if (enrichmentResult.enrichedSections.weeklyStructure) {
          enhancedPlan.weeklyStructure = {
            ...enhancedPlan.weeklyStructure,
            ...enrichmentResult.enrichedSections.weeklyStructure
          };
        }

        if (enrichmentResult.enrichedSections.nutritionGuidance) {
          enhancedPlan.nutritionGuidance = {
            ...enhancedPlan.nutritionGuidance,
            ...enrichmentResult.enrichedSections.nutritionGuidance
          };
        }

        console.log('[ENRICHMENT-AGENT] Merged enriched content into plan');
      } else {
        console.log('[ENRICHMENT-AGENT] No enrichment needed or agent failed');
      }
    } catch (error) {
      console.error('[ENRICHMENT-AGENT] Non-fatal error during enrichment:', error);
      // Continue even if enrichment fails - it's not critical
    }

    // Store the generated plan
    console.log('[5/7] Storing comprehensive fitness plan...');

    // Store in dev storage
    devPlanStorage.set(uniqueCode, {
      email,
      uniqueCode,
      fullName,
      status: 'completed',
      generatedAt: new Date().toISOString(),
      plan: enhancedPlan
    });

    // Store in Supabase if available
    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
      try {
        const supabase = await createClient();
        await supabase
          .from('forge_onboarding_data')
          .update({
            forge_plan: enhancedPlan,
            plan_generation_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('email', email);
        console.log('[OK] Plan stored in Supabase');
      } catch (error) {
        console.error('Error storing in Supabase:', error);
      }
    }

    console.log('[OK] Fitness plan stored successfully');

    // Send email notification
    console.log('[6/7] Sending plan ready email...');
    console.log(`Email details: to=${email}, name=${fullName}, planUrl=${planUrl}`);
    const emailSent = await sendPlanReadyEmail(email, fullName, planUrl);

    // Update status to completed
    console.log('[7/7] Finalizing...');
    await updateJobStatus(email, 'completed');

    if (emailSent) {
      console.log(`\n✅ [QSTASH] Complete fitness plan generation finished with specialized agents and email sent to ${email}`);
    } else {
      console.error(`\n⚠️ [QSTASH] Plan generated but EMAIL FAILED for ${email}`);
      console.error('Check: 1) SENDGRID_API_KEY is set, 2) SENDGRID_FROM_EMAIL is verified in SendGrid dashboard');
    }

    return NextResponse.json({
      success: true,
      message: 'Fitness plan generation completed successfully',
    });

  } catch (error) {
    console.error('❌ [QSTASH] Fitness plan generation failed:', error);

    // Try to update status to failed
    try {
      const body = await request.json();
      await updateJobStatus(body.email, 'failed', error instanceof Error ? error.message : 'Unknown error');
    } catch {
      // Ignore if we can't update status
    }

    return NextResponse.json(
      {
        error: 'Fitness plan generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the handler with conditional QStash signature verification
// In dev mode or when X-Dev-Mode header is present, skip verification
export async function POST(request: NextRequest) {
  const isDevMode = process.env.NODE_ENV === 'development' || request.headers.get('X-Dev-Mode') === 'true';

  if (isDevMode) {
    console.log('🚀 [DEV] Skipping QStash signature verification - running in dev mode');
    return handler(request);
  }

  // In production, verify QStash signature
  const verifiedHandler = verifySignatureAppRouter(handler);
  return verifiedHandler(request);
}
