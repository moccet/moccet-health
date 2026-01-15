/**
 * Agent Prompts
 * System prompts for the Health Agent
 */

export const HEALTH_AGENT_SYSTEM_PROMPT = `You are an autonomous Health Agent helping users optimize their health and wellness. You have access to various tools to analyze health data, manage calendars, create playlists, recommend supplements, and book appointments.

## CRITICAL: Voice-First Conversational Style

You are speaking to the user through voice. Your responses will be read aloud by text-to-speech. This means:

1. **BE CONCISE** - Keep responses to 1-2 short sentences unless the user explicitly asks for details or an explanation
2. **Be natural** - Speak like a helpful friend, not a formal assistant
3. **No walls of text** - Never output long paragraphs. If you need to explain something complex, break it into a back-and-forth conversation
4. **Ask follow-ups** - Instead of dumping all info at once, give a brief answer and offer to elaborate

**Examples of good conversational responses:**
- User: "Hi" → "Hi! How can I help you today?"
- User: "Thanks" → "You're welcome! Let me know if you need anything else."
- User: "How's my sleep?" → "Your sleep's been solid - averaging 7.5 hours with good deep sleep. Want me to break down the trends?"
- User: "What should I do about my low vitamin D?" → "I'd suggest a D3 supplement, around 2000 IU daily. Want me to find some good options?"
- User: "Schedule a checkup" → "Got it. What day works best for you?"

**CRITICAL: Your "response" field must be the ACTUAL words to say, NOT a description of what you're doing.**
BAD: "Greeted the user and awaited further instructions."
GOOD: "Hi! How can I help you today?"

**BAD responses (too long):**
- "Based on your comprehensive health data analysis, I've identified several key areas for improvement including your sleep patterns which show..."

## Your Capabilities
You can:
1. **Analyze health data** - Blood biomarkers, sleep (Oura), glucose (Dexcom), activity
2. **Manage calendars** - Find slots, create/update/delete Google Calendar events
3. **Create playlists** - Spotify for focus, relaxation, workouts
4. **Recommend supplements** - Based on deficiencies
5. **Shop for products** - Search and purchase health products
6. **Book appointments** - Find providers, check insurance, book

## HYPER-PERSONALIZATION: Use Your Full Knowledge

You have access to comprehensive data about this user. USE IT to give hyper-personalized responses:

- **Nutrition Plan**: Their current Sage meal plan, today's specific meals, calorie/macro targets, recent food logs
- **Fitness Program**: Their Forge workout schedule, today's workout, exercise patterns, consistency
- **Health Goals**: Active goals with real-time progress tracking (e.g., "70% toward sleep goal")
- **Life Events**: Upcoming travel, work changes, major events that affect health advice
- **Experiments**: Health interventions they're actively trying (e.g., "Day 5 of magnesium supplement")
- **Check-ins**: Recent mood, energy, stress levels from daily surveys
- **What Worked**: Past advice outcomes - repeat successful strategies, avoid what didn't work

**How to use this context:**
- "What should I eat?" → Reference their actual Sage meal plan: "Your plan has salmon tonight - great for your omega-3 goal"
- "What workout?" → Reference their Forge program: "Today's your upper body day - bench press and rows"
- "How am I doing?" → Reference goals with progress: "You're at 80% of your step goal and sleep is improving"
- "I'm stressed" → Reference check-ins and life events: "Your stress has been higher this week with the conference coming up"
- Giving new advice → Reference outcomes: "Last time we tried X and it helped your sleep by 15%"

## How to Think and Act

Use the ReAct pattern internally, but keep your spoken responses brief:

1. **REASON** internally about what the user needs
2. **ACT** by calling the appropriate tool
3. **OBSERVE** the result
4. **RESPOND** with a concise, natural answer

## Risk Awareness

- **LOW RISK** (auto-execute): Reading data, searching, creating playlists
- **MEDIUM RISK** (needs approval): Creating calendar events, adding to cart
- **HIGH RISK** (needs explicit approval): Purchases, booking appointments

## Important Guidelines

1. **Short responses** - 1-2 sentences is ideal. Only go longer if explicitly asked
2. **Natural speech** - Use contractions, casual tone
3. **One thing at a time** - Don't overwhelm with information
4. **Offer to elaborate** - "Want more details?" instead of giving them upfront
5. **Be efficient** - Get to the point quickly

Remember: You're speaking through voice. Keep it conversational and concise.`;

export const TASK_COMPLETION_CHECK_PROMPT = `Based on the conversation so far, determine if the task has been completed.

A task is COMPLETE when:
- The user's original goal has been achieved
- All necessary actions have been taken
- The user has been informed of the results

A task is NOT COMPLETE when:
- More information is needed
- Actions are pending user approval
- There are follow-up steps to take

Respond with either:
- "COMPLETE" if the task is done
- "CONTINUE" if more actions are needed
- "WAITING" if waiting for user input/approval`;

export const ERROR_RECOVERY_PROMPT = `The previous tool call failed. Analyze the error and determine the best course of action:

1. **Retry** - If it was a transient error, try again
2. **Alternative** - If there's another way to achieve the goal, try that
3. **Inform User** - If the error can't be recovered, explain the situation clearly

Always maintain a helpful tone and suggest what the user can do to resolve the issue.`;

export function buildUserPrompt(
  task: string,
  context: any,
  previousSteps: any[],
  toolResults: any[]
): string {
  let prompt = `## Current Task
${task}
`;

  // Format conversation history as readable back-and-forth
  const conversationHistory = context?.conversationHistory || [];
  if (conversationHistory.length > 0) {
    prompt += `
## Recent Conversation (respond in context of this conversation)
${conversationHistory.map((msg: { role: string; content: string }) =>
  `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
).join('\n\n')}

IMPORTANT: The user's current message may be responding to your previous question above. Consider the full conversation context.
`;
  }

  // Add other context (excluding conversationHistory which we formatted above)
  const { conversationHistory: _, ...otherContext } = context || {};
  if (Object.keys(otherContext).length > 0) {
    prompt += `
## User Context
${JSON.stringify(otherContext, null, 2)}
`;
  }

  if (previousSteps.length > 0) {
    prompt += `
## Previous Reasoning Steps
${previousSteps.map((step, i) => `${i + 1}. ${step.thought}`).join('\n')}
`;
  }

  if (toolResults.length > 0) {
    prompt += `
## Tool Results So Far
${toolResults.map((result) => `- ${result.tool}: ${result.success ? 'Success' : 'Failed'} - ${JSON.stringify(result.data || result.error).substring(0, 500)}`).join('\n')}
`;
  }

  prompt += `
## Your Turn
Think about what to do next. If you need to use a tool, specify which one and with what parameters. If the task is complete, summarize what was accomplished.`;

  return prompt;
}

// =============================================================================
// MEMORY-AWARE PROMPTS
// =============================================================================

export interface MemoryContext {
  facts: Array<{
    category: string;
    fact_key: string;
    fact_value: string;
    confidence: number;
  }>;
  style: {
    verbosity: string;
    tone: string;
    prefers_lists: boolean;
    prefers_explanations: boolean;
  } | null;
  outcomes: Array<{
    advice_type: string;
    advice_given: string;
    outcome: string;
    metric_name: string;
    baseline_value: number | null;
    current_value: number | null;
  }>;
  preferences: Array<{
    action_type: string;
    approval_rate: number;
    learned_preference: string | null;
  }>;
  recentSummary: string | null;
  recentConversations: Array<{
    topic: string;
    summary: string;
    date: string;
  }>;
}

/**
 * Build a memory-aware system prompt that personalizes the agent's responses
 */
export function buildMemoryAwarePrompt(memory: MemoryContext): string {
  const sections: string[] = [];

  sections.push('## User Memory & Personalization\n');

  // Add learned facts
  if (memory.facts && memory.facts.length > 0) {
    sections.push('### Learned Facts About This User');
    const factsByCategory: Record<string, string[]> = {};

    for (const fact of memory.facts) {
      if (!factsByCategory[fact.category]) {
        factsByCategory[fact.category] = [];
      }
      factsByCategory[fact.category].push(
        `${fact.fact_key}: ${fact.fact_value} (${Math.round(fact.confidence * 100)}% confident)`
      );
    }

    for (const [category, facts] of Object.entries(factsByCategory)) {
      sections.push(`\n**${category.charAt(0).toUpperCase() + category.slice(1)}**:`);
      facts.forEach((f) => sections.push(`- ${f}`));
    }
    sections.push('');
  }

  // Add communication style preferences
  if (memory.style) {
    sections.push('### Communication Preferences');
    sections.push(`- **Verbosity**: ${memory.style.verbosity} (adjust your response length accordingly)`);
    sections.push(`- **Tone**: ${memory.style.tone}`);
    sections.push(`- **Prefers lists**: ${memory.style.prefers_lists ? 'Yes - use bullet points when possible' : 'No - use prose'}`);
    sections.push(`- **Prefers explanations**: ${memory.style.prefers_explanations ? 'Yes - include reasoning' : 'No - be concise'}`);
    sections.push('');
  }

  // Add past advice outcomes
  if (memory.outcomes && memory.outcomes.length > 0) {
    sections.push('### Past Advice Outcomes');
    sections.push('Use this to inform recommendations - repeat what worked, avoid what didn\'t:');

    for (const outcome of memory.outcomes.slice(0, 5)) {
      const icon = outcome.outcome === 'improved' ? '✓' : outcome.outcome === 'worsened' ? '✗' : '~';
      const change = outcome.baseline_value && outcome.current_value
        ? ` (${outcome.metric_name}: ${outcome.baseline_value} → ${outcome.current_value})`
        : '';
      sections.push(`- ${icon} "${outcome.advice_given?.substring(0, 100)}..." → ${outcome.outcome}${change}`);
    }
    sections.push('');
  }

  // Add action preferences
  if (memory.preferences && memory.preferences.length > 0) {
    sections.push('### Action Preferences');
    sections.push('Based on past approvals/rejections:');

    for (const pref of memory.preferences) {
      const tendency = pref.approval_rate > 70 ? 'Usually approves' : pref.approval_rate < 30 ? 'Usually rejects' : 'Mixed';
      sections.push(`- **${pref.action_type}**: ${tendency} (${Math.round(pref.approval_rate)}%)`);
      if (pref.learned_preference) {
        sections.push(`  → Learned: "${pref.learned_preference}"`);
      }
    }
    sections.push('');
  }

  // Add recent conversation context
  if (memory.recentConversations && memory.recentConversations.length > 0) {
    sections.push('### Recent Conversation Context');
    sections.push('Previous topics discussed:');

    for (const conv of memory.recentConversations.slice(0, 3)) {
      sections.push(`- **${conv.topic}** (${conv.date}): ${conv.summary?.substring(0, 100)}...`);
    }
    sections.push('');
  }

  // Add recent summary if available
  if (memory.recentSummary) {
    sections.push('### Weekly Summary');
    sections.push(memory.recentSummary);
    sections.push('');
  }

  // Add instructions for using memory
  sections.push('### How to Use This Memory');
  sections.push(`
- **Match their style**: If they prefer brief responses, be concise. If detailed, explain more.
- **Reference past success**: If similar advice worked before, mention it.
- **Avoid past failures**: If something didn't work, acknowledge it and try something different.
- **Respect preferences**: Don't suggest actions they typically reject.
- **Build on context**: Reference previous conversations when relevant.
- **Learn continuously**: Notice new preferences or facts and mention them naturally.
`);

  return sections.join('\n');
}

// =============================================================================
// DATABASE SCHEMA AWARENESS
// =============================================================================

export const DATABASE_CAPABILITIES_PROMPT = `
## Database Capabilities

You have the ability to READ and WRITE to certain parts of the user's health data. Here's what you can do:

### Health Logging (You CAN write)
Use these tools to help users track their health:

- **Water Tracking**
  - log_water_intake: Log water in ml (e.g., "Log 500ml of water")
  - quick_log_water: Log by glasses (1 glass = 250ml)
  - get_water_intake: Check today's intake and progress
  - set_water_goal: Set daily water goal (requires approval)

- **Food Tracking**
  - log_food: Log meals with calories and macros
  - get_food_log: Get food log for a day or range

- **Weight Tracking**
  - log_weight: Log weight (can include body fat %)
  - get_weight_history: View weight trend over time
  - set_weight_goal: Set target weight (requires approval)

### Health Goals (You CAN manage)
- get_health_goals: View active goals and progress
- create_health_goal: Create new goals (SLEEP, ACTIVITY, RECOVERY, GLUCOSE, WEIGHT, STRESS, CUSTOM)
- update_goal_progress: Update progress on manual goals
- pause_goal, resume_goal, complete_goal, abandon_goal: Manage goal lifecycle

### Plans (READ + limited actions)
- **Sage (Nutrition)**: Can read meal plans, log meals from plan
- **Forge (Fitness)**: Can read workout plans, mark workouts complete

### External Connectors (READ ONLY)
Data from these sources is synced automatically. You can READ but NOT modify:
- Oura Ring: Sleep, activity, HRV, readiness
- Dexcom CGM: Glucose readings, trends, alerts
- Whoop: Recovery, strain, sleep performance
- Fitbit: Steps, heart rate, sleep
- Apple Health: Activity, workouts, health metrics
- Strava: Running, cycling activities
- And more...

**Important**: When a user asks you to modify data from external connectors (like "change my Oura sleep score"), explain that this data comes from their device and can only be viewed, not edited.

### Social Features (You CAN manage)
- **Moccet Connect**: Friend connections, meeting suggestions
- **Moccet Share**: Caregiving relationships, alerts, permissions

### What You CANNOT Do
- Modify data in external connectors (Oura, Dexcom, etc.)
- Access other users' data
- Make purchases without explicit approval
- Book appointments without explicit approval
`;

// =============================================================================
// CONNECTOR AWARENESS
// =============================================================================

export interface ConnectorStatus {
  name: string;
  displayName: string;
  connected: boolean;
  lastSynced?: string;
  canRead: string[];
  canWrite: string[];
}

/**
 * Build connector awareness section for the system prompt
 */
export function buildConnectorAwarenessPrompt(connectors: ConnectorStatus[]): string {
  const sections: string[] = [];

  sections.push('## Your Connected Data Sources\n');

  const connected = connectors.filter(c => c.connected);
  const disconnected = connectors.filter(c => !c.connected);

  if (connected.length > 0) {
    sections.push('### Currently Connected');
    for (const c of connected) {
      const readPerms = c.canRead.length > 0 ? `read: ${c.canRead.join(', ')}` : '';
      const writePerms = c.canWrite.length > 0 ? `write: ${c.canWrite.join(', ')}` : 'write: none';
      sections.push(`- **${c.displayName}** ✓ (${readPerms} | ${writePerms})`);
    }
    sections.push('');
  }

  if (disconnected.length > 0) {
    sections.push('### Not Connected');
    sections.push(`These services are available but not connected: ${disconnected.map(c => c.displayName).join(', ')}`);
    sections.push('');
  }

  sections.push('**Note**: If the user asks about data from a disconnected service, let them know they can connect it in the Connectors section of the app.');

  return sections.join('\n');
}

// =============================================================================
// SOCIAL CONTEXT
// =============================================================================

export interface SocialContext {
  friendCount: number;
  pendingRequests: number;
  upcomingMeetings: Array<{
    friend: string;
    activity: string;
    scheduledFor: string;
  }>;
  recentSocialActivity: string;
}

export interface CaregivingContext {
  isCaregiver: boolean;
  careRecipients: Array<{
    name: string;
    status: 'good' | 'fair' | 'concerning';
    lastAlert?: string;
  }>;
  isBeingCaredFor: boolean;
  caregivers: Array<{
    name: string;
    role: string;
  }>;
  pendingAlerts: number;
}

/**
 * Build social context section for the system prompt
 */
export function buildSocialContextPrompt(social: SocialContext | null, caregiving: CaregivingContext | null): string {
  const sections: string[] = [];

  sections.push('## Social & Caregiving Status\n');

  // Moccet Connect
  if (social) {
    sections.push('### Moccet Connect (Friends)');
    sections.push(`- Friends: ${social.friendCount}`);
    if (social.pendingRequests > 0) {
      sections.push(`- Pending friend requests: ${social.pendingRequests}`);
    }
    if (social.upcomingMeetings && social.upcomingMeetings.length > 0) {
      sections.push('- Upcoming meetups:');
      for (const m of social.upcomingMeetings.slice(0, 3)) {
        sections.push(`  - ${m.activity} with ${m.friend} on ${m.scheduledFor}`);
      }
    }
    if (social.recentSocialActivity) {
      sections.push(`- Recent: ${social.recentSocialActivity}`);
    }
    sections.push('');
  }

  // Moccet Share (Caregiving)
  if (caregiving) {
    sections.push('### Moccet Share (Caregiving)');

    if (caregiving.isCaregiver && caregiving.careRecipients.length > 0) {
      sections.push('**As a caregiver, monitoring:**');
      for (const r of caregiving.careRecipients) {
        const statusIcon = r.status === 'good' ? '✓' : r.status === 'fair' ? '~' : '⚠️';
        sections.push(`- ${statusIcon} ${r.name}: ${r.status}${r.lastAlert ? ` (last alert: ${r.lastAlert})` : ''}`);
      }
      if (caregiving.pendingAlerts > 0) {
        sections.push(`- **${caregiving.pendingAlerts} pending alerts to review**`);
      }
    }

    if (caregiving.isBeingCaredFor && caregiving.caregivers.length > 0) {
      sections.push('**Your caregivers:**');
      for (const c of caregiving.caregivers) {
        sections.push(`- ${c.name} (${c.role})`);
      }
    }
    sections.push('');
  }

  if (!social && !caregiving) {
    sections.push('No social or caregiving relationships set up.');
  }

  return sections.join('\n');
}

// =============================================================================
// CONTEXT HEALTH AWARENESS
// =============================================================================

export interface ContextHealthSummary {
  overall: 'healthy' | 'degraded' | 'critical';
  freshSources: string[];
  staleSources: Array<{ name: string; timeSinceSync: string; level: 'warning' | 'critical' }>;
  unavailableSources: string[];
  requiredSourcesAvailable: boolean;
  completenessScore: number;
}

/**
 * Build context health section for the system prompt
 * This helps the agent acknowledge data freshness and uncertainty
 */
export function buildContextHealthPrompt(health: ContextHealthSummary): string {
  const sections: string[] = [];

  sections.push('## Data Quality Status\n');

  // Overall status indicator
  const statusEmoji = health.overall === 'healthy' ? '✅' : health.overall === 'degraded' ? '⚠️' : '❌';
  sections.push(`**Overall**: ${statusEmoji} ${health.overall.toUpperCase()} (${health.completenessScore}% coverage)\n`);

  // Fresh data
  if (health.freshSources.length > 0) {
    sections.push('### ✓ Fresh Data (use confidently)');
    sections.push(health.freshSources.join(', '));
    sections.push('');
  }

  // Stale data with warnings
  if (health.staleSources.length > 0) {
    sections.push('### ⚠️ Stale Data (acknowledge uncertainty)');
    for (const source of health.staleSources) {
      const icon = source.level === 'critical' ? '🔴' : '🟡';
      sections.push(`- ${icon} **${source.name}**: last synced ${source.timeSinceSync}`);
    }
    sections.push('');
    sections.push('When using stale data, acknowledge it naturally:');
    sections.push('- "Based on your data from 2 days ago..."');
    sections.push('- "Your last sync was yesterday, but..."');
    sections.push('');
  }

  // Unavailable sources
  if (health.unavailableSources.length > 0) {
    sections.push('### ✗ Not Available');
    sections.push(`Disconnected: ${health.unavailableSources.join(', ')}`);
    sections.push('');
    sections.push('If the user asks about this data, suggest connecting the service.');
    sections.push('');
  }

  // Instructions for degraded/critical states
  if (health.overall !== 'healthy') {
    sections.push('### How to Handle Data Gaps');
    sections.push('- Be transparent about data limitations');
    sections.push('- Offer recommendations with appropriate caveats');
    sections.push('- Suggest syncing devices if data is critically stale');
    sections.push('- Focus on data sources that ARE fresh');
    sections.push('');
  }

  // Required sources warning
  if (!health.requiredSourcesAvailable) {
    sections.push('**⚠️ IMPORTANT**: Some data sources required for this query are unavailable or stale.');
    sections.push('Acknowledge this limitation upfront in your response.');
    sections.push('');
  }

  return sections.join('\n');
}

// =============================================================================
// ENGAGEMENT OPTIMIZATION
// =============================================================================

export interface EngagementInsights {
  optimalNotificationsPerDay: number;
  preferredHours: number[];
  highEngagementTopics: string[];
  lowEngagementTopics: string[];
  currentStreaks: Array<{ type: string; days: number; atRisk: boolean }>;
}

/**
 * Build engagement awareness section for proactive agent behavior
 */
export function buildEngagementAwarenessPrompt(insights: EngagementInsights): string {
  const sections: string[] = [];

  sections.push('## User Engagement Patterns\n');

  // Notification preferences
  sections.push('### Communication Preferences');
  const hourStrings = insights.preferredHours.map(h =>
    h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
  );
  sections.push(`- Best times to send notifications: ${hourStrings.join(', ')}`);
  sections.push(`- Optimal daily notifications: ${insights.optimalNotificationsPerDay}`);
  sections.push('');

  // Topic engagement
  if (insights.highEngagementTopics.length > 0) {
    sections.push('### High Engagement Topics');
    sections.push(`User responds well to: ${insights.highEngagementTopics.join(', ')}`);
    sections.push('');
  }

  if (insights.lowEngagementTopics.length > 0) {
    sections.push('### Low Engagement Topics');
    sections.push(`User rarely engages with: ${insights.lowEngagementTopics.join(', ')}`);
    sections.push('Consider reducing or reframing these types of messages.');
    sections.push('');
  }

  // Active streaks
  if (insights.currentStreaks.length > 0) {
    sections.push('### Active Streaks');
    for (const streak of insights.currentStreaks) {
      if (streak.atRisk) {
        sections.push(`- 🔥 **${streak.type}**: ${streak.days} days - AT RISK (not logged today)`);
      } else if (streak.days >= 7) {
        sections.push(`- ✓ ${streak.type}: ${streak.days} days`);
      }
    }

    const atRiskStreaks = insights.currentStreaks.filter(s => s.atRisk);
    if (atRiskStreaks.length > 0) {
      sections.push('');
      sections.push('**Streak Protection**: If appropriate, remind the user about at-risk streaks.');
    }
    sections.push('');
  }

  return sections.join('\n');
}

// =============================================================================
// ADVICE EFFECTIVENESS
// =============================================================================

export interface AdvicePattern {
  category: string;
  successRate: number;
  avgImprovement: number;
  abandonmentRate: number;
  successfulStrategies: string[];
  failedStrategies: string[];
}

/**
 * Build advice effectiveness section to help agent give better recommendations
 */
export function buildAdviceEffectivenessPrompt(patterns: AdvicePattern[]): string {
  const sections: string[] = [];

  sections.push('## What Works for This User\n');
  sections.push('Based on tracked outcomes from past advice:\n');

  // Sort by success rate
  const sorted = [...patterns].sort((a, b) => b.successRate - a.successRate);

  for (const pattern of sorted) {
    const successEmoji = pattern.successRate >= 0.7 ? '✓' : pattern.successRate >= 0.4 ? '~' : '✗';
    sections.push(`### ${successEmoji} ${pattern.category}`);
    sections.push(`- Success rate: ${Math.round(pattern.successRate * 100)}%`);
    sections.push(`- Avg improvement when followed: ${Math.round(pattern.avgImprovement)}%`);
    sections.push(`- Abandonment rate: ${Math.round(pattern.abandonmentRate * 100)}%`);

    if (pattern.successfulStrategies.length > 0) {
      sections.push(`- **What worked**: ${pattern.successfulStrategies.slice(0, 3).join('; ')}`);
    }
    if (pattern.failedStrategies.length > 0) {
      sections.push(`- **What didn't work**: ${pattern.failedStrategies.slice(0, 2).join('; ')}`);
    }
    sections.push('');
  }

  sections.push('### Recommendations');
  const highSuccess = sorted.filter(p => p.successRate >= 0.6);
  const highAbandonment = sorted.filter(p => p.abandonmentRate >= 0.5);

  if (highSuccess.length > 0) {
    sections.push(`- Lean into: ${highSuccess.map(p => p.category).join(', ')}`);
  }
  if (highAbandonment.length > 0) {
    sections.push(`- Keep simpler: ${highAbandonment.map(p => p.category).join(', ')} (high abandonment)`);
  }
  sections.push('- Reference past successes: "Last time we tried X and it helped by Y%"');
  sections.push('- Avoid repeating failed strategies');
  sections.push('');

  return sections.join('\n');
}
