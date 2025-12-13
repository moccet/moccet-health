/**
 * Health Agent Module
 *
 * Exports the autonomous health agent and related utilities.
 *
 * Usage:
 * ```typescript
 * import { runHealthAgent, streamHealthAgent } from '@/lib/agents';
 *
 * // Run agent synchronously
 * const result = await runHealthAgent({
 *   taskId: 'task_123',
 *   userEmail: 'user@example.com',
 *   task: 'Your Vitamin D is low. Consider supplementation.',
 * });
 *
 * // Stream agent execution
 * for await (const event of streamHealthAgent({...})) {
 *   console.log(event);
 * }
 * ```
 */

// Main agent exports
export {
  createHealthAgent,
  runHealthAgent,
  resumeAgentWithApproval,
  streamHealthAgent,
  type AgentState,
} from './health-agent';

// Checkpointer for state persistence
export { SupabaseCheckpointer, createCheckpointer } from './checkpointer';

// Tool exports
export {
  allTools,
  toolMap,
  getTool,
  executeTool,
  getToolDescriptions,
  getToolsRequiringApproval,
  getToolRiskLevel,
  TOOL_RISK_LEVELS,
  type ToolDefinition,
  type ToolContext,
  type ToolResult,
  type RiskLevel,
} from './tools';

// Prompts
export {
  HEALTH_AGENT_SYSTEM_PROMPT,
  buildUserPrompt,
} from './prompts';
