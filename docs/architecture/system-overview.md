# System Overview

## Architecture Principles

The Universal Commerce AI System is built on a **hybrid database architecture** that combines the strengths of two databases:

1. **InstantDB** - Real-time CRUD operations with automatic sync
2. **LibSQL/Turso** - Vector embeddings for semantic search

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VoltAgent Server                        │
│                   (http://localhost:4310)                   │
└─────────────────────────────────────────────────────────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
         ┌─────────▼──────────┐  ┌────▼─────────┐
         │  Commerce Agent    │  │  Workflows   │
         │  (AI Assistant)    │  │              │
         └─────────┬──────────┘  └──────────────┘
                   │
          ┌────────┴────────┐
          │                 │
    ┌─────▼──────┐   ┌─────▼──────┐
    │   Tools    │   │   Memory   │
    │            │   │  (LibSQL)  │
    └─────┬──────┘   └────────────┘
          │
    ┌─────┴──────────────────┐
    │                        │
┌───▼──────────┐  ┌──────────▼───────┐
│  InstantDB   │  │  LibSQL/Turso    │
│  (CRUD Ops)  │  │  (Vector Search) │
└──────────────┘  └──────────────────┘
```

## Data Flow

### 1. CRUD Operations (InstantDB)
```typescript
User Request → Commerce Agent → Tool → InstantDB
                                    ← Real-time sync
```

**Entities in InstantDB:**
- `providers` - Vendors/businesses
- `products` - Product catalog
- `inventoryItems` - Stock and pricing
- `orders` - Completed orders
- `draftOrders` - Shopping carts
- `users` - Customers
- `conversations` - Chat history
- `agentMemory` - AI conversation memory

### 2. Semantic Search (LibSQL)
```typescript
User Query → Generate Embedding → Vector Search (LibSQL)
                                → Get Product IDs
                                → Fetch Details (InstantDB)
                                → Return Results
```

**Embeddings Table:**
- `id` - Embedding identifier
- `productid` - Reference to product in InstantDB
- `embedding` - Float32 vector (Google text-embedding-004)
- `content` - Original text
- `content_type` - 'product', 'category', or 'tag'
- `model` - Embedding model name

### 3. Hybrid Search
Combines text matching (40% weight) and vector similarity (60% weight) for optimal results:

```typescript
Query → [Text Search (InstantDB) + Vector Search (LibSQL)]
     → Score Combination
     → Ranked Results
```

## Core Components

### VoltAgent Framework
- **Agents**: AI assistants with specific roles (commerce-assistant)
- **Tools**: Functions agents can call (searchProducts, createOrder, etc.)
- **Workflows**: Multi-step business processes
- **Memory**: Persistent conversation context
- **Server**: Hono-based HTTP server with REST API

### Commerce Agent
Primary AI agent with access to:
- Product search (text & semantic)
- Inventory management
- Order processing
- Provider management
- Bulk operations
- Embedding generation

**Model**: Groq's `openai/gpt-oss-20b` for fast inference

### Database Layer

**InstantDB Client** (`src/db/instantdb-client.ts`)
- Initialized with app ID and admin token
- Schema-aware with TypeScript types
- Real-time sync capabilities

**LibSQL Client** (`src/db.ts`)
- Vector similarity search using `vector_distance_cos()`
- Stores embeddings for all products
- Supports hybrid search

**Unified Interface** (`CommerceDB` class)
- Routes CRUD to InstantDB
- Routes vector ops to LibSQL
- Provides single API for tools

## Request Lifecycle

### Example: Creating a Product

1. **User Request** → VoltOps Console or API
2. **Agent Processing** → Commerce agent receives request
3. **Tool Selection** → Agent chooses `createProduct` tool
4. **Validation** → Zod schema validates parameters
5. **Database Write** → InstantDB creates product + inventory
6. **Embedding Generation** (optional) → Generate and store vector
7. **Response** → Success message with product ID
8. **Real-time Sync** → All connected clients receive update

### Example: Semantic Search

1. **User Query** → "fresh coffee beans"
2. **Embedding** → Generate query embedding with Google AI
3. **Vector Search** → LibSQL finds similar products (cosine similarity)
4. **Product Fetch** → Get full details from InstantDB
5. **Ranking** → Sort by similarity score
6. **Response** → Return top N matching products

## Environment Configuration

Required environment variables:

```env
# InstantDB (CRUD operations)
INSTANTDB_APP_ID=your-app-id
INSTANTDB_ADMIN_TOKEN=your-admin-token

# Turso/LibSQL (Vector search)
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# Google AI (Embeddings)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key

# VoltAgent (Optional monitoring)
VOLTAGENT_PUBLIC_KEY=your-public-key
VOLTAGENT_SECRET_KEY=your-secret-key

# Groq (LLM inference)
GROQ_API_KEY=your-groq-api-key
```

## Scalability Considerations

1. **InstantDB** - Handles real-time sync automatically, scales with usage
2. **LibSQL/Turso** - Globally distributed SQLite, low latency reads
3. **Vector Search** - Indexed for fast cosine similarity queries
4. **Agent Memory** - Persisted in LibSQL for conversation context
5. **Embeddings** - Generated once, reused for all searches

## Security

- Admin tokens stored in environment variables
- No sensitive data in source control
- InstantDB admin SDK bypasses client permissions
- VoltAgent server requires API keys for monitoring

## Next Steps

- [Hybrid Database Architecture](./hybrid-database.md)
- [Agent Architecture](./agent-architecture.md)
- [Quick Start Guide](../development/quick-start.md)
