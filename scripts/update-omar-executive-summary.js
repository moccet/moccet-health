/**
 * Update Omar's executive summary with ecosystem insights
 * Run with: node scripts/update-omar-executive-summary.js
 */

const { createClient } = require('@supabase/supabase-js');

// Hardcoded for this one-time script
const SUPABASE_URL = 'https://imcchkdytaijgcceqszx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const USER_EMAIL = 'omarelalfy@hsph.harvard.edu';

const NEW_EXECUTIVE_SUMMARY = `Your plan is tailored to a three meals per day structure with a first meal after late morning, emphasizing steady glucose, brain supportive fats, and high quality proteins from eggs, dairy, fish, chicken, red meat, and plant based sources. Your Oura data reveals compromised sleep quality, while your Slack and email patterns show extended work hours bleeding into weekends with communication peaks between 2 and 4 pm—a window where cognitive demand is highest but energy often dips. This plan directly addresses that by strategically timing nutrients to sustain afternoon focus and support deeper recovery at night.

Because your main priority is cognitive performance with a broader longevity goal, the structure balances consistent energy through blood sugar stability, omega 3 intake for neuroprotection, and targeted micronutrients that support neurotransmitter synthesis, mitochondrial function, and sleep architecture repair. No pork and no alcohol are included, and recipes match your realistic cooking capacity of around five home cooked meals per week with additional quick builds and batch friendly options for demanding days.

Expect a stable 6 to 9 hour eating window beginning after 11 am, with protein forward meals and smart carbohydrate timing—particularly a moderate complex carb serving at dinner to support serotonin and melatonin production for better sleep. The plan uses caffeine strategically before noon with optional L theanine pairing for smoother focus, prioritizes omega 3 rich seafood two to three times weekly for sustained cognitive edge, and includes magnesium and glycine rich foods in the evening to help your nervous system downshift after long work stretches.`;

async function updateOmarExecutiveSummary() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('🔍 Fetching current plan data for:', USER_EMAIL);

  const { data: currentData, error: fetchError } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .eq('email', USER_EMAIL)
    .single();

  if (fetchError || !currentData) {
    throw new Error(`Failed to fetch plan: ${fetchError?.message || 'Not found'}`);
  }

  console.log('✅ Current plan fetched');
  console.log('📧 Email:', currentData.email);

  if (!currentData.sage_plan) {
    throw new Error('No sage_plan found for this user');
  }

  const updatedSagePlan = {
    ...currentData.sage_plan,
    executiveSummary: NEW_EXECUTIVE_SUMMARY
  };

  console.log('\n📝 Updating executive summary in Supabase...');

  const { error: updateError } = await supabase
    .from('sage_onboarding_data')
    .update({
      sage_plan: updatedSagePlan,
      updated_at: new Date().toISOString()
    })
    .eq('email', USER_EMAIL);

  if (updateError) {
    throw new Error(`Failed to update plan: ${updateError.message}`);
  }

  console.log('✅ Executive summary updated successfully!');
  console.log('\n📋 Changes made:');
  console.log('  ✓ Added Oura sleep quality insight (compromised sleep)');
  console.log('  ✓ Added Slack/email work pattern insights (long hours, weekends)');
  console.log('  ✓ Added 2-4pm communication peak and energy dip correlation');
  console.log('  ✓ Added strategic nutrient timing for afternoon focus');
  console.log('  ✓ Added sleep architecture repair focus');
  console.log('  ✓ Added evening carb timing for serotonin/melatonin');
  console.log('  ✓ Added magnesium and glycine focus for nervous system recovery');
}

updateOmarExecutiveSummary()
  .then(() => {
    console.log('\n✨ Update complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
