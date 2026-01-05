/**
 * Food Recognition Prompts for GPT-4o Vision
 */

export const FOOD_RECOGNITION_SYSTEM_PROMPT = `You are an expert nutritionist and food recognition specialist. Your task is to analyze food images and identify:
1. The specific food item(s) visible
2. Estimated portion sizes in grams
3. Your confidence level in the identification

Be specific with food names - say "grilled chicken breast" instead of just "chicken".
For portions, use visual cues like plate size, hand comparisons, or common portion references.

IMPORTANT:
- If you see a mixed dish (like a salad or stir-fry), break it down into individual components
- If food packaging is visible, try to identify the brand
- If you cannot identify a food item with reasonable confidence, say so
- Estimate conservatively - it's better to slightly underestimate portions than overestimate`;

export const FOOD_RECOGNITION_USER_PROMPT = `Analyze this food image and identify all food items visible.

For each food item, provide:
1. Name (be specific: "grilled salmon fillet" not just "fish")
2. Estimated portion in grams
3. Confidence level (0-1, where 1 is absolutely certain)
4. Your best estimate of macros if you know them (for fallback)

Return your response as valid JSON in this exact format:
{
  "foods": [
    {
      "name": "grilled chicken breast",
      "portionGrams": 150,
      "confidence": 0.85,
      "estimatedMacros": {
        "calories": 248,
        "protein": 46.5,
        "carbs": 0,
        "fat": 5.4,
        "fiber": 0
      }
    },
    {
      "name": "steamed white rice",
      "portionGrams": 180,
      "confidence": 0.9,
      "estimatedMacros": {
        "calories": 234,
        "protein": 4.3,
        "carbs": 51.5,
        "fat": 0.4,
        "fiber": 0.6
      }
    }
  ],
  "mealDescription": "Grilled chicken breast with steamed white rice",
  "notes": "Portion size estimated based on standard dinner plate visible in image"
}

If you cannot identify any food in the image, return:
{
  "foods": [],
  "error": "Unable to identify food items in this image",
  "notes": "Explain why identification failed"
}

Respond ONLY with valid JSON, no additional text.`;

export const PORTION_ESTIMATION_TIPS = `
Common portion size references:
- Palm of hand = ~85g of protein (meat, fish)
- Fist = ~1 cup (~200ml) of carbs (rice, pasta)
- Thumb = ~1 tablespoon of fats (oil, butter, peanut butter)
- Cupped hand = ~30g of nuts/small snacks
- Standard dinner plate = ~10-11 inches diameter
- Standard bowl = ~1-2 cups capacity

Common food weights:
- Medium chicken breast = 140-170g raw, 110-140g cooked
- Slice of bread = 25-40g
- Medium apple = 180-200g
- Medium banana = 120g peeled
- Egg = 50g (44g without shell)
- Cup of cooked rice = 180-200g
- Cup of cooked pasta = 140-160g
`;

/**
 * Build the complete prompt for food recognition
 */
export function buildFoodRecognitionPrompt(): { system: string; user: string } {
  return {
    system: FOOD_RECOGNITION_SYSTEM_PROMPT,
    user: FOOD_RECOGNITION_USER_PROMPT,
  };
}
