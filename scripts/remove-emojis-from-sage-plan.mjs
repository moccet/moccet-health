/**
 * Remove emojis and colored text from existing Sage nutrition plan
 * Run with: node scripts/remove-emojis-from-sage-plan.mjs 5U2JQA6N
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const planCode = process.argv[2];

if (!planCode) {
  console.error('❌ Please provide a plan code as argument');
  console.error('Usage: node scripts/remove-emojis-from-sage-plan.mjs 5U2JQA6N');
  process.exit(1);
}

// Function to remove emojis and clean text formatting
function cleanText(text) {
  if (typeof text !== 'string') return text;

  // Remove common emojis
  let cleaned = text
    .replace(/⚠️/g, '')
    .replace(/🔥/g, '')
    .replace(/💡/g, '')
    .replace(/🧊/g, '')
    .replace(/⏱️/g, '')
    .replace(/✨/g, '')
    .replace(/📊/g, '')
    .replace(/🎯/g, '')
    .replace(/💪/g, '')
    .replace(/🌟/g, '')
    .replace(/⬆️/g, '')
    .replace(/⬇️/g, '')
    .replace(/➡️/g, '')
    .replace(/✅/g, '')
    .replace(/❌/g, '')
    .replace(/🏃/g, '')
    .replace(/🥗/g, '')
    .replace(/🍽️/g, '');

  // Remove priority labels and colored text patterns
  cleaned = cleaned
    .replace(/⚠️\s*/g, '')
    .replace(/🔥\s*/g, '')
    .replace(/💡\s*/g, '')
    .replace(/🧊\s*/g, '')
    .replace(/- HIGH Priority/gi, '')
    .replace(/- CRITICAL/gi, '')
    .replace(/- URGENT/gi, '')
    .replace(/HIGH for /gi, '')
    .replace(/CRITICAL for /gi, '')
    .replace(/Storage:/g, 'Storage advice:')
    .replace(/Tip:/g, 'Tip -');

  // Clean up any double spaces or leading/trailing spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// Recursive function to clean object
function cleanObject(obj) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return cleanText(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => cleanObject(item));
  }

  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = cleanObject(value);
    }
    return cleaned;
  }

  return obj;
}

async function cleanPlan() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`🔍 Fetching Sage plan with code: ${planCode}...`);

  // Find plan in sage_onboarding_data table
  const { data: plans, error } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .not('sage_plan', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  console.log(`Found ${plans.length} Sage plans in database`);

  // Find the plan with matching code
  const plan = plans.find(p => p.form_data?.uniqueCode === planCode);

  if (!plan) {
    const availableCodes = plans.map(p => p.form_data?.uniqueCode).filter(Boolean).join(', ');
    throw new Error(`Sage plan with code ${planCode} not found. Available codes: ${availableCodes}`);
  }

  console.log(`📋 Found Sage plan for: ${plan.email}`);
  console.log(`🧹 Cleaning emojis and colored text...`);

  // Clean all plan-related objects
  const cleanedPlan = cleanObject(plan.sage_plan);
  const cleanedMicronutrients = plan.micronutrients ? cleanObject(plan.micronutrients) : null;
  const cleanedMealPlan = plan.meal_plan ? cleanObject(plan.meal_plan) : null;
  const cleanedLifestyle = plan.lifestyle_integration ? cleanObject(plan.lifestyle_integration) : null;

  console.log(`💾 Updating Sage plan in database...`);
  const updateData = {
    sage_plan: cleanedPlan,
    updated_at: new Date().toISOString()
  };

  if (cleanedMicronutrients) {
    updateData.micronutrients = cleanedMicronutrients;
    console.log('  - Cleaning micronutrients');
  }

  if (cleanedMealPlan) {
    updateData.meal_plan = cleanedMealPlan;
    console.log('  - Cleaning meal plan');
  }

  if (cleanedLifestyle) {
    updateData.lifestyle_integration = cleanedLifestyle;
    console.log('  - Cleaning lifestyle integration');
  }

  const { error: updateError } = await supabase
    .from('sage_onboarding_data')
    .update(updateData)
    .eq('id', plan.id);

  if (updateError) {
    throw new Error(`Failed to update plan: ${updateError.message}`);
  }

  console.log('✅ Sage plan cleaned successfully!');
  console.log(`\nPlan URL: https://moccet.com/sage/personalised-plan?code=${planCode}`);
}

cleanPlan()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
