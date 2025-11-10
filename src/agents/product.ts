/**
 * Product Agent - Manages products for a node
 * Node-scoped, conversational product management
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, id, tx } from "../db/instantdb-client";

// Product-specific tool (only product management actions)
const productTool = createTool({
	name: "product",
	description: "Manage products. Actions: search,create,update,getDetails",
	parameters: z
		.object({
			action: z.enum(["search", "create", "update", "getDetails"]),
			productId: z.string().optional(),
			nodeid: z.string().optional(),
			name: z.string().optional(),
			desc: z.string().optional(),
			category: z.string().optional(),
			price: z.number().optional(),
			stock: z.number().optional(),
			currency: z.string().optional(),
			query: z.string().optional(),
			limit: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "search": {
					const { query, nodeid, limit = 20 } = params;
					const whereClause: any = {};

					if (query) {
						whereClause.name = { $ilike: `%${query}%` };
					}
					if (nodeid) {
						whereClause.nodeid = nodeid;
					}

					const result = await idb.query({
						products: {
							$: { where: whereClause, limit },
							node: {},
						},
					});

					const products = (result.products || []).map((p: any) => ({
						id: p.id,
						name: p.name,
						desc: p.desc,
						category: p.category,
						price: p.price,
						stock: p.stock,
						instock: p.instock,
						currency: p.currency,
						nodeName: p.node?.name,
					}));

					return {
						success: true,
						count: products.length,
						products,
					};
				}

				case "create": {
					const { nodeid, name, desc, category, price, stock, currency } = params;

					if (!nodeid || !name || !category || !price) {
						return {
							success: false,
							message: "Missing required fields: nodeid, name, category, price",
						};
					}

					const productId = id();
					await idb.transact([
						tx.products[productId]
							.update({
								nodeid,
								name,
								desc: desc || "",
								category,
								price,
								stock: stock || 0,
								currency: currency || "INR",
								instock: (stock || 0) > 0,
								active: true,
								featured: false,
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ node: nodeid }),
					]);

					return {
						success: true,
						message: `Product "${name}" created successfully`,
						productId,
					};
				}

				case "update": {
					const { productId, ...updateFields } = params;

					if (!productId) {
						return { success: false, message: "productId required" };
					}

					const updates: any = {
						updatedat: Date.now(),
					};

					if (updateFields.name) updates.name = updateFields.name;
					if (updateFields.desc) updates.desc = updateFields.desc;
					if (updateFields.category) updates.category = updateFields.category;
					if (updateFields.price) updates.price = updateFields.price;
					if (updateFields.stock !== undefined) {
						updates.stock = updateFields.stock;
						updates.instock = updateFields.stock > 0;
					}

					await idb.transact([tx.products[productId].update(updates)]);

					return {
						success: true,
						message: "Product updated successfully",
						productId,
					};
				}

				case "getDetails": {
					const { productId } = params;

					if (!productId) {
						return { success: false, message: "productId required" };
					}

					const result = await idb.query({
						products: {
							$: { where: { id: productId } },
							node: {},
							instances: {},
						},
					});

					const product = result.products?.[0];

					if (!product) {
						return { success: false, message: "Product not found" };
					}

					return {
						success: true,
						product: {
							id: product.id,
							name: product.name,
							desc: product.desc,
							category: product.category,
							price: product.price,
							stock: product.stock,
							instock: product.instock,
							currency: product.currency,
							node: product.node,
							instanceCount: product.instances?.length || 0,
						},
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Product tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Product Agent
export const createProductAgent = (nodeid: string) => {
	return new Agent({
		name: "product-agent",
		instructions: `You manage products for node ${nodeid}.
Help create, update, search products.
Always use nodeid: ${nodeid} for operations.
Be concise and helpful.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [productTool],
	});
};
