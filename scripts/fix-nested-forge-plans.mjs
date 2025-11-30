/**
 * Fix double-nested data in existing Forge plans
 * Run with: node scripts/fix-nested-forge-plans.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

async function fixNestedData() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔍 Fetching all Forge plans...');

  const { data: plans, error } = await supabase
    .from('forge_onboarding_data')
    .select('id, email, form_data, forge_plan')
    .not('forge_plan', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  console.log(`Found ${plans.length} plans to check`);

  let fixedCount = 0;

  for (const plan of plans) {
    const uniqueCode = plan.form_data?.uniqueCode;
    console.log(`\n📋 Checking plan: ${plan.email} (code: ${uniqueCode})`);

    let needsUpdate = false;
    const forgePlan = plan.forge_plan;

    // Fix double-nested weeklyProgram
    if (forgePlan.weeklyProgram?.weeklyProgram) {
      console.log('  ✏️  Unwrapping weeklyProgram');
      forgePlan.weeklyProgram = forgePlan.weeklyProgram.weeklyProgram;
      needsUpdate = true;
    }

    // Fix double-nested nutritionGuidance
    if (forgePlan.nutritionGuidance?.nutritionGuidance) {
      console.log('  ✏️  Unwrapping nutritionGuidance');
      forgePlan.nutritionGuidance = forgePlan.nutritionGuidance.nutritionGuidance;
      needsUpdate = true;
    }

    // Fix double-nested adaptiveFeatures
    if (forgePlan.adaptiveFeatures?.adaptiveFeatures) {
      console.log('  ✏️  Unwrapping adaptiveFeatures');
      forgePlan.adaptiveFeatures = forgePlan.adaptiveFeatures.adaptiveFeatures;
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log('  💾 Updating plan in database...');
      const { error: updateError } = await supabase
        .from('forge_onboarding_data')
        .update({
          forge_plan: forgePlan,
          updated_at: new Date().toISOString()
        })
        .eq('id', plan.id);

      if (updateError) {
        console.error(`  ❌ Error updating plan ${uniqueCode}:`, updateError.message);
      } else {
        console.log('  ✅ Plan updated successfully');
        fixedCount++;
      }
    } else {
      console.log('  ℹ️  No fixes needed');
    }
  }

  console.log(`\n✨ Complete! Fixed ${fixedCount} out of ${plans.length} plans`);
}

fixNestedData()
  .then(() => {
    console.log('\n🎉 All plans fixed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
