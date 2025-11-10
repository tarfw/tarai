/**
 * Instance Agent - Manages product instances/variants
 * Node-scoped, conversational inventory management
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, id, tx } from "../db/instantdb-client";

// Instance-specific tool
const instanceTool = createTool({
	name: "instance",
	description:
		"Manage variants/inventory. Actions: create,createBatch,update,list,checkAvailability",
	parameters: z
		.object({
			action: z.enum([
				"create",
				"createBatch",
				"update",
				"list",
				"checkAvailability",
			]),
			productId: z.string().optional(),
			nodeid: z.string().optional(),
			instanceId: z.string().optional(),
			name: z.string().optional(),
			instanceType: z
				.enum(["variant", "inventory", "capacity", "asset", "unique"])
				.optional(),
			qty: z.number().optional(),
			attrs: z.record(z.any()).optional(),
			priceadd: z.number().optional(),
			// Batch creation
			instances: z
				.array(
					z.object({
						name: z.string(),
						instanceType: z.enum([
							"variant",
							"inventory",
							"capacity",
							"asset",
							"unique",
						]),
						qty: z.number().optional(),
						attrs: z.record(z.any()).optional(),
						priceadd: z.number().optional(),
					}),
				)
				.optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "create": {
					const {
						productId,
						nodeid,
						name,
						instanceType,
						qty,
						attrs,
						priceadd,
					} = params;

					if (!productId || !nodeid || !name || !instanceType) {
						return {
							success: false,
							message:
								"Missing required: productId, nodeid, name, instanceType",
						};
					}

					const instanceId = id();
					await idb.transact([
						tx.instances[instanceId]
							.update({
								productid: productId,
								nodeid,
								name,
								instancetype: instanceType,
								qty: qty || 0,
								available: qty || 0,
								reserved: 0,
								attrs: attrs || {},
								priceadd: priceadd || 0,
								status: "available",
								active: true,
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ product: productId, node: nodeid }),
					]);

					return {
						success: true,
						message: `Instance "${name}" created`,
						instanceId,
					};
				}

				case "createBatch": {
					const { productId, nodeid, instances } = params;

					if (!productId || !nodeid || !instances || instances.length === 0) {
						return {
							success: false,
							message: "Missing required: productId, nodeid, instances array",
						};
					}

					const instanceIds: string[] = [];
					const instanceTransactions = instances.map((inst) => {
						const instanceId = id();
						instanceIds.push(instanceId);
						return tx.instances[instanceId]
							.update({
								productid: productId,
								nodeid,
								name: inst.name,
								instancetype: inst.instanceType,
								qty: inst.qty || 0,
								available: inst.qty || 0,
								reserved: 0,
								attrs: inst.attrs || {},
								priceadd: inst.priceadd || 0,
								status: "available",
								active: true,
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ product: productId, node: nodeid });
					});

					await idb.transact(instanceTransactions);

					// Verify
					const verifyResult = await idb.query({
						instances: {
							$: { where: { "product.id": productId } },
						},
					});

					return {
						success: true,
						message: `${instances.length} instances created`,
						count: instances.length,
						verifiedCount: verifyResult.instances?.length || 0,
						instanceIds,
					};
				}

				case "update": {
					const { instanceId, qty, priceadd, attrs } = params;

					if (!instanceId) {
						return { success: false, message: "instanceId required" };
					}

					const updates: any = { updatedat: Date.now() };

					if (qty !== undefined) {
						updates.qty = qty;
						updates.available = qty;
					}
					if (priceadd !== undefined) updates.priceadd = priceadd;
					if (attrs) updates.attrs = attrs;

					await idb.transact([tx.instances[instanceId].update(updates)]);

					return {
						success: true,
						message: "Instance updated",
						instanceId,
					};
				}

				case "list": {
					const { productId, nodeid } = params;

					if (!productId && !nodeid) {
						return {
							success: false,
							message: "Provide productId or nodeid",
						};
					}

					const whereClause: any = {};
					if (productId) whereClause["product.id"] = productId;
					if (nodeid) whereClause.nodeid = nodeid;

					const result = await idb.query({
						instances: {
							$: { where: whereClause },
							product: {},
						},
					});

					const instances = (result.instances || []).map((inst: any) => ({
						id: inst.id,
						name: inst.name,
						instancetype: inst.instancetype,
						qty: inst.qty,
						available: inst.available,
						reserved: inst.reserved,
						priceadd: inst.priceadd,
						attrs: inst.attrs,
						status: inst.status,
						productName: inst.product?.name,
					}));

					return {
						success: true,
						count: instances.length,
						instances,
					};
				}

				case "checkAvailability": {
					const { instanceId } = params;

					if (!instanceId) {
						return { success: false, message: "instanceId required" };
					}

					const result = await idb.query({
						instances: {
							$: { where: { id: instanceId } },
						},
					});

					const instance = result.instances?.[0];

					if (!instance) {
						return { success: false, message: "Instance not found" };
					}

					return {
						success: true,
						available: instance.available > 0,
						qty: instance.qty,
						availableQty: instance.available,
						reserved: instance.reserved,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Instance tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Instance Agent
export const createInstanceAgent = (nodeid: string) => {
	return new Agent({
		name: "instance-agent",
		instructions: `You manage inventory variants for node ${nodeid}.
Help create variants, update stock, check availability.
Always use nodeid: ${nodeid} for operations.
Be concise and helpful.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [instanceTool],
	});
};
