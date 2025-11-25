import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { devOnboardingStorage } from '@/lib/dev-storage';

// Generate a unique 8-character code
function generateUniqueCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar looking chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate the incoming data
    if (!data || !data.email) {
      return NextResponse.json(
        { error: 'No data provided or missing email' },
        { status: 400 }
      );
    }

    // Log the onboarding data
    console.log('Forge onboarding data received:', {
      timestamp: data.timestamp,
      completed: data.completed,
      email: data.email,
      dataKeys: Object.keys(data),
    });

    // Check if Supabase is configured and working
    // For local testing, you can set FORCE_DEV_MODE=true to skip Supabase
    const forceDevMode = process.env.FORCE_DEV_MODE === 'true';
    const hasSupabase = !forceDevMode && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Generate unique code for this user's plan
    const uniqueCode = generateUniqueCode();
    console.log(`[UNIQUE CODE] Generated code for ${data.email}: ${uniqueCode}`);

    if (!hasSupabase || forceDevMode) {
      // Development mode: Use in-memory storage
      console.log('⚠️  Supabase not configured - using in-memory storage (dev mode)');

      const formData = {
        fullName: data.fullName,
        age: data.age,
        gender: data.gender,
        weight: data.weight,
        weightUnit: data.weightUnit,
        height: data.height,
        email: data.email,
        mainPriority: data.mainPriority,
        drivingGoal: data.drivingGoal,
        allergies: data.allergies,
        otherAllergy: data.otherAllergy,
        medications: data.medications,
        supplements: data.supplements,
        medicalConditions: data.medicalConditions,
        otherCondition: data.otherCondition,
        eatingStyle: data.eatingStyle,
        firstMeal: data.firstMeal,
        energyCrash: data.energyCrash,
        proteinSources: data.proteinSources,
        otherProtein: data.otherProtein,
        foodDislikes: data.foodDislikes,
        mealsCooked: data.mealsCooked,
        alcoholConsumption: data.alcoholConsumption,
        integrations: data.integrations,
        timestamp: data.timestamp,
        completed: data.completed,
        hasLabFile: !!data.labFile,
        uniqueCode: uniqueCode,
      };

      devOnboardingStorage.set(data.email, { form_data: formData });
      devOnboardingStorage.set(uniqueCode, { form_data: formData }); // Also store by code

      console.log('✅ Data stored in dev memory');
      console.log(`[DEBUG] Storage size after save: ${devOnboardingStorage.size}`);
      console.log(`[DEBUG] Storage keys:`, Array.from(devOnboardingStorage.keys()));

      return NextResponse.json({
        success: true,
        message: 'Onboarding data stored successfully (dev mode)',
        data: {
          email: data.email,
          uniqueCode: uniqueCode,
          timestamp: new Date().toISOString(),
        },
      }, { status: 200 });
    }

    // Production mode: Try to use Supabase, fall back to dev mode if it fails
    console.log('✅ Supabase configured - attempting to use database storage');

    // Prepare the form data (exclude file objects as they can't be stored in JSON)
    const formData = {
      fullName: data.fullName,
      age: data.age,
      gender: data.gender,
      weight: data.weight,
      weightUnit: data.weightUnit,
      height: data.height,
      email: data.email,
      mainPriority: data.mainPriority,
      drivingGoal: data.drivingGoal,
      allergies: data.allergies,
      otherAllergy: data.otherAllergy,
      medications: data.medications,
      supplements: data.supplements,
      medicalConditions: data.medicalConditions,
      otherCondition: data.otherCondition,
      eatingStyle: data.eatingStyle,
      firstMeal: data.firstMeal,
      energyCrash: data.energyCrash,
      proteinSources: data.proteinSources,
      otherProtein: data.otherProtein,
      foodDislikes: data.foodDislikes,
      mealsCooked: data.mealsCooked,
      alcoholConsumption: data.alcoholConsumption,
      integrations: data.integrations,
      timestamp: data.timestamp,
      completed: data.completed,
      hasLabFile: !!data.labFile,
      uniqueCode: uniqueCode,
    };

    try {
      // Initialize Supabase client
      const supabase = await createClient();

      // Store onboarding data in Supabase
      // Clear old plan data when new onboarding is submitted
      const { data: insertedData, error: insertError } = await supabase
        .from('forge_onboarding_data')
        .upsert({
          email: data.email,
          form_data: formData,
          lab_file_analysis: null, // Will be populated if they uploaded a lab file
          forge_plan: null, // Clear old plan when new onboarding is submitted
          plan_generation_status: null, // Reset plan generation status
          plan_generation_error: null, // Clear old errors
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'email',
        })
        .select();

      if (insertError) {
        throw insertError;
      }

      console.log('Onboarding data stored successfully in Supabase:', insertedData);

      // Return success response
      return NextResponse.json(
        {
          success: true,
          message: 'Onboarding data stored successfully',
          data: {
            email: data.email,
            uniqueCode: uniqueCode,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 200 }
      );
    } catch (supabaseError) {
      // Supabase failed - fall back to dev mode
      console.error('Supabase error, falling back to dev mode:', supabaseError);
      console.log('⚠️  Using in-memory storage as fallback');

      devOnboardingStorage.set(data.email, { form_data: formData });
      devOnboardingStorage.set(uniqueCode, { form_data: formData }); // Also store by code

      console.log('✅ Data stored in dev memory (fallback)');
      console.log(`[DEBUG] Storage size after save: ${devOnboardingStorage.size}`);

      return NextResponse.json({
        success: true,
        message: 'Onboarding data stored successfully (dev mode fallback)',
        data: {
          email: data.email,
          uniqueCode: uniqueCode,
          timestamp: new Date().toISOString(),
        },
      }, { status: 200 });
    }
  } catch (error) {
    console.error('Error processing forge onboarding:', error);
    return NextResponse.json(
      {
        error: 'Failed to process onboarding data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle GET requests - retrieve stored data (for dev mode)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const code = searchParams.get('code');

  const identifier = code || email;

  if (!identifier) {
    return NextResponse.json(
      {
        message: 'Forge onboarding API endpoint',
        methods: ['POST', 'GET'],
        description: 'Submit forge onboarding data via POST request, retrieve via GET with ?email= or ?code=',
      },
      { status: 200 }
    );
  }

  // Check dev storage first
  const devData = devOnboardingStorage.get(identifier);
  if (devData) {
    return NextResponse.json({
      success: true,
      data: devData,
      source: 'dev-memory',
    });
  }

  // Try Supabase if configured
  const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
    try {
      const supabase = await createClient();

      // If searching by code, need to search in the form_data JSON field
      let data, error;

      if (code) {
        // Search by uniqueCode in the form_data JSON field using the ->> operator
        const result = await supabase
          .from('forge_onboarding_data')
          .select('*')
          .eq('form_data->>uniqueCode', code)
          .single();
        data = result.data;
        error = result.error;
      } else if (email) {
        // Search by email (primary key)
        const result = await supabase
          .from('forge_onboarding_data')
          .select('*')
          .eq('email', email)
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.log('Failed to fetch onboarding data from Supabase:', error.message);
        return NextResponse.json(
          { error: 'Data not found', message: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        source: 'supabase',
      });
    } catch (error) {
      console.error('Error fetching from Supabase:', error);
      return NextResponse.json(
        {
          error: 'Failed to retrieve data',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'No data found for this email' },
    { status: 404 }
  );
}
