# Insight Data Source Diagnostic

## The Problem

Your insights are only reading Apple Health data because **Whoop and blood test data aren't being stored in the database yet**.

---

## How Data Should Flow

### 🩸 Blood Test Data Flow
```
User uploads blood test PDF
    ↓
Backend analyzes with GPT-4 Vision
    ↓
Extracts biomarkers (Vitamin D, B12, Iron, etc.)
    ↓
Stores in sage_onboarding_data.lab_file_analysis
    ↓
Insight system reads from there
    ↓
Generates supplement recommendations
```

**Current Status**: ❌ No blood data in database

**Expected Table**: `sage_onboarding_data`
**Expected Column**: `lab_file_analysis` (JSONB)

---

### 💪 Whoop Data Flow

Whoop data comes through **Vital API** (unified health platform):

```
User connects Whoop via Vital
    ↓
Whoop syncs recovery/strain data to Vital
    ↓
Vital sends webhook to your backend
    ↓
Backend processes webhook event
    ↓
Stores in forge_training_data (provider='whoop')
    ↓
Insight system reads from there
    ↓
Generates recovery/HRV insights
```

**Current Status**: ❌ No Whoop data in database

**Expected Tables**:
- `forge_training_data` - Raw Whoop metrics
- `forge_workout_patterns` - Analyzed patterns
- `vital_webhook_events` - Webhook history

---

## Why This Is Happening

### Issue 1: Blood Tests Not Uploaded
**Root Cause**: User hasn't uploaded blood test results yet

**Expected Data Structure**:
```json
{
  "biomarkers": [
    {
      "name": "Vitamin D, 25-Hydroxy",
      "value": 18.5,
      "unit": "ng/mL",
      "referenceRange": "30-100",
      "status": "low",
      "category": "vitamins"
    },
    {
      "name": "Vitamin B12",
      "value": 350,
      "unit": "pg/mL",
      "referenceRange": "200-900",
      "status": "normal",
      "category": "vitamins"
    }
  ],
  "concerns": [
    "Low Vitamin D (18.5 ng/mL, optimal: 30-100)",
    "Borderline low B12 (350 pg/mL)"
  ],
  "analyzedAt": "2025-12-15T10:30:00Z"
}
```

### Issue 2: Whoop Not Connected/Synced
**Root Cause**: One of these:
1. Whoop not connected to Vital
2. Vital webhook not configured
3. Whoop data synced but not stored in database
4. Using Whoop directly (not through Vital)

**Where Whoop Data Should Be**:
```sql
-- Table: forge_training_data
{
  "email": "user@example.com",
  "provider": "whoop",
  "recovery_score": {
    "avg": 75,
    "trend": "improving",
    "greenDays": 20,
    "yellowDays": 7,
    "redDays": 3
  },
  "hrv_trends": {
    "avg": 65,
    "trend": "stable",
    "baseline": 62
  },
  "resting_hr_trends": {
    "avg": 52,
    "trend": "decreasing"
  }
}
```

---

## How to Fix This

### Fix 1: Upload Blood Test Results

**Option A: Via Flutter App (If Implemented)**
1. Go to Settings → Health Data
2. Tap "Upload Blood Test"
3. Select PDF file of lab results
4. Backend analyzes and stores in database

**Option B: Manually Test Upload**
```bash
# Test blood test upload
curl -X POST https://moccet.ai/api/upload-blood-test \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/blood_test.pdf" \
  -F "email=your-email@example.com"
```

**Option C: Direct Database Insert (For Testing)**
If you want to test with sample data:
```sql
-- Insert sample blood test data
UPDATE sage_onboarding_data
SET lab_file_analysis = '{
  "biomarkers": [
    {
      "name": "Vitamin D, 25-Hydroxy",
      "value": 18.5,
      "unit": "ng/mL",
      "referenceRange": "30-100",
      "status": "low",
      "category": "vitamins"
    },
    {
      "name": "Vitamin B12",
      "value": 350,
      "unit": "pg/mL",
      "referenceRange": "200-900",
      "status": "normal",
      "category": "vitamins"
    },
    {
      "name": "Iron, Serum",
      "value": 45,
      "unit": "µg/dL",
      "referenceRange": "60-170",
      "status": "low",
      "category": "minerals"
    }
  ],
  "concerns": [
    "Low Vitamin D (18.5 ng/mL, optimal: 30-100)",
    "Low Iron (45 µg/dL, optimal: 60-170)"
  ],
  "analyzedAt": "2025-12-15T10:30:00Z"
}'::jsonb
WHERE email = 'your-email@example.com';
```

---

### Fix 2: Connect Whoop via Vital

**Step 1: Check if Vital is Configured**
```bash
# Check .env.local for Vital credentials
grep VITAL /Users/sofianyoussef/Desktop/moccet/moccet-new/.env.local
```

You should see:
```bash
VITAL_API_KEY=sk_us_...
VITAL_ENVIRONMENT=sandbox  # or production
VITAL_REGION=us
VITAL_WEBHOOK_SECRET=whsec_...
```

**Step 2: Connect Whoop in Flutter App**
1. Go to Settings → Connected Apps
2. Tap "Connect Whoop"
3. OAuth flow → Authorize Vital to access Whoop
4. Vital creates connection

**Step 3: Verify Webhook Setup**

Check if Vital webhook is configured:
1. Go to: https://app.tryvital.io/webhooks
2. Verify webhook URL: `https://moccet.ai/api/vital/webhook`
3. Verify signing secret matches your `.env.local`

**Step 4: Test Webhook Manually**

Simulate a Whoop data sync:
```bash
curl -X POST https://moccet.ai/api/vital/webhook \
  -H "Content-Type: application/json" \
  -H "x-vital-webhook-signature: <calculated-signature>" \
  -d '{
    "event_type": "daily.data.body.created",
    "client_user_id": "your-email@example.com",
    "provider": "whoop",
    "data": {
      "recovery_score": 75,
      "hrv": 65,
      "resting_hr": 52
    }
  }'
```

**Step 5: Verify Data Stored**
```sql
-- Check if Whoop data exists
SELECT * FROM forge_training_data
WHERE email = 'your-email@example.com'
AND provider = 'whoop';

-- Check webhook events
SELECT * FROM vital_webhook_events
WHERE user_id LIKE '%your-email%'
ORDER BY received_at DESC
LIMIT 10;
```

---

### Fix 3: Manual Data Insert (For Testing)

If you want to test insights without connecting Whoop:

```sql
-- Insert sample Whoop data
INSERT INTO forge_training_data (
  email,
  provider,
  recovery_score,
  hrv_trends,
  resting_hr_trends,
  data_period_start,
  data_period_end,
  sync_date
) VALUES (
  'your-email@example.com',
  'whoop',
  '{
    "avg": 75,
    "trend": "improving",
    "greenDays": 20,
    "yellowDays": 7,
    "redDays": 3
  }'::jsonb,
  '{
    "avg": 65,
    "trend": "stable",
    "baseline": 62
  }'::jsonb,
  '{
    "avg": 52,
    "trend": "decreasing"
  }'::jsonb,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE,
  NOW()
);

-- Insert sample workout patterns
INSERT INTO forge_workout_patterns (
  email,
  source,
  patterns,
  metrics,
  data_period_start,
  data_period_end,
  sync_date
) VALUES (
  'your-email@example.com',
  'whoop',
  '{
    "recovery": {
      "avg": 75,
      "greenDays": 20
    },
    "strain": {
      "avgDailyStrain": 12.5,
      "overreachingDays": 2
    },
    "hrvTrends": {
      "baseline": 62,
      "current": 65
    }
  }'::jsonb,
  '{
    "recoveryScore": 75,
    "overtrainingRisk": "low"
  }'::jsonb,
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE,
  NOW()
);
```

---

## Verify Insights Are Generated

After adding data, trigger insight generation:

**Option 1: API Call**
```bash
curl -X POST https://moccet.ai/api/user/insights \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com"
  }'
```

**Option 2: Check Database**
```sql
-- Check generated insights
SELECT
  insight_type,
  title,
  source_provider,
  severity,
  created_at
FROM real_time_insights
WHERE email = 'your-email@example.com'
ORDER BY created_at DESC
LIMIT 20;
```

You should now see insights from multiple sources:
- ✅ Apple Health → Activity, steps, sleep
- ✅ Whoop → Recovery, HRV, strain
- ✅ Blood Tests → Vitamin deficiencies, supplement recommendations

---

## Quick Diagnostic Script

Run this in your backend to check data availability:

```typescript
// File: scripts/check-data-sources.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDataSources(email: string) {
  console.log(`Checking data sources for ${email}...\n`);

  // Check Apple Health (via Health table)
  const { data: healthData } = await supabase
    .from('user_health_data')
    .select('*')
    .eq('email', email);
  console.log(`✅ Apple Health: ${healthData?.length || 0} records`);

  // Check Whoop data
  const { data: whoopData } = await supabase
    .from('forge_training_data')
    .select('*')
    .eq('email', email)
    .eq('provider', 'whoop');
  console.log(`${whoopData?.length ? '✅' : '❌'} Whoop: ${whoopData?.length || 0} records`);

  // Check blood tests
  const { data: bloodData } = await supabase
    .from('sage_onboarding_data')
    .select('lab_file_analysis')
    .eq('email', email)
    .single();
  console.log(`${bloodData?.lab_file_analysis ? '✅' : '❌'} Blood Tests: ${bloodData?.lab_file_analysis ? 'Available' : 'Not found'}`);

  // Check Vital webhooks
  const { data: vitalEvents } = await supabase
    .from('vital_webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(10);
  console.log(`📡 Vital Webhooks: ${vitalEvents?.length || 0} recent events`);

  // Check integration tokens
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('provider, is_active')
    .eq('user_email', email);
  console.log(`\n🔗 Connected Integrations:`);
  tokens?.forEach(t => console.log(`  - ${t.provider}: ${t.is_active ? 'Active' : 'Inactive'}`));
}

// Run it
checkDataSources('your-email@example.com');
```

Run it:
```bash
cd /Users/sofianyoussef/Desktop/moccet/moccet-new
ts-node scripts/check-data-sources.ts
```

---

## Expected Output After Fixes

Once everything is connected, insights should look like:

```
📊 Recent Insights for user@example.com:

✅ Sleep Debt Alert (Apple Health)
   - Title: "Sleep Debt Accumulating"
   - Message: "You've slept 6.2 hours on average this week (target: 8h)"
   - Source: apple_health

✅ Recovery Alert (Whoop)
   - Title: "Recovery in Red Zone"
   - Message: "Your recovery score of 32% suggests you need rest"
   - Source: whoop

✅ HRV Declining (Whoop)
   - Title: "HRV Below Baseline"
   - Message: "Your HRV has dropped 20% from your baseline of 65ms"
   - Source: whoop

✅ Vitamin D Deficiency (Blood Test)
   - Title: "Low Vitamin D Detected"
   - Message: "Your Vitamin D is 18.5 ng/mL (optimal: 30-100)"
   - Recommendation: "Consider Thorne Vitamin D3 1000 IU supplement"
   - Source: bloodBiomarkers
```

---

## Summary

**Current State**:
- ✅ Apple Health data → Working
- ❌ Whoop data → Not in database
- ❌ Blood test data → Not in database

**Action Items**:
1. Upload blood test PDF via app or API
2. Connect Whoop via Vital integration
3. Verify Vital webhook is configured
4. Trigger insight generation
5. Check `real_time_insights` table for new insights

**Quick Test (Insert Sample Data)**:
If you just want to test the system, use the SQL insert commands above to add sample Whoop and blood data to your database, then call the insights API endpoint.
