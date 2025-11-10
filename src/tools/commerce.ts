import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, id, tx } from "../db/instantdb-client";

/**
 * DOMAIN-CLUSTERED COMMERCE TOOLS
 * Token-efficient tool organization with action-based routing
 * Aligned with InstantDB schema (nodes, products, instances, etc.)
 */

// ============================================
// 1. PRODUCT TOOL (Product & Instance Management)
// ============================================

export const productTool = createTool({
	name: "product",
	description:
		"Product & instance mgmt. Actions: search,create,update,getDetails,createInstance,createInstances,updateInstance,getInstances,checkAvailability",
	parameters: z
		.object({
			action: z.enum([
				"search",
				"create",
				"update",
				"getDetails",
				"createInstance",
				"createInstances",
				"updateInstance",
				"getInstances",
				"checkAvailability",
			]),
			// Product fields
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
			// Instance fields
			instanceId: z.string().optional(),
			instanceName: z.string().optional(),
			instanceType: z
				.enum(["variant", "inventory", "capacity", "asset", "unique"])
				.optional(),
			qty: z.number().optional(),
			attrs: z.record(z.any()).optional(),
			priceadd: z.number().optional(),
			// Batch instance creation
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
							instances: {},
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
						nodeid: p.node?.id,
						nodeName: p.node?.name,
						instanceCount: p.instances?.length || 0,
					}));

					return {
						success: true,
						message: `Found ${products.length} products`,
						products,
					};
				}

				case "create": {
					const {
						nodeid,
						name,
						desc,
						category,
						price,
						stock = 0,
						currency = "INR",
					} = params;

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
								stock,
								currency,
								instock: stock > 0,
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
					const { productId, name, desc, category, price, stock } = params;

					if (!productId) {
						return { success: false, message: "productId is required" };
					}

					const updateData: any = { updatedat: Date.now() };
					if (name !== undefined) updateData.name = name;
					if (desc !== undefined) updateData.desc = desc;
					if (category !== undefined) updateData.category = category;
					if (price !== undefined) updateData.price = price;
					if (stock !== undefined) {
						updateData.stock = stock;
						updateData.instock = stock > 0;
					}

					await idb.transact([tx.products[productId].update(updateData)]);

					return {
						success: true,
						message: `Product "${productId}" updated successfully`,
					};
				}

				case "getDetails": {
					const { productId } = params;

					if (!productId) {
						return { success: false, message: "productId is required" };
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
						return {
							success: false,
							message: `Product "${productId}" not found`,
						};
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
							nodeid: product.node?.id,
							nodeName: product.node?.name,
							instances: product.instances || [],
						},
					};
				}

				case "createInstance": {
					const {
						productId,
						nodeid,
						instanceName,
						instanceType,
						qty = 0,
						attrs,
						priceadd = 0,
					} = params;

					if (!productId || !nodeid || !instanceName || !instanceType) {
						return {
							success: false,
							message:
								"Missing required fields: productId, nodeid, instanceName, instanceType",
						};
					}

					const instanceId = id();
					await idb.transact([
						tx.instances[instanceId]
							.update({
								productid: productId,
								nodeid,
								name: instanceName,
								instancetype: instanceType,
								qty,
								available: qty,
								reserved: 0,
								attrs: attrs || {},
								priceadd,
								status: "available",
								active: true,
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ product: productId, node: nodeid }),
					]);

					return {
						success: true,
						message: `Instance "${instanceName}" created successfully`,
						instanceId,
					};
				}

				case "createInstances": {
					const { productId, nodeid, instances } = params;

					if (!productId || !nodeid || !instances || instances.length === 0) {
						return {
							success: false,
							message:
								"Missing required fields: productId, nodeid, instances (array)",
						};
					}

					// Create all instances in a single transaction
					const instanceIds: string[] = [];
					const instanceTransactions = instances.map((instance) => {
						const instanceId = id();
						instanceIds.push(instanceId);
						return tx.instances[instanceId]
							.update({
								productid: productId,
								nodeid,
								name: instance.name,
								instancetype: instance.instanceType,
								qty: instance.qty || 0,
								available: instance.qty || 0,
								reserved: 0,
								attrs: instance.attrs || {},
								priceadd: instance.priceadd || 0,
								status: "available",
								active: true,
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ product: productId, node: nodeid });
					});

					await idb.transact(instanceTransactions);

					// Verify instances were created by querying them back
					const verifyResult = await idb.query({
						instances: {
							$: {
								where: {
									"product.id": productId,
								},
							},
						},
					});

					// Return with actual instance IDs created
					const createdInstances = instances.map((instance, index) => ({
						instanceId: instanceIds[index],
						name: instance.name,
						instanceType: instance.instanceType,
						qty: instance.qty || 0,
						priceadd: instance.priceadd || 0,
						attrs: instance.attrs || {},
					}));

					return {
						success: true,
						message: `${instances.length} instances created successfully (verified: ${verifyResult.instances?.length || 0} in DB)`,
						count: instances.length,
						instances: createdInstances,
						verifiedCount: verifyResult.instances?.length || 0,
					};
				}

				case "updateInstance": {
					const { instanceId, qty, status, attrs } = params;

					if (!instanceId) {
						return { success: false, message: "instanceId is required" };
					}

					const updateData: any = { updatedat: Date.now() };
					if (qty !== undefined) {
						updateData.qty = qty;
						updateData.available = qty;
					}
					if (status !== undefined) updateData.status = status;
					if (attrs !== undefined) updateData.attrs = attrs;

					await idb.transact([tx.instances[instanceId].update(updateData)]);

					return {
						success: true,
						message: `Instance "${instanceId}" updated successfully`,
					};
				}

				case "getInstances": {
					const { productId } = params;

					if (!productId) {
						return { success: false, message: "productId is required" };
					}

					const result = await idb.query({
						instances: {
							$: { where: { "product.id": productId } },
							product: {},
							node: {},
						},
					});

					return {
						success: true,
						instances: result.instances || [],
					};
				}

				case "checkAvailability": {
					const { instanceId, qty = 1 } = params;

					if (!instanceId) {
						return { success: false, message: "instanceId is required" };
					}

					const result = await idb.query({
						instances: {
							$: { where: { id: instanceId } },
						},
					});

					const instance = result.instances?.[0];
					if (!instance) {
						return {
							success: false,
							message: `Instance "${instanceId}" not found`,
						};
					}

					const available = instance.available >= qty;

					return {
						success: true,
						available,
						currentQty: instance.available,
						requestedQty: qty,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Product tool error:", error);
			return {
				success: false,
				message: "Product operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 2. ORDER TOOL (Order Management)
// ============================================

export const orderTool = createTool({
	name: "order",
	description:
		"Order mgmt. Actions: create,update,getDetails,addItems,updateStatus,cancel,getByContributor,getByNode",
	parameters: z.object({
		action: z.enum([
			"create",
			"update",
			"getDetails",
			"addItems",
			"updateStatus",
			"cancel",
			"getByContributor",
			"getByNode",
		]),
		orderId: z.string().optional(),
		ordernum: z.string().optional(),
		contributorid: z.string().optional(),
		nodeid: z.string().optional(),
		ordertype: z.enum(["store", "food", "delivery"]).optional(),
		items: z
			.array(
				z.object({
					productId: z.string(),
					instanceId: z.string().optional(),
					name: z.string(),
					qty: z.number(),
					unitprice: z.number(),
				}),
			)
			.optional(),
		address: z.string().optional(),
		phone: z.string().optional(),
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
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "create": {
					const { contributorid, nodeid, ordertype, items, address, phone } =
						params;

					if (!contributorid || !nodeid || !items || items.length === 0) {
						return {
							success: false,
							message:
								"Missing required fields: contributorid, nodeid, items",
						};
					}

					const orderId = id();
					const ordernum = `ORD-${Date.now()}`;

					// Calculate totals
					const subtotal = items.reduce(
						(sum, item) => sum + item.unitprice * item.qty,
						0,
					);
					const tax = subtotal * 0.18; // 18% tax
					const deliveryfee = ordertype === "delivery" ? 50 : 0;
					const discount = subtotal > 1000 ? subtotal * 0.05 : 0;
					const total = subtotal + tax + deliveryfee - discount;

					// Create order
					await idb.transact([
						tx.orders[orderId]
							.update({
								contributorid,
								nodeid,
								ordernum,
								ordertype: ordertype || "store",
								subtotal,
								tax,
								deliveryfee,
								discount,
								total,
								currency: "INR",
								address: address || "",
								phone: phone || "",
								status: "pending",
								paystatus: "pending",
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ contributor: contributorid, node: nodeid }),
					]);

					// Create line items
					const lineitemTransactions = items.map((item) => {
						const lineitemId = id();
						return tx.lineitems[lineitemId]
							.update({
								orderid: orderId,
								productid: item.productId,
								instanceid: item.instanceId || undefined,
								name: item.name,
								instancename: item.instanceId || "",
								qty: item.qty,
								unitprice: item.unitprice,
								total: item.unitprice * item.qty,
								createdat: Date.now(),
							})
							.link({
								order: orderId,
								product: item.productId,
								...(item.instanceId && { instance: item.instanceId }),
							});
					});

					await idb.transact(lineitemTransactions);

					return {
						success: true,
						message: `Order ${ordernum} created successfully`,
						orderId,
						ordernum,
						total,
					};
				}

				case "getDetails": {
					const { orderId } = params;

					if (!orderId) {
						return { success: false, message: "orderId is required" };
					}

					const result = await idb.query({
						orders: {
							$: { where: { id: orderId } },
							contributor: {},
							node: {},
							lineitems: {
								product: {},
							},
							tasks: {},
						},
					});

					const order = result.orders?.[0];
					if (!order) {
						return { success: false, message: `Order "${orderId}" not found` };
					}

					return {
						success: true,
						order,
					};
				}

				case "updateStatus": {
					const { orderId, status } = params;

					if (!orderId || !status) {
						return {
							success: false,
							message: "orderId and status are required",
						};
					}

					const updateData: any = {
						status,
						updatedat: Date.now(),
					};

					if (status === "confirmed") {
						updateData.confirmedat = Date.now();
					} else if (status === "delivered") {
						updateData.deliveredat = Date.now();
					}

					await idb.transact([tx.orders[orderId].update(updateData)]);

					return {
						success: true,
						message: `Order status updated to "${status}"`,
					};
				}

				case "cancel": {
					const { orderId } = params;

					if (!orderId) {
						return { success: false, message: "orderId is required" };
					}

					await idb.transact([
						tx.orders[orderId].update({
							status: "cancelled",
							updatedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: "Order cancelled successfully",
					};
				}

				case "getByContributor": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const result = await idb.query({
						orders: {
							$: {
								where: { "contributor.id": contributorid },
								limit,
							},
							node: {},
							lineitems: {},
						},
					});

					return {
						success: true,
						orders: result.orders || [],
					};
				}

				case "getByNode": {
					const { nodeid, limit = 20 } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid is required" };
					}

					const result = await idb.query({
						orders: {
							$: {
								where: { "node.id": nodeid },
								limit,
							},
							contributor: {},
							lineitems: {},
						},
					});

					return {
						success: true,
						orders: result.orders || [],
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Order tool error:", error);
			return {
				success: false,
				message: "Order operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 3. SERVICE TOOL (Service & Booking Management)
// ============================================

export const serviceTool = createTool({
	name: "service",
	description:
		"Service & booking mgmt. Actions: createService,updateService,createSlots,getAvailableSlots,createBooking,updateBooking,cancelBooking,getBookingDetails",
	parameters: z.object({
		action: z.enum([
			"createService",
			"updateService",
			"createSlots",
			"getAvailableSlots",
			"createBooking",
			"updateBooking",
			"cancelBooking",
			"getBookingDetails",
		]),
		serviceId: z.string().optional(),
		bookingId: z.string().optional(),
		slotId: z.string().optional(),
		nodeid: z.string().optional(),
		contributorid: z.string().optional(),
		name: z.string().optional(),
		desc: z.string().optional(),
		category: z.string().optional(),
		price: z.number().optional(),
		duration: z.number().optional(),
		date: z.string().optional(),
		start: z.string().optional(),
		end: z.string().optional(),
		customerName: z.string().optional(),
		phone: z.string().optional(),
		email: z.string().optional(),
		notes: z.string().optional(),
		status: z
			.enum(["pending", "confirmed", "completed", "cancelled", "noshow"])
			.optional(),
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "createService": {
					const { nodeid, name, desc, category, price, duration } = params;

					if (!nodeid || !name || !category || !price || !duration) {
						return {
							success: false,
							message:
								"Missing required fields: nodeid, name, category, price, duration",
						};
					}

					const serviceId = id();
					await idb.transact([
						tx.services[serviceId]
							.update({
								nodeid,
								name,
								desc: desc || "",
								category,
								price,
								currency: "INR",
								pricetype: "fixed",
								duration,
								needapproval: false,
								maxperslot: 1,
								active: true,
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ node: nodeid }),
					]);

					return {
						success: true,
						message: `Service "${name}" created successfully`,
						serviceId,
					};
				}

				case "createSlots": {
					const { serviceId, nodeid, date, start, end } = params;

					if (!serviceId || !nodeid || !date || !start || !end) {
						return {
							success: false,
							message:
								"Missing required fields: serviceId, nodeid, date, start, end",
						};
					}

					const slotId = id();
					await idb.transact([
						tx.slots[slotId]
							.update({
								serviceid: serviceId,
								nodeid,
								date,
								start,
								end,
								status: "available",
								capacity: 1,
								booked: 0,
								createdat: Date.now(),
							})
							.link({ service: serviceId, node: nodeid }),
					]);

					return {
						success: true,
						message: `Slot created for ${date} ${start}-${end}`,
						slotId,
					};
				}

				case "getAvailableSlots": {
					const { serviceId, date } = params;

					if (!serviceId || !date) {
						return {
							success: false,
							message: "serviceId and date are required",
						};
					}

					const result = await idb.query({
						slots: {
							$: {
								where: {
									"service.id": serviceId,
									date,
									status: "available",
								},
							},
							service: {},
						},
					});

					return {
						success: true,
						slots: result.slots || [],
					};
				}

				case "createBooking": {
					const {
						contributorid,
						serviceId,
						nodeid,
						slotId,
						date,
						start,
						end,
						duration,
						price,
						customerName,
						phone,
						email,
						notes,
					} = params;

					if (
						!contributorid ||
						!serviceId ||
						!nodeid ||
						!slotId ||
						!date ||
						!start
					) {
						return {
							success: false,
							message:
								"Missing required fields: contributorid, serviceId, nodeid, slotId, date, start",
						};
					}

					const bookingId = id();
					const bookingnum = `BKG-${Date.now()}`;

					// Create booking
					await idb.transact([
						tx.bookings[bookingId]
							.update({
								contributorid,
								serviceid: serviceId,
								nodeid,
								slotid: slotId,
								bookingnum,
								date,
								start,
								end: end || "",
								duration: duration || 0,
								price: price || 0,
								name: customerName || "",
								phone: phone || "",
								email: email || "",
								notes: notes || "",
								status: "pending",
								paystatus: "pending",
								createdat: Date.now(),
							})
							.link({
								contributor: contributorid,
								service: serviceId,
								node: nodeid,
								slot: slotId,
							}),

						// Update slot
						tx.slots[slotId].update({
							status: "booked",
							booked: 1,
						}),
					]);

					return {
						success: true,
						message: `Booking ${bookingnum} created successfully`,
						bookingId,
						bookingnum,
					};
				}

				case "updateBooking": {
					const { bookingId, status } = params;

					if (!bookingId || !status) {
						return {
							success: false,
							message: "bookingId and status are required",
						};
					}

					const updateData: any = {
						status,
					};

					if (status === "confirmed") {
						updateData.confirmedat = Date.now();
					} else if (status === "completed") {
						updateData.completedat = Date.now();
					}

					await idb.transact([tx.bookings[bookingId].update(updateData)]);

					return {
						success: true,
						message: `Booking status updated to "${status}"`,
					};
				}

				case "cancelBooking": {
					const { bookingId, slotId } = params;

					if (!bookingId || !slotId) {
						return {
							success: false,
							message: "bookingId and slotId are required",
						};
					}

					await idb.transact([
						tx.bookings[bookingId].update({
							status: "cancelled",
						}),
						tx.slots[slotId].update({
							status: "available",
							booked: 0,
						}),
					]);

					return {
						success: true,
						message: "Booking cancelled successfully",
					};
				}

				case "getBookingDetails": {
					const { bookingId } = params;

					if (!bookingId) {
						return { success: false, message: "bookingId is required" };
					}

					const result = await idb.query({
						bookings: {
							$: { where: { id: bookingId } },
							contributor: {},
							service: {},
							node: {},
							slot: {},
							tasks: {},
						},
					});

					const booking = result.bookings?.[0];
					if (!booking) {
						return {
							success: false,
							message: `Booking "${bookingId}" not found`,
						};
					}

					return {
						success: true,
						booking,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Service tool error:", error);
			return {
				success: false,
				message: "Service operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 4. NODE TOOL (Node/Business Management)
// ============================================

export const nodeTool = createTool({
	name: "node",
	description:
		"Node mgmt. Actions: create,update,getDetails,getProducts,getServices,getOrders,search",
	parameters: z.object({
		action: z.enum([
			"create",
			"update",
			"getDetails",
			"getProducts",
			"getServices",
			"getOrders",
			"search",
		]),
		nodeid: z.string().optional(),
		name: z.string().optional(),
		type: z
			.enum(["store", "restaurant", "service", "doctor", "salon"])
			.optional(),
		address: z.string().optional(),
		city: z.string().optional(),
		lat: z.number().optional(),
		lng: z.number().optional(),
		phone: z.string().optional(),
		email: z.string().optional(),
		query: z.string().optional(),
		limit: z.number().optional(),
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "create": {
					const { name, type, address, city, lat, lng, phone, email } = params;

					if (!name || !type || !address || !city || !phone) {
						return {
							success: false,
							message:
								"Missing required fields: name, type, address, city, phone",
						};
					}

					const nodeid = id();
					await idb.transact([
						tx.nodes[nodeid].update({
							name,
							type,
							address,
							city,
							lat: lat || 0,
							lng: lng || 0,
							phone,
							email: email || "",
							open: "09:00",
							close: "18:00",
							days: "Mon-Sat",
							commission: 5,
							isopen: true,
							verified: false,
							rating: 0,
							createdat: Date.now(),
							updatedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: `Node "${name}" created successfully`,
						nodeid,
					};
				}

				case "update": {
					const { nodeid, name, address, city, phone, email } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid is required" };
					}

					const updateData: any = { updatedat: Date.now() };
					if (name !== undefined) updateData.name = name;
					if (address !== undefined) updateData.address = address;
					if (city !== undefined) updateData.city = city;
					if (phone !== undefined) updateData.phone = phone;
					if (email !== undefined) updateData.email = email;

					await idb.transact([tx.nodes[nodeid].update(updateData)]);

					return {
						success: true,
						message: `Node "${nodeid}" updated successfully`,
					};
				}

				case "getDetails": {
					const { nodeid } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid is required" };
					}

					const result = await idb.query({
						nodes: {
							$: { where: { id: nodeid } },
							products: {},
							services: {},
							orders: {},
						},
					});

					const node = result.nodes?.[0];
					if (!node) {
						return { success: false, message: `Node "${nodeid}" not found` };
					}

					return {
						success: true,
						node,
					};
				}

				case "getProducts": {
					const { nodeid, limit = 50 } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid is required" };
					}

					const result = await idb.query({
						products: {
							$: {
								where: { "node.id": nodeid },
								limit,
							},
							instances: {},
						},
					});

					return {
						success: true,
						products: result.products || [],
					};
				}

				case "getServices": {
					const { nodeid, limit = 50 } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid is required" };
					}

					const result = await idb.query({
						services: {
							$: {
								where: { "node.id": nodeid },
								limit,
							},
							slots: {},
						},
					});

					return {
						success: true,
						services: result.services || [],
					};
				}

				case "search": {
					const { query, type, city, limit = 20 } = params;

					const whereClause: any = {};
					if (query) whereClause.name = { $ilike: `%${query}%` };
					if (type) whereClause.type = type;
					if (city) whereClause.city = city;

					const result = await idb.query({
						nodes: {
							$: { where: whereClause, limit },
						},
					});

					return {
						success: true,
						nodes: result.nodes || [],
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Node tool error:", error);
			return {
				success: false,
				message: "Node operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 5. CONTRIBUTOR TOOL (Participant Management)
// ============================================

export const contributorTool = createTool({
	name: "contributor",
	description:
		"Contributor mgmt. Actions: create,update,getDetails,getOrders,getBookings,getTasks",
	parameters: z.object({
		action: z.enum([
			"create",
			"update",
			"getDetails",
			"getOrders",
			"getBookings",
			"getTasks",
		]),
		contributorid: z.string().optional(),
		name: z.string().optional(),
		email: z.string().optional(),
		phone: z.string().optional(),
		role: z
			.enum(["customer", "staff", "driver", "admin", "nodeowner"])
			.optional(),
		address: z.string().optional(),
		city: z.string().optional(),
		limit: z.number().optional(),
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "create": {
					const { name, email, phone, role = "customer" } = params;

					if (!name || !email) {
						return {
							success: false,
							message: "Missing required fields: name, email",
						};
					}

					const contributorid = id();
					await idb.transact([
						tx.contributors[contributorid].update({
							name,
							email,
							phone: phone || "",
							role,
							active: true,
							createdat: Date.now(),
							updatedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: `Contributor "${name}" created successfully`,
						contributorid,
					};
				}

				case "update": {
					const { contributorid, name, phone, address, city } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const updateData: any = { updatedat: Date.now() };
					if (name !== undefined) updateData.name = name;
					if (phone !== undefined) updateData.phone = phone;
					if (address !== undefined) updateData.address = address;
					if (city !== undefined) updateData.city = city;

					await idb.transact([tx.contributors[contributorid].update(updateData)]);

					return {
						success: true,
						message: `Contributor "${contributorid}" updated successfully`,
					};
				}

				case "getDetails": {
					const { contributorid } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const result = await idb.query({
						contributors: {
							$: { where: { id: contributorid } },
							orders: {},
							bookings: {},
							assignedtasks: {},
						},
					});

					const contributor = result.contributors?.[0];
					if (!contributor) {
						return {
							success: false,
							message: `Contributor "${contributorid}" not found`,
						};
					}

					return {
						success: true,
						contributor,
					};
				}

				case "getOrders": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const result = await idb.query({
						orders: {
							$: {
								where: { "contributor.id": contributorid },
								limit,
							},
							node: {},
							lineitems: {},
						},
					});

					return {
						success: true,
						orders: result.orders || [],
					};
				}

				case "getBookings": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const result = await idb.query({
						bookings: {
							$: {
								where: { "contributor.id": contributorid },
								limit,
							},
							service: {},
							node: {},
						},
					});

					return {
						success: true,
						bookings: result.bookings || [],
					};
				}

				case "getTasks": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const result = await idb.query({
						tasks: {
							$: {
								where: { assignedto: contributorid },
								limit,
							},
							order: {},
							booking: {},
						},
					});

					return {
						success: true,
						tasks: result.tasks || [],
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Contributor tool error:", error);
			return {
				success: false,
				message: "Contributor operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 6. TASK TOOL (Workflow Task Management)
// ============================================

export const taskTool = createTool({
	name: "task",
	description:
		"Task mgmt. Actions: create,assign,updateStatus,complete,updateLocation,verifyOTP,getByOrder,getByBooking",
	parameters: z.object({
		action: z.enum([
			"create",
			"assign",
			"updateStatus",
			"complete",
			"updateLocation",
			"verifyOTP",
			"getByOrder",
			"getByBooking",
		]),
		taskId: z.string().optional(),
		reltype: z.enum(["order", "booking"]).optional(),
		relid: z.string().optional(),
		nodeid: z.string().optional(),
		tasktype: z
			.enum(["prepare", "deliver", "confirm", "complete"])
			.optional(),
		title: z.string().optional(),
		assignedto: z.string().optional(),
		status: z
			.enum(["pending", "assigned", "inprogress", "completed", "failed"])
			.optional(),
		lat: z.number().optional(),
		lng: z.number().optional(),
		otp: z.string().optional(),
		seq: z.number().optional(),
		dependson: z.string().optional(),
		limit: z.number().optional(),
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "create": {
					const {
						reltype,
						relid,
						nodeid,
						tasktype,
						title,
						seq = 1,
						dependson,
					} = params;

					if (!reltype || !relid || !nodeid || !tasktype || !title) {
						return {
							success: false,
							message:
								"Missing required fields: reltype, relid, nodeid, tasktype, title",
						};
					}

					const taskId = id();
					await idb.transact([
						tx.tasks[taskId]
							.update({
								nodeid,
								reltype,
								relid,
								tasktype,
								title,
								seq,
								dependson: dependson || "",
								status: "pending",
								trackloc: tasktype === "deliver",
								needotp: tasktype === "deliver",
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ node: nodeid }),
					]);

					return {
						success: true,
						message: `Task "${title}" created successfully`,
						taskId,
					};
				}

				case "assign": {
					const { taskId, assignedto } = params;

					if (!taskId || !assignedto) {
						return {
							success: false,
							message: "taskId and assignedto are required",
						};
					}

					await idb.transact([
						tx.tasks[taskId]
							.update({
								status: "assigned",
								assignedat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ assignedcontributor: assignedto }),
					]);

					return {
						success: true,
						message: "Task assigned successfully",
					};
				}

				case "updateStatus": {
					const { taskId, status } = params;

					if (!taskId || !status) {
						return {
							success: false,
							message: "taskId and status are required",
						};
					}

					const updateData: any = {
						status,
						updatedat: Date.now(),
					};

					if (status === "inprogress") {
						updateData.startedat = Date.now();
					} else if (status === "completed") {
						updateData.completedat = Date.now();
					}

					await idb.transact([tx.tasks[taskId].update(updateData)]);

					return {
						success: true,
						message: `Task status updated to "${status}"`,
					};
				}

				case "complete": {
					const { taskId } = params;

					if (!taskId) {
						return { success: false, message: "taskId is required" };
					}

					await idb.transact([
						tx.tasks[taskId].update({
							status: "completed",
							completedat: Date.now(),
							updatedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: "Task completed successfully",
					};
				}

				case "updateLocation": {
					const { taskId, lat, lng } = params;

					if (!taskId || lat === undefined || lng === undefined) {
						return {
							success: false,
							message: "taskId, lat, and lng are required",
						};
					}

					await idb.transact([
						tx.tasks[taskId].update({
							lat,
							lng,
							lastloc: Date.now(),
							updatedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: "Location updated successfully",
					};
				}

				case "verifyOTP": {
					const { taskId, otp } = params;

					if (!taskId || !otp) {
						return {
							success: false,
							message: "taskId and otp are required",
						};
					}

					// In production, verify OTP against stored value
					await idb.transact([
						tx.tasks[taskId].update({
							status: "completed",
							verifiedat: Date.now(),
							completedat: Date.now(),
							updatedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: "OTP verified and task completed",
					};
				}

				case "getByOrder": {
					const { relid, limit = 20 } = params;

					if (!relid) {
						return { success: false, message: "Order ID (relid) is required" };
					}

					const result = await idb.query({
						tasks: {
							$: {
								where: { reltype: "order", relid },
								limit,
							},
							node: {},
							assignedcontributor: {},
						},
					});

					return {
						success: true,
						tasks: result.tasks || [],
					};
				}

				case "getByBooking": {
					const { relid, limit = 20 } = params;

					if (!relid) {
						return {
							success: false,
							message: "Booking ID (relid) is required",
						};
					}

					const result = await idb.query({
						tasks: {
							$: {
								where: { reltype: "booking", relid },
								limit,
							},
							node: {},
							assignedcontributor: {},
						},
					});

					return {
						success: true,
						tasks: result.tasks || [],
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Task tool error:", error);
			return {
				success: false,
				message: "Task operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 7. TRANSACTION TOOL (Payment Management)
// ============================================

export const transactionTool = createTool({
	name: "transaction",
	description:
		"Payment mgmt. Actions: create,refund,getHistory,getByContributor,getByNode",
	parameters: z.object({
		action: z.enum([
			"create",
			"refund",
			"getHistory",
			"getByContributor",
			"getByNode",
		]),
		transactionId: z.string().optional(),
		orderid: z.string().optional(),
		bookingid: z.string().optional(),
		contributorid: z.string().optional(),
		nodeid: z.string().optional(),
		amount: z.number().optional(),
		currency: z.string().optional(),
		paymethod: z.enum(["cash", "card", "upi", "wallet"]).optional(),
		payref: z.string().optional(),
		platformfee: z.number().optional(),
		nodefee: z.number().optional(),
		limit: z.number().optional(),
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "create": {
					const {
						orderid,
						bookingid,
						contributorid,
						nodeid,
						amount,
						currency = "INR",
						paymethod,
						payref,
					} = params;

					if (!contributorid || !nodeid || !amount || !paymethod) {
						return {
							success: false,
							message:
								"Missing required fields: contributorid, nodeid, amount, paymethod",
						};
					}

					// Calculate revenue split (5% platform fee)
					const platformfee = amount * 0.05;
					const nodefee = amount - platformfee;

					const transactionId = id();
					const transactionData: any = {
						contributorid,
						nodeid,
						orderid: orderid || undefined,
						bookingid: bookingid || undefined,
						amount,
						currency,
						paymethod,
						payref: payref || "",
						platformfee,
						nodefee,
						status: "success",
						createdat: Date.now(),
					};

					const links: any = {
						contributor: contributorid,
						node: nodeid,
					};

					if (orderid) links.order = orderid;
					if (bookingid) links.booking = bookingid;

					await idb.transact([
						tx.transactions[transactionId]
							.update(transactionData)
							.link(links),
					]);

					return {
						success: true,
						message: "Transaction recorded successfully",
						transactionId,
						platformfee,
						nodefee,
					};
				}

				case "refund": {
					const { transactionId, amount } = params;

					if (!transactionId || !amount) {
						return {
							success: false,
							message: "transactionId and amount are required",
						};
					}

					await idb.transact([
						tx.transactions[transactionId].update({
							status: "refunded",
							refundamount: amount,
							refundedat: Date.now(),
						}),
					]);

					return {
						success: true,
						message: "Refund processed successfully",
					};
				}

				case "getHistory": {
					const { limit = 50 } = params;

					const result = await idb.query({
						transactions: {
							$: { limit },
							contributor: {},
							node: {},
							order: {},
							booking: {},
						},
					});

					return {
						success: true,
						transactions: result.transactions || [],
					};
				}

				case "getByContributor": {
					const { contributorid, limit = 50 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const result = await idb.query({
						transactions: {
							$: {
								where: { "contributor.id": contributorid },
								limit,
							},
							node: {},
							order: {},
							booking: {},
						},
					});

					return {
						success: true,
						transactions: result.transactions || [],
					};
				}

				case "getByNode": {
					const { nodeid, limit = 50 } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid is required" };
					}

					const result = await idb.query({
						transactions: {
							$: {
								where: { "node.id": nodeid },
								limit,
							},
							contributor: {},
							order: {},
							booking: {},
						},
					});

					return {
						success: true,
						transactions: result.transactions || [],
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Transaction tool error:", error);
			return {
				success: false,
				message: "Transaction operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 8. SEARCH TOOL (Advanced Search & Discovery)
// ============================================

export const searchTool = createTool({
	name: "search",
	description:
		"Search products/services/nodes. Actions: products,services,nodes,nearMe,semantic",
	parameters: z.object({
		action: z.enum(["products", "services", "nodes", "nearMe", "semantic"]),
		query: z.string().optional(),
		category: z.string().optional(),
		city: z.string().optional(),
		type: z.string().optional(),
		lat: z.number().optional(),
		lng: z.number().optional(),
		radius: z.number().optional(), // in km
		limit: z.number().optional(),
		minPrice: z.number().optional(),
		maxPrice: z.number().optional(),
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "products": {
					const { query, category, minPrice, maxPrice, limit = 20 } = params;

					const whereClause: any = {};
					if (query) whereClause.name = { $ilike: `%${query}%` };
					if (category) whereClause.category = category;

					const result = await idb.query({
						products: {
							$: { where: whereClause, limit },
							node: {},
							instances: {},
						},
					});

					let products = result.products || [];

					// Filter by price range if provided
					if (minPrice !== undefined || maxPrice !== undefined) {
						products = products.filter((p: any) => {
							const price = p.price;
							if (minPrice !== undefined && price < minPrice) return false;
							if (maxPrice !== undefined && price > maxPrice) return false;
							return true;
						});
					}

					return {
						success: true,
						products,
						totalFound: products.length,
					};
				}

				case "services": {
					const { query, category, city, limit = 20 } = params;

					const whereClause: any = {};
					if (query) whereClause.name = { $ilike: `%${query}%` };
					if (category) whereClause.category = category;

					const result = await idb.query({
						services: {
							$: { where: whereClause, limit },
							node: {},
							slots: {},
						},
					});

					let services = result.services || [];

					// Filter by city if node has city
					if (city) {
						services = services.filter(
							(s: any) => s.node?.city?.toLowerCase() === city.toLowerCase(),
						);
					}

					return {
						success: true,
						services,
						totalFound: services.length,
					};
				}

				case "nodes": {
					const { query, type, city, limit = 20 } = params;

					const whereClause: any = {};
					if (query) whereClause.name = { $ilike: `%${query}%` };
					if (type) whereClause.type = type;
					if (city) whereClause.city = city;

					const result = await idb.query({
						nodes: {
							$: { where: whereClause, limit },
							products: {},
							services: {},
						},
					});

					return {
						success: true,
						nodes: result.nodes || [],
						totalFound: result.nodes?.length || 0,
					};
				}

				case "nearMe": {
					const { lat, lng, radius = 5, type, limit = 20 } = params;

					if (lat === undefined || lng === undefined) {
						return {
							success: false,
							message: "lat and lng are required for nearMe search",
						};
					}

					const whereClause: any = {};
					if (type) whereClause.type = type;

					const result = await idb.query({
						nodes: {
							$: { where: whereClause, limit: limit * 2 }, // Get more for filtering
							products: {},
							services: {},
						},
					});

					// Calculate distance and filter by radius
					const nodesWithDistance = (result.nodes || [])
						.map((node: any) => {
							const nodeLat = node.lat || 0;
							const nodeLng = node.lng || 0;

							// Haversine distance formula (approximate)
							const R = 6371; // Earth's radius in km
							const dLat = ((nodeLat - lat) * Math.PI) / 180;
							const dLng = ((nodeLng - lng) * Math.PI) / 180;
							const a =
								Math.sin(dLat / 2) * Math.sin(dLat / 2) +
								Math.cos((lat * Math.PI) / 180) *
									Math.cos((nodeLat * Math.PI) / 180) *
									Math.sin(dLng / 2) *
									Math.sin(dLng / 2);
							const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
							const distance = R * c;

							return {
								...node,
								distance: Math.round(distance * 10) / 10, // Round to 1 decimal
							};
						})
						.filter((node: any) => node.distance <= radius)
						.sort((a: any, b: any) => a.distance - b.distance)
						.slice(0, limit);

					return {
						success: true,
						nodes: nodesWithDistance,
						totalFound: nodesWithDistance.length,
						searchRadius: radius,
					};
				}

				case "semantic": {
					// Placeholder for semantic/vector search
					// This would integrate with vector database or embedding service
					const { query, limit = 10 } = params;

					if (!query) {
						return {
							success: false,
							message: "query is required for semantic search",
						};
					}

					// For now, fall back to text search
					const result = await idb.query({
						products: {
							$: {
								where: { name: { $ilike: `%${query}%` } },
								limit,
							},
							node: {},
							instances: {},
						},
					});

					return {
						success: true,
						products: result.products || [],
						totalFound: result.products?.length || 0,
						searchType: "semantic (fallback to text)",
						message:
							"Semantic search not yet implemented, using text search fallback",
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Search tool error:", error);
			return {
				success: false,
				message: "Search operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// 9. REVIEW TOOL (Customer Reviews)
// ============================================

export const reviewTool = createTool({
	name: "review",
	description:
		"Review mgmt. Actions: create,update,getByTarget,getByContributor,verify,delete",
	parameters: z.object({
		action: z.enum([
			"create",
			"update",
			"getByTarget",
			"getByContributor",
			"verify",
			"delete",
		]),
		reviewId: z.string().optional(),
		contributorid: z.string().optional(),
		targettype: z.enum(["product", "service", "node"]).optional(),
		targetid: z.string().optional(),
		rating: z.number().min(1).max(5).optional(),
		comment: z.string().optional(),
		images: z.array(z.string()).optional(),
		verified: z.boolean().optional(),
		limit: z.number().optional(),
	}),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "create": {
					const {
						contributorid,
						targettype,
						targetid,
						rating,
						comment,
						images,
					} = params;

					if (
						!contributorid ||
						!targettype ||
						!targetid ||
						rating === undefined
					) {
						return {
							success: false,
							message:
								"Missing required fields: contributorid, targettype, targetid, rating",
						};
					}

					const reviewId = id();
					await idb.transact([
						tx.reviews[reviewId]
							.update({
								contributorid,
								targettype,
								targetid,
								rating,
								comment: comment || "",
								images: images || [],
								verified: false,
								createdat: Date.now(),
							})
							.link({ contributor: contributorid }),
					]);

					return {
						success: true,
						message: "Review created successfully",
						reviewId,
					};
				}

				case "update": {
					const { reviewId, rating, comment, images } = params;

					if (!reviewId) {
						return { success: false, message: "reviewId is required" };
					}

					const updateData: any = {};
					if (rating !== undefined) updateData.rating = rating;
					if (comment !== undefined) updateData.comment = comment;
					if (images !== undefined) updateData.images = images;

					await idb.transact([tx.reviews[reviewId].update(updateData)]);

					return {
						success: true,
						message: "Review updated successfully",
					};
				}

				case "getByTarget": {
					const { targettype, targetid, limit = 20 } = params;

					if (!targettype || !targetid) {
						return {
							success: false,
							message: "targettype and targetid are required",
						};
					}

					const result = await idb.query({
						reviews: {
							$: {
								where: { targettype, targetid },
								limit,
							},
							contributor: {},
						},
					});

					const reviews = result.reviews || [];

					// Calculate average rating
					const avgRating =
						reviews.length > 0
							? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) /
								reviews.length
							: 0;

					return {
						success: true,
						reviews,
						totalReviews: reviews.length,
						averageRating: Math.round(avgRating * 10) / 10,
					};
				}

				case "getByContributor": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid is required" };
					}

					const result = await idb.query({
						reviews: {
							$: {
								where: { "contributor.id": contributorid },
								limit,
							},
						},
					});

					return {
						success: true,
						reviews: result.reviews || [],
					};
				}

				case "verify": {
					const { reviewId } = params;

					if (!reviewId) {
						return { success: false, message: "reviewId is required" };
					}

					await idb.transact([
						tx.reviews[reviewId].update({
							verified: true,
						}),
					]);

					return {
						success: true,
						message: "Review verified successfully",
					};
				}

				case "delete": {
					const { reviewId } = params;

					if (!reviewId) {
						return { success: false, message: "reviewId is required" };
					}

					await idb.transact([tx.reviews[reviewId].delete()]);

					return {
						success: true,
						message: "Review deleted successfully",
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Review tool error:", error);
			return {
				success: false,
				message: "Review operation failed",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

// ============================================
// EXPORT ALL TOOLS
// ============================================

export const commerceTools = [
	productTool,
	orderTool,
	serviceTool,
	nodeTool,
	contributorTool,
	taskTool,
	transactionTool,
	searchTool,
	reviewTool,
];
