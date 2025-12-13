#!/usr/bin/env node
/**
 * Moccet Health MCP Server
 *
 * Exposes the user's health ecosystem as MCP resources and tools.
 * Works with Claude Desktop, web clients, and mobile apps.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListResourcesRequestSchema, ListToolsRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { resourceHandlers, resourceDefinitions } from './resources/index.js';
import { toolHandlers, toolDefinitions } from './tools/index.js';
import { promptHandlers, promptDefinitions } from './prompts/index.js';
// Server configuration from environment
const config = {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    userEmail: process.env.MCP_USER_EMAIL || '', // Set by client
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
};
// Create MCP server
const server = new Server({
    name: '@moccet/health',
    version: '1.0.0',
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});
// =============================================================================
// RESOURCES - Health data exposed to AI
// =============================================================================
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
        resources: resourceDefinitions,
    };
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const handler = resourceHandlers[uri];
    if (!handler) {
        throw new Error(`Unknown resource: ${uri}`);
    }
    const content = await handler(config);
    return {
        contents: [
            {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(content, null, 2),
            },
        ],
    };
});
// =============================================================================
// TOOLS - Actions the AI can take
// =============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: toolDefinitions,
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];
    if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
    }
    try {
        const result = await handler(args || {}, config);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    }),
                },
            ],
            isError: true,
        };
    }
});
// =============================================================================
// PROMPTS - Pre-built prompt templates
// =============================================================================
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: promptDefinitions,
    };
});
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = promptHandlers[name];
    if (!handler) {
        throw new Error(`Unknown prompt: ${name}`);
    }
    const prompt = await handler(args || {}, config);
    return prompt;
});
// =============================================================================
// START SERVER
// =============================================================================
async function main() {
    // Validate configuration
    if (!config.supabaseUrl || !config.supabaseKey) {
        console.error('Missing required environment variables:');
        console.error('  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
        console.error('  SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }
    // Start with stdio transport (for Claude Desktop)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Moccet Health MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map