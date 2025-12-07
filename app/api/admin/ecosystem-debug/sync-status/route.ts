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

    // Get ecosystem sync status from onboarding data
    const { data: onboardingData, error: onboardingError } = await supabase
      .from('forge_onboarding_data')
      .select('ecosystem_sync_status, last_ecosystem_sync')
      .eq('email', email)
      .single();

    // Get cached context
    const { data: cachedContext, error: cacheError } = await supabase
      .from('ecosystem_context_cache')
      .select('*')
      .eq('user_email', email)
      .single();

    // Get behavioral patterns
    const { data: patterns, error: patternsError } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('user_email', email);

    // Get unified context
    const { data: unifiedContext, error: unifiedError } = await supabase
      .from('unified_context')
      .select('*')
      .eq('user_email', email)
      .single();

    return NextResponse.json({
      success: true,
      syncStatus: onboardingData?.ecosystem_sync_status || null,
      lastSync: onboardingData?.last_ecosystem_sync || null,
      cachedContext: cachedContext ? {
        contextType: cachedContext.context_type,
        hasContext: !!cachedContext.context,
        contextKeys: cachedContext.context ? Object.keys(cachedContext.context) : [],
        qualityScore: cachedContext.quality_score,
        expiresAt: cachedContext.expires_at,
        createdAt: cachedContext.created_at,
      } : null,
      behavioralPatterns: patterns ? {
        count: patterns.length,
        sources: patterns.map(p => p.source),
      } : null,
      unifiedContext: unifiedContext ? {
        hasContext: true,
        contextKeys: Object.keys(unifiedContext.context || {}),
        lastUpdated: unifiedContext.updated_at,
      } : null,
      errors: {
        onboarding: onboardingError?.message,
        cache: cacheError?.message,
        patterns: patternsError?.message,
        unified: unifiedError?.message,
      },
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal error',
      details: String(error)
    }, { status: 500 });
  }
}
