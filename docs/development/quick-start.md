# Quick Start Guide

Get the Universal Commerce AI System up and running in minutes.

## Prerequisites

- Node.js 18+
- npm or pnpm
- InstantDB account (free at [instantdb.com](https://www.instantdb.com))
- Turso account (optional, for cloud vector storage)
- Google AI API key (for embeddings)
- Groq API key (for LLM)

## 1. Clone and Install

```bash
git clone <your-repo-url>
cd tarai
npm install
```

## 2. Configure Environment

Create `.env` file in project root:

```env
# InstantDB (CRUD operations)
INSTANTDB_APP_ID=d2c4873f-988d-4a4d-977b-9b4746b94936
INSTANTDB_ADMIN_TOKEN=your-admin-token-here

# Turso/LibSQL (Vector embeddings) - Optional, uses local DB if not set
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# Google AI (Embeddings for semantic search)
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key

# Groq (Fast LLM inference)
GROQ_API_KEY=your-groq-api-key

# VoltAgent (Optional - for monitoring)
VOLTAGENT_PUBLIC_KEY=your-public-key
VOLTAGENT_SECRET_KEY=your-secret-key
```

### Getting API Keys

**InstantDB:**
1. Sign up at [instantdb.com](https://www.instantdb.com)
2. Create a new app
3. Copy App ID and Admin Token from dashboard

**Google AI:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create API key
3. Copy the key

**Groq:**
1. Sign up at [console.groq.com](https://console.groq.com)
2. Generate API key
3. Copy the key

**Turso (Optional):**
1. Sign up at [turso.tech](https://turso.tech)
2. Create database: `turso db create commerce-vectors`
3. Get URL: `turso db show commerce-vectors`
4. Create token: `turso db tokens create commerce-vectors`

## 3. Push InstantDB Schema

```bash
# Login to InstantDB CLI (one-time)
npx instant-cli@latest login

# Push schema to remote database
npx instant-cli@latest push schema --app d2c4873f-988d-4a4d-977b-9b4746b94936 --yes
```

Or if you have `instant.config.json` configured:

```bash
npx instant-cli@latest push schema --yes
```

You should see output showing all entities and attributes being created.

## 4. Start Development Server

```bash
npm run dev
```

You should see:

```
✅ InstantDB client initialized for CRUD operations
✅ LibSQL client initialized for vector embeddings
✅ LibSQL database initialized for vector embeddings (for semantic search)
✅ InstantDB initialized for CRUD operations (real-time sync)
🎉 Universal Commerce AI System started successfully!
🌐 Server running on http://localhost:3141
🤖 Commerce agent ready to handle requests

════════════════════════════════════════════════════
  VOLTAGENT SERVER STARTED SUCCESSFULLY
════════════════════════════════════════════════════
✓ HTTP Server:  http://localhost:4310
✓ Swagger UI:   http://localhost:4310/ui
════════════════════════════════════════════════════
```

## 5. Test the System

### Using VoltOps Console

1. Visit [console.voltagent.dev](https://console.voltagent.dev)
2. Connect to `http://localhost:4310`
3. Start a conversation with the commerce agent

Example queries:
```
"Show me all available products"
"Create a new provider called Brewbar Coffee"
"Add a product: Premium Coffee Beans, category Coffee, price 24.99, quantity 100"
"Find products related to coffee"
```

### Using Swagger UI

1. Visit [http://localhost:4310/ui](http://localhost:4310/ui)
2. Explore available endpoints
3. Test API calls directly

### Using curl

```bash
# Health check
curl http://localhost:4310/health

# Send a message to commerce agent
curl -X POST http://localhost:4310/api/agents/commerce/messages \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me available products",
    "userId": "test-user"
  }'
```

## 6. Verify Database Setup

### Check InstantDB

Visit your InstantDB dashboard at [instantdb.com](https://www.instantdb.com) to see entities and data.

### Check LibSQL Vector Store

```bash
# If using local SQLite
sqlite3 .voltagent/commerce.db "SELECT COUNT(*) FROM embeddings;"

# If using Turso
turso db shell commerce-vectors "SELECT COUNT(*) FROM embeddings;"
```

## Common Setup Issues

### Error: "Missing INSTANTDB_APP_ID or INSTANTDB_ADMIN_TOKEN"

✅ Check `.env` file exists and contains both values:
```env
INSTANTDB_APP_ID=your-app-id
INSTANTDB_ADMIN_TOKEN=your-admin-token
```

### Error: "Attributes are missing in your schema"

✅ Push schema using CLI:
```bash
npx instant-cli@latest push schema --app <app-id> --yes
```

### Error: "Invalid id for entity 'providers'"

✅ This is fixed in current version. If you see it, make sure you're using latest code from `main` branch.

### Port Already in Use

If port 4310 or 3141 is in use:

```bash
# Kill existing process on Windows
netstat -ano | findstr :4310
taskkill /PID <process-id> /F

# Kill existing process on Mac/Linux
lsof -ti:4310 | xargs kill -9
```

Or change port in code (not recommended).

## Next Steps

### Explore the System

- **[System Architecture](../architecture/system-overview.md)** - Understand how it works
- **[API Reference](../api/tool-reference.md)** - Learn available tools
- **[Workflows](../workflows/)** - See example workflows

### Add Sample Data

Use the commerce agent to add sample data:

```
"Create provider: Brewbar Coffee, description: Artisan coffee roasters"

"Add product: Ethiopian Yirgacheffe, category: Coffee, price: 18.99, quantity: 50, provider: [the-provider-id-from-above]"

"Generate embeddings for all products"
```

### Build a Frontend

The system provides a REST API at `http://localhost:4310`. Build a React/Next.js frontend:

```bash
npx create-next-app@latest my-commerce-app
```

Use InstantDB React SDK for real-time data:

```bash
npm install @instantdb/react
```

### Deploy

See [Deployment Guide](./deployment.md) for production deployment instructions.

## Troubleshooting

For more help:
- Check [Troubleshooting Guide](./troubleshooting.md)
- Review [Common Issues](https://github.com/your-repo/issues)
- Join [VoltAgent Discord](https://discord.gg/voltagent)
- Join [InstantDB Discord](https://discord.com/invite/VU53p7uQcE)

## Development Workflow

```bash
# Start dev server with auto-reload
npm run dev

# Build for production
npm run build

# Run tests (if configured)
npm test

# Format code
npm run format

# Lint code
npm run lint
```

## What's Next?

You now have a fully functional AI commerce system! Here's what you can do:

1. **Add Products** - Use the commerce agent to populate your catalog
2. **Test Search** - Try semantic search with natural language queries
3. **Process Orders** - Test the order workflow
4. **Build a Frontend** - Create a customer-facing interface
5. **Customize Agents** - Modify agent instructions and tools
6. **Add Workflows** - Create new business process workflows

Happy coding! 🚀
