# Moccet Health MCP Server

A Model Context Protocol (MCP) server that exposes your health ecosystem to AI assistants like Claude.

## What is MCP?

MCP (Model Context Protocol) is a standard way for AI models to access external data and tools. Instead of the AI making API calls, the data is exposed as **resources** that the AI can read, and actions are exposed as **tools** the AI can use.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  MCP SERVER: @moccet/health                     │
│                                                                 │
│  RESOURCES (Your health data)                                  │
│  ────────────────────────────                                  │
│  health://context/unified     → Full health profile            │
│  health://blood/biomarkers    → Blood test results             │
│  health://blood/deficiencies  → Nutrient deficiencies          │
│  health://oura/sleep          → Sleep data                     │
│  health://oura/recovery       → HRV & readiness                │
│  health://dexcom/glucose      → CGM readings                   │
│  health://insights            → AI-generated insights          │
│  health://priorities          → Priority health areas          │
│                                                                 │
│  TOOLS (Actions the AI can take)                               │
│  ───────────────────────────────                               │
│  calendar_find_slots          → Find available times           │
│  calendar_create_event        → Schedule events                │
│  spotify_create_playlist      → Create playlists               │
│  supplements_search           → Find supplements               │
│  shopping_add_to_cart         → Add to cart                    │
│  booking_schedule             → Book appointments              │
│                                                                 │
│  PROMPTS (Pre-built templates)                                 │
│  ─────────────────────────────                                 │
│  analyze-deficiency           → Deep dive on a biomarker       │
│  optimize-sleep               → Sleep improvement plan         │
│  supplement-protocol          → Supplement recommendations     │
│  weekly-health-review         → Weekly summary                 │
└─────────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure Environment

Create a `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
MCP_USER_EMAIL=user@example.com
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "moccet-health": {
      "command": "node",
      "args": ["/path/to/moccet-new/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "your_supabase_url",
        "SUPABASE_SERVICE_ROLE_KEY": "your_service_role_key",
        "MCP_USER_EMAIL": "your_email@example.com",
        "NEXT_PUBLIC_BASE_URL": "https://your-app.vercel.app"
      }
    }
  }
}
```

Then restart Claude Desktop. You'll see the Moccet Health tools available.

## Using the Prompts

In Claude Desktop, you can use the pre-built prompts:

- **"Use the analyze-deficiency prompt for vitamin_d"** - Deep analysis of your Vitamin D status
- **"Use the weekly-health-review prompt"** - Get your weekly health summary
- **"Use the supplement-protocol prompt with budget medium"** - Get supplement recommendations

## Resources

The AI automatically has access to all your health data:

```
Claude sees:
"Reading health://context/unified...
Your unified health profile shows:
- Sleep: 6.2 hrs avg (below optimal 7-8hrs), score 68/100
- HRV: 45ms (moderate), trending down from 52ms
- Vitamin D: 15 ng/mL (deficient, optimal is 40-60)
- Glucose: avg 108 mg/dL, 12 spikes this week..."
```

## Tools

Tools let Claude take actions on your behalf:

| Tool | Risk Level | Requires Approval |
|------|------------|-------------------|
| calendar_find_slots | Low | No |
| calendar_create_event | Medium | Yes |
| spotify_create_playlist | Low | No |
| supplements_search | Low | No |
| shopping_add_to_cart | Medium | Yes |
| shopping_purchase | High | Yes |
| booking_schedule | High | Yes |

## Development

Run in development mode with auto-reload:

```bash
npm run dev
```

Test with MCP Inspector:

```bash
npm run inspector
```

## Security

- The server uses your Supabase service role key for database access
- OAuth tokens are fetched from your existing user_oauth_connections table
- High-risk actions always require explicit user confirmation
- All actions are logged to agent_action_log table
