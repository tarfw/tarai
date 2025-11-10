/**
 * Order Agent - Manages orders for a node
 * Node-scoped, conversational order management
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, id, tx } from "../db/instantdb-client";

// Order-specific tool
const orderTool = createTool({
	name: "order",
	description:
		"Manage orders. Actions: list,getDetails,updateStatus,cancel,getByNode",
	parameters: z
		.object({
			action: z.enum([
				"list",
				"getDetails",
				"updateStatus",
				"cancel",
				"getByNode",
			]),
			orderId: z.string().optional(),
			nodeid: z.string().optional(),
			status: z
				.enum([
					"pending",
					"confirmed",
					"preparing",
					"outfordelivery",
					"delivered",
					"cancelled",
				])
				.optional(),
			limit: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "list": {
					const { nodeid, status, limit = 20 } = params;

					const whereClause: any = {};
					if (nodeid) whereClause.nodeid = nodeid;
					if (status) whereClause.status = status;

					const result = await idb.query({
						orders: {
							$: { where: whereClause, limit },
							contributor: {},
							lineitems: { product: {} },
						},
					});

					const orders = (result.orders || []).map((order: any) => ({
						id: order.id,
						ordernum: order.ordernum,
						total: order.total,
						status: order.status,
						paystatus: order.paystatus,
						createdat: order.createdat,
						customerName: order.contributor?.name,
						itemCount: order.lineitems?.length || 0,
					}));

					return {
						success: true,
						count: orders.length,
						orders,
					};
				}

				case "getDetails": {
					const { orderId } = params;

					if (!orderId) {
						return { success: false, message: "orderId required" };
					}

					const result = await idb.query({
						orders: {
							$: { where: { id: orderId } },
							contributor: {},
							node: {},
							lineitems: { product: {}, instance: {} },
						},
					});

					const order = result.orders?.[0];

					if (!order) {
						return { success: false, message: "Order not found" };
					}

					return {
						success: true,
						order: {
							id: order.id,
							ordernum: order.ordernum,
							ordertype: order.ordertype,
							subtotal: order.subtotal,
							tax: order.tax,
							deliveryfee: order.deliveryfee,
							discount: order.discount,
							total: order.total,
							currency: order.currency,
							status: order.status,
							paystatus: order.paystatus,
							address: order.address,
							phone: order.phone,
							createdat: order.createdat,
							customer: order.contributor,
							node: order.node,
							items: order.lineitems?.map((item: any) => ({
								name: item.name,
								instancename: item.instancename,
								qty: item.qty,
								unitprice: item.unitprice,
								total: item.total,
								product: item.product,
							})),
						},
					};
				}

				case "updateStatus": {
					const { orderId, status } = params;

					if (!orderId || !status) {
						return {
							success: false,
							message: "orderId and status required",
						};
					}

					const updates: any = {
						status,
					};

					if (status === "confirmed") {
						updates.confirmedat = Date.now();
					} else if (status === "delivered") {
						updates.deliveredat = Date.now();
					}

					await idb.transact([tx.orders[orderId].update(updates)]);

					return {
						success: true,
						message: `Order status updated to ${status}`,
						orderId,
					};
				}

				case "cancel": {
					const { orderId } = params;

					if (!orderId) {
						return { success: false, message: "orderId required" };
					}

					await idb.transact([
						tx.orders[orderId].update({
							status: "cancelled",
						}),
					]);

					return {
						success: true,
						message: "Order cancelled",
						orderId,
					};
				}

				case "getByNode": {
					const { nodeid, limit = 50 } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid required" };
					}

					const result = await idb.query({
						orders: {
							$: { where: { nodeid }, limit },
							contributor: {},
						},
					});

					const orders = (result.orders || []).map((order: any) => ({
						id: order.id,
						ordernum: order.ordernum,
						total: order.total,
						status: order.status,
						createdat: order.createdat,
						customerName: order.contributor?.name,
					}));

					return {
						success: true,
						count: orders.length,
						orders,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Order tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Order Agent
export const createOrderAgent = (nodeid: string) => {
	return new Agent({
		name: "order-agent",
		instructions: `You manage orders for node ${nodeid}.
Help view, update, track, cancel orders.
Always use nodeid: ${nodeid} for operations.
Be concise and helpful.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [orderTool],
	});
};
