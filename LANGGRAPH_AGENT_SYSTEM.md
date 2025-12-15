# LangGraph Autonomous Agent System

## Overview
LangGraph was integrated to create a **truly autonomous AI health agent** that can reason, plan, and take actions on behalf of users based on their health insights and data.

---

## What is LangGraph?

**LangGraph** (from LangChain) is a framework for building stateful, multi-actor AI applications with:
- **State Machines**: Visual graph-based workflows
- **Checkpointing**: Resume execution from any point
- **Human-in-the-Loop**: Built-in approval flows for risky actions
- **Parallel Execution**: Run multiple branches simultaneously
- **Memory**: Persistent conversation and execution state

---

## Why LangGraph for Moccet Health?

Traditional chatbots just respond to questions. LangGraph enables **autonomous agents** that can:

1. **Analyze** health insights automatically
2. **Plan** multi-step actions to address health issues
3. **Execute** actions with appropriate tools
4. **Ask for approval** when actions are risky
5. **Remember** context across conversations
6. **Coordinate** multiple specialized sub-agents

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    HEALTH INSIGHTS                          │
│   (Sleep debt, glucose spikes, recovery alerts, etc.)      │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼──────────┐
                    │ Health Agent  │
                    │  (LangGraph)  │
                    └────┬──────────┘
                         │
        ┌────────────────▼──────────────────┐
        │    ReAct Loop (Reason + Act)      │
        │  1. Observe insights              │
        │  2. Reason about what to do       │
        │  3. Plan actions                  │
        │  4. Execute tools                 │
        │  5. Reflect on results            │
        └────────────────┬──────────────────┘
                         │
        ┌────────────────▼─────────────────────┐
        │         Available Tools              │
        ├──────────────────────────────────────┤
        │ • Health Data (read insights)        │
        │ • Calendar (schedule events)         │
        │ • Spotify (create playlists)         │
        │ • Supplements (recommend products)   │
        │ • Shopping (order supplements)       │
        │ • Booking (book appointments)        │
        └──────────────────────────────────────┘
```

---

## Key Components

### 1. Health Agent (LangGraph State Machine)

**File**: `/lib/agents/health-agent.ts`

**What it does**:
- Uses GPT-4 to reason about health insights
- Maintains conversation state across multiple turns
- Executes tools to take actions
- Requests approval for risky actions
- Tracks reasoning steps for transparency

**Agent State**:
```typescript
{
  taskId: string,              // Unique task identifier
  userEmail: string,           // User context
  task: string,                // The health insight or user request
  messages: [],                // Conversation history
  currentStep: number,         // ReAct loop iteration
  pendingToolCall: {...},      // Tool waiting for approval
  toolResults: [],             // Executed tool history
  awaitingApproval: boolean,   // Paused for user approval
  reasoning: [],               // Thought process log
  status: 'running' | 'completed' | 'failed',
  finalResult: {...}           // Summary of actions taken
}
```

**ReAct Loop**:
1. **Thought**: "User has sleep debt of 2 hours. I should help them schedule more sleep."
2. **Action**: Call `find_calendar_slots` to find available bedtime
3. **Observation**: "Found 3 available slots: 10 PM, 10:30 PM, 11 PM"
4. **Thought**: "10 PM would give them 8 hours before their 6 AM wake time."
5. **Action**: Call `create_calendar_event` to block sleep time
6. **Observation**: "Calendar event created successfully"
7. **Final**: "I've scheduled a sleep block from 10 PM - 6 AM to help you recover."

---

### 2. Tools (Agent Capabilities)

#### Health Data Tools
**File**: `/lib/agents/tools/health-data.ts`

| Tool | Risk Level | Description |
|------|------------|-------------|
| `get_health_insights` | Low | Fetch recent health insights for the user |
| `get_biomarker_data` | Low | Get latest blood test results |
| `get_sleep_data` | Low | Fetch Oura Ring sleep metrics |
| `get_glucose_data` | Low | Retrieve Dexcom CGM readings |

#### Calendar Tools
**File**: `/lib/agents/tools/calendar.ts`

| Tool | Risk Level | Description |
|------|------------|-------------|
| `find_calendar_slots` | Low | Find available time slots for scheduling |
| `create_calendar_event` | **Medium** | Create a new calendar event (requires approval) |
| `block_focus_time` | **Medium** | Block off time for deep work |

#### Spotify Tools
**File**: `/lib/agents/tools/spotify.ts`

| Tool | Risk Level | Description |
|------|------------|-------------|
| `create_workout_playlist` | Low | Generate a high-energy workout playlist |
| `create_sleep_playlist` | Low | Generate a calming sleep playlist |
| `create_focus_playlist` | Low | Generate a concentration playlist |

#### Supplement Tools
**File**: `/lib/agents/tools/supplements.ts`

| Tool | Risk Level | Description |
|------|------------|-------------|
| `analyze_biomarkers` | Low | Analyze blood results for deficiencies |
| `recommend_supplements` | Low | Suggest supplements for deficiencies |
| `add_to_cart` | **Medium** | Add supplements to shopping cart (requires approval) |

#### Shopping Tools
**File**: `/lib/agents/tools/shopping.ts`

| Tool | Risk Level | Description |
|------|------------|-------------|
| `view_cart` | Low | Show current shopping cart contents |
| `checkout` | **High** | Complete purchase (requires approval) |

#### Booking Tools
**File**: `/lib/agents/tools/booking.ts`

| Tool | Risk Level | Description |
|------|------------|-------------|
| `search_doctors` | Low | Find healthcare providers by specialty |
| `book_appointment` | **High** | Book a doctor appointment (requires approval) |

---

### 3. Approval Flow (Human-in-the-Loop)

**Risk Levels**:
- **Low**: Auto-execute (reading data, creating playlists)
- **Medium**: Ask for approval (calendar events, adding to cart)
- **High**: Require explicit approval (purchases, bookings)

**Flow**:
```
Agent wants to create calendar event
    ↓
Risk Level: MEDIUM
    ↓
Pause execution → Save checkpoint
    ↓
Send notification to user:
"Agent wants to create calendar event: 'Sleep Block 10 PM - 6 AM'"
    ↓
User approves/rejects via UI
    ↓
Resume from checkpoint
    ↓
Execute or skip based on approval
```

**Database Tables**:
- `agent_executions` - Track agent sessions
- `agent_approval_requests` - Pending approvals
- `agent_approval_decisions` - User responses
- `agent_action_log` - Audit trail
- `agent_checkpoints` - State snapshots for resuming

---

### 4. Checkpointing (Resume Execution)

**File**: `/lib/agents/checkpointer.ts`

LangGraph's checkpointing allows the agent to:
- **Save state** at any point in execution
- **Resume** from where it left off (even days later)
- **Recover** from errors without starting over
- **Handle approvals** asynchronously

**Example**:
```typescript
// Save checkpoint before approval
await checkpointer.save({
  threadId: 'thread_123',
  state: agentState,
  metadata: { awaitingApproval: true }
});

// User approves 2 hours later...

// Resume execution
const savedState = await checkpointer.load('thread_123');
const agent = createHealthAgent(savedState);
await agent.resume();
```

---

### 5. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/chat` | POST | Chat with the health agent |
| `/api/agent/stream` | POST | Streaming chat responses |
| `/api/agent/resume` | POST | Resume a paused agent execution |

**Example Request**:
```bash
curl -X POST https://moccet.ai/api/agent/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Help me improve my sleep based on my recent insights",
    "threadId": "optional-thread-id"
  }'
```

**Response** (Streaming):
```json
{
  "event": "thought",
  "data": {
    "thought": "User has sleep debt. Let me find available sleep time slots."
  }
}

{
  "event": "tool_call",
  "data": {
    "tool": "find_calendar_slots",
    "args": { "durationMinutes": 480, "preferredTimeOfDay": "evening" }
  }
}

{
  "event": "approval_required",
  "data": {
    "tool": "create_calendar_event",
    "args": { "title": "Sleep Block", "start": "2025-12-15T22:00:00Z" },
    "riskLevel": "medium"
  }
}
```

---

## Real-World Use Cases

### Use Case 1: Automatic Sleep Debt Recovery

**Trigger**: Insight generated - "Sleep debt: 2 hours"

**Agent Actions**:
1. Read insight: `get_health_insights()`
2. Find available sleep slots: `find_calendar_slots({ durationMinutes: 480 })`
3. **Ask approval**: Create calendar event to block bedtime
4. Create sleep playlist: `create_sleep_playlist({ mood: 'calming' })`
5. **Final result**: "I've scheduled a sleep block from 10 PM - 6 AM and created a relaxing playlist to help you wind down."

---

### Use Case 2: Vitamin D Deficiency Supplementation

**Trigger**: Blood test shows low Vitamin D

**Agent Actions**:
1. Analyze biomarkers: `analyze_biomarkers({ testId: 'blood_test_123' })`
2. Find deficiency: Vitamin D = 18 ng/mL (optimal: 30-50)
3. Recommend supplements: `recommend_supplements({ deficiencies: ['vitamin_d'] })`
4. **Ask approval**: Add Thorne Vitamin D3 to cart ($24.99)
5. **Final result**: "Your Vitamin D is low at 18 ng/mL. I've recommended Thorne Vitamin D3 (1000 IU). Would you like me to add it to your cart?"

---

### Use Case 3: Glucose Spike Management

**Trigger**: Insight - "Glucose spike after lunch (190 mg/dL)"

**Agent Actions**:
1. Get glucose data: `get_glucose_data({ hours: 24 })`
2. Identify pattern: Post-meal spikes consistently
3. **Ask approval**: Book nutritionist appointment
4. **Ask approval**: Block calendar for post-meal walks (15 min)
5. **Final result**: "I've noticed consistent post-meal glucose spikes. I can help by:
   - Scheduling a nutritionist consultation
   - Blocking 15-minute walk slots after meals
   Would you like me to proceed?"

---

### Use Case 4: Stress Management via Calendar Optimization

**Trigger**: Insight - "High email activity + low HRV = stress"

**Agent Actions**:
1. Get calendar data: `find_calendar_slots({ daysAhead: 7 })`
2. Identify issue: Back-to-back meetings with no breaks
3. **Ask approval**: Block 30-min focus windows between meetings
4. Create focus playlist: `create_focus_playlist({ genre: 'ambient' })`
5. **Final result**: "I've noticed your calendar is packed. I can help reduce stress by adding buffer time between meetings and creating a focus playlist. Approve?"

---

## Database Schema

### Agent Execution Tracking
```sql
-- Agent session tracking
CREATE TABLE agent_executions (
  id TEXT PRIMARY KEY,
  user_email TEXT,
  thread_id TEXT,
  status TEXT, -- 'running', 'awaiting_approval', 'completed', 'failed'
  reasoning_steps JSONB,
  tool_calls JSONB,
  pending_approval JSONB,
  final_result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Approval requests
CREATE TABLE agent_approval_requests (
  id UUID PRIMARY KEY,
  execution_id TEXT REFERENCES agent_executions(id),
  tool_name TEXT,
  tool_args JSONB,
  risk_level TEXT, -- 'low', 'medium', 'high'
  status TEXT, -- 'pending', 'approved', 'rejected', 'expired'
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

-- Checkpoints for resuming
CREATE TABLE agent_checkpoints (
  id UUID PRIMARY KEY,
  thread_id TEXT,
  checkpoint_id TEXT,
  checkpoint JSONB, -- Full agent state
  metadata JSONB,
  created_at TIMESTAMPTZ
);

-- Audit log
CREATE TABLE agent_action_log (
  id UUID PRIMARY KEY,
  user_email TEXT,
  action_type TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
);
```

---

## Integration with Insights System

**How it works together**:

1. **Real-time insights** are generated (via insight-trigger-service)
2. **Notification sent** to user via OneSignal
3. **User opens app** and views insight
4. **Agent button** appears: "Let me help with this"
5. **User taps** → Agent analyzes insight
6. **Agent plans actions** using available tools
7. **Agent requests approvals** for risky actions
8. **User approves** → Agent executes
9. **Final summary** shown to user

**Example Flow**:
```
Sleep Debt Insight Generated
    ↓
User receives push notification
    ↓
User opens insight detail screen
    ↓
Taps "Let Agent Help"
    ↓
Agent analyzes: "User needs more sleep"
    ↓
Agent finds available calendar slots
    ↓
Agent requests approval to create sleep block
    ↓
User approves
    ↓
Calendar event created
    ↓
Sleep playlist created
    ↓
Summary: "I've scheduled your sleep block and created a relaxing playlist"
```

---

## Configuration

### Environment Variables
```bash
# OpenAI for agent reasoning
OPENAI_API_KEY=sk-...

# Supabase for state storage
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...

# Tool integrations
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

### Package Dependencies
```json
{
  "@langchain/langgraph": "^1.0.4",
  "@langchain/openai": "^1.2.0",
  "@langchain/core": "^1.1.5",
  "zod": "^4.1.13"
}
```

---

## Testing the Agent

### 1. Via API (Postman/Curl)
```bash
curl -X POST https://moccet.ai/api/agent/chat \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I have sleep debt. Can you help me schedule better sleep?"
  }'
```

### 2. Via Flutter App (Future Implementation)
```dart
// In insight detail screen
final response = await http.post(
  Uri.parse('https://moccet.ai/api/agent/chat'),
  headers: {
    'Authorization': 'Bearer $token',
    'Content-Type': 'application/json',
  },
  body: jsonEncode({
    'message': 'Help me with this insight',
    'threadId': insightId,
  }),
);
```

---

## Benefits Over Traditional Chatbots

| Feature | Traditional Chatbot | LangGraph Agent |
|---------|-------------------|-----------------|
| **Reasoning** | Pre-scripted responses | Dynamic reasoning with GPT-4 |
| **Actions** | Can only respond | Can take actions via tools |
| **Memory** | Stateless or simple KV | Full state machine with checkpoints |
| **Approval** | No built-in flow | Human-in-the-loop for risky actions |
| **Multi-step** | Single turn | Multi-turn reasoning loops |
| **Transparency** | Black box | Shows reasoning steps to user |
| **Recovery** | Must restart from scratch | Resume from any checkpoint |
| **Coordination** | Single agent | Can orchestrate multiple sub-agents |

---

## Future Enhancements

### 1. Multi-Agent Coordination
- **Coordinator Agent**: Orchestrates multiple specialized agents
- **Calendar Agent**: Handles scheduling tasks
- **Shopping Agent**: Manages supplement purchases
- **Booking Agent**: Schedules healthcare appointments
- **Nutrition Agent**: Meal planning and recipe suggestions

### 2. Proactive Insights
- Agent runs automatically when new insights arrive
- Pre-plans actions before user even sees the insight
- Presents a "I've already prepared solutions" experience

### 3. Learning from Feedback
- Track which actions users approve/reject
- Learn user preferences over time
- Adjust risk levels based on user trust

### 4. Voice Integration
- "Hey Moccet, help me with my sleep debt"
- Agent executes via voice commands
- Speaks reasoning and results back to user

---

## Key Files Reference

**Core Agent**:
- `/lib/agents/health-agent.ts` - Main LangGraph state machine
- `/lib/agents/prompts.ts` - System prompts and reasoning templates
- `/lib/agents/checkpointer.ts` - State persistence
- `/lib/agents/index.ts` - Public API exports

**Tools**:
- `/lib/agents/tools/index.ts` - Tool registry
- `/lib/agents/tools/health-data.ts` - Read health insights
- `/lib/agents/tools/calendar.ts` - Google Calendar integration
- `/lib/agents/tools/spotify.ts` - Spotify playlist creation
- `/lib/agents/tools/supplements.ts` - Supplement recommendations
- `/lib/agents/tools/shopping.ts` - E-commerce integration
- `/lib/agents/tools/booking.ts` - Healthcare appointment booking

**API Endpoints**:
- `/app/api/agent/chat/route.ts` - Chat interface
- `/app/api/agent/stream/route.ts` - Streaming responses
- `/app/api/agent/resume/route.ts` - Resume paused executions

**Database**:
- `/supabase/migrations/015_langgraph_agents.sql` - Schema definitions

---

## Summary

**LangGraph enables Moccet Health to have a truly autonomous AI agent that**:

✅ Analyzes health insights intelligently
✅ Plans multi-step actions to address health issues
✅ Executes actions with appropriate tools
✅ Requests approval for risky operations
✅ Maintains context across conversations
✅ Resumes execution after interruptions
✅ Provides full transparency into its reasoning
✅ Learns from user feedback over time

**This transforms Moccet from a passive health tracker into a proactive AI health assistant that takes action!** 🚀
