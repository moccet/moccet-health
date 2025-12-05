import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { devPlanStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';

// This endpoint handles content enrichment as a separate background job
// It can run for up to 13 minutes without blocking the main plan generation
export const maxDuration = 800;

// Import email sending function
async function sendPlanReadyEmail(email: string, name: string, planUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-forge-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, planUrl }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error sending email:', error);
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

    // Send email notification with the fully enriched plan
    console.log('[FORGE-ENRICHMENT] Sending plan ready email...');
    const emailSent = await sendPlanReadyEmail(email, fullName, planUrl);

    if (emailSent) {
      console.log(`[FORGE-ENRICHMENT] ✅ Email sent successfully to ${email}`);
    } else {
      console.error(`[FORGE-ENRICHMENT] ⚠️ Email failed for ${email}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Content enrichment completed and email sent',
      sectionsEnriched: enrichmentResult.issuesFound,
      emailSent
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
