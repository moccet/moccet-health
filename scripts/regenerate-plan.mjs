import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function regeneratePlan() {
  // Get the most recent onboarding entry
  const { data: userData, error } = await supabase
    .from('forge_onboarding_data')
    .select('email, form_data')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !userData) {
    console.error('❌ Error fetching user data:', error);
    return;
  }

  const uniqueCode = userData.form_data?.uniqueCode;
  if (!uniqueCode) {
    console.error('❌ No unique code found in form data');
    return;
  }

  console.log('\n✅ Found user data:');
  console.log('   Email:', userData.email);
  console.log('   Code:', uniqueCode);
  console.log('   Name:', userData.form_data?.fullName || 'Unknown');

  // Reset plan generation status to allow regeneration
  console.log('\n🔄 Resetting plan generation status...');
  await supabase
    .from('forge_onboarding_data')
    .update({
      plan_generation_status: 'pending',
      forge_plan: null,
      updated_at: new Date().toISOString()
    })
    .eq('email', userData.email);

  console.log('✅ Status reset to pending');

  // Trigger plan generation via webhook
  console.log('\n🚀 Triggering plan generation...');

  const webhookPayload = {
    email: userData.email,
    uniqueCode: uniqueCode,
    fullName: userData.form_data?.fullName || 'User'
  };

  try {
    const response = await fetch('http://localhost:3001/api/webhooks/qstash/forge-generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Mode': 'true' // Skip QStash signature verification in dev
      },
      body: JSON.stringify(webhookPayload)
    });

    if (response.ok) {
      console.log('✅ Plan generation triggered successfully!');
      console.log('\n⏳ This will take 5-10 minutes. Watch the server logs for progress.');
      console.log('   Look for: [TRAINING-AGENT], [NUTRITION-AGENT], [RECOVERY-AGENT], [ADAPTATION-AGENT]');
      console.log('\n📊 When complete, refresh your browser at:');
      console.log(`   http://localhost:3001/forge/personalised-plan?code=${uniqueCode}`);
    } else {
      const errorText = await response.text();
      console.error('❌ Failed to trigger generation:', response.status, errorText);
    }
  } catch (err) {
    console.error('❌ Error calling webhook:', err);
  }
}

regeneratePlan();
