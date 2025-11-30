/**
 * Verify that the Sage plan was cleaned properly
 * Run with: node scripts/verify-plan-cleaned.mjs 5U2JQA6N
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://imcchkdytaijgcceqszx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltY2Noa2R5dGFpamdjY2Vxc3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDk2MjUsImV4cCI6MjA3NDAyNTYyNX0.LTCjIlLDv733SJ72q2t3VZEytl_X431CN6LDt8GOyGM';

const planCode = process.argv[2];

if (!planCode) {
  console.error('Usage: node scripts/verify-plan-cleaned.mjs 5U2JQA6N');
  process.exit(1);
}

function checkForEmojis(text) {
  if (typeof text !== 'string') return [];
  const emojis = [];
  const emojiPatterns = [
    { emoji: '⚠️', name: 'warning' },
    { emoji: '🔥', name: 'fire' },
    { emoji: '💡', name: 'bulb' },
    { emoji: '🧊', name: 'ice' },
    { emoji: '⏱️', name: 'timer' }
  ];

  for (const pattern of emojiPatterns) {
    if (text.includes(pattern.emoji)) {
      emojis.push(pattern.name);
    }
  }

  return emojis;
}

function scanObject(obj, path = '') {
  const issues = [];

  if (obj === null || obj === undefined) return issues;

  if (typeof obj === 'string') {
    const emojis = checkForEmojis(obj);
    if (emojis.length > 0) {
      issues.push({ path, emojis, sample: obj.substring(0, 100) });
    }
    if (obj.includes('HIGH Priority') || obj.includes('CRITICAL')) {
      issues.push({ path, type: 'priority-label', sample: obj.substring(0, 100) });
    }
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      issues.push(...scanObject(item, `${path}[${idx}]`));
    });
  } else if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      issues.push(...scanObject(value, path ? `${path}.${key}` : key));
    }
  }

  return issues;
}

async function verifyPlan() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`🔍 Fetching Sage plan with code: ${planCode}...`);

  const { data: plans, error } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .not('sage_plan', 'is', null);

  if (error) {
    throw new Error(`Failed to fetch plans: ${error.message}`);
  }

  const plan = plans.find(p => p.form_data?.uniqueCode === planCode);

  if (!plan) {
    throw new Error(`Plan with code ${planCode} not found`);
  }

  console.log(`📋 Found plan for: ${plan.email}`);
  console.log(`🔎 Scanning for emojis and formatting issues...`);

  const issues = scanObject(plan.sage_plan);

  if (issues.length === 0) {
    console.log('✅ Plan is clean! No emojis or priority labels found.');
  } else {
    console.log(`❌ Found ${issues.length} issues:`);
    issues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. Path: ${issue.path}`);
      if (issue.emojis) {
        console.log(`   Emojis: ${issue.emojis.join(', ')}`);
      }
      if (issue.type) {
        console.log(`   Type: ${issue.type}`);
      }
      console.log(`   Sample: ${issue.sample}...`);
    });
  }

  console.log(`\nLast updated: ${plan.updated_at}`);
}

verifyPlan()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
