/**
 * Script to trigger plan generation for Omar (BE45YKNT) with ecosystem insights
 * Run with: node scripts/generate-omar-plan.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const supabase = createClient(supabaseUrl, supabaseKey);

const PLAN_CODE = 'BE45YKNT';

async function generateOmarPlan() {
  console.log(`\nFetching Omar's data (code: ${PLAN_CODE})...`);

  const { data: userData, error } = await supabase
    .from('forge_onboarding_data')
    .select('email, form_data')
    .eq('form_data->>uniqueCode', PLAN_CODE)
    .single();

  if (error || !userData) {
    console.error('Error fetching user data:', error);
    process.exit(1);
  }

  console.log('Found user:', userData.email);
  console.log('Name:', userData.form_data?.fullName || 'Omar');

  // Reset plan generation status
  console.log('\nResetting plan generation status...');
  await supabase
    .from('forge_onboarding_data')
    .update({
      plan_generation_status: 'pending',
      forge_plan: null,
      updated_at: new Date().toISOString()
    })
    .eq('form_data->>uniqueCode', PLAN_CODE);

  console.log('Status reset to pending');

  // Trigger plan generation
  console.log('\nTriggering plan generation...');

  const webhookPayload = {
    email: userData.email,
    uniqueCode: PLAN_CODE,
    fullName: userData.form_data?.fullName || 'Omar'
  };

  try {
    const response = await fetch('https://moccet.ai/api/webhooks/qstash/forge-generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Mode': 'true'
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log('\n✅ Plan generation triggered!');
      console.log('\nThis will take 5-10 minutes.');
      console.log('Once complete, run: node scripts/update-omar-plan.mjs');
      console.log(`\nThen view at: https://moccet.ai/forge/personalised-plan?code=${PLAN_CODE}`);
    } else {
      const errorText = await response.text();
      console.error('Failed to trigger:', response.status, errorText);
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.log('\nTrying localhost instead...');

    try {
      const localResponse = await fetch('http://localhost:3000/api/webhooks/qstash/forge-generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dev-Mode': 'true'
        },
        body: JSON.stringify(webhookPayload)
      });

      if (localResponse.ok) {
        console.log('\n✅ Plan generation triggered on localhost!');
        console.log('\nWatch your terminal for progress.');
        console.log('Once complete, run: node scripts/update-omar-plan.mjs');
      } else {
        console.error('Localhost also failed:', await localResponse.text());
      }
    } catch (localErr) {
      console.error('Localhost error:', localErr.message);
    }
  }
}

generateOmarPlan().catch(console.error);
