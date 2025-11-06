#!/usr/bin/env tsx

/**
 * Complete database reset script
 */

import "dotenv/config";
import { commerceDb } from "./db";
import { resetDatabase } from "./db/schema";

async function resetDB() {
	console.log("🔄 Completely resetting database...\n");

	try {
		await resetDatabase(commerceDb);

		console.log("\n✅ Database reset complete!");
		console.log(
			"Now run 'npm run setup' to recreate the schema and add sample data.",
		);
	} catch (error) {
		console.error("❌ Error resetting database:", error);
	}
}

// Run reset if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	resetDB();
}

export { resetDB };
