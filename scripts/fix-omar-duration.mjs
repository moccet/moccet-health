/**
 * Script to fix missing duration in Omar's plan
 * Run with: node scripts/fix-omar-duration.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const supabase = createClient(supabaseUrl, supabaseKey);

const PLAN_CODE = 'BE45YKNT';

async function fixDuration() {
  console.log(`\nFetching Omar's plan (code: ${PLAN_CODE})...`);

  const { data, error } = await supabase
    .from('forge_onboarding_data')
    .select('forge_plan')
    .eq('form_data->>uniqueCode', PLAN_CODE)
    .single();

  if (error || !data?.forge_plan) {
    console.error('Error:', error || 'No plan found');
    process.exit(1);
  }

  const plan = data.forge_plan;
  console.log('Plan found, fixing durations...');

  // Add duration to each training day
  const weeklyProgram = plan.weeklyProgram;

  // Training days get 45-60 minutes
  if (weeklyProgram.monday) {
    weeklyProgram.monday.duration = '45-60 minutes';
    weeklyProgram.monday.focus = 'Lower Body Strength';
  }
  if (weeklyProgram.wednesday) {
    weeklyProgram.wednesday.duration = '45-60 minutes';
    weeklyProgram.wednesday.focus = 'Upper Body Push';
  }
  if (weeklyProgram.thursday) {
    weeklyProgram.thursday.duration = '30-45 minutes';
    weeklyProgram.thursday.focus = 'Active Recovery';
  }
  if (weeklyProgram.friday) {
    weeklyProgram.friday.duration = '45-60 minutes';
    weeklyProgram.friday.focus = 'Lower Body Power';
  }
  if (weeklyProgram.saturday) {
    weeklyProgram.saturday.duration = '45-60 minutes';
    weeklyProgram.saturday.focus = 'Upper Body Pull';
  }

  // Update the plan
  const updatedPlan = {
    ...plan,
    weeklyProgram
  };

  const { error: updateError } = await supabase
    .from('forge_onboarding_data')
    .update({ forge_plan: updatedPlan })
    .eq('form_data->>uniqueCode', PLAN_CODE);

  if (updateError) {
    console.error('Error updating:', updateError);
    process.exit(1);
  }

  console.log('\n✅ Durations fixed!');
  console.log('- Monday: 45-60 minutes (Lower Body Strength)');
  console.log('- Wednesday: 45-60 minutes (Upper Body Push)');
  console.log('- Thursday: 30-45 minutes (Active Recovery)');
  console.log('- Friday: 45-60 minutes (Lower Body Power)');
  console.log('- Saturday: 45-60 minutes (Upper Body Pull)');
  console.log('\nRefresh the page to see changes.');
}

fixDuration().catch(console.error);
