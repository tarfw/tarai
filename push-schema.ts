/**
 * Push InstantDB Schema to the InstantDB App
 * Run this script once to apply the schema to your InstantDB instance
 *
 * Usage: npx tsx push-schema.ts
 */

import "dotenv/config";

const APP_ID = process.env.INSTANTDB_APP_ID;
const ADMIN_TOKEN = process.env.INSTANTDB_ADMIN_TOKEN;

if (!APP_ID || !ADMIN_TOKEN) {
	console.error("❌ Missing INSTANTDB_APP_ID or INSTANTDB_ADMIN_TOKEN in .env");
	process.exit(1);
}

const schema = {
	blobs: {},
	entities: {
		providers: {
			name: { type: "string", required: true, unique: false, indexed: false },
			description: {
				type: "string",
				required: false,
				unique: false,
				indexed: false,
			},
			contactEmail: {
				type: "string",
				required: false,
				unique: false,
				indexed: false,
			},
			contactPhone: {
				type: "string",
				required: false,
				unique: false,
				indexed: false,
			},
			address: { type: "string", required: false, unique: false, indexed: false },
			active: { type: "boolean", required: true, unique: false, indexed: false },
			verified: {
				type: "boolean",
				required: true,
				unique: false,
				indexed: false,
			},
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
			updatedAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
		products: {
			name: { type: "string", required: true, unique: false, indexed: false },
			description: {
				type: "string",
				required: false,
				unique: false,
				indexed: false,
			},
			category: {
				type: "string",
				required: true,
				unique: false,
				indexed: false,
			},
			tags: { type: "json", required: false, unique: false, indexed: false },
			images: { type: "json", required: false, unique: false, indexed: false },
			available: {
				type: "boolean",
				required: true,
				unique: false,
				indexed: false,
			},
			featured: {
				type: "boolean",
				required: true,
				unique: false,
				indexed: false,
			},
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
			updatedAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
		inventoryItems: {
			variantName: {
				type: "string",
				required: false,
				unique: false,
				indexed: false,
			},
			price: { type: "number", required: true, unique: false, indexed: true },
			quantity: { type: "number", required: true, unique: false, indexed: true },
			reserved: { type: "number", required: true, unique: false, indexed: false },
			inStock: { type: "boolean", required: true, unique: false, indexed: true },
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
			updatedAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
		orders: {
			orderNumber: {
				type: "string",
				required: true,
				unique: true,
				indexed: true,
			},
			userId: { type: "string", required: true, unique: false, indexed: true },
			items: { type: "json", required: true, unique: false, indexed: false },
			subtotal: { type: "number", required: true, unique: false, indexed: false },
			tax: { type: "number", required: true, unique: false, indexed: false },
			discount: { type: "number", required: true, unique: false, indexed: false },
			total: { type: "number", required: true, unique: false, indexed: false },
			paid: { type: "boolean", required: true, unique: false, indexed: false },
			completed: {
				type: "boolean",
				required: true,
				unique: false,
				indexed: true,
			},
			notes: { type: "string", required: false, unique: false, indexed: false },
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
			updatedAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
		draftOrders: {
			orderNumber: {
				type: "string",
				required: false,
				unique: false,
				indexed: false,
			},
			userId: { type: "string", required: true, unique: false, indexed: true },
			items: { type: "json", required: true, unique: false, indexed: false },
			subtotal: { type: "number", required: true, unique: false, indexed: false },
			tax: { type: "number", required: true, unique: false, indexed: false },
			discount: { type: "number", required: true, unique: false, indexed: false },
			total: { type: "number", required: true, unique: false, indexed: false },
			paid: { type: "boolean", required: true, unique: false, indexed: false },
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
			updatedAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
		users: {
			name: { type: "string", required: false, unique: false, indexed: false },
			email: { type: "string", required: true, unique: true, indexed: true },
			phone: { type: "string", required: false, unique: false, indexed: false },
			active: { type: "boolean", required: true, unique: false, indexed: false },
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
			updatedAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
		conversations: {
			userId: { type: "string", required: true, unique: false, indexed: true },
			title: { type: "string", required: false, unique: false, indexed: false },
			context: { type: "json", required: false, unique: false, indexed: false },
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
			updatedAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
		agentMemory: {
			userId: { type: "string", required: true, unique: false, indexed: true },
			role: { type: "string", required: true, unique: false, indexed: false },
			content: { type: "string", required: true, unique: false, indexed: false },
			metadata: { type: "json", required: false, unique: false, indexed: false },
			createdAt: {
				type: "number",
				required: true,
				unique: false,
				indexed: false,
			},
		},
	},
	links: {
		providerProducts: {
			forward: { on: "products", has: "one", label: "provider" },
			reverse: { on: "providers", has: "many", label: "products" },
		},
		productInventory: {
			forward: { on: "inventoryItems", has: "one", label: "product" },
			reverse: { on: "products", has: "many", label: "inventoryItems" },
		},
		orderProvider: {
			forward: { on: "orders", has: "one", label: "provider" },
			reverse: { on: "providers", has: "many", label: "orders" },
		},
		orderUser: {
			forward: { on: "orders", has: "one", label: "user" },
			reverse: { on: "users", has: "many", label: "orders" },
		},
		draftOrderProvider: {
			forward: { on: "draftOrders", has: "one", label: "provider" },
			reverse: { on: "providers", has: "many", label: "draftOrders" },
		},
		draftOrderUser: {
			forward: { on: "draftOrders", has: "one", label: "user" },
			reverse: { on: "users", has: "many", label: "draftOrders" },
		},
		conversationUser: {
			forward: { on: "conversations", has: "one", label: "user" },
			reverse: { on: "users", has: "many", label: "conversations" },
		},
		memoryConversation: {
			forward: { on: "agentMemory", has: "one", label: "conversation" },
			reverse: { on: "conversations", has: "many", label: "messages" },
		},
	},
	rooms: {},
};

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
