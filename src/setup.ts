#!/usr/bin/env tsx

/**
 * Setup script for the Universal Commerce AI System
 * Initializes database, creates sample data, and generates embeddings
 */

import "dotenv/config";
import { CommerceDB } from "./db";
import { generateProductEmbeddings } from "./utils/embeddings";

async function setupDatabase() {
	console.log("🚀 Setting up Universal Commerce AI System...\n");

	// Initialize database schema
	const { initializeDatabase } = await import("./db/schema");
	const { commerceDb } = await import("./db");
	await initializeDatabase(commerceDb);

	try {
		// Step 1: Create sample data
		console.log("📝 Creating sample data...");
		const { CommerceDB } = await import("./db");
		await CommerceDB.createSampleData();
		console.log("✅ Sample data created\n");

		// Step 2: Generate embeddings for products
		console.log("🧠 Generating embeddings for products...");
		await CommerceDB.generateProductEmbeddings(async (text: string) => {
			const { generateEmbedding } = await import("./utils/embeddings");
			return generateEmbedding(text);
		});
		console.log("✅ Embeddings generated\n");

		console.log("🎉 Setup complete! Your commerce AI system is ready.");
		console.log("\nNext steps:");
		console.log("1. Start the server: npm run dev");
		console.log("2. Test semantic search with queries like:");
		console.log("   - 'fresh baked goods'");
		console.log("   - 'healthy breakfast options'");
		console.log("   - 'hot drinks'");
	} catch (error) {
		console.error("❌ Setup failed:", error);
		process.exit(1);
	}
}

// Run setup directly
setupDatabase().catch(console.error);

export { setupDatabase };
