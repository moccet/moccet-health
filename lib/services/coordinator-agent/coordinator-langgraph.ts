/**
 * Coordinator Agent using LangGraph
 *
 * This shows how the multi-agent orchestration would work with LangGraph.
 * Benefits:
 * - Visual state machine (can export to diagram)
 * - Built-in persistence/checkpointing
 * - Human-in-the-loop approval flows
 * - Parallel branch execution
 * - Automatic retry/error handling
 *
 * To use this, install: npm install @langchain/langgraph @langchain/openai
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

// =============================================================================
// STATE DEFINITION
// =============================================================================

// The state that flows through the graph
interface CoordinatorState {
  // Input
  userEmail: string;
  insights: Insight[];

  // Planning phase
  plannedTasks: PlannedTask[];
  taskGraph: TaskGraphNode[];
  executionOrder: string[];

  // Approval phase
  tasksNeedingApproval: string[];
  approvedTasks: string[];
  rejectedTasks: string[];

  // Execution phase
  currentTaskIndex: number;
  completedTasks: string[];
  failedTasks: string[];
  taskResults: Record<string, any>;

  // Status
  status: 'planning' | 'awaiting_approval' | 'executing' | 'completed' | 'failed';
  error?: string;
}

interface Insight {
  id: string;
  title: string;
  category: string;
  recommendation?: string;
}

interface PlannedTask {
  id: string;
  agentType: 'calendar' | 'spotify' | 'supplement' | 'shopping' | 'health_booking';
  title: string;
  description: string;
  params: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  dependsOn: string[];
  sourceInsightId: string;
}

interface TaskGraphNode {
  taskId: string;
  dependsOn: string[];
  canAutoExecute: boolean;
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
}

// =============================================================================
// LLM SETUP
// =============================================================================

const llm = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0.3,
});

// =============================================================================
// NODE FUNCTIONS (each is a step in the graph)
// =============================================================================

/**
 * Node 1: Plan tasks from insights
 * Uses GPT-4 to analyze insights and create a task plan
 */
async function planTasks(state: CoordinatorState): Promise<Partial<CoordinatorState>> {
  const systemPrompt = `You are a health optimization coordinator.
Analyze these health insights and create a plan of agent tasks to address them.

Available agents:
- calendar: Schedule events, time blocks
- spotify: Create playlists for mood/focus
- supplement: Analyze biomarkers, recommend supplements
- shopping: Purchase products
- health_booking: Book medical appointments

For each task, specify:
- agentType: which agent to use
- title: what the task does
- riskLevel: low (spotify), medium (calendar, supplement), high (shopping, health_booking)
- dependsOn: task IDs this depends on (e.g., shopping depends on supplement analysis)

Return JSON array of tasks.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(`Insights to address:\n${JSON.stringify(state.insights, null, 2)}`),
  ]);

  const tasks: PlannedTask[] = JSON.parse(response.content as string);

  // Build task graph
  const taskGraph: TaskGraphNode[] = tasks.map(task => ({
    taskId: task.id,
    dependsOn: task.dependsOn,
    canAutoExecute: task.riskLevel === 'low',
    status: 'pending',
  }));

  // Topological sort for execution order
  const executionOrder = topologicalSort(taskGraph);

  // Determine which tasks need approval
  const tasksNeedingApproval = tasks
    .filter(t => t.riskLevel !== 'low')
    .map(t => t.id);

  return {
    plannedTasks: tasks,
    taskGraph,
    executionOrder,
    tasksNeedingApproval,
    status: tasksNeedingApproval.length > 0 ? 'awaiting_approval' : 'executing',
  };
}

/**
 * Node 2: Wait for human approval (interrupt point)
 * LangGraph will pause here until approval is received
 */
async function awaitApproval(state: CoordinatorState): Promise<Partial<CoordinatorState>> {
  // In LangGraph, this node represents an interrupt point
  // The graph pauses here and waits for external input
  // When resumed, approvedTasks/rejectedTasks will be populated

  console.log('⏸️  Waiting for user approval...');
  console.log(`Tasks needing approval: ${state.tasksNeedingApproval.join(', ')}`);

  // This would be populated by the resume call
  return {
    status: 'executing',
  };
}

/**
 * Node 3: Execute next task
 */
async function executeNextTask(state: CoordinatorState): Promise<Partial<CoordinatorState>> {
  const taskId = state.executionOrder[state.currentTaskIndex];
  const task = state.plannedTasks.find(t => t.id === taskId);

  if (!task) {
    return {
      currentTaskIndex: state.currentTaskIndex + 1,
    };
  }

  // Check if task was rejected
  if (state.rejectedTasks.includes(taskId)) {
    console.log(`⏭️  Skipping rejected task: ${task.title}`);
    return {
      currentTaskIndex: state.currentTaskIndex + 1,
    };
  }

  // Check dependencies
  const depsComplete = task.dependsOn.every(
    depId => state.completedTasks.includes(depId)
  );

  if (!depsComplete) {
    console.log(`⏳ Task ${task.title} blocked - dependencies not met`);
    return {
      failedTasks: [...state.failedTasks, taskId],
      currentTaskIndex: state.currentTaskIndex + 1,
    };
  }

  console.log(`🚀 Executing: ${task.title} (${task.agentType})`);

  try {
    // Execute based on agent type
    const result = await executeAgent(task, state.userEmail);

    return {
      completedTasks: [...state.completedTasks, taskId],
      taskResults: { ...state.taskResults, [taskId]: result },
      currentTaskIndex: state.currentTaskIndex + 1,
    };
  } catch (error) {
    console.error(`❌ Task failed: ${task.title}`, error);
    return {
      failedTasks: [...state.failedTasks, taskId],
      currentTaskIndex: state.currentTaskIndex + 1,
    };
  }
}

/**
 * Node 4: Mark complete
 */
async function markComplete(state: CoordinatorState): Promise<Partial<CoordinatorState>> {
  const allComplete = state.completedTasks.length === state.executionOrder.length;
  const hasFailures = state.failedTasks.length > 0;

  return {
    status: allComplete ? 'completed' : hasFailures ? 'failed' : 'completed',
  };
}

// =============================================================================
// CONDITIONAL EDGES (routing logic)
// =============================================================================

function shouldAwaitApproval(state: CoordinatorState): string {
  if (state.tasksNeedingApproval.length > 0 && state.approvedTasks.length === 0) {
    return 'await_approval';
  }
  return 'execute';
}

function hasMoreTasks(state: CoordinatorState): string {
  if (state.currentTaskIndex < state.executionOrder.length) {
    return 'execute_next';
  }
  return 'complete';
}

// =============================================================================
// BUILD THE GRAPH
// =============================================================================

export function createCoordinatorGraph() {
  const graph = new StateGraph<CoordinatorState>({
    channels: {
      userEmail: { default: () => '' },
      insights: { default: () => [] },
      plannedTasks: { default: () => [] },
      taskGraph: { default: () => [] },
      executionOrder: { default: () => [] },
      tasksNeedingApproval: { default: () => [] },
      approvedTasks: { default: () => [] },
      rejectedTasks: { default: () => [] },
      currentTaskIndex: { default: () => 0 },
      completedTasks: { default: () => [] },
      failedTasks: { default: () => [] },
      taskResults: { default: () => ({}) },
      status: { default: () => 'planning' as const },
      error: { default: () => undefined },
    },
  });

  // Add nodes
  graph.addNode('plan', planTasks);
  graph.addNode('await_approval', awaitApproval);
  graph.addNode('execute_next', executeNextTask);
  graph.addNode('complete', markComplete);

  // Add edges
  graph.addEdge(START, 'plan');

  graph.addConditionalEdges('plan', shouldAwaitApproval, {
    await_approval: 'await_approval',
    execute: 'execute_next',
  });

  graph.addEdge('await_approval', 'execute_next');

  graph.addConditionalEdges('execute_next', hasMoreTasks, {
    execute_next: 'execute_next',
    complete: 'complete',
  });

  graph.addEdge('complete', END);

  return graph.compile({
    // Enable interrupts for human-in-the-loop
    interruptBefore: ['await_approval'],
  });
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

export async function runCoordinatorExample() {
  const coordinator = createCoordinatorGraph();

  // Initial state
  const initialState: Partial<CoordinatorState> = {
    userEmail: 'user@example.com',
    insights: [
      { id: '1', title: 'Low Vitamin D', category: 'BLOOD', recommendation: 'Supplement with D3' },
      { id: '2', title: 'High stress detected', category: 'STRESS', recommendation: 'Schedule breaks' },
      { id: '3', title: 'Sleep quality declining', category: 'SLEEP', recommendation: 'Create wind-down playlist' },
    ],
  };

  console.log('🎯 Starting Coordinator Agent...\n');

  // Run until first interrupt (approval needed)
  let state = await coordinator.invoke(initialState);

  console.log('\n📋 Plan created:');
  console.log(state.plannedTasks.map((t: PlannedTask) => `  - ${t.title} (${t.agentType}, ${t.riskLevel} risk)`).join('\n'));

  if (state.status === 'awaiting_approval') {
    console.log('\n⏸️  Paused for approval...');

    // Simulate user approval
    const approved = state.tasksNeedingApproval; // Approve all

    // Resume with approvals
    state = await coordinator.invoke({
      ...state,
      approvedTasks: approved,
    });
  }

  console.log('\n✅ Final status:', state.status);
  console.log('Completed tasks:', state.completedTasks);
  console.log('Failed tasks:', state.failedTasks);

  return state;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function topologicalSort(nodes: TaskGraphNode[]): string[] {
  const result: string[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(nodeId: string) {
    if (temp.has(nodeId)) throw new Error('Cycle detected');
    if (visited.has(nodeId)) return;

    temp.add(nodeId);
    const node = nodes.find(n => n.taskId === nodeId);
    if (node) {
      for (const dep of node.dependsOn) {
        visit(dep);
      }
    }
    temp.delete(nodeId);
    visited.add(nodeId);
    result.push(nodeId);
  }

  for (const node of nodes) {
    visit(node.taskId);
  }

  return result;
}

async function executeAgent(task: PlannedTask, userEmail: string): Promise<any> {
  // This would call the actual agent APIs
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/agent/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: task.id,
      email: userEmail,
      skipPlanning: true, // Already planned
    }),
  });

  return response.json();
}

// =============================================================================
// GRAPH VISUALIZATION (export to Mermaid diagram)
// =============================================================================

export const GRAPH_MERMAID = `
graph TD
    START((Start)) --> plan[Plan Tasks]
    plan --> check{Needs Approval?}
    check -->|Yes| await[Await Approval]
    check -->|No| exec[Execute Next Task]
    await --> exec
    exec --> more{More Tasks?}
    more -->|Yes| exec
    more -->|No| complete[Mark Complete]
    complete --> END((End))

    style await fill:#ffeb3b
    style exec fill:#4caf50
    style complete fill:#2196f3
`;
