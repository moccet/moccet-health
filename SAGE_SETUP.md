# Sage Personalized Plan Setup Guide

## Overview
This guide will help you set up the Sage personalized nutrition plan feature, which includes:
- Onboarding data storage in Supabase
- AI-powered plan generation with OpenAI GPT-4o
- Personalized plan display page

## Prerequisites
- Supabase account and project
- OpenAI API key
- Next.js application running

## 1. Database Setup

### Run the SQL Migration

1. Log into your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste the contents of `/supabase/migrations/001_create_sage_tables.sql`
4. Run the SQL script

This will create:
- `sage_onboarding_data` table - stores user onboarding responses
- `sage_nutrition_plans` table - stores generated AI nutrition plans
- Necessary indexes and triggers

### Verify Tables

After running the migration, verify the tables exist:

```sql
SELECT * FROM sage_onboarding_data LIMIT 1;
SELECT * FROM sage_nutrition_plans LIMIT 1;
```

## 2. Environment Variables

Ensure you have the following environment variables set in your `.env.local`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key
```

## 3. Test the Flow

### Complete Test Flow:

1. **Start Onboarding**
   - Navigate to `/sage/onboarding`
   - Complete all onboarding screens
   - Fill in personal info, goals, health baseline, fitness, and nutrition preferences
   - Connect Gmail/Slack (optional)
   - Upload lab results (optional)

2. **Submit Onboarding**
   - Click "Complete Setup" on the final screen
   - You'll be redirected to `/sage/personalised-plan?email=your@email.com`

3. **View Personalized Plan**
   - Loading screen will appear (30-60 seconds)
   - AI generates your personalized nutrition plan
   - Plan displays with:
     - Personalized greeting
     - Executive summary
     - Nutrition overview
     - Daily recommendations
     - Micronutrient focus
     - 3-day sample meal plan
     - Lifestyle integration protocols
     - Preventive features

## 4. API Endpoints

### `/api/sage-onboarding` (POST)
Stores onboarding data in Supabase.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "age": "35",
  "email": "john@example.com",
  ...
}
```

**Response:**
```json
{
  "success": true,
  "message": "Onboarding data stored successfully",
  "data": {
    "email": "john@example.com",
    "timestamp": "2025-11-13T..."
  }
}
```

### `/api/generate-sage-plan` (GET)
Generates personalized nutrition plan using AI.

**Query Parameters:**
- `email` (required): User's email address

**Response:**
```json
{
  "success": true,
  "plan": {
    "personalizedGreeting": "Let's get started, John.",
    "executiveSummary": "...",
    "nutritionOverview": {...},
    ...
  },
  "cached": false
}
```

## 5. Features

### Plan Caching
- Plans are cached in the database
- If a plan exists for an email, it's returned immediately
- No redundant AI calls for the same user

### Personalization
The AI considers:
- User's age, gender, weight, height
- Health goals and priorities
- Allergies and medical conditions
- Fitness routine and equipment
- Eating style and preferences
- Food dislikes
- Cooking frequency
- Connected wearables/integrations

### Loading Experience
- Elegant loading animation during plan generation
- Progress indicators
- Takes 30-60 seconds for AI to generate complete plan

### Responsive Design
- Mobile-friendly layouts
- Clean, professional medical aesthetic
- Playfair Display for headings
- Inter for body text
- Sage green color theme (#2d3a2d, #e8ede6)

## 6. Customization

### Modify AI Prompt
Edit `/app/api/generate-sage-plan/route.ts` to customize:
- Plan structure
- Recommendation style
- Nutrition philosophy
- Output format

### Update Design
Edit `/app/sage/personalised-plan/personalised-plan.css` to modify:
- Colors
- Typography
- Layout
- Spacing

### Add Biomarker Analysis
If you have lab file analysis working:
1. Parse lab results in `/api/analyze-health-data`
2. Store analysis in `lab_file_analysis` column
3. Pass to AI prompt in generate-sage-plan
4. Display in biomarkers section (currently hidden if null)

## 7. Troubleshooting

### "No onboarding data found"
- Verify email is correct
- Check Supabase connection
- Ensure onboarding was completed

### Plan generation fails
- Check OpenAI API key
- Verify API rate limits
- Check console for errors

### Supabase errors
- Verify environment variables
- Check Supabase project is active
- Ensure tables exist

## 8. Next Steps

Consider adding:
- User authentication
- Plan history/versioning
- PDF export
- Email delivery of plans
- Progress tracking
- Follow-up recommendations
- Integration with wearable data (Oura, WHOOP, CGM)
- Automated grocery lists
- Recipe database integration

## Support

For questions or issues:
- Check the browser console for errors
- Review server logs for API errors
- Verify all environment variables are set
- Ensure Supabase tables are created correctly
