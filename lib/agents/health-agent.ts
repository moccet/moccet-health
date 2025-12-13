/**
 * Health Agent - LangGraph Implementation
 *
 * A truly autonomous agent that uses the ReAct pattern to reason and act
 * on health-related tasks. Inspired by GPT Agents and Comet.
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@supabase/supabase-js';
import {
  allTools,
  executeTool,
  getToolDescriptions,
  getToolRiskLevel,
  ToolContext,
} from './tools';
import {
  HEALTH_AGENT_SYSTEM_PROMPT,
  buildUserPrompt,
} from './prompts';

// =============================================================================
// STATE DEFINITION
// =============================================================================

// Define the state annotation for LangGraph
const AgentStateAnnotation = Annotation.Root({
  // Input
  taskId: Annotation<string>(),
  userEmail: Annotation<string>(),
  task: Annotation<string>(),  // The insight or task description
  userContext: Annotation<Record<string, any>>(),

  // Conversation
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // ReAct loop tracking
  currentStep: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  maxSteps: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 15,
  }),

  // Tool execution
  pendingToolCall: Annotation<{
    id: string;
    name: string;
    args: Record<string, any>;
    reasoning: string;
  } | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  toolResults: Annotation<Array<{
    tool: string;
    success: boolean;
    data?: any;
    error?: string;
  }>>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // Approval flow
  awaitingApproval: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
  }),
  approvedToolCallIds: Annotation<string[]>({
    reducer: (x, y) => [...new Set([...x, ...y])],
    default: () => [],
  }),
  rejectedToolCallIds: Annotation<string[]>({
    reducer: (x, y) => [...new Set([...x, ...y])],
    default: () => [],
  }),

  // Reasoning steps for UI display
  reasoning: Annotation<Array<{
    step: number;
    thought: string;
    action?: string;
    observation?: string;
    timestamp: string;
  }>>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // Status
  status: Annotation<'running' | 'awaiting_approval' | 'completed' | 'failed'>({
    reducer: (_, y) => y,
    default: () => 'running' as const,
  }),
  finalResult: Annotation<{
    success: boolean;
    summary: string;
    actionsCompleted: string[];
    recommendations?: string[];
  } | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
});

type AgentState = typeof AgentStateAnnotation.State;

// =============================================================================
// LLM SETUP
// =============================================================================

const llm = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0.3,
});

// =============================================================================
// TOOL CONTEXT BUILDER
// =============================================================================

async function buildToolContext(userEmail: string): Promise<ToolContext> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user's OAuth tokens
  const { data: connections } = await supabase
    .from('user_oauth_connections')
    .select('provider, access_token, refresh_token')
    .eq('user_email', userEmail);

  const accessTokens: Record<string, string> = {};
  for (const conn of connections || []) {
    accessTokens[conn.provider] = conn.access_token;
  }

  return {
    userEmail,
    accessTokens,
    supabase,
  };
}

// =============================================================================
// NODE FUNCTIONS
// =============================================================================

/**
 * Reason Node - GPT-4 decides what to do next
 */
async function reasonNode(state: AgentState): Promise<Partial<AgentState>> {
  const step = state.currentStep + 1;

  if (step > state.maxSteps) {
    return {
      status: 'failed',
      error: 'Maximum reasoning steps exceeded',
    };
  }

  // Build the prompt
  const userPrompt = buildUserPrompt(
    state.task,
    state.userContext,
    state.reasoning,
    state.toolResults
  );

  // Add tool descriptions to system prompt
  const systemPrompt = `${HEALTH_AGENT_SYSTEM_PROMPT}

## Available Tools
${getToolDescriptions()}

## Response Format
You must respond in JSON format with one of these structures:

1. To call a tool:
{
  "type": "tool_call",
  "thinking": "Your reasoning about why this tool is needed",
  "tool": "tool_name",
  "args": { ... tool arguments ... }
}

2. To complete the task:
{
  "type": "complete",
  "thinking": "Your reasoning about why the task is complete",
  "summary": "Summary of what was accomplished",
  "actionsCompleted": ["action1", "action2"],
  "recommendations": ["optional recommendations for user"]
}

Always respond with valid JSON only.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
    new HumanMessage(userPrompt),
  ]);

  const content = response.content as string;

  // Parse the response
  let parsed: any;
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    // If parsing fails, treat as completion with the raw response
    console.error('Failed to parse LLM response:', e);
    return {
      currentStep: step,
      reasoning: [{
        step,
        thought: content,
        timestamp: new Date().toISOString(),
      }],
      messages: [response],
      status: 'completed',
      finalResult: {
        success: true,
        summary: content,
        actionsCompleted: [],
      },
    };
  }

  // Handle tool call
  if (parsed.type === 'tool_call') {
    const toolCallId = `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      currentStep: step,
      reasoning: [{
        step,
        thought: parsed.thinking,
        action: `Calling ${parsed.tool}`,
        timestamp: new Date().toISOString(),
      }],
      messages: [response],
      pendingToolCall: {
        id: toolCallId,
        name: parsed.tool,
        args: parsed.args,
        reasoning: parsed.thinking,
      },
    };
  }

  // Handle completion
  if (parsed.type === 'complete') {
    return {
      currentStep: step,
      reasoning: [{
        step,
        thought: parsed.thinking,
        timestamp: new Date().toISOString(),
      }],
      messages: [response],
      status: 'completed',
      finalResult: {
        success: true,
        summary: parsed.summary,
        actionsCompleted: parsed.actionsCompleted || [],
        recommendations: parsed.recommendations,
      },
    };
  }

  // Unknown response type
  return {
    currentStep: step,
    messages: [response],
    status: 'failed',
    error: 'Unknown response type from LLM',
  };
}

/**
 * Check Approval Node - Determines if tool needs approval
 */
async function checkApprovalNode(state: AgentState): Promise<Partial<AgentState>> {
  const toolCall = state.pendingToolCall;
  if (!toolCall) {
    return {};
  }

  const riskLevel = getToolRiskLevel(toolCall.name);

  // Low risk tools auto-execute
  if (riskLevel === 'low') {
    return {
      approvedToolCallIds: [toolCall.id],
    };
  }

  // Check if already approved
  if (state.approvedToolCallIds.includes(toolCall.id)) {
    return {};
  }

  // Check if already rejected
  if (state.rejectedToolCallIds.includes(toolCall.id)) {
    return {
      pendingToolCall: null,
      reasoning: [{
        step: state.currentStep,
        thought: `Tool call ${toolCall.name} was rejected by user. Looking for alternatives.`,
        observation: 'User rejected this action',
        timestamp: new Date().toISOString(),
      }],
    };
  }

  // Needs approval - pause execution
  return {
    awaitingApproval: true,
    status: 'awaiting_approval',
  };
}

/**
 * Act Node - Execute the tool
 */
async function actNode(state: AgentState): Promise<Partial<AgentState>> {
  const toolCall = state.pendingToolCall;
  if (!toolCall) {
    return {};
  }

  // Build tool context
  const toolContext = await buildToolContext(state.userEmail);

  // Execute the tool
  const result = await executeTool(toolCall.name, toolCall.args, toolContext);

  // Update state
  return {
    pendingToolCall: null,
    awaitingApproval: false,
    toolResults: [{
      tool: toolCall.name,
      success: result.success,
      data: result.data,
      error: result.error,
    }],
    reasoning: [{
      step: state.currentStep,
      thought: state.reasoning[state.reasoning.length - 1]?.thought || '',
      action: `Executed ${toolCall.name}`,
      observation: result.success
        ? `Success: ${JSON.stringify(result.data).substring(0, 200)}...`
        : `Failed: ${result.error}`,
      timestamp: new Date().toISOString(),
    }],
    messages: [new HumanMessage(
      `Tool Result for ${toolCall.name}:\n${JSON.stringify(result, null, 2)}`
    )],
  };
}

/**
 * Complete Node - Finalize the task
 */
async function completeNode(state: AgentState): Promise<Partial<AgentState>> {
  // Save execution to database
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.from('agent_executions').insert({
    task_id: state.taskId,
    user_email: state.userEmail,
    thread_id: `thread_${state.taskId}`,
    status: state.status,
    reasoning_steps: state.reasoning,
    tool_calls: state.toolResults,
    final_result: state.finalResult,
    completed_at: new Date().toISOString(),
  });

  return {};
}

// =============================================================================
// ROUTING LOGIC
// =============================================================================

function routeAfterReason(state: AgentState): string {
  if (state.status === 'completed' || state.status === 'failed') {
    return 'complete';
  }

  if (state.pendingToolCall) {
    return 'check_approval';
  }

  // No tool call and not complete - continue reasoning
  return 'reason';
}

function routeAfterCheckApproval(state: AgentState): string {
  if (state.awaitingApproval) {
    return '__interrupt__';  // LangGraph interrupt
  }

  if (state.pendingToolCall && state.approvedToolCallIds.includes(state.pendingToolCall.id)) {
    return 'act';
  }

  // Tool was rejected, go back to reasoning
  return 'reason';
}

function routeAfterAct(state: AgentState): string {
  // Always go back to reasoning after acting
  return 'reason';
}

// =============================================================================
// BUILD THE GRAPH
// =============================================================================

export function createHealthAgent() {
  const graph = new StateGraph(AgentStateAnnotation)
    // Add nodes
    .addNode('reason', reasonNode)
    .addNode('check_approval', checkApprovalNode)
    .addNode('act', actNode)
    .addNode('complete', completeNode)

    // Add edges
    .addEdge(START, 'reason')
    .addConditionalEdges('reason', routeAfterReason, {
      check_approval: 'check_approval',
      complete: 'complete',
      reason: 'reason',
    })
    .addConditionalEdges('check_approval', routeAfterCheckApproval, {
      act: 'act',
      reason: 'reason',
      __interrupt__: '__interrupt__',
    })
    .addConditionalEdges('act', routeAfterAct, {
      reason: 'reason',
    })
    .addEdge('complete', END);

  return graph.compile({
    // Checkpointer will be added when using the agent
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export interface RunAgentInput {
  taskId: string;
  userEmail: string;
  task: string;
  userContext?: Record<string, any>;
}

/**
 * Run the health agent on a task
 */
export async function runHealthAgent(input: RunAgentInput) {
  const agent = createHealthAgent();

  const initialState: Partial<AgentState> = {
    taskId: input.taskId,
    userEmail: input.userEmail,
    task: input.task,
    userContext: input.userContext || {},
    currentStep: 0,
    maxSteps: 15,
  };

  return await agent.invoke(initialState);
}

/**
 * Resume agent after approval
 */
export async function resumeAgentWithApproval(
  state: AgentState,
  approved: boolean
): Promise<AgentState> {
  const agent = createHealthAgent();

  const toolCall = state.pendingToolCall;
  if (!toolCall) {
    return state;
  }

  const updatedState: Partial<AgentState> = {
    ...state,
    awaitingApproval: false,
    status: 'running',
  };

  if (approved) {
    updatedState.approvedToolCallIds = [toolCall.id];
  } else {
    updatedState.rejectedToolCallIds = [toolCall.id];
  }

  return await agent.invoke(updatedState);
}

/**
 * Stream agent execution
 */
export async function* streamHealthAgent(input: RunAgentInput) {
  const agent = createHealthAgent();

  const initialState: Partial<AgentState> = {
    taskId: input.taskId,
    userEmail: input.userEmail,
    task: input.task,
    userContext: input.userContext || {},
    currentStep: 0,
    maxSteps: 15,
  };

  for await (const event of agent.stream(initialState)) {
    yield event;
  }
}

export type { AgentState };
