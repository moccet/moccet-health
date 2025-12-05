# AI-Powered Product Image System

## Overview
Comprehensive AI-powered system for fetching, verifying, and displaying supplement product images in cart and checkout using Claude AI.

## Architecture

### Core Components

#### 1. AI Image Verifier (`lib/services/ai-image-verifier.ts`)
- **Purpose**: Uses Claude Vision to verify images match products
- **Key Features**:
  - Multi-criteria verification (brand match, product match, image quality)
  - Confidence scoring (0-100)
  - Detailed reasoning and issue tracking
  - Batch verification support with rate limiting

**Main Functions**:
```typescript
verifyProductImage(imageUrl, productInfo) -> ImageVerificationResult
batchVerifyImages(items, delayMs) -> ImageVerificationResult[]
isLikelyValidImageUrl(url) -> boolean
```

#### 2. AI Image Fetcher (`lib/services/product-image-fetcher.ts`)
- **Purpose**: Intelligently fetch and verify product images
- **Strategy**: Stock Images → AI Web Scraping → Verified Fallback
- **Features**:
  - Claude-powered web scraping from verified retailers
  - Automatic AI verification before saving
  - Confidence-based acceptance (minimum 70%)
  - Database status tracking

**Main Functions**:
```typescript
fetchProductImage(brand, name, existingUrl?, dosageForm?) -> string
updateAllProductImages(options) -> BatchResult
fetchSingleProductImage(productId) -> SingleResult
```

**AI Web Scraping**:
- Searches verified retailers: Amazon, iHerb, Vitacost, Swanson, Thrive Market
- Returns direct product image URLs
- Validates brand and product name matches
- Requires >70% confidence to accept

#### 3. Database Schema (`supabase/migrations/009_product_image_tracking.sql`)

**New Columns in `supplement_products`**:
```sql
- image_fetch_status: 'pending' | 'fetching' | 'success' | 'failed' | 'verified'
- image_confidence_score: DECIMAL (0-100)
- last_image_fetch_attempt: TIMESTAMPTZ
- image_verification_notes: TEXT
```

**Indexes**:
- `idx_supplement_products_image_status` - Query products by status
- `idx_supplement_products_image_confidence` - Find low-confidence images

### Frontend Components

#### 1. Shopping Cart (`components/ShoppingCart.tsx`)
**Features**:
- Displays actual product images with Next.js Image optimization
- Loading spinner during image fetch
- On-demand image fetching for missing images
- Graceful fallback to SVG placeholder on error

**Image Handling**:
```tsx
{item.imageLoading ? (
  <LoadingSpinner />
) : (
  <Image src={item.imageUrl} onError={fallbackToSVG} />
)}
```

#### 2. Checkout Page (`app/checkout/page.tsx`)
**Features**:
- Same loading state UI as shopping cart
- Optimized image display with Next.js Image
- Error handling with SVG fallback

### API Endpoints

#### 1. Ensure Image (On-Demand)
**Endpoint**: `POST /api/products/ensure-image`

**Request**:
```json
{
  "productId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "imageUrl": "https://...",
  "status": "fetched" | "existing",
  "confidence": 85
}
```

**Use Case**: Triggered automatically when cart items have `imageLoading: true`

#### 2. Batch Update (Admin)
**Endpoint**: `POST /api/admin/fix-existing-product-images`

**Request (Dry Run)**:
```json
{
  "dryRun": true,
  "minConfidence": 70
}
```

**Request (Full Update)**:
```json
{
  "verifyExisting": false,  // Only update missing images
  "minConfidence": 70
}
```

**Request (Re-verify All)**:
```json
{
  "verifyExisting": true,   // Re-verify existing images
  "minConfidence": 80       // Higher quality threshold
}
```

**Response**:
```json
{
  "success": true,
  "verified": 45,      // High-confidence matches
  "lowConfidence": 5,  // Below threshold but saved
  "failed": 2,         // Could not fetch
  "total": 52
}
```

#### 3. Image Statistics
**Endpoint**: `GET /api/admin/fix-existing-product-images`

**Response**:
```json
{
  "stats": {
    "total": 100,
    "verified": 70,
    "success": 15,
    "pending": 10,
    "failed": 5
  },
  "needingAttention": [
    {
      "product": "NOW Foods Vitamin D3",
      "status": "pending",
      "confidence": 0,
      "hasImage": false
    }
  ]
}
```

## Configuration

### Environment Variables Required
```bash
# Required for AI verification and web scraping
ANTHROPIC_API_KEY=sk-ant-...

# Database (already configured)
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Next.js Image Configuration
Added to `next.config.ts`:
```typescript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'images.unsplash.com' },
    { protocol: 'https', hostname: 's3.images-iherb.com' },
    { protocol: 'https', hostname: '**.amazonaws.com' },
    { protocol: 'https', hostname: 'm.media-amazon.com' },
    { protocol: 'https', hostname: 'images-na.ssl-images-amazon.com' },
  ]
}
```

## Usage Guide

### 1. Run Database Migration
```bash
# Apply the migration to add tracking columns
supabase db push
```

### 2. Batch Update Existing Products

**Preview Changes (Dry Run)**:
```bash
curl -X POST http://localhost:3000/api/admin/fix-existing-product-images \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Update All Missing Images**:
```bash
curl -X POST http://localhost:3000/api/admin/fix-existing-product-images \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Re-verify All Images (High Quality)**:
```bash
curl -X POST http://localhost:3000/api/admin/fix-existing-product-images \
  -H "Content-Type: application/json" \
  -d '{"verifyExisting": true, "minConfidence": 85}'
```

### 3. Check Statistics
```bash
curl http://localhost:3000/api/admin/fix-existing-product-images
```

### 4. On-Demand Image Fetching
Automatically triggered when users view their cart:
- Cart service checks `imageLoading` flag
- Frontend calls `/api/products/ensure-image` in background
- Image updates live when fetched

## How It Works

### Image Fetch Workflow

```
1. User views cart/checkout
   ↓
2. Cart service checks each product's image
   ↓
3. If image missing/invalid:
   - Set imageLoading: true
   - Return placeholder image
   ↓
4. Frontend triggers on-demand fetch
   ↓
5. AI Image Fetcher:
   a. Check stock images (instant)
   b. If not found, use Claude to web scrape
   c. Claude searches verified retailers
   d. Returns image URL with confidence
   ↓
6. AI Image Verifier:
   a. Fetch image, convert to base64
   b. Send to Claude Vision
   c. Verify brand, product, quality
   d. Return confidence score + reasoning
   ↓
7. If confidence ≥ 70%:
   - Save to database
   - Update status to 'verified'
   - Return to frontend
   ↓
8. Frontend updates image display
   - Remove loading spinner
   - Show actual product image
```

### Verification Criteria

Claude Vision checks:
1. **Brand Match**: Brand name visible on product label
2. **Product Match**: Correct supplement name (not different product)
3. **Product Type**: Actual product photo (not lifestyle/promotional)
4. **Image Quality**: Clear, professional, e-commerce suitable
5. **Dosage Form**: Matches expected form (capsule, powder, etc.)

**Confidence Levels**:
- **85-100%**: Verified - Exact match, all criteria met
- **70-84%**: Success - Good match, acceptable quality
- **50-69%**: Low Confidence - Saved but flagged for review
- **0-49%**: Failed - Not saved, remains placeholder

## Fallback Strategy

```
Priority 1: Stock Images (85% confidence)
  ├─ Curated Unsplash URLs for common supplements
  ├─ Instant, no API calls
  └─ Covers ~20 popular supplements

Priority 2: AI Web Scraping (70-95% confidence)
  ├─ Claude searches verified retailers
  ├─ Finds exact product match
  └─ Returns direct image URL

Priority 3: AI Verification (validates Priority 2)
  ├─ Claude Vision inspects image
  ├─ Verifies brand/product match
  └─ Only saves if confidence ≥ 70%

Priority 4: Stock Image Fallback (if available)
  └─ Use stock image even with lower confidence

Priority 5: Generic Placeholder
  └─ /images/supplements/default.svg
```

## Performance Optimization

### Rate Limiting
- **AI Web Scraping**: 500ms between requests
- **AI Verification**: No additional delay (included in fetch)
- **Batch Updates**: 500ms per product (prevents API throttling)

### Caching Strategy
1. **Database Cache**: Verified images stored with confidence scores
2. **Skip Re-fetch**: Products with valid images not re-processed
3. **Next.js Image Optimization**: Automatic resizing, caching, WebP conversion

### Cost Management
- **Stock Images**: Free, no API calls
- **Claude API**: ~$0.02 per image (web scrape + verification)
- **Batch Operation**: ~$1-2 for 100 products

## Monitoring & Debugging

### Check Image Status
```sql
SELECT
  image_fetch_status,
  COUNT(*) as count,
  AVG(image_confidence_score) as avg_confidence
FROM supplement_products
GROUP BY image_fetch_status;
```

### Find Low-Confidence Images
```sql
SELECT brand, name, image_confidence_score, image_verification_notes
FROM supplement_products
WHERE image_confidence_score < 70
ORDER BY image_confidence_score ASC;
```

### Recent Fetch Attempts
```sql
SELECT brand, name, image_fetch_status, last_image_fetch_attempt
FROM supplement_products
WHERE last_image_fetch_attempt > NOW() - INTERVAL '1 day'
ORDER BY last_image_fetch_attempt DESC;
```

## Troubleshooting

### Images Not Loading in Cart
1. Check browser console for errors
2. Verify Next.js config allows image domain
3. Check product has `imageLoading: false` and valid URL

### AI Verification Failing
1. Verify `ANTHROPIC_API_KEY` is set
2. Check Claude API quota/rate limits
3. Review `image_verification_notes` in database

### Batch Update Slow
- Normal: 500ms per product (rate limiting)
- 100 products ≈ 50 seconds
- Consider running during off-hours

### High Failure Rate
1. Check AI web scraping prompt effectiveness
2. Review failed products in database
3. Consider adjusting `minConfidence` threshold

## Future Enhancements

### Planned Features
- [ ] Admin dashboard for manual image review
- [ ] Bulk image upload from CSV
- [ ] Multiple image support (thumbnails, full-size)
- [ ] CDN integration (Cloudflare Images)
- [ ] Periodic re-verification job (monthly)

### Optimization Ideas
- [ ] Pre-fetch images for top 100 products
- [ ] Implement image compression pipeline
- [ ] Add WebP/AVIF format support
- [ ] Cache AI responses to reduce API costs

## Security Considerations

- **API Keys**: Never expose `ANTHROPIC_API_KEY` to client
- **Rate Limiting**: Prevent abuse with request throttling
- **Input Validation**: Sanitize all product IDs and URLs
- **Image Sources**: Only allow verified retailer domains
- **Admin Endpoints**: Protect with authentication middleware

## Support

For issues or questions:
1. Check logs: `[AI Image Fetcher]` and `[Image Verifier]` prefixes
2. Review database: `image_verification_notes` column
3. Test single product: `POST /api/products/ensure-image`
4. Run diagnostics: `GET /api/admin/fix-existing-product-images`
