# OneSignal Spontaneous Notification Flow

## Overview
This document explains how spontaneous health insights automatically trigger push notifications via OneSignal when users' health metrics show significant changes.

---

## Complete End-to-End Flow

### 1. User Wears Device & Syncs Data

```
User sleeps with Oura Ring
    ↓
Oura syncs to cloud (~6 AM)
    ↓
Vital API receives data
    ↓
Vital sends webhook to your backend
```

**Webhook Payload Example:**
```json
POST https://moccet.ai/api/vital/webhook
{
  "event_type": "daily.data.sleep.created",
  "user_id": "vital_user_123",
  "client_user_id": "user@example.com",
  "provider": "oura",
  "data": {
    "sleep_score": 65,
    "hrv_avg": 42,
    "deep_sleep_duration": 45,
    "rem_sleep_duration": 60,
    "efficiency": 82
  }
}
```

---

### 2. Backend Receives Webhook

**File**: `/app/api/vital/webhook/route.ts`

**Process**:
1. Verifies webhook signature from Vital
2. Stores event in `vital_webhook_events` table
3. Queues async job with QStash (Upstash):
   ```typescript
   await qstashClient.publishJSON({
     url: `${baseUrl}/api/webhooks/qstash/process-vital-event`,
     body: {
       eventId: event.id,
       eventType: event.event_type,
       email: event.client_user_id
     }
   })
   ```

---

### 3. QStash Processes Event Asynchronously

**File**: `/app/api/webhooks/qstash/process-vital-event/route.ts`

**Process**:
1. Verifies QStash signature
2. Fetches original event from `vital_webhook_events`
3. Calls `insight-trigger-service.processVitalEvent()`

---

### 4. Insight Generation & Analysis

**File**: `/lib/services/insight-trigger-service.ts`

**Process**:

#### Step 4.1: Fetch Current Baseline
```typescript
const baseline = await getBaseline(email, 'sleep_score');
// Returns: { baseline_value: 78, sample_count: 14 }
```

#### Step 4.2: Compare Against Threshold
```typescript
const currentValue = 65; // From webhook
const baselineValue = 78;
const changePct = ((65 - 78) / 78) * 100; // -16.7%

// Check threshold
const threshold = INSIGHT_THRESHOLDS['sleep_score']; // 15%
if (Math.abs(changePct) >= threshold.threshold_pct) {
  // Trigger insight!
}
```

#### Step 4.3: Generate Insight
```typescript
const insight = {
  insight_type: 'sleep_alert',
  title: 'Sleep Quality Below Your Normal',
  message: 'Your readiness score of 65 is 16.7% below your usual 78.',
  severity: 'high',
  actionable_recommendation: 'Try to maintain a consistent sleep schedule this week.',
  source_provider: 'oura',
  source_data_type: 'readiness',
  context_data: {
    currentValue: 65,
    baselineValue: 78,
    changePct: -16.7,
    threshold: 15,
    samples: 14
  }
};
```

#### Step 4.4: Store in Database
```typescript
const { data } = await supabase
  .from('real_time_insights')
  .insert({
    email: 'user@example.com',
    insight_type: 'sleep_alert',
    title: insight.title,
    message: insight.message,
    severity: 'high',
    actionable_recommendation: insight.actionable_recommendation,
    source_provider: 'oura',
    source_data_type: 'readiness',
    context_data: insight.context_data,
    notification_sent: false
  })
  .select('id')
  .single();
```

---

### 5. OneSignal Push Notification (AUTOMATIC)

**File**: `/lib/services/onesignal-service.ts`

**Process**:

#### Step 5.1: Fetch User's Device Tokens
```typescript
const { data: tokens } = await supabase
  .from('user_device_tokens')
  .select('device_token, platform')
  .eq('email', 'user@example.com')
  .eq('is_active', true)
  .eq('provider', 'onesignal');

// Returns: [
//   { device_token: 'player_id_123abc', platform: 'ios' },
//   { device_token: 'player_id_456def', platform: 'android' }
// ]
```

#### Step 5.2: Send to OneSignal API
```typescript
const response = await fetch('https://api.onesignal.com/notifications', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
  },
  body: JSON.stringify({
    app_id: process.env.ONESIGNAL_APP_ID,
    include_player_ids: ['player_id_123abc', 'player_id_456def'],
    headings: { en: 'Sleep Quality Below Your Normal' },
    contents: { en: 'Your readiness score of 65 is 16.7% below your usual 78.' },
    data: {
      insight_id: 'uuid-of-insight',
      insight_type: 'sleep_alert',
      severity: 'high',
      action_url: '/insights/uuid-of-insight'
    },
    ios_sound: 'default',
    ios_badgeCount: 1,
    android_sound: 'default',
    android_channel_id: 'high_priority',
    priority: 10
  })
});

// OneSignal Response:
// {
//   "id": "notification-uuid",
//   "recipients": 2,
//   "external_id": null
// }
```

#### Step 5.3: Mark as Sent
```typescript
if (response.recipients > 0) {
  await supabase
    .from('real_time_insights')
    .update({
      notification_sent: true,
      notification_sent_at: new Date().toISOString(),
      notification_channel: 'push'
    })
    .eq('id', insightId);
}
```

---

### 6. OneSignal Delivers to Devices

OneSignal handles:
- **iOS**: APNs (Apple Push Notification service)
- **Android**: FCM (Firebase Cloud Messaging)
- **Delivery tracking**: Sent, delivered, opened
- **Failed tokens**: Automatically identified
- **Retry logic**: Built-in retry mechanism

---

### 7. Flutter App Receives Notification (Two Channels)

#### Channel A: OneSignal Direct Notification (App Closed/Background)

**File**: `/lib/services/onesignal_service.dart`

```dart
// User taps notification
OneSignal.Notifications.addClickListener((event) {
  final data = event.notification.additionalData;
  final insightId = data['insight_id']; // 'uuid-of-insight'

  // Navigate to insight detail screen
  navigatorKey.currentState?.pushNamed(
    '/insights/$insightId'
  );
});
```

#### Channel B: Supabase Realtime (App Open)

**File**: `/lib/services/realtime_insight_service.dart`

```dart
// Real-time subscription
final channel = supabase.channel('realtime_insights_user@example.com')
  .on(
    RealtimeListenTypes.postgresChanges,
    ChannelFilter(
      event: 'INSERT',
      schema: 'public',
      table: 'real_time_insights',
      filter: 'email=eq.user@example.com'
    ),
    (payload, [ref]) {
      // Show in-app notification
      final insight = StructuredInsight.fromJson(payload['new']);

      // Trigger local notification
      NotificationService().showNotification(
        title: insight.title,
        body: insight.message,
        priority: mapSeverityToPriority(insight.severity),
        data: {'insight_id': insight.id}
      );

      // Update UI
      onInsightReceived?.call(insight);
    }
  )
  .subscribe();
```

---

### 8. Update Baseline for Next Time

```typescript
await updateBaseline(email, 'sleep_score', 65);

// Updates rolling average:
// new_baseline = (78 * 14 + 65) / 15 = 77.13
```

---

## Insight Types & Triggers

### Sleep Insights
| Trigger | Threshold | Severity |
|---------|-----------|----------|
| Readiness < 60 | Critical | critical |
| Readiness drop > 15% | Significant change | high |
| Sleep debt > 2 hours | Accumulation | medium |
| Sleep score > 85 | Improvement | info |

### Glucose Insights
| Trigger | Threshold | Severity |
|---------|-----------|----------|
| Glucose > 180 mg/dL | High spike | critical |
| Glucose > 140 mg/dL | Moderate spike | high |
| Time in range < 70% | Poor control | high |
| Avg glucose change > 15% | Significant change | high |

### Recovery Insights (Whoop)
| Trigger | Threshold | Severity |
|---------|-----------|----------|
| Recovery < 34% | Red zone | critical |
| Recovery 34-66% | Yellow zone | medium |
| Recovery > 66% | Green zone | info |
| HRV drop > 20% | Stress indicator | high |

### Activity Insights
| Trigger | Threshold | Severity |
|---------|-----------|----------|
| Steps < 50% of baseline | Low activity | medium |
| Strain > 18 (overtraining) | High strain | high |
| Workout completed | Info | info |

### Work Pattern Insights
| Trigger | Threshold | Severity |
|---------|-----------|----------|
| After-hours emails > 10 | Email overload | medium |
| Meetings > 6 hours | Calendar conflict | high |
| Focus window available | Opportunity | info |

---

## Testing the Flow

### 1. Manual Test via API

**Test Endpoint**: POST `/api/user/insights`

```bash
curl -X POST https://moccet.ai/api/user/insights \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com"
  }'
```

This will:
1. Process all connected providers
2. Generate insights if thresholds met
3. Send OneSignal notifications automatically

### 2. Simulate Webhook

**Test Endpoint**: POST `/api/webhooks/qstash/process-vital-event`

```bash
curl -X POST https://moccet.ai/api/webhooks/qstash/process-vital-event \
  -H "Content-Type: application/json" \
  -H "Upstash-Signature: mock-sig-for-testing" \
  -d '{
    "eventType": "daily.data.sleep.created",
    "email": "your-email@example.com"
  }'
```

### 3. Check Logs

**Backend logs** (Vercel/Railway):
```
[OneSignal Service] Sending to 2 device(s) for user@example.com
[OneSignal Service] Sent: 2 success, 0 failures
[Insight Trigger] Stored insight: sleep_alert (high severity)
```

**Flutter logs**:
```
[OneSignal] Notification clicked: Sleep Quality Below Your Normal
[RealtimeInsight] Received new insight: sleep_alert
[NotificationService] Showing notification (priority: high)
```

---

## Environment Setup Checklist

### Backend (.env.local)
```bash
✓ ONESIGNAL_APP_ID=ca46d1fb-5449-4f3a-a989-7b5a7043362b
✓ ONESIGNAL_REST_API_KEY=<your-rest-api-key>
✓ VITAL_API_KEY=<your-vital-key>
✓ VITAL_WEBHOOK_SECRET=<your-webhook-secret>
✓ QSTASH_TOKEN=<your-qstash-token>
```

### Database
```sql
✓ user_device_tokens table with 'provider' column
✓ real_time_insights table
✓ user_health_baselines table
✓ vital_webhook_events table
```

### Flutter App
```dart
✓ onesignal_flutter: ^5.3.4 installed
✓ OneSignal App ID configured in onesignal_service.dart
✓ OneSignal initialized in main.dart
✓ RealtimeInsightService initialized
✓ NotificationService initialized
```

---

## Notification Delivery Scenarios

### Scenario 1: App Closed
1. Webhook → Backend → OneSignal API
2. OneSignal → APNs/FCM → Device
3. User sees notification in notification tray
4. User taps → App opens → Navigation to insight detail

### Scenario 2: App in Background
1. Webhook → Backend → OneSignal API
2. OneSignal → APNs/FCM → Device
3. User sees notification in notification tray
4. Supabase Realtime also delivers (app maintains connection)
5. User taps → App resumes → Navigation to insight detail

### Scenario 3: App Open & Active
1. Webhook → Backend → OneSignal API
2. OneSignal → APNs/FCM → Device (silent or minimal)
3. Supabase Realtime delivers immediately
4. In-app notification shown via NotificationService
5. UI updates in real-time (insight list refreshes)

---

## Monitoring & Debugging

### Backend Monitoring
```typescript
// Check notification status
const { data } = await supabase
  .from('real_time_insights')
  .select('notification_sent, notification_sent_at, notification_channel')
  .eq('email', 'user@example.com')
  .order('created_at', { ascending: false })
  .limit(10);

// Check device tokens
const { data: tokens } = await supabase
  .from('user_device_tokens')
  .select('*')
  .eq('email', 'user@example.com')
  .eq('is_active', true);
```

### OneSignal Dashboard
- View delivery reports: https://app.onesignal.com
- Check sent notifications
- See delivery rates
- View device subscriptions
- Monitor click-through rates

### Flutter Debug Logs
```dart
OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
```

---

## Frequency Control (Preventing Spam)

Currently implemented checks:
1. **Threshold-based**: Only alerts if > 15-20% change from baseline
2. **Baseline window**: 14-day rolling average (smooths daily fluctuations)
3. **Severity-based**: Only high/critical insights trigger notifications
4. **Provider-based**: One insight per data type per sync

**Future enhancements** (not yet implemented):
- Rate limiting: Max X notifications per day
- Quiet hours: No notifications 10 PM - 8 AM
- User preferences: Per-insight-type notification settings
- Grouping: Bundle multiple low-priority insights

---

## Summary

**Spontaneous notifications work automatically when:**

1. ✓ User's health data syncs (Oura, Dexcom, Whoop, etc.)
2. ✓ Vital sends webhook to your backend
3. ✓ Backend analyzes data vs baseline
4. ✓ Significant change detected (> threshold)
5. ✓ Insight generated and stored in DB
6. ✓ OneSignal API called with user's device tokens
7. ✓ Notification delivered to user's phone
8. ✓ User taps notification → App opens to insight detail

**No manual intervention required - it's fully automatic!**

---

## Next Steps

1. Add OneSignal REST API key to backend `.env.local`
2. Run database migration: `supabase db push`
3. Test with manual trigger: `POST /api/user/insights`
4. Connect a wearable device (Oura/Dexcom/Whoop)
5. Wait for data sync and watch notifications arrive!

For issues, check:
- Backend logs for OneSignal API errors
- OneSignal dashboard for delivery status
- Flutter logs for notification receipt
- Database for insight storage confirmation
