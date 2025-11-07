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
		logger.info("Initializing Universal Commerce AI System with InstantDB...");

		// Initialize vector embeddings table in LibSQL
		const { initializeDatabase } = await import("./db/schema");
		const { commerceDb } = await import("./db");
		await initializeDatabase(commerceDb);
		logger.info(
			"✅ LibSQL database initialized for vector embeddings (for semantic search)",
		);
		logger.info("✅ InstantDB initialized for CRUD operations (real-time sync)");

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
			instructions: `You are a commerce assistant that helps manage products, inventory, orders, and providers.

CRITICAL RULES FOR CREATING PRODUCTS:
1. Products REQUIRE a valid provider UUID (format: 550e8400-e29b-41d4-a716-446655440000)
2. If user doesn't provide a providerId, you MUST either:
   - Ask them which provider to use
   - Ask them to create a new provider first
   - Use createProviderTool to create one if they give you provider details
3. NEVER call createProduct without a valid providerId parameter

WORKFLOW:
1. For new products: Create provider first → Get provider ID → Create product with that ID
2. For searches: Use searchProducts or semanticSearch
3. For inventory: Check before orders, update after restocking
4. For orders: Verify inventory, get all required IDs (userId, providerId, productId)

PARAMETERS:
- Always extract exact UUIDs from conversation context
- productId, providerId, userId must be valid UUIDs
- Price and quantity must be positive numbers
- Ask for clarification if any required parameter is missing`,
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
