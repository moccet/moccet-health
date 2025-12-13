/**
 * MCP Prompts
 *
 * Pre-built prompt templates for common health tasks.
 * These help users get started with specific analyses.
 */
import { Prompt, GetPromptResult } from '@modelcontextprotocol/sdk/types.js';
export interface ServerConfig {
    supabaseUrl: string;
    supabaseKey: string;
    userEmail: string;
    baseUrl: string;
}
type PromptHandler = (args: Record<string, any>, config: ServerConfig) => Promise<GetPromptResult>;
export declare const promptDefinitions: Prompt[];
export declare const promptHandlers: Record<string, PromptHandler>;
export {};
//# sourceMappingURL=index.d.ts.map