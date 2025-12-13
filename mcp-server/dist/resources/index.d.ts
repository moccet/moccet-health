/**
 * MCP Resources
 *
 * Resources expose health data to the AI. The AI can read these
 * to understand the user's health context.
 */
import { Resource } from '@modelcontextprotocol/sdk/types.js';
export interface ServerConfig {
    supabaseUrl: string;
    supabaseKey: string;
    userEmail: string;
    baseUrl: string;
}
type ResourceHandler = (config: ServerConfig) => Promise<any>;
export declare const resourceDefinitions: Resource[];
export declare const resourceHandlers: Record<string, ResourceHandler>;
export {};
//# sourceMappingURL=index.d.ts.map