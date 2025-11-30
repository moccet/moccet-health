/**
 * Check the full data structure for the Sage plan
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const planCode = '5U2JQA6N';

async function checkStructure() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: plans } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .not('sage_plan', 'is', null);

  const plan = plans.find(p => p.form_data?.uniqueCode === planCode);

  console.log('=== WHAT API RETURNS ===');
  console.log('plan (sage_plan) keys:', plan.sage_plan ? Object.keys(plan.sage_plan) : 'null');
  console.log('meal_plan:', plan.meal_plan ? Object.keys(plan.meal_plan) : 'null');
  console.log('micronutrients:', plan.micronutrients ? Object.keys(plan.micronutrients) : 'null');
  console.log('lifestyle_integration:', plan.lifestyle_integration ? Object.keys(plan.lifestyle_integration) : 'null');

  console.log('\n=== MEAL PLAN STRUCTURE ===');
  if (plan.sage_plan?.sampleMealPlan) {
    console.log('sage_plan.sampleMealPlan keys:', Object.keys(plan.sage_plan.sampleMealPlan));
    console.log('day1 structure:', plan.sage_plan.sampleMealPlan.day1 ? Object.keys(plan.sage_plan.sampleMealPlan.day1) : 'null');
    if (plan.sage_plan.sampleMealPlan.day1?.meals) {
      console.log('day1.meals count:', plan.sage_plan.sampleMealPlan.day1.meals.length);
      console.log('day1.meals[0]:', JSON.stringify(plan.sage_plan.sampleMealPlan.day1.meals[0], null, 2));
    }
  }

  console.log('\n=== WHAT FRONTEND EXPECTS ===');
  console.log('Frontend looks for:');
  console.log('- planData.plan (which is sage_plan)');
  console.log('- planData.mealPlan (which is meal_plan column)');
  console.log('- planData.micronutrients (which is micronutrients column)');
  console.log('- planData.lifestyleIntegration (which is lifestyle_integration column)');

  console.log('\n=== FRONTEND RENDERING ===');
  console.log('For meal plan, it checks:');
  console.log('- detailedMealPlan (from planData.mealPlan) OR');
  console.log('- plan.sampleMealPlan (from planData.plan.sampleMealPlan)');

  console.log('\n=== ISSUE ===');
  console.log('detailedMealPlan will be:', plan.meal_plan ? 'meal_plan object (no days!)' : 'null');
  console.log('plan.sampleMealPlan will be:', plan.sage_plan?.sampleMealPlan ? 'HAS DAYS!' : 'null');
}

checkStructure()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
