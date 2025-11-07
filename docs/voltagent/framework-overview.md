# VoltAgent Framework Overview

## What is VoltAgent?

VoltAgent is an AI agent orchestration framework that makes it easy to build production-ready AI agents with:

- **Tool Calling** - Give agents access to functions and APIs
- **Workflows** - Multi-step business process automation
- **Memory** - Persistent conversation context
- **Monitoring** - Built-in observability with VoltOps
- **Type Safety** - Full TypeScript support with Zod validation

## Core Concepts

### Agents

Agents are AI assistants with specific roles, instructions, and capabilities:

```typescript
const commerceAgent = new Agent({
  name: "commerce-assistant",
  instructions: `Commerce assistant. Find products, check stock, process orders.`,
  model: groq("openai/gpt-oss-20b"),
  tools: [searchProductsTool, createOrderTool, ...],
  memory,
});
```

**Key Properties:**
- `name` - Unique identifier for the agent
- `instructions` - System prompt defining agent's role and behavior
- `model` - LLM to use (supports multiple providers)
- `tools` - Array of tools the agent can call
- `memory` - Conversation history storage

### Tools

Tools are functions that agents can call to interact with external systems:

```typescript
export const searchProductsTool = createTool({
  name: "searchProducts",
  description: "Search for products by name or category",
  parameters: z.object({
    query: z.string().describe("Search query"),
    providerId: z.string().optional(),
  }),
  execute: async ({ query, providerId }) => {
    const results = await CommerceDB.searchProducts(query, providerId);
    return {
      success: true,
      products: results,
    };
  },
});
```

**Key Properties:**
- `name` - Tool identifier
- `description` - Tells the LLM when to use this tool
- `parameters` - Zod schema for validation and LLM function calling
- `execute` - Async function that performs the operation

### Workflows

Workflows orchestrate multi-step processes with conditional logic:

```typescript
export const orderProcessingWorkflow = createWorkflow({
  name: "orderProcessing",
  triggerSchema: z.object({
    userId: z.string(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number(),
    })),
  }),
  steps: {
    validateInventory: step(
      { schema: z.object({ available: z.boolean() }) },
      async ({ trigger }) => {
        // Check inventory for all items
        return { available: true };
      }
    ),

    calculateTotal: step(
      { schema: z.object({ total: z.number() }) },
      async ({ trigger, validateInventory }) => {
        // Calculate order total
        return { total: 99.99 };
      }
    ),

    createOrder: step(
      { schema: z.object({ orderId: z.string() }) },
      async ({ trigger, calculateTotal }) => {
        // Create the order
        return { orderId: "ORD-123" };
      }
    ),
  },
});
```

**Key Properties:**
- `name` - Workflow identifier
- `triggerSchema` - Input validation
- `steps` - Ordered execution steps with dependencies

### Memory

Persistent storage for conversation history:

```typescript
const memory = new Memory({
  storage: new LibSQLMemoryAdapter({
    url: "file:./.voltagent/memory.db",
    logger,
  }),
});
```

**Storage Adapters:**
- `LibSQLMemoryAdapter` - SQLite-based storage
- `InMemoryAdapter` - Temporary storage (not persistent)

### VoltAgent Instance

The main orchestrator that brings everything together:

```typescript
const voltAgent = new VoltAgent({
  agents: {
    commerce: commerceAgent,
  },
  workflows: {
    orderProcessing: orderProcessingWorkflow,
  },
  server: honoServer(),
  logger,
  voltOpsClient: new VoltOpsClient({
    publicKey: process.env.VOLTAGENT_PUBLIC_KEY,
    secretKey: process.env.VOLTAGENT_SECRET_KEY,
  }),
});
```

## Agent Lifecycle

### 1. Request Received
User sends message via API or VoltOps Console:

```json
{
  "message": "Find me coffee products",
  "userId": "user-123",
  "conversationId": "conv-456"
}
```

### 2. Agent Processing
1. Load conversation history from memory
2. Add user message to context
3. Send to LLM with available tools
4. LLM decides which tools to call (if any)

### 3. Tool Execution
1. Validate parameters with Zod schema
2. Execute tool function
3. Return results to LLM
4. LLM may call more tools or return final answer

### 4. Response
1. Save assistant response to memory
2. Return to user
3. Log to VoltOps (if configured)

## Tool Development

### Creating a Tool

```typescript
import { createTool } from "@voltagent/core";
import { z } from "zod";

export const myTool = createTool({
  // Unique name (used in API and logging)
  name: "myTool",

  // Description helps LLM know when to use this tool
  description: "Does something useful with data",

  // Zod schema for parameters
  parameters: z.object({
    requiredParam: z.string().describe("What this param does"),
    optionalParam: z.number().optional().describe("Optional parameter"),
  }),

  // Async execution function
  execute: async ({ requiredParam, optionalParam }) => {
    try {
      // Do the work
      const result = await doSomething(requiredParam);

      // Return structured data
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      // Handle errors gracefully
      return {
        success: false,
        error: error.message,
      };
    }
  },
});
```

### Best Practices

1. **Clear Descriptions** - Help the LLM understand when to use the tool
2. **Detailed Parameter Descriptions** - Guide the LLM on what values to provide
3. **Structured Returns** - Consistent response format
4. **Error Handling** - Catch and return errors gracefully
5. **Validation** - Use Zod for type safety and runtime validation

## Agent Configuration

### Model Selection

VoltAgent supports multiple LLM providers:

```typescript
import { groq } from "@ai-sdk/groq";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";

// Groq (fast, cost-effective)
model: groq("openai/gpt-oss-20b")

// Anthropic (high quality)
model: anthropic("claude-3-5-sonnet-20241022")

// OpenAI (widely compatible)
model: openai("gpt-4-turbo")
```

### Instructions

Write clear, concise instructions:

```typescript
instructions: `
You are a commerce assistant.

CAPABILITIES:
- Search products by name or category
- Check inventory availability
- Process customer orders
- Manage provider information

RULES:
- Always check inventory before confirming orders
- Extract exact parameters from user requests
- Use 'default_provider' if providerId not specified
- Confirm destructive operations before executing

TONE:
- Professional and helpful
- Concise responses
- Ask clarifying questions when needed
`
```

### Tool Selection

Only include tools the agent needs:

```typescript
tools: [
  // Search and retrieval
  searchProductsTool,
  semanticSearchTool,
  getProductDetailsTool,

  // Inventory
  checkInventoryTool,
  updateInventoryTool,

  // Orders
  createOrderTool,

  // Management (for admin agents only)
  createProductTool,
  updateProductTool,
  bulkCreateProductsTool,
]
```

## Server Integration

VoltAgent includes a built-in HTTP server (Hono):

```typescript
import { honoServer } from "@voltagent/server-hono";

const voltAgent = new VoltAgent({
  server: honoServer({
    port: 4310, // Custom port (optional)
  }),
  // ...
});
```

**Endpoints:**
- `GET /health` - Health check
- `POST /api/agents/:agentName/messages` - Send message to agent
- `GET /api/workflows/:workflowName` - Get workflow info
- `POST /api/workflows/:workflowName/execute` - Execute workflow
- `GET /ui` - Swagger UI documentation

## Monitoring with VoltOps

VoltOps provides real-time monitoring and debugging:

```typescript
import { VoltOpsClient } from "@voltagent/core";

voltOpsClient: new VoltOpsClient({
  publicKey: process.env.VOLTAGENT_PUBLIC_KEY,
  secretKey: process.env.VOLTAGENT_SECRET_KEY,
})
```

**Features:**
- Real-time conversation logs
- Tool call inspection
- Error tracking
- Performance metrics
- Agent testing console

Visit [console.voltagent.dev](https://console.voltagent.dev) to monitor your agents.

## Logging

VoltAgent uses Pino for structured logging:

```typescript
import { createPinoLogger } from "@voltagent/logger";

const logger = createPinoLogger({
  name: "my-app",
  level: "info", // 'debug', 'info', 'warn', 'error'
});
```

## Best Practices

1. **Single Responsibility** - Each agent should have a clear, focused role
2. **Tool Reusability** - Create generic tools that multiple agents can use
3. **Error Handling** - Always handle errors gracefully in tools
4. **Validation** - Use Zod schemas for all inputs and outputs
5. **Logging** - Log important operations for debugging
6. **Testing** - Test tools independently before adding to agents
7. **Documentation** - Document agent capabilities and tool parameters

## Resources

- [VoltAgent Documentation](https://voltagent.dev/docs)
- [VoltAgent GitHub](https://github.com/voltagent/voltagent)
- [VoltOps Console](https://console.voltagent.dev)
- [Discord Community](https://discord.gg/voltagent)

## Next Steps

- [Agent Development](./agent-development.md)
- [Tool Development](./tool-development.md)
- [Memory Management](./memory-management.md)
- [API Reference](../api/tool-reference.md)
