import { Agent, createWorkflowChain } from "@voltagent/core";
import { z } from "zod";
import { CommerceDB } from "../db";

/**
 * Workflow for processing complex orders with multiple validation steps
 */
export const orderProcessingWorkflow = createWorkflowChain({
	id: "order-processing",
	name: "Order Processing Workflow",
	purpose:
		"Process customer orders with inventory validation, payment processing, and confirmation",

	input: z.object({
		userId: z.string(),
		items: z.array(
			z.object({
				productId: z.string(),
				quantity: z.number(),
				price: z.number(),
			}),
		),
		providerId: z.string(),
		orderNumber: z.string().optional(),
		specialInstructions: z.string().optional(),
	}),
	result: z.object({
		success: z.boolean(),
		orderId: z.string(),
		orderNumber: z.string(),
		total: z.number(),
		status: z.string(),
		message: z.string(),
	}),
})
	// Step 1: Validate all items and inventory
	.andThen({
		id: "validate-order",
		execute: async ({ data }) => {
			console.log(`Validating order for user ${data.userId}`);

			const validationResults = [];

			for (const item of data.items) {
				const available = await CommerceDB.checkInventory(
					item.productId,
					item.quantity,
				);
				const product = await CommerceDB.getProductDetails(item.productId);

				validationResults.push({
					productId: item.productId,
					requestedQuantity: item.quantity,
					available,
					productName: product?.name || "Unknown",
					availableQuantity: product?.quantity || 0,
					price: item.price,
				});
			}

			const invalidItems = validationResults.filter((r) => !r.available);

			return {
				...data,
				validationResults,
				hasInvalidItems: invalidItems.length > 0,
				invalidItems,
			};
		},
	})

	// Step 2: Calculate totals and apply any business rules
	.andThen({
		id: "calculate-totals",
		execute: async ({ data }) => {
			// Type guard for validation step result
			if ("hasInvalidItems" in data && data.hasInvalidItems) {
				return {
					...data,
					success: false,
					message: `Order cannot be processed. The following items are out of stock or insufficient quantity: ${data.invalidItems.map((i: any) => `${i.productName} (requested: ${i.requestedQuantity}, available: ${i.availableQuantity})`).join(", ")}`,
				};
			}

			const subtotal = data.items.reduce(
				(sum, item) => sum + item.price * item.quantity,
				0,
			);
			const tax = subtotal * 0.18; // 18% tax
			const discount = subtotal > 1000 ? subtotal * 0.05 : 0; // 5% discount for orders over $1000
			const total = subtotal + tax - discount;

			return {
				...data,
				subtotal,
				tax,
				discount,
				total,
				orderNumber: data.orderNumber || `ORD-${Date.now()}`,
			};
		},
	})

	// Step 3: Create order and update inventory
	.andThen({
		id: "process-order",
		execute: async ({ data }) => {
			// Check if we have a failed validation result
			if ("success" in data && !data.success) {
				return {
					success: false,
					orderId: "",
					orderNumber: ("orderNumber" in data ? data.orderNumber : "") || "",
					total: 0,
					status: "failed",
					message: "message" in data ? data.message : "Order validation failed",
				};
			}

			try {
				// Type guard to ensure we have the required data
				if (!("total" in data) || !("orderNumber" in data)) {
					throw new Error("Missing required order data");
				}

				// Create the order
				await CommerceDB.createOrder({
					ordernumber: data.orderNumber,
					userid: data.userId,
					providerid: data.providerId,
					items: data.items.map((item) => ({
						productId: item.productId,
						productName: "", // Would need to fetch from DB
						quantity: item.quantity,
						price: item.price,
					})),
					total: data.total,
				});

				// Update inventory
				for (const item of data.items) {
					await CommerceDB.updateInventory(item.productId, -item.quantity);
				}

				return {
					success: true,
					orderId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
					orderNumber: data.orderNumber as string,
					total: data.total as number,
					status: "confirmed",
					message: `Order ${data.orderNumber} processed successfully. Total: $${(data.total as number).toFixed(2)}`,
				};
			} catch (error) {
				console.error("Error processing order:", error);
				const orderNumber = "orderNumber" in data ? data.orderNumber : "";
				return {
					success: false,
					orderId: "",
					orderNumber: orderNumber || "",
					total: 0,
					status: "error",
					message: `Failed to process order: ${error instanceof Error ? error.message : "Unknown error"}`,
				};
			}
		},
	});

/**
 * Workflow for product recommendation based on user preferences and purchase history
 */
export const productRecommendationWorkflow = createWorkflowChain({
	id: "product-recommendation",
	name: "Product Recommendation Workflow",
	purpose:
		"Generate personalized product recommendations based on user preferences and behavior",

	input: z.object({
		userId: z.string(),
		preferences: z
			.object({
				categories: z.array(z.string()).optional(),
				priceRange: z
					.object({
						min: z.number().optional(),
						max: z.number().optional(),
					})
					.optional(),
				keywords: z.array(z.string()).optional(),
			})
			.optional(),
		context: z.string().optional(), // e.g., "birthday gift", "office supplies"
	}),
	result: z.object({
		recommendations: z.array(
			z.object({
				productId: z.string(),
				name: z.string(),
				category: z.string(),
				price: z.number(),
				score: z.number(),
				reason: z.string(),
			}),
		),
		totalFound: z.number(),
	}),
})
	.andThen({
		id: "analyze-preferences",
		execute: async ({ data }) => {
			// In a real implementation, this would analyze user history, preferences, etc.
			// For now, we'll use the provided preferences

			let query = "";
			const filters = [];

			if (data.preferences?.categories?.length) {
				filters.push(
					`category IN (${data.preferences.categories.map((c) => `'${c}'`).join(",")})`,
				);
			}

			if (data.preferences?.keywords?.length) {
				query = data.preferences.keywords.join(" ");
			}

			if (data.context) {
				query += ` ${data.context}`;
			}

			return {
				...data,
				searchQuery: query.trim(),
				filters: filters.join(" AND "),
			};
		},
	})

	.andThen({
		id: "generate-recommendations",
		execute: async ({ data }) => {
			// Search for products based on preferences
			const products = await CommerceDB.searchProducts(
				data.searchQuery || "",
				undefined,
				50,
			);

			// Score and rank products
			const scoredProducts = products.map((product) => {
				let score = 0;
				const reasons: string[] = [];

				// Price matching
				if (data.preferences?.priceRange) {
					const { min, max } = data.preferences.priceRange;
					const productPrice = product.price as number;
					if (min && productPrice >= min) {
						score += 20;
						reasons.push(`Within minimum price range`);
					}
					if (max && productPrice <= max) {
						score += 20;
						reasons.push(`Within maximum price range`);
					}
				}

				// Category matching
				if (data.preferences?.categories?.includes(String(product.category))) {
					score += 30;
					reasons.push(`Matches preferred category: ${product.category}`);
				}

				// Keyword matching (simple text match)
				if (data.searchQuery) {
					const queryWords = data.searchQuery.toLowerCase().split(" ");
					const productName = String(product.name).toLowerCase();
					const nameWords = productName.split(" ");

					const matches = queryWords.filter((word) =>
						nameWords.some((nameWord: string) => nameWord.includes(word)),
					).length;

					score += matches * 10;
					if (matches > 0) {
						reasons.push(`${matches} keyword matches`);
					}
				}

				// Availability bonus
				if (product.instock) {
					score += 15;
					reasons.push("Currently in stock");
				}

				return {
					productId: product.id as string,
					name: String(product.name),
					category: String(product.category),
					price: product.price as number,
					score,
					reason: reasons.join(", "),
				};
			});

			// Sort by score and return top recommendations
			const recommendations = scoredProducts
				.sort((a, b) => b.score - a.score)
				.slice(0, 10);

			return {
				recommendations,
				totalFound: products.length,
			};
		},
	});
