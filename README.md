<div align="center">
<h1>🛒 Universal Commerce AI System</h1>
<p>AI-Powered Commerce Assistant built with <a href="https://voltagent.dev">VoltAgent</a></p>

<p>
<a href="https://github.com/voltagent/voltagent"><img src="https://img.shields.io/badge/built%20with-VoltAgent-blue" alt="Built with VoltAgent" /></a>
<a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D22-brightgreen" alt="Node Version" /></a>
</p>
</div>

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ 
- Git
- Google API Key (optional - can configure later)
  - Get your key at: https://aistudio.google.com/app/apikey

### Installation

```bash
# Clone the repository (if not created via create-voltagent-app)
git clone <your-repo-url>
cd tarai

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Configuration

Edit `.env` file with your API keys:

```env
# Required for AI agent and embeddings
GOOGLE_GENERATIVE_AI_API_KEY=your-google-ai-api-key-here

# Required for database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token-here

# VoltOps Platform (Optional)
# Get your keys at https://console.voltagent.dev/tracing-setup
# VOLTAGENT_PUBLIC_KEY=your-public-key
# VOLTAGENT_SECRET_KEY=your-secret-key
```

### Running the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build

# Start production server
npm start
```

## 🎯 Features

This Universal Commerce AI System includes:

- **Commerce AI Agent**: Intelligent assistant for complete commerce operations
- **Semantic Search**: Vector-based product search using Google's text-embedding-004 model for natural language queries
- **Hybrid Search**: Combines text matching with semantic similarity for best results
- **Product Management**: Create, update, and manage product catalogs with AI assistance
- **Provider Management**: Create and manage provider accounts
- **Inventory Management**: Real-time stock checking, updates, and reservation
- **Order Processing**: Automated order creation with inventory updates
- **Bulk Operations**: Import multiple products and manage large datasets
- **Workflows**: Advanced workflows for order processing and product recommendations
- **Memory**: Persistent conversation history across sessions
- **Database Integration**: Turso/LibSQL with vector storage for embeddings
- **Type Safety**: Full TypeScript support with Zod validation

## 🔍 VoltOps Platform

### Local Development
The VoltOps Platform provides real-time observability for your agents during development:

1. **Start your agent**: Run `npm run dev`
2. **Open console**: Visit [console.voltagent.dev](https://console.voltagent.dev)
3. **Auto-connect**: The console connects to your local agent at `http://localhost:3141`

Features:
- 🔍 Real-time execution visualization
- 🐛 Step-by-step debugging
- 📊 Performance insights
- 💾 No data leaves your machine

### Production Monitoring
For production environments, configure VoltOpsClient:

1. **Create a project**: Sign up at [console.voltagent.dev/tracing-setup](https://console.voltagent.dev/tracing-setup)
2. **Get your keys**: Copy your Public and Secret keys
3. **Add to .env**:
   ```env
   VOLTAGENT_PUBLIC_KEY=your-public-key
   VOLTAGENT_SECRET_KEY=your-secret-key
   ```
4. **Configure in code**: The template already includes VoltOpsClient setup!

## 📁 Project Structure

```
tarai/
├── src/
│   ├── index.ts          # Main commerce agent configuration
│   ├── setup.ts          # Database setup and embedding generation
│   ├── db.ts             # Database connection and vector operations
│   ├── db/schema.ts      # Database schema definitions
│   ├── utils/
│   │   └── embeddings.ts # Embedding generation utilities
│   ├── tools/            # Commerce tools
│   │   ├── index.ts      # Tool exports
│   │   ├── commerce.ts   # Product search, inventory, orders
│   │   └── weather.ts    # Weather tool (utility)
│   └── workflows/        # Workflow definitions
│       ├── index.ts      # Workflow exports
│       ├── commerce.ts   # Order processing, recommendations
│       └── expense.ts    # Expense approval workflow
├── dist/                 # Compiled output (after build)
├── .env                  # Environment variables
├── .env.example          # Environment template
├── .voltagent/           # Agent memory storage
├── Dockerfile            # Production deployment
├── package.json
└── tsconfig.json
```

## 🧪 Testing the Commerce Agent

### Setup Database and Embeddings

Before testing, set up your database and generate embeddings:

```bash
# Set up database with sample data and generate embeddings
npm run setup

# Verify that embeddings are stored correctly
npm run verify
```

### Available Tools

The commerce agent provides these tools:

- **searchProducts**: Hybrid search combining text and semantic similarity
- **semanticSearch**: Pure vector-based semantic search for natural language queries
- **createProduct**: Create new products with inventory
- **updateProduct**: Modify existing product information
- **updateInventory**: Manage stock levels (add/subtract/set)
- **createProvider**: Create new provider accounts
- **bulkCreateProducts**: Import multiple products at once
- **getProductDetails**: Get comprehensive product information
- **checkInventory**: Verify stock availability
- **createOrder**: Process customer orders
- **generateEmbeddings**: Generate embeddings for products (admin/setup)

### Example Interactions

**Product Creation:**
```
User: "Create a new product called 'Organic Green Tea' in the Beverages category, priced at $12.99 with 50 units in stock"
Agent: Uses createProduct tool to add the new item
```

**Inventory Management:**
```
User: "Add 25 more units to the Organic Green Tea stock"
Agent: Uses updateInventory tool with "add" operation
```

**Provider Setup:**
```
User: "Create a new provider called 'Healthy Beverages Co' with email contact@healthybeverages.com"
Agent: Uses createProvider tool to set up the account
```

**Bulk Product Import:**
```
User: "Import these 5 products for the bakery provider..."
Agent: Uses bulkCreateProducts tool for efficient import
```

**Semantic Product Search:**
```
User: "I'm looking for fresh baked bread or pastries"
Agent: Uses semanticSearch tool to find bakery items
```

### 📋 Complete Test Scenarios

For comprehensive testing, see the `test-scenarios.txt` file which contains detailed test scenarios for all system features.

### Workflow Testing

#### Order Processing Workflow
```json
{
  "userId": "USER-123",
  "items": [
    {
      "productId": "PROD-456",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "providerId": "PROVIDER-789",
  "orderNumber": "ORD-001"
}
```

#### Product Recommendation Workflow
```json
{
  "userId": "USER-123",
  "preferences": {
    "categories": ["electronics", "books"],
    "priceRange": { "max": 100 }
  },
  "context": "birthday gift"
}
```

#### Expense Approval Workflow (Legacy)
```json
{
  "employeeId": "EMP-123",
  "amount": 250,
  "category": "office-supplies",
  "description": "New laptop mouse and keyboard"
}
```

## 🐳 Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -t tarai .

# Run container
docker run -p 3141:3141 --env-file .env tarai

# Or use docker-compose
docker-compose up
```

## 🛠️ Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run setup` - Initialize database and generate embeddings
- `npm run verify` - Verify embeddings are stored correctly
- `npm run volt` - VoltAgent CLI tools

### Adding Custom Tools

Create new tools in `src/tools/`:

```typescript
import { createTool } from '@voltagent/core';
import { z } from 'zod';

export const myTool = createTool({
  name: 'myTool',
  description: 'Description of what this tool does',
  input: z.object({
    param: z.string(),
  }),
  output: z.string(),
  handler: async ({ param }) => {
    // Tool logic here
    return `Result: ${param}`;
  },
});
```

### Creating New Workflows

Add workflows in `src/workflows/`:

```typescript
import { createWorkflowChain } from '@voltagent/core';
import { z } from 'zod';

export const myWorkflow = createWorkflowChain({
  id: "my-workflow",
  name: "My Custom Workflow",
  purpose: "Description of what this workflow does",
  input: z.object({
    data: z.string(),
  }),
  result: z.object({
    output: z.string(),
  }),
})
  .andThen({
    id: "process-data",
    execute: async ({ data }) => {
      // Process the input
      const processed = data.toUpperCase();
      return { processed };
    },
  })
  .andThen({
    id: "final-step",
    execute: async ({ data }) => {
      // Final transformation
      return { output: `Result: ${data.processed}` };
    },
  });
```

## 📚 Resources

- **Documentation**: [voltagent.dev/docs](https://voltagent.dev/docs/)
- **Examples**: [github.com/VoltAgent/voltagent/tree/main/examples](https://github.com/VoltAgent/voltagent/tree/main/examples)
- **Discord**: [Join our community](https://s.voltagent.dev/discord)
- **Blog**: [voltagent.dev/](https://voltagent.dev/blog/)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details

---

<div align="center">
  <p>Built with ❤️ using <a href="https://voltagent.dev">VoltAgent</a></p>
</div>