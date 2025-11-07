/**
 * InstantDB Client for CRUD Operations
 * Handles real-time data synchronization for commerce operations
 */

import { init, id, tx } from "@instantdb/admin";
import { instantDbSchema } from "./instantdb-schema";

if (!process.env.INSTANTDB_APP_ID || !process.env.INSTANTDB_ADMIN_TOKEN) {
	throw new Error(
		"Missing InstantDB credentials. Please set INSTANTDB_APP_ID and INSTANTDB_ADMIN_TOKEN in .env file",
	);
}

// Initialize InstantDB Admin SDK
export const idb = init({
	appId: process.env.INSTANTDB_APP_ID,
	adminToken: process.env.INSTANTDB_ADMIN_TOKEN,
	schema: instantDbSchema,
});

// Export helper functions
export { id, tx };

// Export typed client
export type InstantDB = typeof idb;

console.log("✅ InstantDB client initialized for CRUD operations");
