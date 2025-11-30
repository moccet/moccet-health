/**
 * Check lunch meals in the Sage plan
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const planCode = '5U2JQA6N';

async function checkLunches() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: plans } = await supabase
    .from('sage_onboarding_data')
    .select('sage_plan, email')
    .not('sage_plan', 'is', null);

  const plan = plans.find(p => p.email === 'sofian@moccet.com');

  console.log('Checking lunches for all 7 days:\n');

  for (let i = 1; i <= 7; i++) {
    const day = plan.sage_plan.sampleMealPlan[`day${i}`];
    if (day && day.meals) {
      console.log(`=== DAY ${i} ===`);
      day.meals.forEach((meal, idx) => {
        console.log(`\nMeal ${idx + 1}:`);
        console.log(`Time: ${meal.time}`);
        console.log(`Name: ${meal.name}`);
        console.log(`Description: ${meal.description}`);
        console.log(`Macros: ${meal.macros}`);
      });
      console.log('\n');
    }
  }
}

checkLunches()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
