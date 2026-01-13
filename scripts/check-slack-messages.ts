import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env.local');
const envFile = readFileSync(envPath, 'utf-8');
const envVars: Record<string, string> = {};

envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Check deep content timestamps
  const { data: deep } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('user_email', 'sofian@moccet.com')
    .eq('source', 'slack')
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single();

  console.log('Slack Deep Content Analysis:');
  console.log('Analyzed at:', deep?.analyzed_at);
  console.log('Message count:', deep?.message_count);

  // Check message IDs to see dates
  if (deep?.urgent_messages) {
    console.log('\nUrgent message timestamps:');
    deep.urgent_messages.forEach((m: any) => {
      // Message ID format: slack_X_TIMESTAMP
      const ts = m.messageId?.split('_')[2];
      console.log(' -', ts, '|', m.reasoning?.substring(0, 50));
    });
  }

  if (deep?.pending_tasks) {
    console.log('\nTask timestamps:');
    deep.pending_tasks.forEach((t: any) => {
      console.log(' -', t.extractedAt, '|', t.description?.substring(0, 50));
    });
  }

  // Check behavioral patterns date range
  const { data: patterns } = await supabase
    .from('behavioral_patterns')
    .select('data_period_start, data_period_end, sync_date')
    .eq('email', 'sofian@moccet.com')
    .eq('source', 'slack')
    .order('sync_date', { ascending: false })
    .limit(1)
    .single();

  console.log('\nBehavioral patterns date range:');
  console.log('Start:', patterns?.data_period_start);
  console.log('End:', patterns?.data_period_end);
  console.log('Synced:', patterns?.sync_date);

  // When was the flu message likely sent?
  console.log('\nTodays date: 2026-01-12');
  console.log('If flu message was sent today, it should be in range.');
}

check().catch(console.error);
