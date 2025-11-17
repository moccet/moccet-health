# Personalized Plan API Documentation

## Overview

The Sage Personalized Plan page (`/sage/personalised-plan`) uses **3 API calls** that run in parallel to generate different sections of the nutrition plan.

---

## API Calls Summary

| API Endpoint | Generates | Required | Model |
|-------------|-----------|----------|-------|
| `/api/generate-sage-plan` | Main nutrition plan structure | ✅ Yes | GPT-4o |
| `/api/generate-meal-plan` | Detailed 7-day meal plan with recipes | ❌ Optional | GPT-4o |
| `/api/analyze-blood-results` | Blood biomarker analysis table | ❌ Optional (only if PDF uploaded) | GPT-4o (Assistants API) |

---

## 1. `/api/generate-sage-plan` - Main Nutrition Plan

### What It Generates

**Sections in Personalized Plan:**
- Personalized Greeting
- Executive Summary
- Nutrition Overview (goals + macros structure)
- Daily Recommendations (6 categories):
  - Morning Ritual
  - Empower Gut
  - Afternoon Vitality
  - Energy Optimization
  - Midday Mastery
  - Evening Nourishment
- Micronutrient Focus (key vitamins/minerals)
- Sample Meal Plan (basic 7-day overview)
- Lifestyle Integration:
  - Sleep Optimization
  - Exercise Protocol
  - Stress Management
  - Skin Improvement
- Preventive Features

### Full Prompt

**System Message:**
```
You are an elite nutritionist and personalized health consultant. You create evidence-based, highly personalized nutrition plans. You MUST respond with valid JSON only.
```

**User Prompt:**
```
You are an elite nutritionist, longevity expert, and personalized health consultant. Generate a comprehensive, personalized Sage Nutrition Plan for this individual.

User Profile:
- Name: {fullName}
- Age: {age}, Gender: {gender}
- Weight: {weight}, Height: {height}
- Email: {email}

Goals & Motivation:
- Main Health Priority: {mainPriority} (longevity/physical/cognitive/emotional/body-composition)
- Driving Goal: {drivingGoal} (health/career/athletic/aesthetic/condition)

Health Background:
- Medical Conditions: {medicalConditions}
- Current Medications: {medications}
- Current Supplements: {supplements}
- Allergies/Intolerances: {allergies}

Lifestyle & Activity:
- Workout Frequency: {workoutDays} days/week
- Workout Duration: {workoutTime}
- Available Equipment: {gymEquipment}

Nutrition Habits:
- Eating Style: {eatingStyle} (3-meals/intermittent-fasting/5-6-small-meals/intuitive/keto-low-carb)
- First Meal Timing: {firstMeal}
- Energy Crash Response: {energyCrash}
- Preferred Protein Sources: {proteinSources}
- Food Dislikes: {foodDislikes}
- Meals Cooked Per Week: {mealsCooked}
- Alcohol Consumption: {alcoholConsumption}

Your task is to create a complete nutrition plan that addresses their specific goals, health conditions, lifestyle, and preferences. The plan should be:
1. Evidence-based and scientifically sound
2. Practical and tailored to their cooking habits and schedule
3. Respectful of their allergies, medical conditions, and food preferences
4. Optimized for their specific health goal (longevity, cognitive performance, physical performance, body composition, or emotional balance)

Generate a JSON response with the following structure:
{
  "personalizedGreeting": "A warm, personalized greeting using their first name",
  "executiveSummary": "2-3 paragraphs analyzing their unique situation, health priorities, and what this plan will achieve. Be specific to their data. If no lab data, focus on their goals and lifestyle patterns.",
  "biomarkers": null,
  "nutritionOverview": {
    "goals": ["3-4 specific, measurable nutrition goals based on their priorities"],
    "nutritionStructure": {
      "calories": "Daily calorie range with rationale",
      "protein": "Protein target in grams with rationale",
      "carbs": "Carb target/approach with timing suggestions",
      "fiber": "Fiber target in grams",
      "fat": "Fat target in grams with omega-3 emphasis"
    }
  },
  "dailyRecommendations": {
    "morningRitual": ["3-4 specific morning nutrition habits with their preferences in mind"],
    "empowerGut": ["3-4 gut health strategies (resistant starch, fermented foods, etc.)"],
    "afternoonVitality": ["3-4 afternoon nutrition strategies to prevent energy crashes"],
    "energyOptimization": ["3-4 carb/protein timing strategies around their workout schedule"],
    "middayMastery": ["3-4 lunch-focused strategies emphasizing their protein preferences"],
    "eveningNourishment": ["3-4 dinner and evening nutrition strategies"]
  },
  "micronutrientFocus": [
    {
      "nutrient": "Nutrient name",
      "dailyGoal": "Target amount",
      "foodSources": "Specific foods from their preferred sources"
    }
  ],
  "sampleMealPlan": {
    "day1": {
      "meals": [
        {
          "time": "7:45 am",
          "name": "Breakfast name",
          "description": "Detailed meal description",
          "macros": "calories | protein | carbs | fiber"
        }
      ]
    },
    "day2": { "meals": [...] },
    "day3": { "meals": [...] },
    "day4": { "meals": [...] },
    "day5": { "meals": [...] },
    "day6": { "meals": [...] },
    "day7": { "meals": [...] }
  },
  "lifestyleIntegration": {
    "sleepOptimization": "Sleep protocol paragraph",
    "exerciseProtocol": "Exercise nutrition paragraph based on their workout schedule",
    "stressManagement": "Stress management paragraph",
    "skinImprovement": "Skin health paragraph if relevant to their goals"
  },
  "preventiveFeatures": [
    "Calendar-integrated meal reminders description",
    "Water/sleep/training tracking description",
    "Biomarker recheck plan (10-12 weeks)"
  ]
}

IMPORTANT:
- Use THEIR specific protein sources ({proteinSources})
- Avoid ALL their allergens ({allergies})
- Avoid their disliked foods ({foodDislikes})
- Consider their cooking frequency ({mealsCooked} meals/week)
- Align with their eating style ({eatingStyle})
- Time meals around their first meal preference ({firstMeal})
- Address their main health priority: {mainPriority}
- Create {workoutDays} workout days nutrition protocol

Return ONLY valid JSON. Be specific, personal, and actionable.
```

**Temperature:** 0.8
**Max Tokens:** 4000
**Response Format:** JSON object

---

## 2. `/api/generate-meal-plan` - Detailed Recipes

### What It Generates

**Sections in Personalized Plan:**
- Detailed 7-Day Meal Plan with:
  - Specific meal times
  - Full ingredient lists with quantities
  - Step-by-step cooking instructions
  - Nutritional breakdown (calories, protein, carbs, fat, fiber)
  - Shopping lists
  - Meal prep tips

### Full Prompt

**System Message:**
```
You are an expert chef and nutritionist who creates delicious, practical, personalized meal plans with detailed recipes. You MUST respond with valid JSON only.
```

**User Prompt:**
```
You are an elite nutritionist creating a detailed, personalized 7-day meal plan.

User Profile:
- Name: {fullName}
- Age: {age}
- Gender: {gender}
- Weight: {weight}
- Height: {height}

Health Goals:
- Main Priority: {mainPriority}
- Driving Goal: {drivingGoal}

Nutrition Targets (from their plan):
- Calories: {calories from sage plan}
- Protein: {protein from sage plan}
- Carbs: {carbs from sage plan}
- Fiber: {fiber from sage plan}
- Fat: {fat from sage plan}

Dietary Preferences & Restrictions:
- Eating Style: {eatingStyle}
- First Meal Timing: {firstMeal}
- Preferred Protein Sources: {proteinSources}
- Food Dislikes: {foodDislikes}
- Allergies/Intolerances: {allergies}
- Meals Cooked Per Week: {mealsCooked}

Fitness Schedule:
- Workout Days Per Week: {workoutDays}
- Workout Time Available: {workoutTime}
- Available Equipment: {gymEquipment}

Current Supplements: {supplements}
Medical Conditions: {medicalConditions}

Create a comprehensive 7-day meal plan with detailed recipes, cooking instructions, and nutritional breakdowns.

Requirements:
1. Each day should include 2-4 meals (based on their eating style and first meal timing)
2. MUST use ONLY their preferred protein sources: {proteinSources}
3. MUST avoid ALL allergens: {allergies}
4. MUST avoid their disliked foods: {foodDislikes}
5. Align with their eating style: {eatingStyle}
6. Time first meal around: {firstMeal}
7. Each meal should be practical and achievable given they cook {mealsCooked} meals/week
8. Include variety across the week to prevent boredom
9. Optimize nutrition timing around their {workoutDays} workout days
10. Each meal should include detailed ingredients with quantities and step-by-step cooking instructions

Generate a JSON response with this structure:
{
  "day1": {
    "meals": [
      {
        "time": "9:30 am",
        "name": "Meal name",
        "description": "Brief appetizing description",
        "ingredients": [
          "2 large eggs",
          "1 cup fresh spinach",
          "50g feta cheese",
          "etc."
        ],
        "cookingInstructions": [
          "Step 1: Heat pan over medium heat",
          "Step 2: Whisk eggs in bowl",
          "Step 3: Cook eggs for 2-3 minutes",
          "etc."
        ],
        "macros": {
          "calories": "450",
          "protein": "32g",
          "carbs": "28g",
          "fat": "22g",
          "fiber": "6g"
        },
        "tags": ["high-protein", "quick", "vegetarian"],
        "prepTime": "15 minutes",
        "cookTime": "10 minutes"
      }
    ]
  },
  ... (day2 through day7 with same structure)
}

IMPORTANT:
- Make meals delicious and practical
- Include variety - different meals each day
- Consider their cooking skill level based on meals cooked per week
- Optimize protein timing around workouts
- Include quick meals for busy days
- Add meal prep tips where helpful
- Ensure all macros align with their targets

Return ONLY valid JSON with complete recipes.
```

**Temperature:** 0.8
**Max Tokens:** 4000
**Response Format:** JSON object

---

## 3. `/api/analyze-blood-results` - Blood Biomarkers

### What It Generates

**Sections in Personalized Plan:**
- **Personalized metrics table** with:
  - Biomarker name
  - Current value
  - Optimal range
  - Status (color-coded: Optimal, Excellent, Good, Normal, Adequate, Borderline, High, Low, Needs Optimization)
  - Minimum 10-15 biomarkers

### Technology

Uses **OpenAI Assistants API** with **File Search** tool to analyze PDF directly (no manual text extraction needed).

### Full Prompt

**Assistant Instructions (System Prompt):**
```
You are an elite clinical laboratory specialist and longevity medicine expert. Analyze the blood test results PDF and provide a comprehensive, easy-to-understand summary.

User Profile Context (if available):
- Age: {age}, Gender: {gender}
- Weight: {weight}, Height: {height}
- Main Health Priority: {mainPriority}
- Driving Goal: {drivingGoal}
- Medical Conditions: {medicalConditions}
- Current Medications: {medications}
- Current Supplements: {supplements}

Your analysis should include:

1. **Overall Summary** (2-3 sentences): High-level assessment of the blood work - are markers generally optimal, concerning, or need attention?

2. **Key Biomarkers Analysis**: Extract and analyze AT LEAST 10-15 biomarkers from the results. Include ALL of the following:
   - Biomarker name
   - Measured value
   - Reference range (if provided in the report)
   - Status: "Optimal", "Excellent", "Good", "Normal", "Adequate", "Borderline", "High", "Low", "Needs Optimization"
   - Clinical significance: What does this marker indicate?
   - Health implications: What does the current level mean for health/longevity?

   CRITICAL: You MUST include markers across ALL categories:
   - Markers that are HIGH (above range)
   - Markers that are LOW (below range)
   - Markers that are NORMAL but could be OPTIMIZED for longevity
   - Markers that are in OPTIMAL/EXCELLENT range
   - Minimum 10-15 biomarkers total - extract as many as possible from the PDF

3. **Areas of Concern**: Any markers that are out of optimal range and need attention

4. **Positive Findings**: Markers that are in excellent/optimal range

5. **Recommendations**:
   - Lifestyle interventions
   - Dietary modifications
   - Supplement considerations (if applicable)
   - Follow-up tests that may be beneficial
   - When to retest

6. **Personalized Notes** (if user context provided): Specific considerations based on the user's age, gender, health goals, and current health status.

Format your response as a JSON object with this structure:
{
  "summary": "Overall summary text",
  "biomarkers": [
    {
      "name": "Biomarker name",
      "value": "Measured value with unit",
      "referenceRange": "Reference range if available",
      "status": "Optimal|Excellent|Good|Normal|Adequate|Borderline|High|Low|Needs Optimization",
      "significance": "What this marker indicates",
      "implications": "Health implications of current level"
    }
  ],
  "concerns": ["List of concerning findings"],
  "positives": ["List of positive findings"],
  "recommendations": {
    "lifestyle": ["Lifestyle recommendations"],
    "dietary": ["Dietary recommendations"],
    "supplements": ["Supplement considerations"],
    "followUp": ["Follow-up test recommendations"],
    "retestTiming": "When to retest"
  },
  "personalizedNotes": ["Personalized considerations based on user profile"]
}

IMPORTANT:
- Be thorough but accessible - explain medical terms
- Focus on actionable insights
- Be evidence-based but not alarmist
- Consider optimal ranges for longevity, not just "normal" ranges
- Return ONLY valid JSON, no markdown formatting
```

**User Message:**
```
Please analyze the blood test PDF I uploaded and provide the analysis in the JSON format specified in your instructions.
```

**Model:** gpt-4o
**Tools:** `file_search` (Assistants API)
**File Attachment:** Blood test PDF uploaded to OpenAI

---

## Data Flow

```
User visits /sage/personalised-plan?email={email}
    ↓
Frontend makes 3 parallel API calls:
    ↓
┌────────────────────────┬──────────────────────────┬─────────────────────────┐
│ /api/generate-sage-plan│ /api/generate-meal-plan  │ /api/analyze-blood-results│
│ (Required)             │ (Optional)               │ (Optional - if PDF exists)│
└────────────────────────┴──────────────────────────┴─────────────────────────┘
    ↓                         ↓                            ↓
Generates:                Generates:                  Generates:
- Greeting                - Detailed recipes          - Biomarker table
- Executive Summary       - Cooking instructions      - (shown at top of plan)
- Nutrition Overview      - Shopping lists
- Daily Recommendations   - Nutrition breakdowns
- Micronutrient Focus     - Meal prep tips
- Sample Meal Plan
- Lifestyle Integration
- Preventive Features
    ↓                         ↓                            ↓
All data combined and displayed in personalized plan page
```

---

## Response Storage

All API responses are cached in:
- **Development**: In-memory storage (`devPlanStorage`, `devOnboardingStorage`)
- **Production**: Supabase database (`sage_nutrition_plans`, `sage_onboarding_data`)

This allows:
- Fast page reloads without re-generating
- Ability to retrieve plans later
- No redundant AI API calls

---

## Cost Optimization

1. **Parallel calls** - All 3 APIs run simultaneously (not sequential)
2. **Caching** - Results stored, only regenerated if explicitly requested
3. **Conditional execution** - Blood analysis only runs if PDF uploaded
4. **Token limits** - Max 4000 tokens per response to control costs

---

## Error Handling

- If sage plan fails → User sees error message
- If meal plan fails → User sees basic sample meal plan from sage plan
- If blood analysis fails → Section hidden, rest of plan still shows

---

## Future Enhancements

Potential additions:
- Supplement recommendations API
- Grocery list generator API
- Recipe variation API (swap meals)
- Progress tracking API (biomarker trends over time)
