/**
 * MCP Tools
 *
 * Tools allow the AI to take actions on behalf of the user.
 * Risk levels determine if user approval is required.
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';
export interface ServerConfig {
    supabaseUrl: string;
    supabaseKey: string;
    userEmail: string;
    baseUrl: string;
}
type ToolHandler = (args: Record<string, any>, config: ServerConfig) => Promise<any>;
export declare const toolDefinitions: Tool[];
export declare const toolHandlers: Record<string, ToolHandler>;
export {};
//# sourceMappingURL=index.d.ts.map