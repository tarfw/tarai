# Universal Commerce AI System - Documentation

Welcome to the comprehensive documentation for the Universal Commerce AI System built with VoltAgent and InstantDB.

## 📚 Documentation Structure

### 🏗️ [Architecture](./architecture/)
- [System Overview](./architecture/system-overview.md) - High-level architecture and design principles
- [Hybrid Database Architecture](./architecture/hybrid-database.md) - InstantDB + LibSQL integration
- [Agent Architecture](./architecture/agent-architecture.md) - VoltAgent agent design patterns

### 💾 [Database](./database/)
- [InstantDB Schema](./database/instantdb-schema.md) - Entity definitions and relationships
- [LibSQL Vector Storage](./database/libsql-vectors.md) - Vector embeddings for semantic search
- [Data Operations](./database/operations.md) - CRUD operations and query patterns

### 🔌 [API & Tools](./api/)
- [Commerce Tools](./api/commerce-tools.md) - Product, inventory, and order management tools
- [Search Tools](./api/search-tools.md) - Text and semantic search capabilities
- [Tool Reference](./api/tool-reference.md) - Complete tool API documentation

### 🔄 [Workflows](./workflows/)
- [Order Processing](./workflows/order-processing.md) - Order management workflow
- [Product Recommendation](./workflows/product-recommendation.md) - AI-powered recommendations
- [Expense Approval](./workflows/expense-approval.md) - Approval workflow

### 🌐 [InstantDB](./instantdb/)
- [Getting Started](./instantdb/getting-started.md) - InstantDB setup and initialization
- [Schema Management](./instantdb/schema-management.md) - Working with schemas
- [Real-time Sync](./instantdb/real-time-sync.md) - Real-time data synchronization

### ⚡ [VoltAgent](./voltagent/)
- [Framework Overview](./voltagent/framework-overview.md) - VoltAgent core concepts
- [Agent Development](./voltagent/agent-development.md) - Creating and configuring agents
- [Tool Development](./voltagent/tool-development.md) - Building custom tools
- [Memory Management](./voltagent/memory-management.md) - Agent memory and context

### 🛠️ [Development](./development/)
- [Quick Start](./development/quick-start.md) - Get up and running quickly
- [Environment Setup](./development/environment-setup.md) - Required environment variables
- [Troubleshooting](./development/troubleshooting.md) - Common issues and solutions
- [Testing Guide](./development/testing-guide.md) - Testing strategies and examples
- [Deployment](./development/deployment.md) - Deployment guidelines

### 📝 [Examples](./examples/)
- [Complete Walkthrough](./examples/complete-walkthrough.md) - Step-by-step examples for all operations

## 🚀 Quick Links

- **Get Started**: [Quick Start Guide](./development/quick-start.md)
- **Core Concepts**: [System Overview](./architecture/system-overview.md)
- **API Reference**: [Tool Reference](./api/tool-reference.md)
- **Troubleshooting**: [Common Issues](./development/troubleshooting.md)

## 📖 Key Technologies

This project is built on:
- **[VoltAgent](https://voltagent.dev)** - AI agent orchestration framework
- **[InstantDB](https://www.instantdb.com)** - Real-time database for CRUD operations
- **[LibSQL/Turso](https://turso.tech)** - SQLite-compatible database for vector embeddings
- **[Google AI](https://ai.google.dev)** - Embeddings for semantic search
- **[Groq](https://groq.com)** - Fast LLM inference

## 🎯 What This System Does

The Universal Commerce AI System is an intelligent commerce platform that provides:

1. **Product Management** - Create, update, and manage products with providers
2. **Inventory Tracking** - Real-time inventory management with quantity tracking
3. **Order Processing** - Complete order lifecycle management
4. **Semantic Search** - Natural language product search using AI embeddings
5. **AI Conversations** - Conversational commerce interface with memory
6. **Real-time Sync** - Instant data synchronization across all clients

## 🏁 Getting Started

1. Read the [System Overview](./architecture/system-overview.md) to understand the architecture
2. Follow the [Quick Start Guide](./development/quick-start.md) to set up your environment
3. Explore the [API Reference](./api/tool-reference.md) to learn about available tools
4. Check out [Example Workflows](./workflows/) to see the system in action

## 📝 Contributing

When adding new features or modifying existing ones, please update the relevant documentation files to keep this resource accurate and helpful for all developers and AI assistants working on this project.
