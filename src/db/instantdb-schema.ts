/**
 * InstantDB Schema Definition for Universal Commerce AI System
 * Handles CRUD operations for products, inventory, orders, providers, and users
 * Vector embeddings remain in LibSQL/Turso for semantic search
 */

import { i } from "@instantdb/admin";

export const instantDbSchema = i.schema({
	entities: {
		// Providers (vendors/businesses)
		providers: i.entity({
			name: i.string(),
			description: i.string().optional(),
			contactEmail: i.string().optional(),
			contactPhone: i.string().optional(),
			address: i.string().optional(),
			active: i.boolean(),
			verified: i.boolean(),
			createdAt: i.number(), // Unix timestamp
			updatedAt: i.number(), // Unix timestamp
		}),

		// Products
		products: i.entity({
			name: i.string().indexed(), // Indexed for text search
			description: i.string().optional(),
			category: i.string().indexed(), // Indexed for filtering by category
			tags: i.json().optional(), // Array of tags
			images: i.json().optional(), // Array of image URLs
			available: i.boolean(),
			featured: i.boolean(),
			createdAt: i.number(),
			updatedAt: i.number(),
		}),

		// Inventory Items (pricing and stock per product)
		inventoryItems: i.entity({
			variantName: i.string().optional(),
			price: i.number().indexed(), // Enable price filtering/sorting
			quantity: i.number().indexed(),
			reserved: i.number(),
			inStock: i.boolean().indexed(),
			createdAt: i.number(),
			updatedAt: i.number(),
		}),

		// Orders
		orders: i.entity({
			orderNumber: i.string().unique().indexed(),
			userId: i.string().indexed(),
			items: i.json(), // Array of order items
			subtotal: i.number(),
			tax: i.number(),
			discount: i.number(),
			total: i.number(),
			paid: i.boolean(),
			completed: i.boolean().indexed(),
			notes: i.string().optional(),
			createdAt: i.number(),
			updatedAt: i.number(),
		}),

		// Draft Orders (temporary orders/carts)
		draftOrders: i.entity({
			orderNumber: i.string().optional(),
			userId: i.string().indexed(),
			items: i.json(), // Array of cart items
			subtotal: i.number(),
			tax: i.number(),
			discount: i.number(),
			total: i.number(),
			paid: i.boolean(),
			createdAt: i.number(),
			updatedAt: i.number(),
		}),

		// Users (customers)
		users: i.entity({
			name: i.string().optional(),
			email: i.string().unique().indexed(),
			phone: i.string().optional(),
			active: i.boolean(),
			createdAt: i.number(),
			updatedAt: i.number(),
		}),

		// Conversations (for agent memory)
		conversations: i.entity({
			userId: i.string().indexed(),
			title: i.string().optional(),
			context: i.json().optional(), // JSON context about the conversation
			createdAt: i.number(),
			updatedAt: i.number(),
		}),

		// Agent Memory (conversation history)
		agentMemory: i.entity({
			userId: i.string().indexed(),
			role: i.string(), // 'user' or 'assistant'
			content: i.string(),
			metadata: i.json().optional(), // JSON metadata
			createdAt: i.number(),
		}),
	},

	links: {
		// Provider -> Products (one-to-many)
		providerProducts: {
			forward: { on: "products", has: "one", label: "provider" },
			reverse: { on: "providers", has: "many", label: "products" },
		},

		// Product -> Inventory Items (one-to-many)
		productInventory: {
			forward: { on: "inventoryItems", has: "one", label: "product" },
			reverse: { on: "products", has: "many", label: "inventoryItems" },
		},

		// Order -> Provider (many-to-one)
		orderProvider: {
			forward: { on: "orders", has: "one", label: "provider" },
			reverse: { on: "providers", has: "many", label: "orders" },
		},

		// Order -> User (many-to-one)
		orderUser: {
			forward: { on: "orders", has: "one", label: "user" },
			reverse: { on: "users", has: "many", label: "orders" },
		},

		// Draft Order -> Provider (many-to-one)
		draftOrderProvider: {
			forward: { on: "draftOrders", has: "one", label: "provider" },
			reverse: { on: "providers", has: "many", label: "draftOrders" },
		},

		// Draft Order -> User (many-to-one)
		draftOrderUser: {
			forward: { on: "draftOrders", has: "one", label: "user" },
			reverse: { on: "users", has: "many", label: "draftOrders" },
		},

		// Conversation -> User (many-to-one)
		conversationUser: {
			forward: { on: "conversations", has: "one", label: "user" },
			reverse: { on: "users", has: "many", label: "conversations" },
		},

		// Agent Memory -> Conversation (many-to-one)
		memoryConversation: {
			forward: { on: "agentMemory", has: "one", label: "conversation" },
			reverse: { on: "conversations", has: "many", label: "messages" },
		},
	},
});

export type InstantDbSchema = typeof instantDbSchema;
