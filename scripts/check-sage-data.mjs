import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSagePlanData() {
  // Get the most recent Sage plan
  const { data, error } = await supabase
    .from('sage_onboarding_data')
    .select('email, sage_plan, meal_plan, micronutrients, lifestyle_integration, plan_generation_status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching Sage plan:', error);
    return;
  }

  if (!data) {
    console.log('No Sage plans found');
    return;
  }

  console.log('\n=== SAGE PLAN DATA CHECK ===');
  console.log('Email:', data.email);
  console.log('Status:', data.plan_generation_status);
  console.log('Updated:', data.updated_at);

  console.log('\n=== SAGE PLAN STRUCTURE ===');
  console.log('Has sage_plan:', !!data.sage_plan);
  console.log('Has meal_plan:', !!data.meal_plan);
  console.log('Has micronutrients:', !!data.micronutrients);
  console.log('Has lifestyle_integration:', !!data.lifestyle_integration);

  if (data.sage_plan) {
    console.log('\n=== SAGE PLAN TOP-LEVEL KEYS ===');
    console.log(Object.keys(data.sage_plan));
  } else {
    console.log('\n⚠️  sage_plan is MISSING from the database!');
  }

  if (data.meal_plan) {
    console.log('\n=== MEAL PLAN STRUCTURE ===');
    console.log(JSON.stringify(data.meal_plan, null, 2).substring(0, 500));
  } else {
    console.log('\n⚠️  meal_plan is MISSING from the database!');
  }
}

checkSagePlanData();
