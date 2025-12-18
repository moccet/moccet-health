import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Transform nested biomarkers object to flat array for frontend
// Also handles different formats from image vs PDF blood work uploads
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformBloodAnalysis(analysis: any) {
  if (!analysis) return null;

  const result = { ...analysis };

  // Transform concerns from object to array if needed
  // e.g., {"folate": "High normal", "magnesium": "Low"} -> ["High normal folate", "Low magnesium"]
  if (result.concerns && typeof result.concerns === 'object' && !Array.isArray(result.concerns)) {
    result.concerns = Object.entries(result.concerns).map(([marker, status]) =>
      `${status} ${marker}`.replace(/\s+/g, ' ').trim()
    );
  }

  // Transform positives from object to array if needed
  // e.g., {"iron": "Optimal", "ferritin": "Optimal"} -> ["Optimal iron", "Optimal ferritin"]
  if (result.positives && typeof result.positives === 'object' && !Array.isArray(result.positives)) {
    result.positives = Object.entries(result.positives).map(([marker, status]) =>
      `${status} ${marker}`.replace(/\s+/g, ' ').trim()
    );
  }

  // Transform recommendations if it's in simple format
  if (result.recommendations && typeof result.recommendations === 'object') {
    const recs = result.recommendations;
    // Convert string values to arrays if needed
    if (typeof recs.lifestyle === 'string') {
      recs.lifestyle = [recs.lifestyle];
    }
    if (typeof recs.nutrition === 'string') {
      recs.dietary = recs.dietary || [recs.nutrition];
    }
    if (typeof recs.dietary === 'string') {
      recs.dietary = [recs.dietary];
    }
    if (typeof recs.supplements === 'string') {
      recs.supplements = [recs.supplements];
    }
    // Ensure arrays exist
    recs.lifestyle = recs.lifestyle || [];
    recs.dietary = recs.dietary || [];
    recs.supplements = recs.supplements || [];
    recs.followUp = recs.followUp || [];
    recs.retestTiming = recs.retestTiming || '';
  }

  // If biomarkers is already an array, return the transformed result
  if (Array.isArray(result.biomarkers)) {
    return result;
  }

  // Transform nested biomarkers object to flat array
  if (result.biomarkers && typeof result.biomarkers === 'object') {
    const flatBiomarkers: Array<{
      name: string;
      value: number | string | null;
      unit?: string;
      status: string;
      category: string;
      referenceRange?: string;
    }> = [];

    // Determine status from concerns/positives objects (original format before transformation)
    const getStatusForMarker = (markerName: string): string => {
      const lowerName = markerName.toLowerCase();
      // Check if it's in concerns
      if (analysis.concerns && typeof analysis.concerns === 'object' && !Array.isArray(analysis.concerns)) {
        for (const [key, value] of Object.entries(analysis.concerns)) {
          if (key.toLowerCase() === lowerName) {
            return String(value);
          }
        }
      }
      // Check if it's in positives
      if (analysis.positives && typeof analysis.positives === 'object' && !Array.isArray(analysis.positives)) {
        for (const [key, value] of Object.entries(analysis.positives)) {
          if (key.toLowerCase() === lowerName) {
            return String(value);
          }
        }
      }
      return 'Normal';
    };

    for (const [category, markers] of Object.entries(result.biomarkers)) {
      if (markers && typeof markers === 'object') {
        for (const [name, data] of Object.entries(markers as Record<string, any>)) {
          // Handle case where data is a string (e.g., "8 ng/mL") instead of an object
          if (typeof data === 'string') {
            // Parse value and unit from string like "8 ng/mL" or "134 mcg/dL"
            const match = data.match(/^([\d.]+)\s*(.*)$/);
            flatBiomarkers.push({
              name: name.replace(/([A-Z])/g, ' $1').trim(), // Convert camelCase to readable
              value: match ? match[1] : data,
              unit: match ? match[2] : undefined,
              status: getStatusForMarker(name),
              category: category.replace(/([A-Z])/g, ' $1').trim(),
              referenceRange: undefined,
            });
          } else if (data && typeof data === 'object') {
            flatBiomarkers.push({
              name: name.replace(/([A-Z])/g, ' $1').trim(),
              value: data.value,
              unit: data.unit,
              status: data.status || getStatusForMarker(name),
              category: category.replace(/([A-Z])/g, ' $1').trim(),
              referenceRange: data.referenceRange || data.range,
            });
          }
        }
      }
    }

    result.biomarkers = flatBiomarkers;
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const email = searchParams.get('email');

    console.log('[GET-PLAN] Received request with code:', code, 'email:', email);

    if (!code && !email) {
      return NextResponse.json(
        { error: 'Either code or email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Try sage table first
    const sageQuery = supabase
      .from('sage_onboarding_data')
      .select('sage_plan, lab_file_analysis, plan_generation_status, plan_generation_error, meal_plan, micronutrients, lifestyle_integration, form_data, email');

    if (code) {
      sageQuery.eq('form_data->>uniqueCode', code);
    } else {
      sageQuery.eq('email', email);
    }

    const { data, error } = await sageQuery.single();

    console.log('[GET-PLAN] Sage query result - error:', error, 'hasData:', !!data);

    // Debug: Check if any records exist with this code
    if (error && code) {
      const debugQuery = await supabase
        .from('sage_onboarding_data')
        .select('email, form_data')
        .limit(5);
      console.log('[GET-PLAN DEBUG] Sample sage records:', debugQuery.data?.map(d => ({ email: d.email, uniqueCode: d.form_data?.uniqueCode })));
    }

    // If not found in sage table OR sage has no plan, try forge table
    if (error || !data || !data.sage_plan) {
      console.log('[GET-PLAN] Not found in sage table or no sage_plan, trying forge table...');
      const forgeQuery = supabase
        .from('forge_onboarding_data')
        .select('forge_plan, lab_file_analysis, plan_generation_status, plan_generation_error, form_data, email');

      if (code) {
        forgeQuery.eq('form_data->>uniqueCode', code);
      } else {
        forgeQuery.eq('email', email);
      }

      const forgeResult = await forgeQuery.single();

      console.log('[GET-PLAN] Forge query result - error:', forgeResult.error, 'hasData:', !!forgeResult.data);

      // Debug: Check if any records exist with this code
      if (forgeResult.error && code) {
        const debugQuery = await supabase
          .from('forge_onboarding_data')
          .select('email, form_data')
          .limit(5);
        console.log('[GET-PLAN DEBUG] Sample forge records:', debugQuery.data?.map(d => ({ email: d.email, uniqueCode: d.form_data?.uniqueCode })));
      }

      if (forgeResult.error || !forgeResult.data) {
        console.log('[GET-PLAN] Not found in either table');
        return NextResponse.json(
          {
            success: false,
            error: 'No plan found for this user'
          },
          { status: 404 }
        );
      }

      // Return forge plan data
      console.log('[GET-PLAN] Returning forge plan data');
      console.log('[GET-PLAN] Plan keys:', forgeResult.data.forge_plan ? Object.keys(forgeResult.data.forge_plan) : 'null');
      console.log('[GET-PLAN] Has sevenDayProgram:', !!forgeResult.data.forge_plan?.sevenDayProgram);
      console.log('[GET-PLAN] Has trainingPhilosophy:', !!forgeResult.data.forge_plan?.trainingPhilosophy);

      return NextResponse.json({
        success: true,
        plan: forgeResult.data.forge_plan,
        bloodAnalysis: transformBloodAnalysis(forgeResult.data.lab_file_analysis),
        status: forgeResult.data.plan_generation_status || 'completed',
        error: forgeResult.data.plan_generation_error,
        gender: forgeResult.data.form_data?.gender,
        email: forgeResult.data.email
      });
    }

    // Return sage plan data
    console.log('[GET-PLAN] Returning sage plan data');
    return NextResponse.json({
      success: true,
      plan: data.sage_plan,
      bloodAnalysis: transformBloodAnalysis(data.lab_file_analysis),
      mealPlan: data.meal_plan,
      micronutrients: data.micronutrients,
      lifestyleIntegration: data.lifestyle_integration,
      status: data.plan_generation_status || 'completed',
      error: data.plan_generation_error,
      email: data.email
    });

  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
