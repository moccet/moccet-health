import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { devOnboardingStorage } from '@/lib/dev-storage';

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
    console.log('Sage onboarding data received:', {
      timestamp: data.timestamp,
      completed: data.completed,
      email: data.email,
      dataKeys: Object.keys(data),
    });

    // Check if Supabase is configured and working
    // For local testing, you can set FORCE_DEV_MODE=true to skip Supabase
    const forceDevMode = process.env.FORCE_DEV_MODE === 'true';
    const hasSupabase = !forceDevMode && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!hasSupabase || forceDevMode) {
      // Development mode: Use in-memory storage
      console.log('⚠️  Supabase not configured - using in-memory storage (dev mode)');

      const formData = {
        fullName: data.fullName,
        age: data.age,
        gender: data.gender,
        weight: data.weight,
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
        workoutTime: data.workoutTime,
        workoutDays: data.workoutDays,
        gymEquipment: data.gymEquipment,
        otherEquipment: data.otherEquipment,
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
      };

      devOnboardingStorage.set(data.email, { form_data: formData });

      console.log('✅ Data stored in dev memory');
      console.log(`[DEBUG] Storage size after save: ${devOnboardingStorage.size}`);
      console.log(`[DEBUG] Storage keys:`, Array.from(devOnboardingStorage.keys()));

      return NextResponse.json({
        success: true,
        message: 'Onboarding data stored successfully (dev mode)',
        data: {
          email: data.email,
          timestamp: new Date().toISOString(),
        },
      }, { status: 200 });
    }

    // Production mode: Use Supabase
    console.log('✅ Supabase configured - using database storage');

    // Initialize Supabase client
    const supabase = await createClient();

    // Prepare the form data (exclude file objects as they can't be stored in JSON)
    const formData = {
      fullName: data.fullName,
      age: data.age,
      gender: data.gender,
      weight: data.weight,
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
      workoutTime: data.workoutTime,
      workoutDays: data.workoutDays,
      gymEquipment: data.gymEquipment,
      otherEquipment: data.otherEquipment,
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
    };

    // Store onboarding data in Supabase
    const { data: insertedData, error: insertError } = await supabase
      .from('sage_onboarding_data')
      .upsert({
        email: data.email,
        form_data: formData,
        lab_file_analysis: null, // Will be populated if they uploaded a lab file
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      })
      .select();

    if (insertError) {
      console.error('Supabase insert error:', insertError);
      return NextResponse.json(
        {
          error: 'Failed to store onboarding data',
          message: insertError.message,
        },
        { status: 500 }
      );
    }

    console.log('Onboarding data stored successfully:', insertedData);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Onboarding data stored successfully',
        data: {
          email: data.email,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing sage onboarding:', error);
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

  if (!email) {
    return NextResponse.json(
      {
        message: 'Sage onboarding API endpoint',
        methods: ['POST', 'GET'],
        description: 'Submit sage onboarding data via POST request, retrieve via GET with ?email=',
      },
      { status: 200 }
    );
  }

  // Check dev storage first
  const devData = devOnboardingStorage.get(email);
  if (devData) {
    return NextResponse.json({
      success: true,
      data: devData,
      source: 'dev-memory',
    });
  }

  // Try Supabase if configured
  const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (hasSupabase) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('sage_onboarding_data')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
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
