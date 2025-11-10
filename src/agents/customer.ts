/**
 * Customer Agent - Customer view for cart, orders, bookings
 * Customer-scoped, conversational shopping assistant
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb } from "../db/instantdb-client";

// Customer-specific tool
const customerTool = createTool({
	name: "customer",
	description:
		"Manage customer data. Actions: myOrders,myBookings,getProfile",
	parameters: z
		.object({
			action: z.enum(["myOrders", "myBookings", "getProfile"]),
			contributorid: z.string().optional(),
			limit: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "myOrders": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid required" };
					}

					const result = await idb.query({
						orders: {
							$: { where: { contributorid }, limit },
							node: {},
							lineitems: {},
						},
					});

					const orders = (result.orders || []).map((order: any) => ({
						id: order.id,
						ordernum: order.ordernum,
						total: order.total,
						status: order.status,
						paystatus: order.paystatus,
						createdat: order.createdat,
						storeName: order.node?.name,
						itemCount: order.lineitems?.length || 0,
					}));

					return {
						success: true,
						count: orders.length,
						orders,
					};
				}

				case "myBookings": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid required" };
					}

					const result = await idb.query({
						bookings: {
							$: { where: { contributorid }, limit },
							service: {},
							node: {},
						},
					});

					const bookings = (result.bookings || []).map((booking: any) => ({
						id: booking.id,
						bookingnum: booking.bookingnum,
						date: booking.date,
						start: booking.start,
						end: booking.end,
						price: booking.price,
						status: booking.status,
						serviceName: booking.service?.name,
						nodeName: booking.node?.name,
					}));

					return {
						success: true,
						count: bookings.length,
						bookings,
					};
				}

				case "getProfile": {
					const { contributorid } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid required" };
					}

					const result = await idb.query({
						contributors: {
							$: { where: { id: contributorid } },
						},
					});

					const profile = result.contributors?.[0];

					if (!profile) {
						return { success: false, message: "Profile not found" };
					}

					return {
						success: true,
						profile: {
							id: profile.id,
							name: profile.name,
							email: profile.email,
							phone: profile.phone,
							role: profile.role,
							address: profile.address,
							city: profile.city,
						},
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Customer tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Customer Agent
export const createCustomerAgent = (contributorid: string) => {
	return new Agent({
		name: "customer-agent",
		instructions: `You help customer ${contributorid} view orders, bookings, profile.
Show order status, booking details, track deliveries.
Be helpful and friendly.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [customerTool],
	});
};
