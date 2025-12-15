const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { resolve } = require('path');

// Load env
const envPath = resolve(__dirname, '../.env.local');
const envFile = readFileSync(envPath, 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkToken() {
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('provider, is_active, expires_at, created_at, updated_at, refresh_token')
    .eq('user_email', 'sofian@moccet.com')
    .eq('provider', 'whoop');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('\n🔍 Whoop Token Status for sofian@moccet.com:\n');

  if (!data || data.length === 0) {
    console.log('❌ No Whoop token found - needs re-authentication');
    console.log('\n👉 Re-authenticate at: https://moccet.ai/api/whoop/auth?email=sofian@moccet.com');
    return;
  }

  data.forEach(token => {
    const isExpired = token.expires_at && new Date(token.expires_at) < new Date();
    const hasRefresh = !!token.refresh_token;
    console.log(`Provider: ${token.provider}`);
    console.log(`Active: ${token.is_active ? '✅ Yes' : '❌ No'}`);
    console.log(`Expires: ${token.expires_at || 'N/A'}`);
    console.log(`Expired: ${isExpired ? '⚠️ YES' : '✅ No'}`);
    console.log(`Has Refresh Token: ${hasRefresh ? '✅ Yes' : '❌ No'}`);
    console.log(`Created: ${token.created_at}`);
    console.log(`Updated: ${token.updated_at}`);

    if (isExpired && !hasRefresh) {
      console.log('\n❌ Token expired and no refresh token available.');
      console.log('👉 Re-authenticate at: https://moccet.ai/api/whoop/auth?email=sofian@moccet.com');
    } else if (isExpired && hasRefresh) {
      console.log('\n⚠️ Token expired but has refresh token - should auto-refresh on next request.');
    }
  });
}

checkToken().then(() => process.exit(0));
