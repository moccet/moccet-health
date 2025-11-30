/**
 * Check what's in the meal_plan column
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const planCode = '5U2JQA6N';

async function checkMealPlan() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: plans } = await supabase
    .from('sage_onboarding_data')
    .select('meal_plan, sage_plan, updated_at, email')
    .not('sage_plan', 'is', null);

  const plan = plans.find(p => p.email === 'sofian@moccet.com');

  console.log('Updated at:', plan.updated_at);
  console.log('\nHas meal_plan:', !!plan.meal_plan);
  console.log('Has sage_plan.sampleMealPlan:', !!plan.sage_plan?.sampleMealPlan);

  if (plan.meal_plan) {
    console.log('\nmeal_plan keys:', Object.keys(plan.meal_plan));
    console.log('\nmeal_plan sample:', JSON.stringify(plan.meal_plan, null, 2).substring(0, 500));
  }

  if (plan.sage_plan?.sampleMealPlan) {
    console.log('\nsage_plan.sampleMealPlan keys:', Object.keys(plan.sage_plan.sampleMealPlan));
  }
}

checkMealPlan()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
