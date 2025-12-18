/**
 * Script to update Omar's plan (BE45YKNT) with ecosystem insights
 * Run with: node scripts/update-omar-plan.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const supabase = createClient(supabaseUrl, supabaseKey);

const PLAN_CODE = 'BE45YKNT';

// Omar's ecosystem insights
const ecosystemInsights = {
  slack: {
    workPattern: 'Works ALL hours of the day including weekends and late nights',
    afterHoursActivity: 'VERY HIGH - constant availability, messages sent at irregular hours',
    workLifeBalance: 'POOR - no clear boundaries between work and personal time',
    stressIndicator: 'HIGH - always-on work culture detected'
  },
  oura: {
    sleepQuality: 'VERY POOR - inconsistent sleep patterns detected',
    sleepConsistency: 'LOW - highly variable bedtimes and wake times',
    recoveryStatus: 'COMPROMISED - poor sleep affecting recovery capacity',
    hrvTrend: 'Likely suppressed due to chronic sleep debt'
  },
  gmail: {
    peakEmailActivity: '2:00 PM - 4:00 PM (afternoon spike)',
    workStressPattern: 'High email volume during afternoon hours',
    optimalMealWindows: 'Before 12:00 PM or after 4:00 PM (avoiding email peaks)',
    meetingDensity: 'Concentrated afternoon workload'
  }
};

async function findPlan() {
  console.log(`\nSearching for plan with code: ${PLAN_CODE}...`);

  // Try forge_fitness_plans table first
  const { data: fitnessData } = await supabase
    .from('forge_fitness_plans')
    .select('*')
    .eq('unique_code', PLAN_CODE)
    .single();

  if (fitnessData?.fitness_plan) {
    return { table: 'forge_fitness_plans', column: 'fitness_plan', data: fitnessData, matchCol: 'unique_code' };
  }

  // Try forge_onboarding_data with forge_plan
  const { data: onboardingData } = await supabase
    .from('forge_onboarding_data')
    .select('*')
    .eq('form_data->>uniqueCode', PLAN_CODE)
    .single();

  if (onboardingData?.forge_plan) {
    return { table: 'forge_onboarding_data', column: 'forge_plan', data: onboardingData, matchCol: 'form_data->>uniqueCode' };
  }

  // Return onboarding data even if no plan (to show status)
  if (onboardingData) {
    return { table: 'forge_onboarding_data', column: 'forge_plan', data: onboardingData, matchCol: 'form_data->>uniqueCode', noPlan: true };
  }

  return null;
}

function buildUpdatedPlan(existingPlan) {
  const ecosystemSummary = `Based on your connected ecosystem data, we've identified critical patterns that shape this program. Your Oura Ring reveals very poor and inconsistent sleep quality, which directly impacts recovery capacity and training adaptation. Your Slack activity shows you're working all hours of the day, including weekends and late nights, indicating high stress levels and poor work-life boundaries. Gmail analysis detected email spikes between 2-4 PM, helping us identify optimal windows for training and meals.

Given these insights, your program prioritizes morning or early evening training sessions to work around your afternoon email demands and to avoid late-night activity that further disrupts sleep. Recovery protocols are designed to aggressively address your sleep debt, with specific strategies to improve sleep consistency. Stress management is woven throughout, recognizing the always-on work pattern that's affecting your physiological recovery.`;

  const updatedGreeting = `Welcome, Omar! Your journey toward enhanced longevity begins here, designed specifically around your advanced experience and your dedication to sustainable health. With insights from your Oura Ring, Slack, and Gmail integrations, we've built a program that addresses your unique challenges - particularly your inconsistent sleep patterns and demanding work schedule. This isn't just a fitness plan; it's a recovery-focused system designed to optimize your health within your lifestyle constraints.`;

  const updatedRecoveryIntro = `Your Oura Ring data reveals a critical concern: very poor and inconsistent sleep quality that's compromising your recovery capacity. Combined with Slack data showing late-night work activity, your body is in a chronic state of under-recovery. This protocol prioritizes sleep consistency above all else - it's the foundation everything else is built on.`;

  const nutritionIntro = `Your Gmail data shows peak email activity between 2-4 PM, making this a poor window for meals. Your Slack patterns indicate irregular eating opportunities due to constant availability. Combined with compromised sleep from your Oura data, nutrition timing becomes critical for energy management and recovery support. We'll structure meals around your actual work patterns, not theoretical ideals.`;

  const mealTiming = `Based on your Gmail email spike at 2-4 PM, avoid eating during this high-stress window. Front-load nutrition with a substantial breakfast before 9 AM and lunch before 12 PM. If afternoon eating is necessary, opt for a light protein snack around 4:30 PM after your email peak subsides. Dinner should be early (6-7 PM) to support better sleep, given your Oura data showing poor sleep quality. Avoid eating within 3 hours of your intended bedtime to prevent sleep disruption.`;

  return {
    ...existingPlan,
    personalizedGreeting: updatedGreeting,
    executiveSummary: ecosystemSummary,
    ecosystemInsights: ecosystemInsights,
    recoveryProtocol: {
      ...existingPlan.recoveryProtocol,
      personalizedIntro: updatedRecoveryIntro,
    },
    nutritionGuidance: {
      ...existingPlan.nutritionGuidance,
      personalizedIntro: nutritionIntro,
      mealTiming: mealTiming,
    },
  };
}

async function updateOmarPlan() {
  const result = await findPlan();

  if (!result) {
    console.error('No record found with code:', PLAN_CODE);
    process.exit(1);
  }

  console.log(`Found record in: ${result.table}`);
  console.log(`Email: ${result.data.email}`);

  if (result.noPlan) {
    console.log('\nPlan not generated yet.');
    console.log('Status:', result.data.plan_generation_status || 'unknown');
    console.log('\nAvailable columns with data:', Object.keys(result.data).filter(k => result.data[k] !== null));
    process.exit(0);
  }

  const plan = result.data[result.column];
  console.log(`Plan found! Keys:`, Object.keys(plan).slice(0, 10).join(', '), '...');

  const updatedPlan = buildUpdatedPlan(plan);

  console.log('\nUpdating plan with ecosystem insights...');

  const updateObj = { [result.column]: updatedPlan };
  const { error: updateError } = await supabase
    .from(result.table)
    .update(updateObj)
    .eq(result.matchCol, PLAN_CODE);

  if (updateError) {
    console.error('Error updating:', updateError);
    process.exit(1);
  }

  console.log('\n✅ Plan updated successfully!');
  console.log('\nEcosystem insights added:');
  console.log('- Slack: Late night/weekend work patterns, poor work-life balance');
  console.log('- Oura: Very poor sleep quality, inconsistent patterns');
  console.log('- Gmail: 2-4 PM email spikes, afternoon workload');
  console.log('\nRefresh the plan page to see the changes:');
  console.log(`https://moccet.ai/forge/personalised-plan?code=${PLAN_CODE}`);
}

updateOmarPlan().catch(console.error);
