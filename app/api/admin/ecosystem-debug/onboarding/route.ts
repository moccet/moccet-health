import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get onboarding data
    const { data, error } = await supabase
      .from('forge_onboarding_data')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch onboarding data',
        details: error.message,
      });
    }

    if (!data) {
      return NextResponse.json({
        success: false,
        message: 'No onboarding data found for this user',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        email: data.email,
        uniqueCode: data.form_data?.uniqueCode,
        hasLabFile: data.form_data?.hasLabFile,
        hasLabAnalysis: !!data.lab_file_analysis,
        hasForgePlan: !!data.forge_plan,
        planGenerationStatus: data.plan_generation_status,
        planGenerationError: data.plan_generation_error,
        integrations: data.form_data?.integrations || [],
        ecosystemSyncStatus: data.ecosystem_sync_status,
        lastEcosystemSync: data.last_ecosystem_sync,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      },
      formDataKeys: Object.keys(data.form_data || {}),
      forgePlanKeys: data.forge_plan ? Object.keys(data.forge_plan) : null,
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal error',
      details: String(error)
    }, { status: 500 });
  }
}
