import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlanData() {
  // Get the most recent plan
  const { data, error } = await supabase
    .from('forge_onboarding_data')
    .select('email, forge_plan, plan_generation_status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching plan:', error);
    return;
  }

  if (!data) {
    console.log('No plans found');
    return;
  }

  console.log('\n=== PLAN DATA CHECK ===');
  console.log('Email:', data.email);
  console.log('Status:', data.plan_generation_status);
  console.log('Updated:', data.updated_at);
  console.log('\n=== TOP-LEVEL KEYS IN PLAN ===');
  console.log(Object.keys(data.forge_plan || {}));
  console.log('\n=== TRAINING DATA ===');
  console.log('Has weeklyProgram:', !!data.forge_plan?.weeklyProgram);
  console.log('Has executiveSummary:', !!data.forge_plan?.executiveSummary);
  console.log('Has trainingPhilosophy:', !!data.forge_plan?.trainingPhilosophy);
  console.log('\n=== NUTRITION DATA ===');
  console.log('Has nutritionGuidance:', !!data.forge_plan?.nutritionGuidance);

  if (data.forge_plan?.weeklyProgram) {
    console.log('\n=== WEEKLY PROGRAM STRUCTURE ===');
    console.log(JSON.stringify(data.forge_plan.weeklyProgram, null, 2).substring(0, 500));
  } else {
    console.log('\n⚠️  weeklyProgram is MISSING from the database!');
  }
}

checkPlanData();
