/**
 * Food Image Analysis API Endpoint
 *
 * POST /api/food/analyze-image
 *
 * Accepts a food image and returns identified foods with accurate nutrition data.
 * Uses GPT-4o Vision for food recognition + USDA/OpenFoodFacts for nutrition lookup.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { lookupNutrition, FoodAnalysisResponse, MacroNutrients } from '@/lib/services/nutrition-lookup';
import { buildFoodRecognitionPrompt } from '@/lib/prompts/food-recognition-prompt';

// Initialize OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({
    apiKey,
    timeout: 120000,
    maxRetries: 2,
  });
}

// Initialize Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(url, key);
}

interface GPTFoodResult {
  foods: Array<{
    name: string;
    portionGrams: number;
    confidence: number;
    estimatedMacros?: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
    };
  }>;
  mealDescription?: string;
  notes?: string;
  error?: string;
}

/**
 * Parse GPT response to extract food identification results
 */
function parseGPTResponse(content: string): GPTFoodResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.foods || !Array.isArray(parsed.foods)) {
      throw new Error('Invalid response structure: missing foods array');
    }

    return parsed as GPTFoodResult;
  } catch (error) {
    console.error('[FoodAnalysis] Failed to parse GPT response:', error);
    throw new Error('Failed to parse food recognition response');
  }
}

/**
 * Upload image to Supabase Storage and get signed URL
 */
async function uploadImageToStorage(
  supabase: ReturnType<typeof getSupabaseClient>,
  imageBuffer: Buffer,
  contentType: string,
  userEmail: string
): Promise<string> {
  const timestamp = Date.now();
  const extension = contentType.split('/')[1] || 'jpg';
  const fileName = `food_${timestamp}.${extension}`;
  const filePath = `${userEmail}/${fileName}`;

  console.log(`[FoodAnalysis] Uploading image to storage: ${filePath}`);

  const { error: uploadError } = await supabase.storage
    .from('food-images')
    .upload(filePath, imageBuffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('[FoodAnalysis] Upload error:', uploadError);
    throw new Error('Failed to upload image');
  }

  // Get signed URL (valid for 1 hour)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('food-images')
    .createSignedUrl(filePath, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error('Failed to create signed URL');
  }

  return signedUrlData.signedUrl;
}

export async function POST(request: NextRequest) {
  console.log('[FoodAnalysis] Received request');

  try {
    // Parse FormData
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const email = formData.get('email') as string | null;

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: 'Image file is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image format. Supported: JPEG, PNG, WebP, HEIC' },
        { status: 400 }
      );
    }

    // Convert image to base64 for GPT-4o Vision
    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    console.log(`[FoodAnalysis] Processing image: ${imageFile.name}, size: ${imageBuffer.length} bytes`);

    // Initialize clients
    const openai = getOpenAIClient();
    const supabase = getSupabaseClient();

    // Upload image to storage (optional, for reference/debugging)
    let imageUrl: string | undefined;
    if (email) {
      try {
        imageUrl = await uploadImageToStorage(supabase, imageBuffer, mimeType, email);
        console.log(`[FoodAnalysis] Image uploaded: ${imageUrl}`);
      } catch (uploadError) {
        console.warn('[FoodAnalysis] Image upload failed (continuing):', uploadError);
        // Don't fail the request if upload fails
      }
    }

    // Call GPT-4o Vision for food recognition
    const { system, user } = buildFoodRecognitionPrompt();

    console.log('[FoodAnalysis] Calling GPT-4o Vision...');
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: system,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: user,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.3, // Lower temperature for more consistent results
    });

    const gptContent = gptResponse.choices[0]?.message?.content;
    if (!gptContent) {
      throw new Error('Empty response from GPT-4o');
    }

    console.log('[FoodAnalysis] GPT-4o response received');

    // Parse GPT response
    const gptResult = parseGPTResponse(gptContent);

    if (gptResult.error || gptResult.foods.length === 0) {
      return NextResponse.json({
        success: false,
        error: gptResult.error || 'No food items identified in the image',
        notes: gptResult.notes,
        imageUrl,
      } as FoodAnalysisResponse);
    }

    // Look up accurate nutrition data for each identified food
    console.log(`[FoodAnalysis] Looking up nutrition for ${gptResult.foods.length} foods...`);

    const enrichedFoods = await Promise.all(
      gptResult.foods.map(async (food) => {
        // Convert AI estimate to MacroNutrients format
        const aiEstimate: MacroNutrients | undefined = food.estimatedMacros
          ? {
              calories: food.estimatedMacros.calories,
              protein: food.estimatedMacros.protein,
              carbs: food.estimatedMacros.carbs,
              fat: food.estimatedMacros.fat,
              fiber: food.estimatedMacros.fiber,
            }
          : undefined;

        // Look up nutrition data (with AI estimate as fallback)
        const nutrition = await lookupNutrition(food.name, {
          portionGrams: food.portionGrams,
          aiEstimate,
        });

        if (nutrition) {
          return {
            name: food.name,
            portionSize: `${food.portionGrams}g`,
            portionGrams: food.portionGrams,
            confidence: food.confidence,
            macros: nutrition.macros,
            micros: nutrition.micros,
            source: nutrition.source,
            fdcId: nutrition.fdcId,
            offCode: nutrition.offCode,
            servingDescription: nutrition.servingDescription,
          };
        }

        // Fallback to AI estimate if no database match
        return {
          name: food.name,
          portionSize: `${food.portionGrams}g`,
          portionGrams: food.portionGrams,
          confidence: food.confidence,
          macros: aiEstimate || {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
          },
          source: 'ai_estimated' as const,
        };
      })
    );

    console.log('[FoodAnalysis] Analysis complete');

    // Save to sage_food_logs if user email is provided
    if (email && enrichedFoods.length > 0) {
      console.log(`[FoodAnalysis] Saving ${enrichedFoods.length} food items to database for ${email}`);

      const foodLogs = enrichedFoods.map((food, index) => ({
        id: `${email}_${Date.now()}_${index}`,
        user_email: email,
        name: food.name,
        calories: food.macros.calories || 0,
        protein: food.macros.protein || 0,
        carbs: food.macros.carbs || 0,
        fat: food.macros.fat || 0,
        fiber: food.macros.fiber || 0,
        serving_size: food.portionGrams || 100,
        serving_unit: 'g',
        servings_consumed: 1,
        source: 'image_analysis',
        image_url: imageUrl,
        database_id: food.fdcId || food.offCode || null,
        database_source: food.source || 'ai_estimated',
        logged_at: new Date().toISOString(),
        meal_type: 'snack', // Default, can be updated by user
        sugar: food.micros?.sugar || null,
        sodium: food.micros?.sodium || null,
        potassium: food.micros?.potassium || null,
        vitamin_a: food.micros?.vitaminA || null,
        vitamin_c: food.micros?.vitaminC || null,
        calcium: food.micros?.calcium || null,
        iron: food.micros?.iron || null,
      }));

      const { error: insertError } = await supabase
        .from('sage_food_logs')
        .insert(foodLogs);

      if (insertError) {
        console.error('[FoodAnalysis] Failed to save food logs:', insertError);
        // Don't fail the request, just log the error
      } else {
        console.log(`[FoodAnalysis] Successfully saved ${foodLogs.length} food items`);
      }
    }

    // Return enriched results
    const response: FoodAnalysisResponse = {
      success: true,
      foods: enrichedFoods,
      imageUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[FoodAnalysis] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Analysis failed';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        foods: [],
      } as FoodAnalysisResponse,
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
