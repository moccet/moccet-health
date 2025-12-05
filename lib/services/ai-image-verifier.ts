/**
 * AI Image Verification Service
 *
 * Uses Claude Vision API to verify that product images accurately match
 * the supplement product they represent. Prevents incorrect, irrelevant,
 * or low-quality images from being stored.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ImageVerificationResult {
  isMatch: boolean;
  confidence: number; // 0-100
  reasoning: string;
  issues: string[];
  recommendations?: string;
}

export interface ProductInfo {
  name: string;
  brand: string;
  dosageForm?: string; // e.g., "Capsule", "Softgel", "Powder"
  strength?: string;    // e.g., "1000mg", "5000 IU"
}

/**
 * Verify that an image URL matches the expected product
 *
 * @param imageUrl - URL of the image to verify
 * @param product - Product information to match against
 * @returns Verification result with confidence score and reasoning
 */
export async function verifyProductImage(
  imageUrl: string,
  product: ProductInfo
): Promise<ImageVerificationResult> {
  try {
    // Fetch the image first to convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return {
        isMatch: false,
        confidence: 0,
        reasoning: 'Failed to fetch image from URL',
        issues: [`HTTP ${imageResponse.status}: ${imageResponse.statusText}`],
      };
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Determine media type from URL or Content-Type header
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const mediaType = contentType.includes('png') ? 'image/png' : 'image/jpeg';

    // Construct detailed verification prompt
    const verificationPrompt = buildVerificationPrompt(product);

    // Call Claude Vision API
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: verificationPrompt,
            },
          ],
        },
      ],
    });

    // Parse Claude's response
    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude Vision API');
    }

    const result = parseVerificationResponse(textContent.text);
    return result;

  } catch (error) {
    console.error('Image verification error:', error);
    return {
      isMatch: false,
      confidence: 0,
      reasoning: 'Error during AI verification',
      issues: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Build detailed verification prompt for Claude Vision
 */
function buildVerificationPrompt(product: ProductInfo): string {
  const { name, brand, dosageForm, strength } = product;

  return `You are an expert at verifying supplement product images. Analyze this image and determine if it accurately represents the following product:

**Product Details:**
- Name: ${name}
- Brand: ${brand}
${dosageForm ? `- Dosage Form: ${dosageForm}` : ''}
${strength ? `- Strength: ${strength}` : ''}

**Verification Criteria:**
1. **Brand Match**: Does the image show the correct brand (${brand})? Check for brand name on label/packaging.
2. **Product Match**: Does it show ${name} specifically, not a different supplement?
3. **Product Type**: Is it an actual product photo (bottle/package) and not a lifestyle/promotional image?
4. **Quality**: Is the image clear, professional, and suitable for e-commerce display?
5. **Dosage Form**: ${dosageForm ? `Does it match the expected form (${dosageForm})?` : 'Can you identify the dosage form?'}

**Response Format (JSON):**
\`\`\`json
{
  "isMatch": true/false,
  "confidence": 0-100,
  "reasoning": "Brief explanation of your assessment",
  "issues": ["List any problems found"],
  "brandVisible": true/false,
  "productNameVisible": true/false,
  "isProductShot": true/false,
  "imageQuality": "excellent/good/fair/poor"
}
\`\`\`

Be strict: Only approve images with >70% confidence that accurately represent THIS specific product.`;
}

/**
 * Parse Claude Vision's verification response
 */
function parseVerificationResponse(responseText: string): ImageVerificationResult {
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                     responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      // Fallback: parse response as plain text
      return parseTextResponse(responseText);
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    return {
      isMatch: parsed.isMatch || false,
      confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
      reasoning: parsed.reasoning || 'No reasoning provided',
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      recommendations: buildRecommendations(parsed),
    };

  } catch (error) {
    console.error('Failed to parse verification response:', error);
    // Return conservative result on parse failure
    return {
      isMatch: false,
      confidence: 0,
      reasoning: 'Failed to parse AI response',
      issues: ['Response parsing error'],
    };
  }
}

/**
 * Fallback parser for non-JSON responses
 */
function parseTextResponse(text: string): ImageVerificationResult {
  const lowerText = text.toLowerCase();

  // Look for confidence indicators
  const hasPositiveIndicators = /match|correct|accurate|appropriate|suitable/i.test(text);
  const hasNegativeIndicators = /not match|incorrect|wrong|different|unsuitable/i.test(text);

  // Extract confidence if mentioned
  const confidenceMatch = text.match(/confidence[:\s]*(\d+)/i);
  const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) :
                    hasPositiveIndicators && !hasNegativeIndicators ? 60 : 20;

  return {
    isMatch: confidence >= 70,
    confidence,
    reasoning: text.substring(0, 200), // First 200 chars as reasoning
    issues: hasNegativeIndicators ? ['AI indicated potential mismatch'] : [],
  };
}

/**
 * Build recommendations based on verification details
 */
function buildRecommendations(parsed: any): string | undefined {
  const issues: string[] = [];

  if (!parsed.brandVisible) {
    issues.push('Brand not visible on product');
  }
  if (!parsed.productNameVisible) {
    issues.push('Product name not clearly visible');
  }
  if (!parsed.isProductShot) {
    issues.push('Use actual product photo instead of lifestyle image');
  }
  if (parsed.imageQuality === 'poor' || parsed.imageQuality === 'fair') {
    issues.push('Higher quality image recommended');
  }

  return issues.length > 0 ? issues.join('; ') : undefined;
}

/**
 * Batch verify multiple images (with rate limiting)
 *
 * @param items - Array of {imageUrl, product} to verify
 * @param delayMs - Delay between requests (default 500ms)
 * @returns Array of verification results
 */
export async function batchVerifyImages(
  items: Array<{ imageUrl: string; product: ProductInfo }>,
  delayMs: number = 500
): Promise<ImageVerificationResult[]> {
  const results: ImageVerificationResult[] = [];

  for (const item of items) {
    const result = await verifyProductImage(item.imageUrl, item.product);
    results.push(result);

    // Rate limiting delay (except for last item)
    if (items.indexOf(item) < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Quick validation: Check if image URL is likely valid before full verification
 */
export function isLikelyValidImageUrl(url: string | null | undefined): boolean {
  if (!url || url === '') return false;

  // Reject known placeholder patterns
  const invalidPatterns = [
    '/images/supplements/default.png',
    'dicebear.com',
    'placeholder',
    'example.com',
    'localhost',
  ];

  return !invalidPatterns.some(pattern => url.includes(pattern));
}
