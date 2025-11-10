/**
 * Admin Agent - Platform-wide administration
 * Admin-scoped, conversational platform management
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, tx } from "../db/instantdb-client";

// Admin-specific tool
const adminTool = createTool({
	name: "admin",
	description:
		"Platform admin ops. Actions: listNodes,approveNode,platformRevenue,platformStats,listContributors,updateContributor",
	parameters: z
		.object({
			action: z.enum([
				"listNodes",
				"approveNode",
				"platformRevenue",
				"platformStats",
				"listContributors",
				"updateContributor",
			]),
			nodeid: z.string().optional(),
			contributorid: z.string().optional(),
			verified: z.boolean().optional(),
			active: z.boolean().optional(),
			period: z.enum(["today", "week", "month", "year"]).optional(),
			limit: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "listNodes": {
					const { limit = 50 } = params;

					const result = await idb.query({
						nodes: {
							$: { limit },
						},
					});

					const nodes = (result.nodes || []).map((node: any) => ({
						id: node.id,
						name: node.name,
						type: node.type,
						city: node.city,
						verified: node.verified,
						active: node.active,
						rating: node.rating,
						commission: node.commission,
						createdat: node.createdat,
					}));

					return {
						success: true,
						count: nodes.length,
						nodes,
					};
				}

				case "approveNode": {
					const { nodeid, verified } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid required" };
					}

					await idb.transact([
						tx.nodes[nodeid].update({
							verified: verified !== undefined ? verified : true,
							updatedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: `Node ${verified ? "verified" : "unverified"}`,
						nodeid,
					};
				}

				case "platformRevenue": {
					const { period = "month" } = params;

					// Calculate date range
					const now = new Date();
					let startDate: number;

					switch (period) {
						case "today":
							now.setHours(0, 0, 0, 0);
							startDate = now.getTime();
							break;
						case "week":
							now.setDate(now.getDate() - 7);
							startDate = now.getTime();
							break;
						case "month":
							now.setMonth(now.getMonth() - 1);
							startDate = now.getTime();
							break;
						case "year":
							now.setFullYear(now.getFullYear() - 1);
							startDate = now.getTime();
							break;
					}

					// Get all paid transactions
					const result = await idb.query({
						transactions: {
							$: {
								where: {
									createdat: { $gte: startDate },
									status: "success",
								},
							},
						},
					});

					const transactions = result.transactions || [];

					const totalRevenue = transactions.reduce(
						(sum: number, txn: any) => sum + (txn.amount || 0),
						0,
					);
					const platformFees = transactions.reduce(
						(sum: number, txn: any) => sum + (txn.platformfee || 0),
						0,
					);
					const nodeFees = transactions.reduce(
						(sum: number, txn: any) => sum + (txn.nodefee || 0),
						0,
					);

					return {
						success: true,
						period,
						revenue: {
							total: totalRevenue,
							platform: platformFees,
							nodes: nodeFees,
						},
						transactionCount: transactions.length,
					};
				}

				case "platformStats": {
					// Get counts of all entities
					const [nodesResult, productsResult, ordersResult, bookingsResult] =
						await Promise.all([
							idb.query({ nodes: {} }),
							idb.query({ products: {} }),
							idb.query({ orders: {} }),
							idb.query({ bookings: {} }),
						]);

					const activeNodes = (nodesResult.nodes || []).filter(
						(n: any) => n.active,
					).length;
					const verifiedNodes = (nodesResult.nodes || []).filter(
						(n: any) => n.verified,
					).length;

					return {
						success: true,
						stats: {
							nodes: {
								total: nodesResult.nodes?.length || 0,
								active: activeNodes,
								verified: verifiedNodes,
							},
							products: {
								total: productsResult.products?.length || 0,
							},
							orders: {
								total: ordersResult.orders?.length || 0,
							},
							bookings: {
								total: bookingsResult.bookings?.length || 0,
							},
						},
					};
				}

				case "listContributors": {
					const { limit = 50 } = params;

					const result = await idb.query({
						contributors: {
							$: { limit },
						},
					});

					const contributors = (result.contributors || []).map(
						(contributor: any) => ({
							id: contributor.id,
							name: contributor.name,
							email: contributor.email,
							role: contributor.role,
							active: contributor.active,
							createdat: contributor.createdat,
						}),
					);

					return {
						success: true,
						count: contributors.length,
						contributors,
					};
				}

				case "updateContributor": {
					const { contributorid, active } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid required" };
					}

					const updates: any = {
						updatedat: Date.now(),
					};

					if (active !== undefined) {
						updates.active = active;
					}

					await idb.transact([
						tx.contributors[contributorid].update(updates),
					]);

					return {
						success: true,
						message: "Contributor updated",
						contributorid,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Admin tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Admin Agent
export const createAdminAgent = () => {
	return new Agent({
		name: "admin-agent",
		instructions: `You manage the platform as an administrator.
View all nodes, approve stores, monitor revenue, platform stats.
Be professional and provide clear administrative insights.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [adminTool],
	});
};
