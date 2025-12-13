/**
 * Dependency Resolver
 *
 * Resolves task execution order using topological sort.
 * Handles dependency graphs and detects cycles.
 */

export interface TaskNode {
  taskId: string;
  agentType: string;
  dependsOn: string[]; // Task IDs this task depends on
  canRunParallel: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ExecutionGroup {
  groupIndex: number;
  taskIds: string[];
  canRunInParallel: boolean;
}

export interface ResolutionResult {
  success: boolean;
  executionOrder: string[];
  executionGroups: ExecutionGroup[];
  hasCycle: boolean;
  cycleNodes?: string[];
}

/**
 * Resolve execution order using Kahn's algorithm (topological sort)
 */
export function resolveExecutionOrder(tasks: TaskNode[]): ResolutionResult {
  // Build adjacency list and in-degree map
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const taskMap = new Map<string, TaskNode>();

  // Initialize
  for (const task of tasks) {
    graph.set(task.taskId, []);
    inDegree.set(task.taskId, 0);
    taskMap.set(task.taskId, task);
  }

  // Build graph edges
  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      if (graph.has(depId)) {
        graph.get(depId)!.push(task.taskId);
        inDegree.set(task.taskId, (inDegree.get(task.taskId) || 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  const executionOrder: string[] = [];
  const executionGroups: ExecutionGroup[] = [];

  // Find all nodes with no incoming edges
  for (const [taskId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(taskId);
    }
  }

  let groupIndex = 0;

  while (queue.length > 0) {
    // Process all nodes at current level (can run in parallel)
    const currentLevel = [...queue];
    queue.length = 0;

    // Check if tasks at this level can run in parallel
    const canRunParallel = currentLevel.every((taskId) => {
      const task = taskMap.get(taskId);
      return task?.canRunParallel ?? false;
    });

    executionGroups.push({
      groupIndex,
      taskIds: currentLevel,
      canRunInParallel: canRunParallel && currentLevel.length > 1,
    });

    for (const taskId of currentLevel) {
      executionOrder.push(taskId);

      // Reduce in-degree of neighbors
      for (const neighbor of graph.get(taskId) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    groupIndex++;
  }

  // Check for cycle
  const hasCycle = executionOrder.length !== tasks.length;

  if (hasCycle) {
    // Find nodes in cycle (remaining nodes with in-degree > 0)
    const cycleNodes = Array.from(inDegree.entries())
      .filter(([_, degree]) => degree > 0)
      .map(([taskId]) => taskId);

    return {
      success: false,
      executionOrder: [],
      executionGroups: [],
      hasCycle: true,
      cycleNodes,
    };
  }

  return {
    success: true,
    executionOrder,
    executionGroups,
    hasCycle: false,
  };
}

/**
 * Optimize execution order for better performance
 * - Low-risk, auto-executable tasks first
 * - Parallel execution where possible
 */
export function optimizeExecutionOrder(
  tasks: TaskNode[],
  baseOrder: string[]
): string[] {
  // Within each dependency level, sort by:
  // 1. Low risk first (can auto-execute)
  // 2. Faster estimated duration first

  const taskMap = new Map<string, TaskNode>();
  for (const task of tasks) {
    taskMap.set(task.taskId, task);
  }

  // Group by dependency level
  const levels: Map<number, string[]> = new Map();
  const levelMap: Map<string, number> = new Map();

  // Calculate levels
  for (let i = 0; i < baseOrder.length; i++) {
    const taskId = baseOrder[i];
    const task = taskMap.get(taskId)!;

    // Level is max level of dependencies + 1
    let maxDepLevel = -1;
    for (const depId of task.dependsOn) {
      const depLevel = levelMap.get(depId) ?? -1;
      maxDepLevel = Math.max(maxDepLevel, depLevel);
    }

    const level = maxDepLevel + 1;
    levelMap.set(taskId, level);

    if (!levels.has(level)) {
      levels.set(level, []);
    }
    levels.get(level)!.push(taskId);
  }

  // Sort within each level
  const riskPriority: Record<string, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };

  const optimizedOrder: string[] = [];

  const sortedLevels = Array.from(levels.keys()).sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const levelTasks = levels.get(level)!;

    levelTasks.sort((a, b) => {
      const taskA = taskMap.get(a)!;
      const taskB = taskMap.get(b)!;

      // Sort by risk level (low first)
      return riskPriority[taskA.riskLevel] - riskPriority[taskB.riskLevel];
    });

    optimizedOrder.push(...levelTasks);
  }

  return optimizedOrder;
}

/**
 * Check if a task's dependencies are all completed
 */
export function areDependenciesMet(
  taskId: string,
  tasks: TaskNode[],
  completedTaskIds: Set<string>
): boolean {
  const task = tasks.find((t) => t.taskId === taskId);
  if (!task) return false;

  for (const depId of task.dependsOn) {
    if (!completedTaskIds.has(depId)) {
      return false;
    }
  }

  return true;
}

/**
 * Get tasks that are ready to execute (dependencies met)
 */
export function getReadyTasks(
  tasks: TaskNode[],
  completedTaskIds: Set<string>,
  inProgressTaskIds: Set<string>
): TaskNode[] {
  return tasks.filter((task) => {
    // Skip if already completed or in progress
    if (completedTaskIds.has(task.taskId) || inProgressTaskIds.has(task.taskId)) {
      return false;
    }

    // Check if all dependencies are met
    return areDependenciesMet(task.taskId, tasks, completedTaskIds);
  });
}
