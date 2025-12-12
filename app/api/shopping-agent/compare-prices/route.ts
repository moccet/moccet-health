import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrowserController } from '@/lib/services/shopping-agent/browser-controller';
import type { ProductSearchResult } from '@/lib/services/shopping-agent/sites/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SUPPORTED_SITES = ['amazon', 'iherb', 'healf'] as const;

interface PriceComparisonResult {
  productName: string;
  searchQuery: string;
  results: {
    site: string;
    products: ProductSearchResult[];
    bestMatch?: ProductSearchResult;
    searchTime: number;
    error?: string;
  }[];
  bestOverall?: {
    site: string;
    product: ProductSearchResult;
    reason: string;
  };
}

/**
 * POST - Compare prices for products across multiple sites
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, products, sites, taskId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Products array is required' },
        { status: 400 }
      );
    }

    // Determine which sites to search
    const searchSites = sites && Array.isArray(sites)
      ? sites.filter((s: string) => SUPPORTED_SITES.includes(s as any))
      : [...SUPPORTED_SITES];

    if (searchSites.length === 0) {
      return NextResponse.json(
        { error: `No valid sites. Supported: ${SUPPORTED_SITES.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[Shopping Agent] Comparing prices for ${products.length} products across ${searchSites.join(', ')}`);

    // Update task status if taskId provided
    if (taskId) {
      await supabase
        .from('shopping_agent_tasks')
        .update({
          status: 'searching',
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    }

    const browserController = new BrowserController({ headless: true });
    const comparisonResults: PriceComparisonResult[] = [];

    try {
      // Search for each product
      for (const product of products) {
        const productResult: PriceComparisonResult = {
          productName: product.name,
          searchQuery: buildSearchQuery(product),
          results: [],
        };

        // Search each site in parallel
        const siteResults = await Promise.allSettled(
          searchSites.map(async (site: string) => {
            const startTime = Date.now();
            try {
              const results = await browserController.searchProducts(
                site,
                productResult.searchQuery,
                {
                  maxResults: 5,
                  inStockOnly: true,
                }
              );

              // Find best match based on name similarity and price
              const bestMatch = findBestMatch(results, product);

              return {
                site,
                products: results,
                bestMatch,
                searchTime: Date.now() - startTime,
              };
            } catch (error: any) {
              console.error(`[Shopping Agent] Error searching ${site}:`, error);
              return {
                site,
                products: [],
                searchTime: Date.now() - startTime,
                error: error.message,
              };
            }
          })
        );

        // Process results
        for (const result of siteResults) {
          if (result.status === 'fulfilled') {
            productResult.results.push(result.value);
          }
        }

        // Determine best overall option
        productResult.bestOverall = determineBestOverall(productResult.results);

        comparisonResults.push(productResult);
      }
    } finally {
      await browserController.close();
    }

    // Update task with results if taskId provided
    if (taskId) {
      await supabase
        .from('shopping_agent_tasks')
        .update({
          status: 'comparing_prices',
          search_results: comparisonResults,
          search_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      // Calculate price comparison summary
      const priceComparison = comparisonResults.map(result => ({
        product: result.productName,
        bestSite: result.bestOverall?.site,
        bestPrice: result.bestOverall?.product.price,
        bestUrl: result.bestOverall?.product.url,
        reason: result.bestOverall?.reason,
      }));

      // Determine recommended site (most best matches)
      const siteCounts = priceComparison.reduce((acc, item) => {
        if (item.bestSite) {
          acc[item.bestSite] = (acc[item.bestSite] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const recommendedSite = Object.entries(siteCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      await supabase
        .from('shopping_agent_tasks')
        .update({
          status: 'awaiting_approval',
          price_comparison: priceComparison,
          recommended_site: recommendedSite,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    }

    // Build summary
    const summary = {
      totalProducts: products.length,
      sitesSearched: searchSites,
      recommendations: comparisonResults.map(r => ({
        product: r.productName,
        bestSite: r.bestOverall?.site || 'none found',
        bestPrice: r.bestOverall?.product.price,
        bestUrl: r.bestOverall?.product.url,
      })),
      estimatedTotal: comparisonResults.reduce(
        (sum, r) => sum + (r.bestOverall?.product.price || 0),
        0
      ),
    };

    return NextResponse.json({
      success: true,
      comparisons: comparisonResults,
      summary,
      taskId,
    });
  } catch (error) {
    console.error('[Shopping Agent] Error in compare-prices:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Build search query from product info
 */
function buildSearchQuery(product: any): string {
  const parts = [product.name];

  if (product.dosage) {
    parts.push(product.dosage);
  }

  if (product.brand) {
    parts.unshift(product.brand);
  }

  return parts.join(' ');
}

/**
 * Find best matching product from search results
 */
function findBestMatch(
  results: ProductSearchResult[],
  targetProduct: any
): ProductSearchResult | undefined {
  if (results.length === 0) return undefined;

  // Score each result
  const scored = results.map(result => {
    let score = 0;

    // Name similarity (simple word matching)
    const targetWords = targetProduct.name.toLowerCase().split(/\s+/);
    const resultWords = result.name.toLowerCase().split(/\s+/);
    const matchingWords = targetWords.filter((w: string) =>
      resultWords.some((rw: string) => rw.includes(w) || w.includes(rw))
    );
    score += (matchingWords.length / targetWords.length) * 50;

    // In stock bonus
    if (result.inStock) score += 20;

    // Rating bonus
    if (result.rating && result.rating >= 4) score += 10;
    if (result.rating && result.rating >= 4.5) score += 5;

    // Prime/free shipping bonus
    if (result.prime || result.freeShipping) score += 5;

    // Price factor (lower is better, but not too cheap which might be fake)
    if (result.price > 5 && result.price < 100) {
      score += 10;
    }

    // Dosage match (if specified)
    if (targetProduct.dosage) {
      if (result.name.toLowerCase().includes(targetProduct.dosage.toLowerCase())) {
        score += 15;
      }
    }

    return { result, score };
  });

  // Sort by score and return best
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.result;
}

/**
 * Determine best overall option across sites
 */
function determineBestOverall(
  siteResults: PriceComparisonResult['results']
): PriceComparisonResult['bestOverall'] | undefined {
  const validResults = siteResults.filter(r => r.bestMatch);

  if (validResults.length === 0) return undefined;

  // Score each site's best match
  const scored = validResults.map(r => {
    let score = 0;
    const product = r.bestMatch!;

    // Price (lower is better) - normalize to 0-40 points
    const prices = validResults.map(vr => vr.bestMatch?.price || 999);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (maxPrice > minPrice) {
      score += (1 - (product.price - minPrice) / (maxPrice - minPrice)) * 40;
    } else {
      score += 40;
    }

    // Rating bonus (0-20 points)
    if (product.rating) {
      score += (product.rating / 5) * 20;
    }

    // In stock (0-15 points)
    if (product.inStock) score += 15;

    // Free shipping / Prime (0-10 points)
    if (product.prime || product.freeShipping) score += 10;

    // Review count bonus (0-10 points)
    if (product.reviewCount && product.reviewCount > 100) score += 5;
    if (product.reviewCount && product.reviewCount > 1000) score += 5;

    // Search time (faster is slightly better) - 0-5 points
    const searchTimes = validResults.map(vr => vr.searchTime);
    const minTime = Math.min(...searchTimes);
    const maxTime = Math.max(...searchTimes);
    if (maxTime > minTime) {
      score += (1 - (r.searchTime - minTime) / (maxTime - minTime)) * 5;
    }

    return { site: r.site, product, score };
  });

  // Sort and return best
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (!best) return undefined;

  // Generate reason
  const reasons = [];
  if (best.product.price === Math.min(...validResults.map(r => r.bestMatch?.price || 999))) {
    reasons.push('lowest price');
  }
  if (best.product.rating && best.product.rating >= 4.5) {
    reasons.push('highly rated');
  }
  if (best.product.prime) {
    reasons.push('Prime eligible');
  }
  if (best.product.freeShipping) {
    reasons.push('free shipping');
  }

  return {
    site: best.site,
    product: best.product,
    reason: reasons.length > 0 ? reasons.join(', ') : 'best overall match',
  };
}

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
