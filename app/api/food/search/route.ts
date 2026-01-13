import { NextRequest, NextResponse } from 'next/server';
import { searchUSDA } from '@/lib/services/nutrition-lookup/usda-client';

/**
 * Food Search API
 * Searches USDA FoodData Central for foods matching a query
 *
 * GET /api/food/search?q=coffee&limit=20
 */

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || searchParams.get('query');
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query must be at least 2 characters', foods: [] },
      { status: 400 }
    );
  }

  console.log(`[Food Search] Searching for: "${query}" (limit: ${limit})`);

  try {
    const results = await searchUSDA(query, {
      pageSize: Math.min(limit, 50), // Cap at 50
      dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'],
    });

    // Transform to mobile-friendly format
    const foods = results.map(item => ({
      id: item.fdcId || `usda_${Date.now()}_${Math.random()}`,
      externalId: item.fdcId,
      source: 'usda',
      name: item.name,
      brand: item.brandName,
      servingSize: item.servingSizeGrams,
      servingUnit: 'g',
      servingDescription: item.servingDescription,
      macros: {
        calories: item.macros.calories,
        protein: item.macros.protein,
        carbs: item.macros.carbs,
        fat: item.macros.fat,
      },
      fiber: item.macros.fiber,
      sugar: item.micros?.sugar,
      sodium: item.micros?.sodium,
      saturatedFat: item.micros?.saturatedFat,
      cholesterol: item.micros?.cholesterol,
      potassium: item.micros?.potassium,
      calcium: item.micros?.calcium,
      iron: item.micros?.iron,
      vitaminA: item.micros?.vitaminA,
      vitaminC: item.micros?.vitaminC,
      isVerified: true,
    }));

    console.log(`[Food Search] Found ${foods.length} results for "${query}"`);

    return NextResponse.json({
      success: true,
      query,
      count: foods.length,
      foods,
    });
  } catch (error) {
    console.error('[Food Search] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        foods: [],
      },
      { status: 500 }
    );
  }
}
