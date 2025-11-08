import { createWorkflowChain } from "@voltagent/core";
import { z } from "zod";
import {
	productTool,
	orderTool,
	serviceTool,
	taskTool,
	transactionTool,
} from "../tools/commerce";

/**
 * UPDATED COMMERCE WORKFLOWS
 * Using domain-clustered tools with action-based routing
 * Aligned with InstantDB schema (nodes, products, instances, etc.)
 */

// ============================================
// 1. ORDER PROCESSING WORKFLOW
// ============================================

export const orderProcessingWorkflow = createWorkflowChain({
	id: "order-processing",
	name: "Order Processing Workflow",
	purpose:
		"Process customer orders with inventory validation, order creation, task generation, and payment processing",

	input: z.object({
		contributorid: z.string(),
		nodeid: z.string(),
		items: z.array(
			z.object({
				productId: z.string(),
				instanceId: z.string().optional(),
				name: z.string(),
				qty: z.number(),
				unitprice: z.number(),
			}),
		),
		ordertype: z.enum(["store", "food", "delivery"]),
		address: z.string().optional(),
		phone: z.string().optional(),
	}),

	result: z.object({
		success: z.boolean(),
		orderId: z.string().optional(),
		ordernum: z.string().optional(),
		total: z.number().optional(),
		message: z.string(),
	}),
})
	// Step 1: Validate inventory for all items
	.andThen({
		id: "validate-inventory",
		execute: async ({ data }) => {
			console.log(`Validating inventory for ${data.items.length} items...`);

			const validationResults = [];

			for (const item of data.items) {
				if (item.instanceId) {
					// Check instance availability
					const availabilityCheck = await productTool.execute({
						action: "checkAvailability",
						instanceId: item.instanceId,
						qty: item.qty,
					});

					validationResults.push({
						productId: item.productId,
						instanceId: item.instanceId,
						requestedQty: item.qty,
						available: availabilityCheck.available,
						currentQty: availabilityCheck.currentQty,
						name: item.name,
					});
				} else {
					// For products without instances, assume available
					validationResults.push({
						productId: item.productId,
						requestedQty: item.qty,
						available: true,
						name: item.name,
					});
				}
			}

			const unavailableItems = validationResults.filter((r) => !r.available);

			return {
				...data,
				validationResults,
				hasUnavailableItems: unavailableItems.length > 0,
				unavailableItems,
			};
		},
	})

	// Step 2: Create order if validation passed
	.andThen({
		id: "create-order",
		execute: async ({ data }) => {
			if ("hasUnavailableItems" in data && data.hasUnavailableItems) {
				const unavailableList = (data.unavailableItems as any[])
					.map(
						(i) =>
							`${i.name} (requested: ${i.requestedQty}, available: ${i.currentQty || 0})`,
					)
					.join(", ");

				return {
					...data,
					success: false,
					message: `Cannot process order. Unavailable items: ${unavailableList}`,
				};
			}

			// Create order using orderTool
			const orderResult = await orderTool.execute({
				action: "create",
				contributorid: data.contributorid,
				nodeid: data.nodeid,
				ordertype: data.ordertype,
				items: data.items,
				address: data.address,
				phone: data.phone,
			});

			if (!orderResult.success) {
				return {
					...data,
					success: false,
					message: orderResult.message,
				};
			}

			return {
				...data,
				orderId: orderResult.orderId,
				ordernum: orderResult.ordernum,
				total: orderResult.total,
			};
		},
	})

	// Step 3: Update instance inventory
	.andThen({
		id: "update-inventory",
		execute: async ({ data }) => {
			if ("success" in data && !data.success) {
				return data;
			}

			// Update instance quantities for reserved items
			for (const item of data.items) {
				if (item.instanceId) {
					// Get current instance
					const instances = await productTool.execute({
						action: "getInstances",
						productId: item.productId,
					});

					const instance = instances.instances?.find(
						(i: any) => i.id === item.instanceId,
					);

					if (instance) {
						// Reduce available quantity
						await productTool.execute({
							action: "updateInstance",
							instanceId: item.instanceId,
							qty: instance.qty - item.qty,
						});
					}
				}
			}

			return data;
		},
	})

	// Step 4: Generate workflow tasks
	.andThen({
		id: "generate-tasks",
		execute: async ({ data }) => {
			if ("success" in data && !data.success) {
				return data;
			}

			const orderId = "orderId" in data ? data.orderId : "";
			const ordertype = data.ordertype;

			const tasks = [];

			// Task 1: Prepare order
			const prepareTask = await taskTool.execute({
				action: "create",
				reltype: "order",
				relid: orderId,
				nodeid: data.nodeid,
				tasktype: "prepare",
				title:
					ordertype === "food"
						? "Prepare Food Order"
						: "Prepare Order for Pickup",
				seq: 1,
			});
			tasks.push(prepareTask);

			// Task 2: Deliver (if delivery order)
			if (ordertype === "delivery" || ordertype === "food") {
				const deliverTask = await taskTool.execute({
					action: "create",
					reltype: "order",
					relid: orderId,
					nodeid: data.nodeid,
					tasktype: "deliver",
					title: "Deliver Order",
					seq: 2,
				});
				tasks.push(deliverTask);
			}

			return {
				...data,
				tasks,
			};
		},
	})

	// Step 5: Create transaction
	.andThen({
		id: "create-transaction",
		execute: async ({ data }) => {
			if ("success" in data && !data.success) {
				return data;
			}

			const orderId = "orderId" in data ? data.orderId : "";
			const total = "total" in data ? data.total : 0;

			const transaction = await transactionTool.execute({
				action: "create",
				orderid: orderId,
				contributorid: data.contributorid,
				nodeid: data.nodeid,
				amount: total,
				paymethod: "cash",
			});

			return {
				success: true,
				orderId,
				ordernum: "ordernum" in data ? data.ordernum : "",
				total,
				message: `Order processed successfully. Order ID: ${orderId}`,
				transaction,
			};
		},
	});

// ============================================
// 2. SERVICE BOOKING WORKFLOW
// ============================================

export const serviceBookingWorkflow = createWorkflowChain({
	id: "service-booking",
	name: "Service Booking Workflow",
	purpose:
		"Book service appointments with slot validation, booking creation, and confirmation",

	input: z.object({
		contributorid: z.string(),
		serviceId: z.string(),
		nodeid: z.string(),
		date: z.string(),
		start: z.string(),
		customerName: z.string(),
		phone: z.string(),
		email: z.string().optional(),
		notes: z.string().optional(),
	}),

	result: z.object({
		success: z.boolean(),
		bookingId: z.string().optional(),
		bookingnum: z.string().optional(),
		message: z.string(),
	}),
})
	// Step 1: Check slot availability
	.andThen({
		id: "check-slots",
		execute: async ({ data }) => {
			console.log(
				`Checking available slots for service ${data.serviceId} on ${data.date}...`,
			);

			const slotsResult = await serviceTool.execute({
				action: "getAvailableSlots",
				serviceId: data.serviceId,
				date: data.date,
			});

			if (!slotsResult.success || !slotsResult.slots?.length) {
				return {
					...data,
					success: false,
					message: `No available slots for ${data.date}`,
				};
			}

			// Find slot matching the requested start time
			const slot = slotsResult.slots.find((s: any) => s.start === data.start);

			if (!slot) {
				return {
					...data,
					success: false,
					message: `Slot at ${data.start} is not available`,
				};
			}

			return {
				...data,
				slotId: slot.id,
				slotEnd: slot.end,
			};
		},
	})

	// Step 2: Create booking
	.andThen({
		id: "create-booking",
		execute: async ({ data }) => {
			if ("success" in data && !data.success) {
				return data;
			}

			const slotId = "slotId" in data ? data.slotId : "";
			const slotEnd = "slotEnd" in data ? data.slotEnd : "";

			// Get service details for pricing
			const serviceDetails = await serviceTool.execute({
				action: "getAvailableSlots",
				serviceId: data.serviceId,
				date: data.date,
			});

			const price = serviceDetails.slots?.[0]?.service?.price || 0;
			const duration = serviceDetails.slots?.[0]?.service?.duration || 60;

			const bookingResult = await serviceTool.execute({
				action: "createBooking",
				contributorid: data.contributorid,
				serviceId: data.serviceId,
				nodeid: data.nodeid,
				slotId,
				date: data.date,
				start: data.start,
				end: slotEnd,
				duration,
				price,
				customerName: data.customerName,
				phone: data.phone,
				email: data.email,
				notes: data.notes,
			});

			if (!bookingResult.success) {
				return {
					...data,
					success: false,
					message: bookingResult.message,
				};
			}

			return {
				...data,
				bookingId: bookingResult.bookingId,
				bookingnum: bookingResult.bookingnum,
				price,
			};
		},
	})

	// Step 3: Generate confirmation tasks
	.andThen({
		id: "generate-tasks",
		execute: async ({ data }) => {
			if ("success" in data && !data.success) {
				return data;
			}

			const bookingId = "bookingId" in data ? data.bookingId : "";

			// Task 1: Confirm booking
			const confirmTask = await taskTool.execute({
				action: "create",
				reltype: "booking",
				relid: bookingId,
				nodeid: data.nodeid,
				tasktype: "confirm",
				title: "Confirm Booking",
				seq: 1,
			});

			// Task 2: Send reminder (can be scheduled)
			const reminderTask = await taskTool.execute({
				action: "create",
				reltype: "booking",
				relid: bookingId,
				nodeid: data.nodeid,
				tasktype: "confirm",
				title: "Send Reminder",
				seq: 2,
			});

			// Task 3: Complete service
			const completeTask = await taskTool.execute({
				action: "create",
				reltype: "booking",
				relid: bookingId,
				nodeid: data.nodeid,
				tasktype: "complete",
				title: "Complete Service",
				seq: 3,
			});

			return {
				...data,
				tasks: [confirmTask, reminderTask, completeTask],
			};
		},
	})

	// Step 4: Create transaction
	.andThen({
		id: "create-transaction",
		execute: async ({ data }) => {
			if ("success" in data && !data.success) {
				return data;
			}

			const bookingId = "bookingId" in data ? data.bookingId : "";
			const price = "price" in data ? data.price : 0;

			const transaction = await transactionTool.execute({
				action: "create",
				bookingid: bookingId,
				contributorid: data.contributorid,
				nodeid: data.nodeid,
				amount: price,
				paymethod: "card",
			});

			return {
				success: true,
				bookingId,
				bookingnum: "bookingnum" in data ? data.bookingnum : "",
				message: `Booking confirmed successfully. Booking ID: ${bookingId}`,
				transaction,
			};
		},
	});

// ============================================
// 3. PRODUCT DISCOVERY WORKFLOW
// ============================================

export const productDiscoveryWorkflow = createWorkflowChain({
	id: "product-discovery",
	name: "Product Discovery Workflow",
	purpose:
		"Discover and rank products based on search query, availability, and relevance",

	input: z.object({
		query: z.string(),
		nodeid: z.string().optional(),
		limit: z.number().optional(),
	}),

	result: z.object({
		success: z.boolean(),
		products: z.array(z.any()),
		totalFound: z.number(),
	}),
})
	// Step 1: Search products
	.andThen({
		id: "search-products",
		execute: async ({ data }) => {
			console.log(`Searching for products: "${data.query}"...`);

			const searchResult = await productTool.execute({
				action: "search",
				query: data.query,
				nodeid: data.nodeid,
				limit: data.limit || 20,
			});

			if (!searchResult.success) {
				return {
					success: false,
					products: [],
					totalFound: 0,
				};
			}

			return {
				...data,
				products: searchResult.products || [],
			};
		},
	})

	// Step 2: Enrich with instance details
	.andThen({
		id: "enrich-products",
		execute: async ({ data }) => {
			const products = data.products || [];

			// Get instances for each product
			const enrichedProducts = await Promise.all(
				products.map(async (product: any) => {
					const instancesResult = await productTool.execute({
						action: "getInstances",
						productId: product.id,
					});

					return {
						...product,
						instances: instancesResult.instances || [],
						availableInstances:
							instancesResult.instances?.filter(
								(i: any) => i.status === "available" && i.available > 0,
							) || [],
					};
				}),
			);

			return {
				...data,
				products: enrichedProducts,
			};
		},
	})

	// Step 3: Rank and filter
	.andThen({
		id: "rank-products",
		execute: async ({ data }) => {
			const products = data.products || [];

			// Score products based on:
			// - In stock: +50 points
			// - Has available instances: +30 points
			// - Featured: +20 points
			const scoredProducts = products.map((product: any) => {
				let score = 0;

				if (product.instock) score += 50;
				if (product.availableInstances?.length > 0) score += 30;
				if (product.featured) score += 20;

				return {
					...product,
					score,
				};
			});

			// Sort by score descending
			const rankedProducts = scoredProducts.sort(
				(a: any, b: any) => b.score - a.score,
			);

			return {
				success: true,
				products: rankedProducts,
				totalFound: rankedProducts.length,
			};
		},
	});

// ============================================
// 4. TASK EXECUTION WORKFLOW
// ============================================

export const taskExecutionWorkflow = createWorkflowChain({
	id: "task-execution",
	name: "Task Execution Workflow",
	purpose: "Execute and track workflow tasks with location and OTP verification",

	input: z.object({
		taskId: z.string(),
		assignedto: z.string().optional(),
		lat: z.number().optional(),
		lng: z.number().optional(),
		otp: z.string().optional(),
	}),

	result: z.object({
		success: z.boolean(),
		message: z.string(),
		status: z.string(),
	}),
})
	// Step 1: Assign task if needed
	.andThen({
		id: "assign-task",
		execute: async ({ data }) => {
			if (data.assignedto) {
				await taskTool.execute({
					action: "assign",
					taskId: data.taskId,
					assignedto: data.assignedto,
				});

				return {
					...data,
					assigned: true,
				};
			}

			return data;
		},
	})

	// Step 2: Start task
	.andThen({
		id: "start-task",
		execute: async ({ data }) => {
			await taskTool.execute({
				action: "updateStatus",
				taskId: data.taskId,
				status: "inprogress",
			});

			return {
				...data,
				status: "inprogress",
			};
		},
	})

	// Step 3: Update location if provided
	.andThen({
		id: "update-location",
		execute: async ({ data }) => {
			if (data.lat !== undefined && data.lng !== undefined) {
				await taskTool.execute({
					action: "updateLocation",
					taskId: data.taskId,
					lat: data.lat,
					lng: data.lng,
				});

				return {
					...data,
					locationUpdated: true,
				};
			}

			return data;
		},
	})

	// Step 4: Complete task with OTP verification
	.andThen({
		id: "complete-task",
		execute: async ({ data }) => {
			if (data.otp) {
				// Verify OTP and complete
				const result = await taskTool.execute({
					action: "verifyOTP",
					taskId: data.taskId,
					otp: data.otp,
				});

				return {
					success: result.success,
					message: result.message,
					status: "completed",
				};
			} else {
				// Complete without OTP
				const result = await taskTool.execute({
					action: "complete",
					taskId: data.taskId,
				});

				return {
					success: result.success,
					message: result.message,
					status: "completed",
				};
			}
		},
	});

// ============================================
// EXPORT ALL WORKFLOWS
// ============================================

export const commerceWorkflows = {
	orderProcessing: orderProcessingWorkflow,
	serviceBooking: serviceBookingWorkflow,
	productDiscovery: productDiscoveryWorkflow,
	taskExecution: taskExecutionWorkflow,
};
