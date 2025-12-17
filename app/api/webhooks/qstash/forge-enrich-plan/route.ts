import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { devPlanStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';

// This endpoint handles content enrichment as a separate background job
// It can run for up to 13 minutes without blocking the main plan generation
export const maxDuration = 800;

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

async function sendPlanReadyEmail(email: string, name: string, planUrl: string): Promise<boolean> {
  try {
    const sgMail = (await import('@sendgrid/mail')).default;
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      console.error('[FORGE-ENRICHMENT] SendGrid API key not configured');
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
    console.log(`[FORGE-ENRICHMENT] ✅ Plan ready email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('[FORGE-ENRICHMENT] ❌ Failed to send email:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.error('[FORGE-ENRICHMENT] SendGrid error details:', (error as any).response?.body);
    }
    return false;
  }
}

async function updateJobStatus(email: string, status: string) {
  const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
    try {
      const supabase = await createClient();
      await supabase
        .from('forge_onboarding_data')
        .update({ plan_generation_status: status })
        .eq('email', email);
    } catch (error) {
      console.error('Error updating job status:', error);
    }
  }
}

async function handler(request: NextRequest) {
  try {
    const { email, uniqueCode, fullName, planUrl } = await request.json();

    console.log(`[FORGE-ENRICHMENT] Starting content enrichment for ${email} (code: ${uniqueCode})`);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Retrieve the existing plan from storage
    let existingPlan;
    let userProfile;
    let biomarkers;
    let unifiedContext;

    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
      // Fetch from Supabase
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('forge_onboarding_data')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        console.error('[FORGE-ENRICHMENT] Failed to fetch plan from Supabase:', error);
        return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
      }

      existingPlan = data.forge_plan;
      userProfile = data.form_data;

      // Fetch biomarkers if available
      const { data: bioData } = await supabase
        .from('blood_analysis')
        .select('*')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      biomarkers = bioData?.analysis || null;

      // Fetch unified context if available
      const { data: contextData } = await supabase
        .from('unified_context')
        .select('*')
        .eq('user_email', email)
        .single();

      unifiedContext = contextData || null;
    } else {
      // Fetch from dev storage
      const stored = devPlanStorage.get(uniqueCode);
      if (!stored || !stored.plan) {
        console.error('[FORGE-ENRICHMENT] Plan not found in dev storage');
        return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
      }

      existingPlan = stored.plan;
      userProfile = {}; // Would need to fetch from devOnboardingStorage if needed
    }

    if (!existingPlan) {
      console.error('[FORGE-ENRICHMENT] No plan data available');
      return NextResponse.json({ success: false, error: 'No plan data' }, { status: 404 });
    }

    console.log('[FORGE-ENRICHMENT] Fetched existing plan, calling enrichment API...');

    // Call the enrichment API
    const enrichmentResult = await fetch(`${baseUrl}/api/forge-enrich-content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: existingPlan,
        userProfile,
        biomarkers,
        unifiedContext
      })
    }).then(res => res.json()).catch(err => {
      console.error('[FORGE-ENRICHMENT] Error calling enrichment API:', err);
      return { success: false };
    });

    if (!enrichmentResult.success || !enrichmentResult.enrichedSections) {
      console.log('[FORGE-ENRICHMENT] No enrichment needed or enrichment failed');
      return NextResponse.json({ success: true, message: 'No enrichment needed' });
    }

    console.log(`[FORGE-ENRICHMENT] ✅ Enriched ${enrichmentResult.issuesFound} sections`);

    // Merge enriched content into the plan
    const enrichedPlan = { ...existingPlan };

    if (enrichmentResult.enrichedSections.trainingPhilosophy) {
      enrichedPlan.trainingPhilosophy = {
        ...enrichedPlan.trainingPhilosophy,
        ...enrichmentResult.enrichedSections.trainingPhilosophy
      };
    }

    if (enrichmentResult.enrichedSections.weeklyStructure) {
      enrichedPlan.weeklyStructure = {
        ...enrichedPlan.weeklyStructure,
        ...enrichmentResult.enrichedSections.weeklyStructure
      };
    }

    if (enrichmentResult.enrichedSections.nutritionGuidance) {
      enrichedPlan.nutritionGuidance = {
        ...enrichedPlan.nutritionGuidance,
        ...enrichmentResult.enrichedSections.nutritionGuidance
      };
    }

    console.log('[FORGE-ENRICHMENT] Merged enriched content, storing updated plan...');

    // Store the enriched plan back
    if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
      const supabase = await createClient();
      await supabase
        .from('forge_onboarding_data')
        .update({
          forge_plan: enrichedPlan,
          updated_at: new Date().toISOString()
        })
        .eq('email', email);
      console.log('[FORGE-ENRICHMENT] ✅ Enriched plan stored in Supabase');
    } else {
      devPlanStorage.set(uniqueCode, {
        email,
        uniqueCode,
        fullName,
        status: 'completed',
        generatedAt: new Date().toISOString(),
        plan: enrichedPlan
      });
      console.log('[FORGE-ENRICHMENT] ✅ Enriched plan stored in dev storage');
    }

    console.log(`[FORGE-ENRICHMENT] ✅ Content enrichment completed for ${email}`);

    // Update job status to completed
    await updateJobStatus(email, 'completed');

    // NOTE: Email sending disabled - plans should be reviewed before sending
    // To send email manually, create a /api/send-forge-email endpoint
    console.log(`[FORGE-ENRICHMENT] ✅ Plan ready for ${email} (email disabled - manual review required)`);

    return NextResponse.json({
      success: true,
      message: 'Content enrichment completed (email disabled - manual review required)',
      sectionsEnriched: enrichmentResult.issuesFound,
      emailSent: false
    });

  } catch (error) {
    console.error('[FORGE-ENRICHMENT] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Enrichment failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // In development, skip signature verification
  if (process.env.NODE_ENV === 'development' || process.env.FORCE_DEV_MODE === 'true') {
    return handler(request);
  }

  // In production, verify QStash signature
  const verifiedHandler = verifySignatureAppRouter(handler);
  return verifiedHandler(request);
}
