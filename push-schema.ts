/**
 * Push InstantDB Schema to the InstantDB App
 * Run this script once to apply the schema to your InstantDB instance
 *
 * Usage: npx tsx push-schema.ts
 */

import "dotenv/config";
import _schema from "./instant.schema.ts";

const APP_ID = process.env.INSTANTDB_APP_ID;
const ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

if (!APP_ID || !ADMIN_TOKEN) {
	console.error("❌ Missing INSTANTDB_APP_ID or INSTANTDB_ADMIN_TOKEN in .env");
	process.exit(1);
}

// Use the imported schema directly
const schema = _schema;

async function pushSchema() {
	console.log("🚀 Pushing schema to InstantDB...");
	console.log(`📦 App ID: ${APP_ID}`);

	try {
		const response = await fetch(
			`https://api.instantdb.com/admin/apps/${APP_ID}/schema`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${ADMIN_TOKEN}`,
				},
				body: JSON.stringify(schema),
			},
		);

		const responseText = await response.text();
		console.log("Response status:", response.status);
		console.log("Response text:", responseText);

		if (!response.ok) {
			console.error("❌ Failed to push schema");
			console.error("Status:", response.status);
			console.error("Response:", responseText);
			process.exit(1);
		}

		let result;
		try {
			result = responseText ? JSON.parse(responseText) : {};
		} catch (e) {
			result = { message: responseText || "Success" };
		}

		console.log("✅ Schema pushed successfully!");
		console.log("📊 Result:", JSON.stringify(result, null, 2));
		console.log("\n🎉 Your InstantDB schema is now configured!");
		console.log("   You can now run: npm run dev");
	} catch (error) {
		console.error("❌ Error pushing schema:", error);
		process.exit(1);
	}
}

pushSchema();
