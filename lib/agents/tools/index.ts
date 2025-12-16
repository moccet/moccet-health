/**
 * Tool Index
 * Exports all tools for the Health Agent
 */

import {
  ToolDefinition,
  ToolContext,
  ToolResult,
  RiskLevel,
  getToolRiskLevel,
  TOOL_RISK_LEVELS,
} from './types';
import { healthDataTools } from './health-data';
import { calendarTools } from './calendar';
import { spotifyTools } from './spotify';
import { supplementTools } from './supplements';
import { shoppingTools } from './shopping';
import { bookingTools } from './booking';
import { emailTools } from './email';

// Export all tools
export const allTools: ToolDefinition[] = [
  ...healthDataTools,
  ...calendarTools,
  ...spotifyTools,
  ...supplementTools,
  ...shoppingTools,
  ...bookingTools,
  ...emailTools,
];

// Tool map for quick lookup
export const toolMap: Map<string, ToolDefinition> = new Map(
  allTools.map((tool) => [tool.name, tool])
);

// Get tool by name
export function getTool(name: string): ToolDefinition | undefined {
  return toolMap.get(name);
}

// Execute a tool by name
export async function executeTool(
  toolName: string,
  params: any,
  context: any
): Promise<any> {
  const tool = toolMap.get(toolName);
  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  // Validate parameters
  try {
    const validatedParams = tool.parameters.parse(params);
    return await tool.execute(validatedParams, context);
  } catch (error) {
    return {
      success: false,
      error: `Parameter validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Get tool descriptions for LLM
export function getToolDescriptions(): string {
  return allTools
    .map((tool) => {
      const paramSchema = tool.parameters.shape;
      const paramDesc = Object.entries(paramSchema)
        .map(([key, schema]: [string, any]) => {
          const desc = schema.description || '';
          const isOptional = schema.isOptional?.() ?? false;
          return `    - ${key}${isOptional ? ' (optional)' : ''}: ${desc}`;
        })
        .join('\n');

      return `
### ${tool.name}
Risk Level: ${tool.riskLevel.toUpperCase()}
${tool.description}

Parameters:
${paramDesc || '    None'}
`;
    })
    .join('\n---\n');
}

// Get tools that require approval
export function getToolsRequiringApproval(): string[] {
  return allTools
    .filter((tool) => tool.riskLevel === 'medium' || tool.riskLevel === 'high')
    .map((tool) => tool.name);
}

// Export types and utilities
export type { ToolDefinition, ToolContext, ToolResult, RiskLevel };
export { getToolRiskLevel, TOOL_RISK_LEVELS };

// Export individual tool sets for granular imports
export { healthDataTools } from './health-data';
export { calendarTools } from './calendar';
export { spotifyTools } from './spotify';
export { supplementTools } from './supplements';
export { shoppingTools } from './shopping';
export { bookingTools } from './booking';
export { emailTools } from './email';
