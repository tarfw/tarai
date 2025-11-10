/**
 * Analytics Agent - Business insights and metrics
 * Node-scoped, conversational analytics
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb } from "../db/instantdb-client";

// Analytics-specific tool
const analyticsTool = createTool({
	name: "analytics",
	description:
		"Get business metrics. Actions: sales,revenue,topProducts,topServices,orderStats,bookingStats",
	parameters: z
		.object({
			action: z.enum([
				"sales",
				"revenue",
				"topProducts",
				"topServices",
				"orderStats",
				"bookingStats",
			]),
			nodeid: z.string().optional(),
			startDate: z.number().optional(),
			endDate: z.number().optional(),
			period: z.enum(["today", "week", "month", "year"]).optional(),
			limit: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			const { nodeid, period = "today", limit = 10 } = params;

			if (!nodeid) {
				return { success: false, message: "nodeid required" };
			}

			// Calculate date range
			let startDate = params.startDate;
			let endDate = params.endDate || Date.now();

			if (!startDate) {
				const now = new Date();
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
			}

			switch (action) {
				case "sales": {
					// Get total sales count
					const ordersResult = await idb.query({
						orders: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
								},
							},
						},
					});

					const bookingsResult = await idb.query({
						bookings: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
								},
							},
						},
					});

					const orders = ordersResult.orders || [];
					const bookings = bookingsResult.bookings || [];

					return {
						success: true,
						period,
						sales: {
							orders: orders.length,
							bookings: bookings.length,
							total: orders.length + bookings.length,
						},
					};
				}

				case "revenue": {
					// Get total revenue
					const ordersResult = await idb.query({
						orders: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
									paystatus: "paid",
								},
							},
						},
					});

					const bookingsResult = await idb.query({
						bookings: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
									paystatus: "paid",
								},
							},
						},
					});

					const orders = ordersResult.orders || [];
					const bookings = bookingsResult.bookings || [];

					const orderRevenue = orders.reduce(
						(sum: number, order: any) => sum + (order.total || 0),
						0,
					);
					const bookingRevenue = bookings.reduce(
						(sum: number, booking: any) => sum + (booking.price || 0),
						0,
					);

					return {
						success: true,
						period,
						revenue: {
							orders: orderRevenue,
							bookings: bookingRevenue,
							total: orderRevenue + bookingRevenue,
						},
					};
				}

				case "topProducts": {
					// Get line items for the period
					const ordersResult = await idb.query({
						orders: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
								},
							},
							lineitems: { product: {} },
						},
					});

					// Aggregate by product
					const productSales: Record<string, any> = {};

					(ordersResult.orders || []).forEach((order: any) => {
						(order.lineitems || []).forEach((item: any) => {
							const productId = item.product?.id;
							if (productId) {
								if (!productSales[productId]) {
									productSales[productId] = {
										productId,
										name: item.product?.name || "Unknown",
										totalQty: 0,
										totalRevenue: 0,
										orderCount: 0,
									};
								}
								productSales[productId].totalQty += item.qty || 0;
								productSales[productId].totalRevenue += item.total || 0;
								productSales[productId].orderCount += 1;
							}
						});
					});

					// Sort by revenue
					const topProducts = Object.values(productSales)
						.sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
						.slice(0, limit);

					return {
						success: true,
						period,
						count: topProducts.length,
						products: topProducts,
					};
				}

				case "topServices": {
					// Get bookings for the period
					const bookingsResult = await idb.query({
						bookings: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
								},
							},
							service: {},
						},
					});

					// Aggregate by service
					const serviceSales: Record<string, any> = {};

					(bookingsResult.bookings || []).forEach((booking: any) => {
						const serviceId = booking.service?.id;
						if (serviceId) {
							if (!serviceSales[serviceId]) {
								serviceSales[serviceId] = {
									serviceId,
									name: booking.service?.name || "Unknown",
									totalBookings: 0,
									totalRevenue: 0,
								};
							}
							serviceSales[serviceId].totalBookings += 1;
							serviceSales[serviceId].totalRevenue += booking.price || 0;
						}
					});

					// Sort by bookings
					const topServices = Object.values(serviceSales)
						.sort((a: any, b: any) => b.totalBookings - a.totalBookings)
						.slice(0, limit);

					return {
						success: true,
						period,
						count: topServices.length,
						services: topServices,
					};
				}

				case "orderStats": {
					const ordersResult = await idb.query({
						orders: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
								},
							},
						},
					});

					const orders = ordersResult.orders || [];

					// Group by status
					const statsByStatus: Record<string, number> = {};
					orders.forEach((order: any) => {
						const status = order.status || "unknown";
						statsByStatus[status] = (statsByStatus[status] || 0) + 1;
					});

					return {
						success: true,
						period,
						totalOrders: orders.length,
						byStatus: statsByStatus,
					};
				}

				case "bookingStats": {
					const bookingsResult = await idb.query({
						bookings: {
							$: {
								where: {
									nodeid,
									createdat: { $gte: startDate, $lte: endDate },
								},
							},
						},
					});

					const bookings = bookingsResult.bookings || [];

					// Group by status
					const statsByStatus: Record<string, number> = {};
					bookings.forEach((booking: any) => {
						const status = booking.status || "unknown";
						statsByStatus[status] = (statsByStatus[status] || 0) + 1;
					});

					return {
						success: true,
						period,
						totalBookings: bookings.length,
						byStatus: statsByStatus,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Analytics tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Analytics Agent
export const createAnalyticsAgent = (nodeid: string) => {
	return new Agent({
		name: "analytics-agent",
		instructions: `You provide business insights for node ${nodeid}.
Show sales metrics, revenue, top products/services, trends.
Always use nodeid: ${nodeid} for operations.
Present data clearly and concisely.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [analyticsTool],
	});
};
