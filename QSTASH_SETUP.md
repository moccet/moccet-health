# Upstash QStash Setup Guide

This document explains how to set up Upstash QStash for background plan generation processing.

## Why QStash?

The plan generation process takes longer than Vercel's 5-minute (300s) timeout limit on Pro plans. QStash solves this by:

- Running jobs in the background (no timeout issues)
- Automatic retries on failure
- Serverless and scales automatically
- Free tier includes 500 messages/day

## Setup Steps

### 1. Create Upstash Account

1. Go to [https://upstash.com](https://upstash.com)
2. Sign up for a free account
3. Verify your email

### 2. Create a QStash Database

1. In the Upstash console, go to **QStash**
2. Click **Create QStash**
3. Copy the following credentials:
   - **QSTASH_TOKEN** - Your publishing token
   - **QSTASH_CURRENT_SIGNING_KEY** - Current signing key
   - **QSTASH_NEXT_SIGNING_KEY** - Next signing key

### 3. Add Environment Variables

Add these variables to your `.env.local` file and Vercel project settings:

```bash
# Upstash QStash Configuration
QSTASH_TOKEN=your_qstash_token_here
QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key_here
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key_here
```

#### In Vercel Dashboard:

1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add all three variables above
4. Make sure they're available for **Production**, **Preview**, and **Development**

### 4. Run Database Migration

Run the SQL migration to add job status tracking:

```bash
# In your Supabase SQL Editor, run:
supabase_add_plan_status.sql
```

Or manually execute the SQL in your Supabase dashboard.

### 5. Deploy to Vercel

```bash
git add .
git commit -m "Add Upstash QStash for background plan generation"
git push
```

Vercel will automatically deploy with the new environment variables.

## How It Works

### 1. User Submits Onboarding Form

- User completes the onboarding form
- Frontend calls `/api/generate-plan-async`

### 2. Job is Queued

- API endpoint publishes job to QStash
- Status set to `queued` in database
- Returns immediately to user with success message

### 3. QStash Calls Webhook

- QStash calls `/api/webhooks/qstash/generate-plan`
- Webhook signature is verified automatically
- Status updated to `processing`

### 4. Plan Generation Runs

- Main sage plan generated
- Meal plan generated
- Micronutrients generated
- Lifestyle integration generated

### 5. User Notified

- Email sent to user with plan ready notification
- Status updated to `completed`
- If any step fails, status set to `failed` with error message

## Monitoring

### Check Job Status in Database

```sql
SELECT email, plan_generation_status, plan_generation_error, updated_at
FROM sage_onboarding_data
WHERE plan_generation_status IS NOT NULL
ORDER BY updated_at DESC;
```

### QStash Dashboard

- View job history: [https://console.upstash.com/qstash](https://console.upstash.com/qstash)
- See success/failure rates
- View retry attempts
- Monitor message queue

### Vercel Logs

- Real-time logs: `vercel logs --follow`
- Or view in Vercel dashboard under **Deployments** → **Functions**

## Testing Locally

To test QStash locally, you need to expose your local server:

### Option 1: Using ngrok

```bash
# Install ngrok
brew install ngrok  # macOS
# or download from https://ngrok.com

# Start your dev server
npm run dev

# In another terminal, expose it
ngrok http 3000

# Copy the ngrok URL (e.g., https://abc123.ngrok.io)
# Update NEXT_PUBLIC_BASE_URL in .env.local to use this URL
```

### Option 2: Using Upstash's Local Testing

```bash
# Upstash provides a CLI tool for local testing
npx @upstash/qstash-cli dev
```

## Troubleshooting

### Job Not Processing

1. **Check QStash Dashboard** - See if message was received
2. **Verify webhook URL** - Must be publicly accessible HTTPS
3. **Check environment variables** - All 3 QStash vars must be set
4. **Review Vercel logs** - Look for errors in webhook endpoint

### Signature Verification Failed

- Make sure `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` are correct
- Keys rotate periodically - update from Upstash dashboard if needed

### Job Times Out

- Check Vercel function logs
- Default max duration is 900s (15 min) on Pro
- If still timing out, consider breaking into smaller jobs

### Database Status Not Updating

- Verify Supabase credentials are set
- Check SQL migration ran successfully
- Review Supabase logs for permission errors

## Cost Considerations

### Free Tier Limits

- **500 messages per day** (plenty for most use cases)
- **Unlimited retries**
- **Standard support**

### Paid Plans

If you exceed 500 messages/day:
- **Pay as you go**: $1 per 1000 messages
- **Pro plan**: $10/month for 10,000 messages

## Security

- Webhook signatures are verified automatically
- Only QStash can call the webhook endpoint
- Environment variables are encrypted by Vercel
- Database credentials use row-level security

## Next Steps

After setup is complete, users will:
1. Submit their onboarding form
2. See "Plan generation started" message immediately
3. Receive an email when their plan is ready (typically 5-15 minutes)
4. Click the email link to view their personalized plan

No more timeout errors! 🎉
