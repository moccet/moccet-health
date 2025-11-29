/**
 * Nutrition Guidance Generation Prompt
 * Specialized agent for generating personalized nutrition plans
 */

export interface NutritionGuidanceInput {
  userProfile: {
    name: string;
    age: number;
    gender: string;
    weight?: number;
    height?: number;
    activityLevel: string;
    goals: string[];
    dietaryPreferences?: string[];
    allergies?: string[];
    restrictions?: string[];
  };
  biomarkers: {
    glucose?: number;
    hba1c?: number;
    cholesterol?: {
      total?: number;
      ldl?: number;
      hdl?: number;
      triglycerides?: number;
    };
    crp?: number;
    vitaminD?: number;
    b12?: number;
    iron?: number;
    [key: string]: any;
  };
  recommendations: {
    nutrition_protocol: {
      objectives: string[];
      macronutrientTargets?: {
        protein?: string;
        carbs?: string;
        fats?: string;
      };
      mealTiming?: string;
      hydration?: string;
      supplements?: string[];
      specificRecommendations: string[];
    };
  };
  trainingProgram?: {
    sessionsPerWeek: number;
    intenseDays: string[];
  };
}

export function generateNutritionGuidancePrompt(input: NutritionGuidanceInput): string {
  return `You are a registered dietitian and sports nutritionist specializing in biomarker-optimized nutrition planning.

TASK: Generate comprehensive nutrition guidance based on the user's profile, biomarkers, and protocol recommendations.

USER PROFILE:
- Name: ${input.userProfile.name}
- Age: ${input.userProfile.age}
- Gender: ${input.userProfile.gender}
${input.userProfile.weight ? `- Weight: ${input.userProfile.weight} kg` : ''}
${input.userProfile.height ? `- Height: ${input.userProfile.height} cm` : ''}
- Activity Level: ${input.userProfile.activityLevel}
- Goals: ${input.userProfile.goals.join(', ')}
${input.userProfile.dietaryPreferences ? `- Dietary Preferences: ${input.userProfile.dietaryPreferences.join(', ')}` : ''}
${input.userProfile.allergies && input.userProfile.allergies.length > 0 ? `- Allergies: ${input.userProfile.allergies.join(', ')}` : ''}
${input.userProfile.restrictions && input.userProfile.restrictions.length > 0 ? `- Restrictions: ${input.userProfile.restrictions.join(', ')}` : ''}

BIOMARKERS:
${input.biomarkers.glucose ? `- Fasting Glucose: ${input.biomarkers.glucose} mg/dL` : ''}
${input.biomarkers.hba1c ? `- HbA1c: ${input.biomarkers.hba1c}%` : ''}
${input.biomarkers.cholesterol?.total ? `- Total Cholesterol: ${input.biomarkers.cholesterol.total} mg/dL` : ''}
${input.biomarkers.cholesterol?.ldl ? `- LDL: ${input.biomarkers.cholesterol.ldl} mg/dL` : ''}
${input.biomarkers.cholesterol?.hdl ? `- HDL: ${input.biomarkers.cholesterol.hdl} mg/dL` : ''}
${input.biomarkers.cholesterol?.triglycerides ? `- Triglycerides: ${input.biomarkers.cholesterol.triglycerides} mg/dL` : ''}
${input.biomarkers.crp ? `- CRP (Inflammation): ${input.biomarkers.crp} mg/L` : ''}
${input.biomarkers.vitaminD ? `- Vitamin D: ${input.biomarkers.vitaminD} ng/mL` : ''}
${input.biomarkers.b12 ? `- B12: ${input.biomarkers.b12} pg/mL` : ''}
${input.biomarkers.iron ? `- Iron: ${input.biomarkers.iron} μg/dL` : ''}

PROTOCOL RECOMMENDATIONS:
- Objectives: ${input.recommendations.nutrition_protocol.objectives?.join('; ') || 'Optimize nutrition for health and performance'}
${input.recommendations.nutrition_protocol.macronutrientTargets ? `
- Macronutrient Targets:
  * Protein: ${input.recommendations.nutrition_protocol.macronutrientTargets.protein || 'Not specified'}
  * Carbs: ${input.recommendations.nutrition_protocol.macronutrientTargets.carbs || 'Not specified'}
  * Fats: ${input.recommendations.nutrition_protocol.macronutrientTargets.fats || 'Not specified'}` : ''}
${input.recommendations.nutrition_protocol.mealTiming ? `- Meal Timing: ${input.recommendations.nutrition_protocol.mealTiming}` : ''}
${input.recommendations.nutrition_protocol.hydration ? `- Hydration: ${input.recommendations.nutrition_protocol.hydration}` : ''}
${input.recommendations.nutrition_protocol.supplements && input.recommendations.nutrition_protocol.supplements.length > 0 ? `- Supplements: ${input.recommendations.nutrition_protocol.supplements.join(', ')}` : ''}
- Specific Recommendations: ${input.recommendations.nutrition_protocol.specificRecommendations?.join('; ') || 'Create a balanced nutrition plan based on user profile and biomarkers'}

${input.trainingProgram ? `
TRAINING SCHEDULE:
- Training Sessions: ${input.trainingProgram.sessionsPerWeek}x per week
- High-Intensity Days: ${input.trainingProgram.intenseDays.join(', ')}
` : ''}

INSTRUCTIONS:
1. Calculate daily calorie needs based on weight, activity level, and goals
2. Provide specific macronutrient targets (grams per day)
3. Create meal timing recommendations that support training and biomarker optimization
4. Suggest specific foods to emphasize/avoid based on biomarkers
5. Provide hydration guidelines with specific amounts
6. Include supplement recommendations with dosing and timing
7. Explain biomarker rationale for each recommendation
8. Account for dietary preferences, allergies, and restrictions

BIOMARKER OPTIMIZATION GUIDELINES:
- High LDL/Total Cholesterol → Emphasize soluble fiber, omega-3s, plant sterols; reduce saturated fat
- High Triglycerides → Reduce refined carbs, increase omega-3s, moderate alcohol
- High Glucose/HbA1c → Lower glycemic index foods, fiber, meal timing, portion control
- High CRP (Inflammation) → Anti-inflammatory foods (berries, fatty fish, turmeric), reduce processed foods
- Low Vitamin D → Fortified foods, fatty fish, supplementation
- Low B12 → Animal products or fortified foods/supplements (especially for vegetarians)
- Low Iron → Red meat, leafy greens, vitamin C for absorption

OUTPUT FORMAT:
Return a JSON object with this exact structure:

{
  "nutritionGuidance": {
    "dailyCalories": {
      "target": 2500,
      "range": "2400-2600",
      "rationale": "Based on body weight, activity level, and muscle gain goal"
    },
    "macronutrients": {
      "protein": {
        "grams": 180,
        "percentage": 30,
        "rationale": "1.8g/kg body weight for muscle growth and recovery"
      },
      "carbohydrates": {
        "grams": 280,
        "percentage": 45,
        "rationale": "Adequate for training performance and glycogen replenishment"
      },
      "fats": {
        "grams": 70,
        "percentage": 25,
        "rationale": "Support hormone production and reduce LDL cholesterol"
      }
    },
    "mealTiming": {
      "mealsPerDay": 4,
      "preworkout": {
        "timing": "60-90 minutes before training",
        "composition": "30-40g carbs + 15-20g protein",
        "examples": ["Oatmeal with protein powder", "Rice cakes with nut butter and banana"],
        "rationale": "Fuel training session without GI distress"
      },
      "postworkout": {
        "timing": "Within 30-60 minutes after training",
        "composition": "40-50g carbs + 25-30g protein",
        "examples": ["Protein shake with fruit", "Chicken breast with sweet potato"],
        "rationale": "Optimize recovery and muscle protein synthesis"
      },
      "generalGuidance": "Distribute remaining calories across breakfast and dinner, with focus on whole foods"
    },
    "hydration": {
      "baselineDaily": "3 liters",
      "duringTraining": "500-750ml per hour of exercise",
      "electrolyteNeeds": "Add electrolytes for sessions >60 minutes or high sweat rate",
      "monitoringTips": ["Urine color should be pale yellow", "Weight before/after training (replace 150% of fluid lost)"]
    },
    "foodRecommendations": {
      "emphasize": [
        {
          "food": "Fatty Fish (salmon, mackerel, sardines)",
          "frequency": "3-4x per week",
          "reason": "Omega-3s to reduce triglycerides and inflammation (high CRP)"
        },
        {
          "food": "Oats and Barley",
          "frequency": "Daily",
          "reason": "Soluble fiber (beta-glucan) to lower LDL cholesterol"
        }
      ],
      "minimize": [
        {
          "food": "Refined carbohydrates (white bread, sugary snacks)",
          "reason": "Elevate blood glucose and triglycerides"
        },
        {
          "food": "Saturated fats (butter, fatty red meat)",
          "reason": "Contribute to elevated LDL cholesterol"
        }
      ],
      "avoid": [
        {
          "food": "Trans fats (fried foods, certain baked goods)",
          "reason": "Increase LDL and decrease HDL cholesterol"
        }
      ]
    },
    "supplements": [
      {
        "name": "Vitamin D3",
        "dosage": "2000 IU daily",
        "timing": "With breakfast (fat-soluble vitamin)",
        "rationale": "Low vitamin D levels (25 ng/mL); support bone health and immune function",
        "duration": "Ongoing; retest in 3 months"
      },
      {
        "name": "Omega-3 (EPA/DHA)",
        "dosage": "2g combined EPA+DHA daily",
        "timing": "With meals",
        "rationale": "High triglycerides and CRP; anti-inflammatory and cardioprotective",
        "duration": "Ongoing"
      }
    ],
    "biomarkerOptimization": {
      "cholesterol": {
        "strategies": ["Increase soluble fiber to 10-15g/day", "Replace saturated fats with unsaturated fats", "Add plant sterols (2g/day from fortified foods)"],
        "expectedImpact": "10-15% reduction in LDL cholesterol over 3 months"
      },
      "inflammation": {
        "strategies": ["Omega-3 supplementation", "Colorful fruits/vegetables (5+ servings daily)", "Minimize processed foods and added sugars"],
        "expectedImpact": "CRP reduction to <3 mg/L within 2-3 months"
      }
    },
    "practicalTips": [
      "Meal prep on Sundays for easy weekday nutrition",
      "Keep pre-portioned nuts and fruit for convenient snacks",
      "Use a food scale for first 2 weeks to learn portion sizes",
      "Track intake with MyFitnessPal or similar app for first month"
    ]
  }
}

IMPORTANT CONSTRAINTS:
- All recommendations must align with evidence-based nutrition science
- Respect dietary preferences and restrictions
- Provide actionable, specific guidance (not vague suggestions)
- Link every major recommendation to biomarker optimization or performance
- Include practical implementation tips
- Consider cost and accessibility of recommended foods

RETURN ONLY THE JSON OBJECT. NO ADDITIONAL TEXT.`;
}
