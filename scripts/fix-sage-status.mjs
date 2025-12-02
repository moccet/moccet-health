import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStatus() {
  const { data, error } = await supabase
    .from('sage_onboarding_data')
    .update({ plan_generation_status: 'completed' })
    .eq('email', 'lysasand.535434@gmail.com');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Status updated to completed!');
    console.log('Now refresh the page: http://localhost:3001/sage/personalised-plan?code=G56QE3X7');
  }
}

fixStatus();
