/**
 * Node Agent - Manages store/business settings
 * Node-scoped, conversational business management
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, tx } from "../db/instantdb-client";

// Node-specific tool
const nodeTool = createTool({
	name: "node",
	description: "Manage store settings. Actions: getDetails,update",
	parameters: z
		.object({
			action: z.enum(["getDetails", "update"]),
			nodeid: z.string().optional(),
			name: z.string().optional(),
			address: z.string().optional(),
			phone: z.string().optional(),
			email: z.string().optional(),
			open: z.string().optional(),
			close: z.string().optional(),
			days: z.string().optional(),
			commission: z.number().optional(),
			bio: z.string().optional(),
			isopen: z.boolean().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "getDetails": {
					const { nodeid } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid required" };
					}

					const result = await idb.query({
						nodes: {
							$: { where: { id: nodeid } },
						},
					});

					const node = result.nodes?.[0];

					if (!node) {
						return { success: false, message: "Node not found" };
					}

					return {
						success: true,
						node: {
							id: node.id,
							name: node.name,
							type: node.type,
							address: node.address,
							city: node.city,
							phone: node.phone,
							email: node.email,
							open: node.open,
							close: node.close,
							days: node.days,
							commission: node.commission,
							isopen: node.isopen,
							verified: node.verified,
							rating: node.rating,
							bio: node.bio,
							createdat: node.createdat,
						},
					};
				}

				case "update": {
					const { nodeid, ...updateFields } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid required" };
					}

					const updates: any = {
						updatedat: Date.now(),
					};

					if (updateFields.name) updates.name = updateFields.name;
					if (updateFields.address) updates.address = updateFields.address;
					if (updateFields.phone) updates.phone = updateFields.phone;
					if (updateFields.email) updates.email = updateFields.email;
					if (updateFields.open) updates.open = updateFields.open;
					if (updateFields.close) updates.close = updateFields.close;
					if (updateFields.days) updates.days = updateFields.days;
					if (updateFields.commission !== undefined)
						updates.commission = updateFields.commission;
					if (updateFields.bio) updates.bio = updateFields.bio;
					if (updateFields.isopen !== undefined)
						updates.isopen = updateFields.isopen;

					await idb.transact([tx.nodes[nodeid].update(updates)]);

					return {
						success: true,
						message: "Store settings updated successfully",
						nodeid,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Node tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Node Agent
export const createNodeAgent = (nodeid: string) => {
	return new Agent({
		name: "node-agent",
		instructions: `You manage store settings for node ${nodeid}.
Help update hours, contact info, commission, status.
Always use nodeid: ${nodeid} for operations.
Be concise and helpful.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [nodeTool],
	});
};
