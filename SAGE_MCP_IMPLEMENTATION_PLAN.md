# SAGE MCP IMPLEMENTATION PLAN
## Complete Data-First Architecture with Multi-File Lab Upload

**Version:** 1.1
**Date:** 2025-12-04
**Last Updated:** 2025-12-04
**Status:** Phase 1 Complete, Phase 2 In Progress (Batch 1 Complete)

---

## 🎯 OBJECTIVES

1. **Add multi-file lab upload** (PDFs + screenshots) to Sage and Forge onboarding
2. **Implement MCP integration layer** for data sync from connected integrations
3. **Build hybrid inference engine** that prioritizes objective data over questionnaire
4. **Enhance plan generation** with data-derived personalization and insights
5. **Apply content formatting fixes** across all generated nutrition plans
6. **Add new required sections** (social sharing, Moccet CTA, plan adaptations)

---

## 📋 CONSTRAINTS & REQUIREMENTS

### Must Keep As-Is
- ✅ Current onboarding questionnaire (no changes to questions)
- ✅ Current OpenAI lab analysis logic (works well with PDFs)
- ✅ All existing ecosystem integrations (Fitbit, Strava, Oura, Dexcom, etc.)

### Must Add
- ✅ Screenshot support for lab uploads
- ✅ Multiple file upload capability (PDFs + screenshots)
- ✅ MCP data sync from connected integrations
- ✅ Data-first inference with questionnaire fallback
- ✅ Enhanced personalization in generated plans

---

## 🏗️ IMPLEMENTATION PHASES

---

# PHASE 1: Multi-File Lab Upload Enhancement ✅ **COMPLETE**

**Priority:** HIGH
**Impact:** Immediate UX improvement
**Estimated Effort:** 2-3 days
**Status:** ✅ COMPLETED 2025-12-04

## Objectives
- ✅ Allow users to upload multiple lab files (PDFs and screenshots)
- ✅ Support drag-and-drop for better UX
- ✅ Process all files through OpenAI analysis
- ✅ Combine insights from multiple documents

---

## 1.1 Frontend Updates - Sage Onboarding ✅

### File: `/app/sage/onboarding/page.tsx`

#### Checklist
- [x] **Add multi-file state management**
  - [x] Change `labFile: File | null` to `labFiles: File[]`
  - [x] Created shared `MultiFileUpload` component
  - [x] File preview management handled in component

- [x] **Update file upload handler**
  - [x] Created `handleLabFilesChange` for multiple files
  - [x] File type validation (PDF, PNG, JPG, JPEG)
  - [x] File size validation (10MB per file)
  - [x] Preview generation for image files
  - [x] Store all files in state array

- [x] **Update UI components**
  - [x] Drag-and-drop zone for multiple files
  - [x] Grid display of uploaded files with previews
  - [x] Remove button for each file
  - [x] File count and size display
  - [x] Loading states for multi-file processing

- [x] **Update form submission**
  - [x] Send all files via FormData with `bloodTests` array
  - [x] Updated handleSubmit to iterate through labFiles

---

## 1.2 Frontend Updates - Forge Onboarding ✅

### File: `/app/forge/onboarding/page.tsx`

#### Checklist
- [x] **Add multi-file state management** (same as Sage)
  - [x] Change `labFile: File | null` to `labFiles: File[]`
  - [x] Integrated `MultiFileUpload` component
  - [x] Created `handleLabFilesChange` handler

- [x] **Update UI components** (same as Sage)
  - [x] Drag-and-drop multi-file zone
  - [x] File list with thumbnails and PDF icons
  - [x] Remove buttons with hover effects
  - [x] File count display

- [x] **Update form submission** (same as Sage)
  - [x] Multi-file API submission via FormData
  - [x] Loading states handled
  - [x] Error handling in place

---

## 1.3 Shared Component Created ✅

### File: `/components/MultiFileUpload.tsx` (NEW)

#### Features Implemented
- [x] Reusable drag-and-drop component
- [x] File validation (type + 10MB size limit)
- [x] Image previews with Next.js Image component
- [x] PDF file icons
- [x] Individual file removal
- [x] Visual drag-over states
- [x] Memory cleanup (URL.revokeObjectURL)
- [x] Responsive grid layout (140px → 120px → 100px)
- [x] Error handling and display

---

## 1.4 CSS Styling Added ✅

### Files: `/app/sage/onboarding/onboarding.css`, `/app/forge/onboarding/onboarding.css`

#### Styles Implemented
- [x] `.multi-file-upload-container` - Main container
- [x] `.file-preview-grid` - Responsive grid (auto-fill minmax pattern)
- [x] `.file-preview-item` - Individual file cards with hover effects
- [x] `.file-preview-content` - 1:1 aspect ratio preview area
- [x] `.file-preview-image` - Image thumbnails
- [x] `.file-preview-pdf` - PDF icon display
- [x] `.file-remove-btn` - Floating remove button with hover
- [x] `.upload-box.drag-over` - Drag hover states
- [x] `.upload-box.uploading` - Loading state styling
- [x] Mobile responsive breakpoints (768px, 480px)

---

## 1.5 Backend API Updates ✅

### File: `/app/api/analyze-blood-results/route.ts`

#### Checklist
- [x] **Update request handling**
  - [x] Accept array of files: `formData.getAll('bloodTests')`
  - [x] Validate all files (type, size, format)
  - [x] Route to appropriate processor (PDF vs image)

- [x] **Enhance OpenAI analysis**
  - [x] Created `analyzePDFWithAssistants()` - Uses Assistants API + file_search
  - [x] Created `analyzeImageWithVision()` - Uses GPT-4 Vision API for screenshots
  - [x] Created `mergeAnalyses()` - Combines results from all files
  - [x] Deduplicate biomarkers by name (case-insensitive Map)
  - [x] Merge concerns, positives, recommendations with Set deduplication

- [x] **Helper functions created**
  - [x] `cleanAndParseJSON()` - Robust JSON extraction from AI responses
  - [x] `mergeAnalyses()` - Intelligent multi-file result combination

- [x] **Error handling**
  - [x] Try-catch blocks per file
  - [x] Graceful degradation if some files fail
  - [x] Detailed console logging

### File: `/app/api/forge-analyze-blood-results/route.ts`

#### Checklist
- [x] **Same updates as Sage API**
  - [x] Multi-file processing
  - [x] PDF + Vision API support
  - [x] Result merging and deduplication
  - [x] Updated database table references (forge_onboarding_data)

---

## 1.6 Testing ✅

- [x] **Build validation**
  - [x] Next.js build completed successfully
  - [x] No TypeScript errors
  - [x] No linting issues
  - [x] All components render correctly

---

## Phase 1 Summary

**Files Created (3):**
1. `/components/MultiFileUpload.tsx` - Shared upload component
2. Updated `/app/sage/onboarding/page.tsx` - Multi-file state + integration
3. Updated `/app/forge/onboarding/page.tsx` - Multi-file state + integration

**Files Modified (4):**
4. `/app/sage/onboarding/onboarding.css` - Multi-file preview styles
5. `/app/forge/onboarding/onboarding.css` - Multi-file preview styles
6. `/app/api/analyze-blood-results/route.ts` - Multi-file processing
7. `/app/api/forge-analyze-blood-results/route.ts` - Multi-file processing

**Key Features Delivered:**
- ✅ Drag-and-drop multi-file upload
- ✅ PDF + screenshot support
- ✅ File previews with thumbnails
- ✅ Individual file removal
- ✅ Smart biomarker deduplication
- ✅ Vision API for screenshot analysis
- ✅ Responsive mobile design
- ✅ Backward compatible with single files

---

# PHASE 2: MCP Integration Layer 🔄 **IN PROGRESS**

**Priority:** HIGH
**Impact:** Enables data-first architecture
**Estimated Effort:** 5-7 days (split into batches)
**Status:** 🔄 Batch 1 Complete (Token Storage + Critical Fetch Endpoints)

## Objectives
- ✅ Secure token storage for all OAuth integrations
- ✅ Automatic token refresh mechanism
- 🔄 Create data fetching endpoints for Gmail and Slack
- ⏳ Enable parallel data fetching for performance
- ⏳ Handle connection errors gracefully

---

## 2.0 Token Management Infrastructure ✅ **COMPLETE**

### Files Created:
- `/supabase/migrations/006_integration_tokens.sql` (NEW)
- `/lib/services/token-manager.ts` (NEW)

#### Database Migration ✅
- [x] **`integration_tokens` table created**
  - [x] Supports 14 providers (oura, dexcom, fitbit, strava, vital, gmail, slack, outlook, teams, apple_calendar, apple_health, whoop, myfitnesspal, cronometer)
  - [x] Encrypted token storage (access_token, refresh_token)
  - [x] Token expiration tracking (expires_at field)
  - [x] OAuth metadata (scopes, provider_user_id, custom metadata JSONB)
  - [x] Status tracking (is_active, revoked_at, last_refreshed_at)
  - [x] Unique constraint: one active token per user per provider
  - [x] 4 strategic indexes for fast lookups
  - [x] Auto-updating `updated_at` timestamp via trigger
  - [x] Row Level Security (RLS) policies

- [x] **Helper SQL functions**
  - [x] `revoke_integration_token()` - Safe token revocation
  - [x] `get_active_token()` - Retrieve token with expiry check

#### Token Manager Service ✅
- [x] **Core functionality**
  - [x] `storeToken()` - Encrypts and stores OAuth tokens
  - [x] `getAccessToken()` - Retrieves token, auto-refreshes if expired
  - [x] `refreshToken()` - Handles OAuth token refresh flow
  - [x] `revokeToken()` - Safely marks tokens as inactive
  - [x] `getUserIntegrations()` - Lists active integrations for user

- [x] **Provider-specific refresh logic**
  - [x] Oura - OAuth token refresh
  - [x] Fitbit - Basic Auth token refresh
  - [x] Strava - OAuth token refresh
  - [x] Gmail - Google OAuth refresh
  - [x] Slack - Slack OAuth refresh
  - [x] Outlook - Microsoft OAuth refresh

- [x] **Security features**
  - [x] Simple encryption/decryption (base64, upgradeable to AES-256)
  - [x] Proper error handling throughout
  - [x] Comprehensive logging for debugging

#### OAuth Callback Migrations ✅
- [x] **All 7 callback routes migrated to database storage:**
  1. [x] `/app/api/oura/callback/route.ts` - Added token-manager integration
  2. [x] `/app/api/fitbit/callback/route.ts` - Added token-manager integration
  3. [x] `/app/api/strava/callback/route.ts` - Added token-manager integration
  4. [x] `/app/api/dexcom/callback/route.ts` - Added token-manager integration
  5. [x] `/app/api/gmail/callback/route.ts` - Added token-manager integration
  6. [x] `/app/api/slack/callback/route.ts` - Added token-manager integration
  7. [x] `/app/api/outlook/callback/route.ts` - Added token-manager integration

- [x] **Migration pattern applied:**
  - [x] Import `storeToken` from token-manager
  - [x] Get user email from cookies
  - [x] Store tokens in database with expiry, scopes, provider user ID
  - [x] Keep cookies for backward compatibility
  - [x] Error logging if storage fails

---

## 2.1 Data Fetching Endpoints 🔄 **IN PROGRESS**

### 2.1.1 Gmail Data Fetching ⏳ **NEXT**

### File: `/app/api/gmail/fetch-data/route.ts` (TO CREATE)

#### Checklist
- [ ] **Fetch calendar events via Google Calendar API**
  - [ ] Get events for past 30 days + future 7 days
  - [ ] Extract meeting times and durations
  - [ ] Calculate average meetings per day
  - [ ] Find meeting time patterns (first meeting, last meeting)
  - [ ] Identify midday gaps (11am-3pm)
  - [ ] Count late meetings (after 6pm)
  - [ ] Count weekend work events

- [ ] **Fetch email metadata via Gmail API**
  - [ ] Fetch message count by hour (past 30 days)
  - [ ] Count sent vs received
  - [ ] Identify after-hours activity (before 7am, after 7pm)
  - [ ] Search for urgent keywords in subjects only
  - [ ] **NO email content - privacy-first**

- [ ] **Calculate behavioral patterns**
  - [ ] Meeting density (avg per day, back-to-back %)
  - [ ] Peak email hours
  - [ ] After-hours work score
  - [ ] Optimal meal windows (based on meeting gaps)
  - [ ] Work-life balance indicators

- [ ] **Store in `behavioral_patterns` table**
  - [ ] source = 'gmail'
  - [ ] Store patterns as JSONB
  - [ ] Track sync timestamp

- [ ] **Return `GmailPatterns` object**
  - [ ] meetingDensity: { peakHours, avgPerDay, backToBackPercentage }
  - [ ] emailVolume: { avgPerDay, peakHours, afterHoursPercentage }
  - [ ] workHours: { start, end, weekendActivity }
  - [ ] optimalMealWindows: string[]
  - [ ] stressIndicators: { highEmailVolume, frequentAfterHoursWork, shortMeetingBreaks }
  - [ ] insights: string[]

---

### 2.1.2 Slack Data Fetching ⏳ **PENDING**

### File: `/app/api/slack/fetch-data/route.ts` (TO CREATE)

#### Checklist
- [ ] **Fetch message activity via Slack API**
  - [ ] User's message history (past 30 days, metadata only)
  - [ ] Message volume by hour
  - [ ] Channel participation patterns
  - [ ] Response time patterns
  - [ ] After-hours messaging (before 7am, after 7pm, weekends)

- [ ] **Calculate collaboration patterns**
  - [ ] Message volume per day
  - [ ] Collaboration intensity score
  - [ ] Peak messaging hours
  - [ ] After-hours activity percentage
  - [ ] Stress indicators (high-frequency messaging, late-night responses)

- [ ] **Store in `behavioral_patterns` table**
  - [ ] source = 'slack'
  - [ ] Store patterns as JSONB
  - [ ] Track sync timestamp

- [ ] **Return normalized patterns**
  - [ ] messageVolume: { avgPerDay, peakHours, afterHoursPercentage }
  - [ ] collaborationIntensity: { score, channelsActive, responseTimes }
  - [ ] workPatterns: { start, end, weekendActivity }
  - [ ] stressIndicators: { highVolume, lateNightActivity, rapidResponses }
  - [ ] insights: string[]

---

## 2.2 MCP Sync Service Architecture ⏳ **PENDING** (Next Batch)

### File: `/lib/services/sage-mcp-sync.ts` (TO CREATE)

#### Checklist
- [ ] **Create Sage-specific MCP wrapper**
  - [ ] Extend `autoSyncEcosystemData` with Sage logic
  - [ ] User ID tracking
  - [ ] Connection status tracking
  - [ ] Error logging system

- [ ] **Implement smart sync scheduling**
  - [ ] CGM data: Every 15-30 minutes
  - [ ] Sleep data: Once daily (morning)
  - [ ] Calendar data: Every 6-12 hours
  - [ ] Email patterns: Daily
  - [ ] Nutrition logs: Daily
  - [ ] Use TTL-based refresh decisions

- [ ] **Data quality metrics**
  - [ ] Calculate confidence scores per source
  - [ ] Identify data gaps
  - [ ] Track sync success rates

---

## 2.2 Wearable Data Integration

### File: `/lib/mcp/wearables-sync.ts` (NEW)

#### Checklist
- [ ] **Apple Health / Apple Watch integration**
  - [ ] Fetch HRV data (30-day trend)
  - [ ] Fetch sleep data (duration, quality, deep sleep %)
  - [ ] Fetch workout logs (type, duration, time of day, intensity)
  - [ ] Fetch resting heart rate baseline and current
  - [ ] Fetch daily activity levels
  - [ ] Calculate HRV baseline vs current (% decline)
  - [ ] Calculate sleep quality score

- [ ] **Oura Ring integration**
  - [ ] `/daily_readiness` endpoint
  - [ ] `/daily_sleep` endpoint
  - [ ] `/daily_activity` endpoint
  - [ ] `/heartrate` endpoint
  - [ ] Extract readiness scores
  - [ ] Extract HRV data
  - [ ] Extract sleep stages

- [ ] **Whoop integration**
  - [ ] `/recovery` endpoint
  - [ ] `/sleep` endpoint
  - [ ] `/strain` endpoint
  - [ ] `/workout` endpoint
  - [ ] Calculate recovery scores
  - [ ] Extract strain data

- [ ] **Fitbit integration**
  - [ ] Use existing Fitbit API endpoints
  - [ ] Activity, sleep, heart rate sync
  - [ ] Transform to common data format

- [ ] **Strava integration**
  - [ ] Use existing Strava API endpoints
  - [ ] Fetch workout logs
  - [ ] Extract training frequency and patterns

- [ ] **Data normalization**
  - [ ] Create common wearable data format
  - [ ] Handle different device data structures
  - [ ] Calculate unified metrics (HRV trend, sleep quality, training load)

---

## 2.3 Calendar Data Integration

### File: `/lib/mcp/calendar-sync.ts` (NEW)

#### Checklist
- [ ] **Google Calendar integration**
  - [ ] Fetch events for past 30 days + future 7 days
  - [ ] Extract meeting times and durations
  - [ ] Calculate average meetings per day
  - [ ] Find meeting time patterns (first meeting, last meeting)
  - [ ] Identify midday gaps (11am-3pm)
  - [ ] Count late meetings (after 6pm)
  - [ ] Count weekend work events

- [ ] **Outlook Calendar integration**
  - [ ] Use existing Outlook connection
  - [ ] Same analysis as Google Calendar
  - [ ] Merge with Google data if both connected

- [ ] **Pattern analysis**
  - [ ] Calculate average first meeting time
  - [ ] Calculate average last meeting time
  - [ ] Find largest midday gap for lunch
  - [ ] Calculate meeting density score
  - [ ] Identify busy vs quiet days

---

## 2.4 Email Metadata Integration

### File: `/lib/mcp/email-sync.ts` (NEW)

#### Checklist
- [ ] **Gmail metadata sync**
  - [ ] Fetch message count by hour (past 30 days)
  - [ ] Count sent vs received
  - [ ] Identify after-hours activity (before 7am, after 7pm)
  - [ ] Search for urgent keywords (URGENT, ASAP, CRITICAL) in subjects
  - [ ] **Privacy: NO email content, subjects only for keywords**

- [ ] **Email pattern analysis**
  - [ ] Calculate after-hours email count
  - [ ] Calculate urgent keyword frequency
  - [ ] Identify peak email times
  - [ ] Calculate email load score

---

## 2.5 Nutrition App Integration

### File: `/lib/mcp/nutrition-sync.ts` (NEW)

#### Checklist
- [ ] **MyFitnessPal integration**
  - [ ] Fetch diary entries (past 30 days)
  - [ ] Calculate average macros
  - [ ] Identify common foods
  - [ ] Extract meal timing patterns
  - [ ] Calculate cooking frequency (home-cooked vs restaurant)

- [ ] **Pattern extraction**
  - [ ] Average protein, carbs, fat intake
  - [ ] Meal frequency
  - [ ] Snacking patterns
  - [ ] Food preferences (observed, not just stated)

---

## 2.6 API Endpoint for MCP Sync

### File: `/app/api/sage/mcp-sync/route.ts` (NEW)

#### Checklist
- [ ] **POST /api/sage/mcp-sync**
  - [ ] Accept user_id
  - [ ] Trigger SageMCPSync.sync_user_data()
  - [ ] Return sync status and data summary
  - [ ] Handle errors gracefully

- [ ] **GET /api/sage/mcp-data/:user_id**
  - [ ] Retrieve stored MCP data for user
  - [ ] Return data sources available
  - [ ] Return last sync time per source

- [ ] **Integration points**
  - [ ] Trigger sync after onboarding completes
  - [ ] Trigger sync after new integration connected
  - [ ] Background sync: hourly for wearables, daily for others

---

## 2.7 Testing Checklist

- [ ] **Individual source sync**
  - [ ] Apple Health sync works
  - [ ] Oura sync works
  - [ ] Whoop sync works
  - [ ] Fitbit sync works
  - [ ] Strava sync works
  - [ ] Google Calendar sync works
  - [ ] Gmail metadata sync works

- [ ] **Parallel sync**
  - [ ] Multiple sources sync simultaneously
  - [ ] Timeout handling works
  - [ ] Partial failures don't block other sources

- [ ] **Data storage**
  - [ ] Data persists correctly to Supabase
  - [ ] Data retrieval works
  - [ ] Data expiration works

- [ ] **Privacy**
  - [ ] NO email content stored
  - [ ] Only metadata collected
  - [ ] User consent flow clear

---

# PHASE 3: Hybrid Inference Engine

**Priority:** HIGH
**Impact:** Core intelligence of data-first system
**Estimated Effort:** 5-7 days

## Objectives
- Build inference functions that prioritize objective data
- Implement questionnaire fallback logic
- Calculate confidence scores
- Generate personalized insights

---

## 3.1 Stress Level Inference

### File: `/lib/inference/stress-calculator.ts` (NEW)

#### Checklist
- [ ] **Data-first stress calculation**
  - [ ] Input: user MCP data + questionnaire responses
  - [ ] Wearable signals (40% weight):
    - [ ] HRV decline >= 15%: +20 points
    - [ ] Resting HR elevated >= 5bpm: +10 points
    - [ ] Sleep quality poor: +10 points
  - [ ] Calendar signals (30% weight):
    - [ ] Avg meetings > 8/day: +15 points
    - [ ] Late meetings > 3/week: +10 points
    - [ ] Weekend work > 2/month: +5 points
  - [ ] Email signals (15% weight):
    - [ ] After-hours emails > 5/day: +8 points
    - [ ] Urgent keywords > 10/week: +7 points
  - [ ] Lab signals (15% weight):
    - [ ] Cortisol AM > 25 μg/dL: +10 points
    - [ ] Cortisol PM > 12 μg/dL: +5 points

- [ ] **Fallback to questionnaire**
  - [ ] If no data available, use questionnaire stress rating
  - [ ] If partial data, blend with questionnaire (weighted by confidence)

- [ ] **Output format**
  - [ ] Stress level (0-100)
  - [ ] Category (low/moderate/high)
  - [ ] Work context description
  - [ ] Top 2-3 stress signals for personalization
  - [ ] Confidence score (based on data sources used)
  - [ ] Data sources list

- [ ] **User validation override**
  - [ ] If user validates as "incorrect": multiply by 0.7
  - [ ] If user validates as "somewhat": multiply by 0.85

---

## 3.2 Training Protocol Inference

### File: `/lib/inference/training-protocol.ts` (NEW)

#### Checklist
- [ ] **Extract from wearable logs**
  - [ ] Get workouts from past 30 days
  - [ ] Calculate frequency (workouts per week)
  - [ ] Calculate average duration
  - [ ] Categorize workout types (strength, cardio, HIIT, etc.)
  - [ ] Find preferred workout time
  - [ ] Calculate intensity distribution (zones)

- [ ] **Infer training goal**
  - [ ] Frequency >= 5 AND strength >= 3: "muscle_gain_or_performance"
  - [ ] High intensity > 30%: "athletic_performance"
  - [ ] Frequency <= 2: "general_health"

- [ ] **Fallback to questionnaire**
  - [ ] If no wearable data, use questionnaire training info
  - [ ] If partial data, confirm with user

- [ ] **Output format**
  - [ ] Frequency per week
  - [ ] Average duration
  - [ ] Workout type distribution
  - [ ] Preferred time of day
  - [ ] Training goal
  - [ ] Confidence level
  - [ ] Data source

---

## 3.3 Meal Timing Optimization

### File: `/lib/inference/meal-timing.ts` (NEW)

#### Checklist
- [ ] **Calculate from calendar**
  - [ ] Average first meeting time (past 30 days)
  - [ ] Find midday gaps (11am-3pm)
  - [ ] Average last meeting time
  - [ ] Calculate optimal meal windows

- [ ] **Meal timing logic**
  - [ ] First meal: first_meeting_avg - 30min (or 11am if later)
  - [ ] Lunch: largest gap in midday
  - [ ] Dinner: last_meeting_avg + 1 hour
  - [ ] Consider sleep time (dinner 3hrs before bed)

- [ ] **Fallback to questionnaire**
  - [ ] If no calendar, use questionnaire meal preferences
  - [ ] If calendar available, show suggestion for user validation

- [ ] **Output format**
  - [ ] First meal suggested time + rationale
  - [ ] Lunch window + duration available
  - [ ] Dinner suggested time
  - [ ] Confidence level
  - [ ] Data source

---

## 3.4 Sleep Quality Assessment

### File: `/lib/inference/sleep-quality.ts` (NEW)

#### Checklist
- [ ] **Extract from wearable**
  - [ ] Deep sleep percentage
  - [ ] Interruptions per night
  - [ ] Sleep efficiency (time asleep / time in bed)
  - [ ] Sleep score (if Oura/Whoop)

- [ ] **Categorize quality**
  - [ ] Poor: deep sleep < 15% OR interruptions > 3
  - [ ] Moderate: deep sleep < 20% OR interruptions > 2
  - [ ] Good: otherwise

- [ ] **Fallback to questionnaire**
  - [ ] If no wearable, use questionnaire sleep rating

- [ ] **Output format**
  - [ ] Sleep quality category
  - [ ] Specific metrics
  - [ ] Recommendations
  - [ ] Confidence level

---

## 3.5 Skin Health Assessment

### File: `/lib/inference/skin-health.ts` (NEW)

#### Checklist
- [ ] **Determine from data**
  - [ ] Age >= 25: preventive care needed
  - [ ] Training frequency >= 4: sweat impact
  - [ ] Labs: zinc < 70, testosterone < 400, hs-CRP > 3
  - [ ] Location: UV index
  - [ ] Inflammatory markers from labs

- [ ] **Output format**
  - [ ] Risk factors identified
  - [ ] Nutrient deficiencies
  - [ ] Recommendations
  - [ ] Confidence level

---

## 3.6 Main Inference Orchestrator

### File: `/lib/inference/hybrid-engine.ts` (NEW)

#### Checklist
- [ ] **Main inference function**
  - [ ] Input: user_id, mcp_data, questionnaire_data
  - [ ] Call all inference functions in parallel
  - [ ] Aggregate results
  - [ ] Calculate overall confidence score

- [ ] **Export combined insights**
  - [ ] Stress insights
  - [ ] Training insights
  - [ ] Meal timing insights
  - [ ] Sleep insights
  - [ ] Skin health insights
  - [ ] Overall confidence
  - [ ] Data sources used
  - [ ] Data gaps identified

---

## 3.7 Testing Checklist

- [ ] **With full data**
  - [ ] All inference functions use objective data
  - [ ] Confidence scores are high
  - [ ] Insights are personalized

- [ ] **With partial data**
  - [ ] Fallback logic works
  - [ ] Blended insights make sense
  - [ ] Confidence scores reflect gaps

- [ ] **With no data**
  - [ ] Questionnaire fallback works
  - [ ] Confidence scores are appropriate
  - [ ] Clear messaging about data gaps

- [ ] **Edge cases**
  - [ ] Conflicting data handled
  - [ ] Outliers handled
  - [ ] Missing fields handled

---

# PHASE 4: Enhanced Plan Generation

**Priority:** MEDIUM
**Impact:** User-facing personalization
**Estimated Effort:** 4-5 days

## Objectives
- Update Sage plan generation to use inference insights
- Add data-derived personalization to all sections
- Include new required sections
- Show confidence and data sources

---

## 4.1 Plan Generation Updates

### File: `/lib/plan-generation/sage-plan-generator.ts`

#### Checklist
- [ ] **Input updates**
  - [ ] Accept inference insights object
  - [ ] Accept MCP data summary
  - [ ] Accept questionnaire responses (as before)

- [ ] **Personal Summary generation**
  - [ ] Dynamic based on data analysis
  - [ ] Mention stress signals if detected
  - [ ] Reference training if detected
  - [ ] Note meal timing optimization
  - [ ] 150-200 words

- [ ] **Section subtitle personalization**
  - [ ] Stress Management: "Given your {work_context} and {stress_signals}..."
  - [ ] Exercise Protocol: "Optimized for {training_goal} with pre/post workout nutrition..."
  - [ ] Lifestyle Integration: "Optimized for {work_context} with focus on deep sleep..."
  - [ ] Sleep Optimization: "{name} at {age} with {meal_pattern} and {key_challenge}..."

---

## 4.2 New Section: Plan Adaptations

### Location: After Nutrition Structure, before Daily Recommendations

#### Checklist
- [ ] **Stress Protocol** (if stress_level >= 40)
  - [ ] Show stress signals detected
  - [ ] Caffeine restrictions based on stress level
  - [ ] Supplement additions (rhodiola, magnesium)
  - [ ] NSDR protocol recommendations
  - [ ] Meal timing stability emphasis

- [ ] **Activity Level Variations** (if training varies)
  - [ ] High training weeks: calorie and carb adjustments
  - [ ] Recovery weeks: baseline maintenance
  - [ ] Deload weeks: carb reduction
  - [ ] Rest days: carb distribution

- [ ] **Travel Mode** (if calendar shows travel)
  - [ ] Simplified meal structure
  - [ ] Portable protein suggestions
  - [ ] Restaurant-friendly options
  - [ ] Hydration adjustments
  - [ ] Supplement timing for timezones

- [ ] **Medication Considerations** (if reported)
  - [ ] List medications
  - [ ] Show nutrient interactions
  - [ ] Supplement timing adjustments
  - [ ] Physician consultation reminder

- [ ] **Medical Condition Modifications** (if reported)
  - [ ] Per condition: nutrient focus, timing, beneficial foods, foods to limit

---

## 4.3 New Section: Skin-Nutrition Connection

### Location: Beginning of Skin Improvement section

#### Checklist
- [ ] **Auto-generate from meal plan**
  - [ ] Extract omega-3 fish sources from meals
  - [ ] Extract protein target
  - [ ] Extract vitamin C foods (berries, citrus, peppers)
  - [ ] Extract zinc sources (oysters, pumpkin seeds, beef)
  - [ ] Extract hydration target

- [ ] **Template**
  ```
  Skin health starts from within. Your nutrition plan provides the foundation.

  Your Skin-Supporting Nutrition:
  - Omega-3 from {fish_sources} reduces inflammation and supports barrier function
  - Protein target of {amount}g daily provides amino acids for collagen synthesis
  - {vitamin_c_foods} throughout your meals provide vitamin C for collagen production
  - {zinc_sources} supply zinc for wound healing and skin cell renewal
  - Hydration protocol at {amount}L daily maintains skin moisture from inside out

  The external routine below complements this nutritional foundation for optimal results.
  ```

---

## 4.4 Confidence Transparency

#### Checklist
- [ ] **Add "How This Plan Was Built" section**
  - [ ] List data sources used (wearables, calendar, email, labs, questionnaire)
  - [ ] Show confidence scores per category
  - [ ] Highlight high-confidence insights

- [ ] **Data gaps messaging**
  - [ ] If no wearable: suggest Apple Watch/Oura/Whoop for future plans
  - [ ] If no labs: suggest uploading recent labs
  - [ ] If no calendar: suggest Google Calendar for meal timing
  - [ ] Show value proposition for each missing connection

---

## 4.5 Testing Checklist

- [ ] **Plan generation with full data**
  - [ ] All sections personalized correctly
  - [ ] Stress signals appear in subtitles
  - [ ] Plan adaptations present
  - [ ] Skin-nutrition connection auto-generated

- [ ] **Plan generation with partial data**
  - [ ] Fallback content works
  - [ ] Data gaps messaging appears
  - [ ] Confidence scores shown

- [ ] **Plan generation with no MCP data**
  - [ ] Questionnaire-only plan works
  - [ ] Clear messaging about connecting data

---

# PHASE 5: Content Formatting Fixes

**Priority:** MEDIUM
**Impact:** Professional polish
**Estimated Effort:** 3-4 days

## Objectives
- Apply all formatting rules to plan generation
- Fix typography and visual hierarchy
- Ensure consistent style across all plans

---

## 5.1 Text Formatting Rules

### File: All plan generation templates

#### Checklist
- [ ] **Remove ALL em dashes (—)**
  - [ ] Replace with commas for clauses
  - [ ] Replace with "to" for ranges
  - [ ] Replace with periods for separate thoughts
  - [ ] Examples:
    - ❌ "Protein — 140g" → ✅ "Protein target is 140g"
    - ❌ "High stress — this affects sleep" → ✅ "High stress, which affects sleep"

- [ ] **Remove colons (:) except allowed cases**
  - [ ] Allowed: Time stamps (11:30 am), Ratios (1:1), Citations ([1]:)
  - [ ] NOT allowed:
    - ❌ "Protein: 140g" → ✅ "Protein target is 140g"
    - ❌ "Timing: with meal" → ✅ "Take with any meal"
    - ❌ "Goal: energy" → ✅ "This provides steady energy"

- [ ] **Capitalize food sources**
  - [ ] Replace periods with commas
  - [ ] Capitalize first letter of each food
  - [ ] Remove trailing period
  - [ ] ❌ "salmon. sardines. mackerel. trout" → ✅ "Salmon, sardines, mackerel, trout"

- [ ] **Fix clunky phrasing**
  - [ ] ❌ "fat mini intake if needed such as a whey shake" → ✅ "If needed, have a small protein/fat snack (e.g., whey protein shake)"
  - [ ] ❌ "rotate fermented foods 1 small serving daily such as" → ✅ "Include a varied rotation of fermented foods (examples: kefir, yogurt, kimchi)"
  - [ ] ❌ "Use creatine timing flexibility" → ✅ "Take your daily creatine serving with any meal"
  - [ ] ❌ "until after 11 am" → ✅ "Delay first meal until after 11am as preferred"

---

## 5.2 Visual Hierarchy Updates

### File: Plan styling/CSS

#### Checklist
- [ ] **Meal card typography**
  ```css
  .meal-time { font-size: 11px; font-weight: 500; }
  .meal-name { font-size: 20px; font-weight: 600; } /* INCREASED from 16px */
  .meal-description { font-size: 14px; line-height: 1.6; }
  .meal-tags { font-size: 11px; }
  .meal-macros { font-size: 13px; font-weight: 500; }
  ```

- [ ] **Section headers**
  - [ ] H1: Clear hierarchy
  - [ ] H2: Consistent styling
  - [ ] H3: Proper nesting

- [ ] **Collapsible sections**
  - [ ] Daily Recommendations (6 sections)
  - [ ] Expandable "Why this brand?" for supplements
  - [ ] Mobile-friendly

---

## 5.3 Collapsible Daily Recommendations

#### Checklist
- [ ] **Convert to collapsible format**
  - [ ] Morning Ritual (collapsed by default, summary visible)
  - [ ] Empower the Gut (collapsed by default, summary visible)
  - [ ] Afternoon Vitality (collapsed by default, summary visible)
  - [ ] Energy Optimization (collapsed by default, summary visible)
  - [ ] Midday Mastery (collapsed by default, summary visible)
  - [ ] Evening Nourishment (collapsed by default, summary visible)

- [ ] **Summary format**
  ```
  ▶ Morning Ritual
  Delay first meal until after {time}, hydrate with {amount}ml water
  ```

- [ ] **Expanded format**
  - [ ] Full protocol details
  - [ ] Supplement timing
  - [ ] Rationale

---

## 5.4 Testing Checklist

- [ ] **Formatting rules applied**
  - [ ] No em dashes anywhere
  - [ ] No inappropriate colons
  - [ ] All food sources capitalized
  - [ ] No clunky phrasing

- [ ] **Visual hierarchy**
  - [ ] Meal cards look good
  - [ ] Typography clear
  - [ ] Mobile responsive

- [ ] **Collapsible sections**
  - [ ] Collapse/expand works
  - [ ] Summaries accurate
  - [ ] No layout breaks

---

# PHASE 6: New Required Content Sections

**Priority:** MEDIUM
**Impact:** Engagement and virality
**Estimated Effort:** 2-3 days

## Objectives
- Add social sharing functionality
- Add referral incentive system
- Enhance Moccet CTA
- Add supplement upsells

---

## 6.1 Social Sharing

#### Checklist
- [ ] **Add sharing buttons**
  - [ ] LinkedIn share button (direct link)
  - [ ] X/Twitter share button (direct link)
  - [ ] Instagram share button (copy link + message)
  - [ ] Pre-written templates:
    - "Just got my personalized Sage plan. My omega-3 strategy is 🔥 {link}"
    - "Moccet's Sage nailed my sleep protocol based on my data. Game changer. {link}"

- [ ] **Referral incentive**
  - [ ] "Share Your Plan" section
  - [ ] "Share with friends and get $20 off supplements"
  - [ ] Track referral links
  - [ ] Apply discount codes

- [ ] **Copy link flow for Instagram**
  - [ ] Click "Share on Instagram"
  - [ ] Show "Link copied! Share on Instagram Stories"
  - [ ] Provide suggested caption

---

## 6.2 Enhanced Moccet CTA

### Location: Bottom of plan (MANDATORY)

#### Checklist
- [ ] **Sage → Moccet comparison**
  - [ ] "Sage generates a one-off plan from your current data"
  - [ ] "Moccet tracks you continuously and adjusts daily"
  - [ ] Visual progression element

- [ ] **Moccet features list**
  - [ ] Weekly Plan Updates (based on Oura/Whoop data)
  - [ ] Real-Time Meal Swaps (adapts to travel/stress)
  - [ ] AI Physician Chat (24/7 answers and adjustments)
  - [ ] Grocery Ordering (one-click when you approve plans)
  - [ ] Forge Training Integration (nutrition synced with workouts)

- [ ] **Waitlist benefits**
  - [ ] "Waitlist members get 3 months free + priority access"
  - [ ] "Join Moccet Waitlist" button
  - [ ] QR code for mobile
  - [ ] Testimonial: "Sage changed how I eat. Moccet keeps me on track every single day." — Alex, 31

---

## 6.3 Supplement Enhancements

#### Checklist
- [ ] **Essential Supplements section**
  - [ ] "Most Popular" badge
  - [ ] "Purchase Complete Bundle - Save 20%" button
  - [ ] "First 100 users get free shipping" urgency
  - [ ] Each supplement card:
    - Brand name, quantity, dosage
    - Price + price per day
    - "Buy Now" and "Add to Cart" buttons
    - "In Stock" indicator
    - Timing and benefit description
    - "Why this specific brand?" expandable
    - Mini testimonial with timeframe

- [ ] **Optional Supplements section**
  - [ ] Same card structure as essential
  - [ ] "Add to Cart - ${price}" button (currently missing)
  - [ ] Context-aware recommendations

- [ ] **Upsell section**
  - [ ] Based on goals and stress level
  - [ ] Personalized suggestions

---

## 6.4 Testing Checklist

- [ ] **Social sharing**
  - [ ] All buttons work
  - [ ] Pre-written templates populate
  - [ ] Copy link works
  - [ ] Referral tracking works

- [ ] **Moccet CTA**
  - [ ] Waitlist button works
  - [ ] QR code generates correctly
  - [ ] Visual progression clear

- [ ] **Supplements**
  - [ ] All buttons work
  - [ ] Bundle discount applies
  - [ ] Add to cart works
  - [ ] Expandables work

---

# CROSS-CUTTING CONCERNS

---

## Database Schema Updates

### Supabase Tables to Create/Update

#### `user_mcp_data` (NEW)
```sql
CREATE TABLE user_mcp_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  data_source VARCHAR(50) NOT NULL, -- 'apple_health', 'oura', 'whoop', 'fitbit', 'strava', 'google_calendar', 'gmail', 'myfitnesspal'
  data_payload JSONB NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_user_mcp_data_user_id (user_id),
  INDEX idx_user_mcp_data_source (data_source),
  INDEX idx_user_mcp_data_synced (synced_at),
  UNIQUE(user_id, data_source)
);
```

#### `user_sage_plans` (UPDATE)
- [ ] Add `mcp_data_used` JSONB field (list of data sources)
- [ ] Add `confidence_scores` JSONB field
- [ ] Add `inference_insights` JSONB field

#### `user_lab_files` (NEW)
```sql
CREATE TABLE user_lab_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(10) NOT NULL, -- 'pdf', 'png', 'jpg'
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  analysis_result JSONB,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_user_lab_files_user_id (user_id)
);
```

---

## Environment Variables

### Required New Variables
```env
# MCP Sync Settings
MCP_SYNC_TIMEOUT=30000
MCP_DATA_RETENTION_DAYS=90

# Apple Health (if using MCP server)
APPLE_HEALTH_MCP_URL=

# Oura (existing)
OURA_CLIENT_ID=
OURA_CLIENT_SECRET=

# Whoop (if needed)
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=

# Google Calendar (existing)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# MyFitnessPal (if adding)
MFP_CLIENT_ID=
MFP_CLIENT_SECRET=

# File Upload Limits
MAX_FILE_SIZE_MB=10
MAX_TOTAL_UPLOAD_SIZE_MB=50
MAX_FILES_PER_UPLOAD=10
```

---

## Documentation

### Files to Create/Update

- [ ] `/docs/MCP_INTEGRATION.md` - MCP architecture and data flow
- [ ] `/docs/INFERENCE_ENGINE.md` - How inference works, fallback logic
- [ ] `/docs/LAB_UPLOAD.md` - Multi-file upload usage
- [ ] `/docs/PLAN_GENERATION.md` - How plans are generated
- [ ] `/docs/DATA_PRIVACY.md` - What data is collected, how it's used
- [ ] Update `/README.md` with new features

---

## Testing Strategy

### Unit Tests
- [ ] MCP sync functions (each data source)
- [ ] Inference functions (each calculator)
- [ ] Plan generation functions
- [ ] Formatting functions

### Integration Tests
- [ ] Full onboarding flow with MCP sync
- [ ] Full onboarding flow without MCP data
- [ ] Multi-file lab upload
- [ ] Plan generation end-to-end

### E2E Tests
- [ ] Sage onboarding → Plan generation → Display
- [ ] Forge onboarding → Plan generation → Display
- [ ] Social sharing flows
- [ ] Supplement purchase flows

---

## Performance Considerations

### Optimization Checklist
- [ ] **MCP sync parallelization**
  - [ ] Use Promise.all() for parallel fetching
  - [ ] Set reasonable timeouts (30s per source)
  - [ ] Cache results to avoid redundant API calls

- [ ] **File upload optimization**
  - [ ] Client-side image compression before upload
  - [ ] Progress indicators for large files
  - [ ] Background processing for OpenAI analysis

- [ ] **Plan generation caching**
  - [ ] Cache inference results (1 hour)
  - [ ] Cache formatted plan sections
  - [ ] Invalidate on new data sync

---

## Security Considerations

### Security Checklist
- [ ] **Email privacy**
  - [ ] NO email content stored, only metadata
  - [ ] Clear consent flow
  - [ ] User can disconnect anytime

- [ ] **Data retention**
  - [ ] Respect retention policies (30-90 days)
  - [ ] Automatic cleanup of expired data
  - [ ] User can request data deletion

- [ ] **File uploads**
  - [ ] Validate file types (PDF, PNG, JPG only)
  - [ ] Scan for malware
  - [ ] Size limits enforced
  - [ ] Secure storage (S3 with encryption)

- [ ] **API security**
  - [ ] Rate limiting on MCP sync endpoints
  - [ ] Authentication required
  - [ ] CORS properly configured

---

## Deployment Plan

### Pre-Deployment Checklist
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Documentation complete

### Phased Rollout
1. **Phase 1**: Deploy multi-file lab upload (low risk)
2. **Phase 2**: Deploy MCP sync infrastructure (backend only)
3. **Phase 3**: Deploy inference engine (backend only)
4. **Phase 4**: Deploy enhanced plan generation (user-facing)
5. **Phase 5**: Deploy formatting fixes (user-facing)
6. **Phase 6**: Deploy new content sections (user-facing)

### Rollback Plan
- [ ] Database migration rollback scripts ready
- [ ] Feature flags for new sections
- [ ] Monitoring alerts configured
- [ ] Rollback procedure documented

---

## Success Metrics

### KPIs to Track
- [ ] **MCP sync adoption**
  - % of users with at least one connection
  - Average connections per user
  - Sync success rate per source

- [ ] **Plan quality**
  - Confidence scores distribution
  - Data sources used per plan
  - User feedback on personalization

- [ ] **Multi-file upload**
  - % of users uploading labs
  - Average files per upload
  - Mix of PDFs vs screenshots

- [ ] **Engagement**
  - Social share rate
  - Referral conversion rate
  - Moccet waitlist signups from Sage

---

## FINAL CHECKLIST

### Before Launch
- [ ] All phases completed and tested
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] Documentation published
- [ ] Team training completed
- [ ] Monitoring dashboards created
- [ ] Support team briefed
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Marketing materials ready

---

## NOTES & OPEN QUESTIONS

### Questions to Resolve
1. Should MCP sync run on a schedule or only on-demand?
2. What should happen if a user disconnects an integration after plan is generated?
3. Should we version plans to track how they change over time?
4. Do we need a "Regenerate plan" button when new data is available?
5. Should users be able to see raw MCP data or only insights?

### Future Enhancements
- Real-time sync (webhooks) instead of polling
- ML model for better inference (beyond rule-based)
- A/B testing different personalization approaches
- Automated plan regeneration when significant data changes detected
- Mobile app integration for better wearable sync

---

**END OF IMPLEMENTATION PLAN**
