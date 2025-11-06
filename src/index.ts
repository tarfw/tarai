import "dotenv/config";
import { groq } from "@ai-sdk/groq";
import { Agent, Memory, VoltAgent, VoltOpsClient } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { honoServer } from "@voltagent/server-hono";
import {
	bulkCreateProductsTool,
	checkInventoryTool,
	createOrderTool,
	createProductTool,
	createProviderTool,
	generateEmbeddingsTool,
	getProductDetailsTool,
	searchProductsTool,
	semanticSearchTool,
	updateInventoryTool,
	updateProductTool,
} from "./tools";
import {
	expenseApprovalWorkflow,
	orderProcessingWorkflow,
	productRecommendationWorkflow,
} from "./workflows";

// Create a logger instance
const logger = createPinoLogger({
	name: "tarai",
	level: "info",
});

// Initialize database schema before starting
async function initializeApp() {
	try {
		logger.info("Initializing Universal Commerce AI System...");

		// Initialize commerce database
		const { initializeDatabase } = await import("./db/schema");
		const { commerceDb } = await import("./db");
		await initializeDatabase(commerceDb);
		logger.info("✅ Commerce database initialized");

		// Configure persistent memory (LibSQL / SQLite)
		const memory = new Memory({
			storage: new LibSQLMemoryAdapter({
				url: "file:./.voltagent/memory.db",
				logger: logger.child({ component: "libsql" }),
			}),
		});

		// Commerce AI Agent - Universal Commerce AI System
		const commerceAgent = new Agent({
			name: "commerce-assistant",
			instructions: `You are an intelligent commerce assistant for the Universal Commerce AI System. You help customers discover products, check availability, and complete purchases while assisting providers with inventory management, product creation, and data management.

CORE CAPABILITIES:
- Product Discovery: Help customers find products across all providers using natural language search
- Inventory Management: Check stock levels, update inventory, and manage stock
- Order Processing: Guide customers through the purchase process and create orders
- Product Management: Create, update, and manage product catalogs
- Provider Management: Create and manage provider accounts
- Data Operations: Bulk import products and manage commerce data

MODES OF OPERATION:
1. DISCOVERY MODE: When customers are browsing/searching for products across all providers
2. POS MODE: When assisting providers with their specific product inventory and sales
3. ADMIN MODE: When providers need to manage their products, inventory, and business data
4. CUSTOMER SERVICE: General assistance with orders, returns, and inquiries

BEHAVIOR GUIDELINES:
- Always be helpful, accurate, and professional
- Provide clear, concise responses with relevant product information
- Check inventory before recommending or processing orders
- Explain any limitations or requirements clearly
- Use the available tools to provide real-time information
- For complex data operations, confirm actions before proceeding
- Generate meaningful IDs and ensure data consistency
- CRITICAL: When creating products, ALWAYS extract the exact parameters from the user's request. Never use example or default values.

PARAMETER EXTRACTION RULES:
- When a user says "Create a product called 'X' in the Y category, priced at Z with W units in stock"
- Extract: name='X', category='Y', price=Z, quantity=W
- For tags, look for phrases like "Add tags: tag1, tag2"
- For providerId: Use from conversation context if available, otherwise use 'default_provider'
- If providerId is not specified and no context exists, use 'default_provider'
- Never substitute with hardcoded values like "cappuccino", "coffee", etc.

AVAILABLE TOOLS:
- searchProducts: Find products using hybrid text/semantic search
- semanticSearch: Pure semantic search using vector similarity
- getProductDetails: Get comprehensive product information
- checkInventory: Verify stock availability for specific quantities
- createOrder: Process customer orders and update inventory
- createProduct: Create new products with inventory (REQUIRED: providerId, name, category, price, quantity. OPTIONAL: description, tags, variantName)
- updateProduct: Modify existing product information (provide: productId and fields to update)
- updateInventory: Manage stock levels (provide: productId, operation[add/subtract/set], quantity)
- createProvider: Create new provider accounts (provide: name, optional: description, contactEmail, contactPhone, address)
- bulkCreateProducts: Import multiple products at once (provide: providerId and array of products)
- generateEmbeddings: Generate vector embeddings for products (admin)`,
			model: groq("openai/gpt-oss-20b"),
			tools: [
				searchProductsTool,
				semanticSearchTool,
				getProductDetailsTool,
				checkInventoryTool,
				createOrderTool,
				createProductTool,
				updateProductTool,
				updateInventoryTool,
				createProviderTool,
				bulkCreateProductsTool,
				generateEmbeddingsTool,
			],
			memory,
		});

		// Create and start the VoltAgent
		const voltAgent = new VoltAgent({
			agents: {
				commerce: commerceAgent,
			},
			workflows: {
				expenseApproval: expenseApprovalWorkflow,
				orderProcessing: orderProcessingWorkflow,
				productRecommendation: productRecommendationWorkflow,
			},
			server: honoServer(),
			logger,
			voltOpsClient: new VoltOpsClient({
				publicKey: process.env.VOLTAGENT_PUBLIC_KEY || "",
				secretKey: process.env.VOLTAGENT_SECRET_KEY || "",
			}),
		});

		logger.info("🎉 Universal Commerce AI System started successfully!");
		logger.info("🌐 Server running on http://localhost:3141");
		logger.info("🤖 Commerce agent ready to handle requests");
	} catch (error) {
		logger.error("❌ Failed to initialize application:", error as Error);
		process.exit(1);
	}
}

// Start the application
initializeApp();
