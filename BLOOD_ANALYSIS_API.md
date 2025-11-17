# Blood Analysis API Documentation

## Overview

The Blood Analysis API provides comprehensive analysis of blood test results from PDF files, extracting biomarkers, providing clinical interpretations, and generating personalized recommendations.

## API Endpoint

**POST** `/api/analyze-blood-results`

### Request

The endpoint accepts `multipart/form-data` with the following fields:

- `bloodTest` (File, required): PDF file containing blood test results
- `email` (string, optional): User email for personalized analysis and caching

### Example Usage

```javascript
const formData = new FormData();
formData.append('bloodTest', bloodTestFile);
formData.append('email', 'user@example.com');

const response = await fetch('/api/analyze-blood-results', {
  method: 'POST',
  body: formData
});

const result = await response.json();
```

### Response

```json
{
  "success": true,
  "analysis": {
    "summary": "Overall assessment of blood work",
    "biomarkers": [
      {
        "name": "Vitamin D",
        "value": "45 ng/mL",
        "referenceRange": "30-100 ng/mL",
        "status": "Normal",
        "significance": "Important for bone health and immune function",
        "implications": "Current level supports healthy immune function"
      }
    ],
    "concerns": [
      "LDL cholesterol slightly elevated"
    ],
    "positives": [
      "HDL cholesterol in optimal range"
    ],
    "recommendations": {
      "lifestyle": [
        "Increase cardiovascular exercise to 150 minutes per week"
      ],
      "dietary": [
        "Reduce saturated fat intake to <7% of daily calories"
      ],
      "supplements": [
        "Consider omega-3 supplementation (1000-2000mg EPA/DHA)"
      ],
      "followUp": [
        "Complete lipid panel in 3 months"
      ],
      "retestTiming": "3 months"
    },
    "personalizedNotes": [
      "Based on your age and fitness goals, focus on cardiovascular health"
    ]
  }
}
```

## GET Endpoint

**GET** `/api/analyze-blood-results?email={email}`

Retrieves cached blood analysis for a user.

### Response

```json
{
  "success": true,
  "analysis": { /* Same structure as POST response */ }
}
```

## Features

### 1. PDF Text Extraction
- Automatically extracts text from blood test PDF files
- Uses PDF.js for accurate text extraction
- Handles multi-page documents

### 2. AI-Powered Analysis
- Uses GPT-4 to analyze biomarkers
- Provides clinical significance for each marker
- Identifies optimal vs. normal ranges (longevity-focused)

### 3. Personalized Recommendations
- Integrates user profile data (age, gender, health goals)
- Provides targeted lifestyle and dietary interventions
- Suggests follow-up tests and timing

### 4. Biomarker Status Classification
- **Optimal**: Marker in ideal range for longevity
- **Normal**: Within standard reference range
- **Borderline**: Approaching concerning levels
- **High/Low**: Outside normal range, needs attention

### 5. Caching
- Stores analysis in memory (dev mode) or Supabase (production)
- Prevents redundant API calls for the same user
- Enables quick retrieval on subsequent page loads

## Integration with Sage Personalized Plan

The blood analysis is automatically integrated into the Sage personalized plan page:

1. When a user visits `/sage/personalised-plan?email={email}`, the page:
   - Fetches the user's nutrition plan
   - Fetches personalized insights
   - Fetches detailed meal plan
   - **NEW**: Fetches blood analysis (if available)

2. The blood analysis section displays:
   - Overall summary
   - Individual biomarker cards with status badges
   - Areas of concern vs. positive findings
   - Comprehensive recommendations
   - Personalized notes based on user profile

## UI Components

### Blood Analysis Section Structure

```tsx
<section className="blood-analysis-section">
  {/* Overall Summary */}
  <div className="blood-summary">
    <h3>Overall Summary</h3>
    <p>{summary}</p>
  </div>

  {/* Biomarkers Grid */}
  <div className="biomarkers-grid">
    {biomarkers.map(marker => (
      <div className="biomarker-card status-{optimal|normal|borderline|high|low}">
        <h4>{marker.name}</h4>
        <span className="status-badge">{marker.status}</span>
        <div className="biomarker-value">{marker.value}</div>
        <p>{marker.significance}</p>
        <p>{marker.implications}</p>
      </div>
    ))}
  </div>

  {/* Findings Grid */}
  <div className="findings-grid">
    <div className="concerns-card">/* Concerns */</div>
    <div className="positives-card">/* Positives */</div>
  </div>

  {/* Recommendations */}
  <div className="recommendations-section">
    {/* Lifestyle, Dietary, Supplements, Follow-up */}
  </div>
</section>
```

## Styling

The blood analysis section includes:
- Color-coded biomarker cards based on status
- Responsive grid layouts
- Status badges (optimal=green, normal=blue, borderline=yellow, high/low=red)
- Separate styling for concerns (red accent) vs positives (green accent)
- Mobile-responsive design

## Technical Implementation

### PDF Processing
```typescript
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdfDocument = await loadingTask.promise;
  // Extract text from all pages
}
```

### User Context Integration
```typescript
// Fetches user profile from dev storage or Supabase
const devData = devOnboardingStorage.get(email);
if (devData?.form_data) {
  // Include user age, gender, health goals in AI prompt
}
```

### AI Analysis
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [/* Clinical analysis prompt */],
  temperature: 0.7,
  max_tokens: 4000,
  response_format: { type: 'json_object' }
});
```

## Error Handling

The API handles various error scenarios:
- Missing blood test file (400)
- PDF extraction failure (400)
- Invalid PDF content (400)
- AI analysis failure (500)
- Database storage errors (logged but non-blocking)

## Future Enhancements

1. **Trend Analysis**: Track biomarker changes over time
2. **Image OCR**: Support scanned blood test images
3. **Multi-format Support**: Accept CSV, JSON lab results
4. **Interactive Charts**: Visualize biomarker trends
5. **Reference Range Customization**: Age/gender-specific ranges
6. **Integration Alerts**: Notify users of concerning markers

## Development Notes

- The API works in both dev mode (in-memory storage) and production (Supabase)
- Set `FORCE_DEV_MODE=true` to use in-memory storage even with Supabase configured
- PDF.js worker is configured for server-side execution
- All AI responses are validated and sanitized before storage

## Testing

To test the blood analysis:

1. Upload a blood test PDF via the onboarding flow
2. Visit `/sage/personalised-plan?email={your-email}`
3. The blood analysis section will appear at the top of the plan

Alternatively, use the POST endpoint directly:
```bash
curl -X POST http://localhost:3000/api/analyze-blood-results \
  -F "bloodTest=@path/to/blood-test.pdf" \
  -F "email=test@example.com"
```
