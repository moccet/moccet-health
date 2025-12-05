/**
 * Test AI Web Scraping
 * GET /api/test-ai-scraping?brand=X&name=Y
 *
 * Test Claude's ability to find product images from retailers
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const brand = searchParams.get('brand') || 'Premium Select';
    const name = searchParams.get('name') || 'Omega-3 (EPA+DHA)';
    const dosageForm = searchParams.get('dosageForm');

    console.log(`[Test AI Scraping] Searching for: ${brand} ${name}`);

    const prompt = buildWebScrapingPrompt(brand, name, dosageForm);

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({
        success: false,
        error: 'No response from Claude',
      });
    }

    return NextResponse.json({
      success: true,
      rawResponse: textContent.text,
      prompt: prompt,
    });
  } catch (error) {
    console.error('[Test AI Scraping] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function buildWebScrapingPrompt(brand: string, name: string, dosageForm?: string | null): string {
  return `You are an expert at finding accurate supplement product images from verified retailers.

**Product to Find:**
- Brand: ${brand}
- Product Name: ${name}
${dosageForm ? `- Form: ${dosageForm}` : ''}

**Your Task:**
Search verified supplement retailers for this EXACT product. Focus on these trusted sources:
1. **Amazon.com** - Search: "amazon.com ${brand} ${name} supplement"
2. **iHerb.com** - Premium supplement retailer with verified products
3. **Vitacost.com** - Trusted supplement source
4. **Swanson.com** - Established supplement brand
5. **Thrive Market** - Natural products retailer

**Requirements:**
- Find the EXACT product (matching brand AND product name)
- Return a direct image URL from the product page
- Prefer product bottle/package images (not lifestyle photos)
- Verify the image shows the correct brand label
- Image must be high-quality and suitable for e-commerce

**Response Format (JSON only):**
\`\`\`json
{
  "found": true/false,
  "imageUrl": "direct URL to product image",
  "source": "retailer name (e.g., 'Amazon', 'iHerb')",
  "confidence": 0-100,
  "productUrl": "full product page URL for verification",
  "notes": "brief explanation of match quality"
}
\`\`\`

If you cannot find the EXACT product, return:
\`\`\`json
{
  "found": false,
  "confidence": 0,
  "notes": "Could not find exact match for ${brand} ${name}"
}
\`\`\`

**Important:**
- Only return URLs you are CONFIDENT point to the correct product
- Do not return generic supplement images
- Do not return images from untrusted sources
- Confidence should be >70 for acceptable matches`;
}
