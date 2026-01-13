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
  const { data } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('user_email', 'sofian@moccet.com')
    .order('analyzed_at', { ascending: false });

  console.log('Searching for health content in sofian deep analysis...\n');

  data?.forEach(d => {
    const content = JSON.stringify(d).toLowerCase();
    const healthTerms = ['flu', 'sick', 'ill', 'fever', 'tired', 'exhausted', 'unwell', 'cold'];

    healthTerms.forEach(term => {
      if (content.includes(term)) {
        console.log(`Found "${term}" in ${d.source}:`);

        // Search in stress indicators
        if (d.stress_indicators) {
          const si = JSON.stringify(d.stress_indicators);
          if (si.toLowerCase().includes(term)) {
            console.log('  In stress_indicators:', d.stress_indicators.supportiveInsight?.substring(0, 150));
          }
        }

        // Search in pending tasks
        d.pending_tasks?.forEach((t: any) => {
          if (t.description?.toLowerCase().includes(term)) {
            console.log('  In task:', t.description);
          }
        });

        // Search in urgent messages
        d.urgent_messages?.forEach((m: any) => {
          if (m.reasoning?.toLowerCase().includes(term) || m.summary?.toLowerCase().includes(term)) {
            console.log('  In urgent:', m.reasoning || m.summary);
          }
        });
      }
    });
  });
}

check().catch(console.error);
