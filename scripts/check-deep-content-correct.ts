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
  console.log('═'.repeat(70));
  console.log('DEEP CONTENT ANALYSIS CHECK (correct column: user_email)');
  console.log('═'.repeat(70));

  // Check table structure first
  const { data: sample } = await supabase
    .from('deep_content_analysis')
    .select('*')
    .limit(1);

  if (sample?.length) {
    console.log('\nTable columns:', Object.keys(sample[0]).join(', '));
  }

  // Check for both users with correct column
  for (const email of ['hvdvpjyp2z@privaterelay.appleid.com', 'sofian@moccet.com']) {
    console.log(`\n─────────────────────────────────────`);
    console.log(`USER: ${email}`);
    console.log(`─────────────────────────────────────`);

    const { data, error } = await supabase
      .from('deep_content_analysis')
      .select('*')
      .eq('user_email', email)
      .order('analyzed_at', { ascending: false });

    if (error) {
      console.log(`Error: ${error.message}`);
      continue;
    }

    if (!data?.length) {
      console.log('No deep content analysis found');
      continue;
    }

    console.log(`Found ${data.length} records:`);
    data.forEach(d => {
      console.log(`\n  Source: ${d.source}`);
      console.log(`  Analyzed: ${d.analyzed_at}`);
      console.log(`  Pending tasks: ${d.pending_tasks?.length || 0}`);
      console.log(`  Response debt: ${d.response_debt?.count || 0}`);
      console.log(`  Key people: ${d.key_people?.length || 0}`);
      console.log(`  Urgent messages: ${d.urgent_messages?.length || 0}`);

      if (d.pending_tasks?.length) {
        console.log('  Sample tasks:');
        d.pending_tasks.slice(0, 2).forEach((t: any) => {
          console.log(`    - [${t.urgency}] ${t.description?.substring(0, 60)}...`);
        });
      }
    });
  }

  // Also check extracted_tasks table
  console.log('\n\n═'.repeat(70));
  console.log('EXTRACTED TASKS TABLE');
  console.log('═'.repeat(70));

  for (const email of ['hvdvpjyp2z@privaterelay.appleid.com', 'sofian@moccet.com']) {
    const { data: tasks } = await supabase
      .from('extracted_tasks')
      .select('*')
      .eq('user_email', email)
      .order('extracted_at', { ascending: false })
      .limit(5);

    console.log(`\n${email}: ${tasks?.length || 0} tasks`);
    if (tasks?.length) {
      tasks.slice(0, 3).forEach(t => {
        console.log(`  - [${t.status}] ${t.description?.substring(0, 50)}...`);
      });
    }
  }

  console.log('\n' + '═'.repeat(70));
}

check().catch(console.error);
