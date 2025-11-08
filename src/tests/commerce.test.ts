/**
 * COMMERCE TOOLS TEST SUITE
 * Comprehensive tests for all domain-clustered commerce tools
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
	productTool,
	orderTool,
	serviceTool,
	nodeTool,
	contributorTool,
	taskTool,
	transactionTool,
	searchTool,
	reviewTool,
} from "../tools/commerce";

// Test data
let testNodeId: string;
let testContributorId: string;
let testProductId: string;
let testInstanceId: string;
let testServiceId: string;
let testSlotId: string;
let testOrderId: string;
let testBookingId: string;
let testTaskId: string;
let testTransactionId: string;
let testReviewId: string;

describe("Commerce Tools Test Suite", () => {
	// ============================================
	// SETUP: Create Test Data
	// ============================================

	beforeAll(async () => {
		console.log("Setting up test data...");

		// Create test contributor
		const contributorResult = await contributorTool.execute({
			action: "create",
			name: "Test Customer",
			email: "test@example.com",
			phone: "1234567890",
			role: "customer",
		});
		testContributorId = contributorResult.contributorid!;

		// Create test node
		const nodeResult = await nodeTool.execute({
			action: "create",
			name: "Test Store",
			type: "store",
			address: "123 Test St",
			city: "Test City",
			lat: 12.9716,
			lng: 77.5946,
			phone: "9876543210",
			email: "teststore@example.com",
		});
		testNodeId = nodeResult.nodeid!;

		console.log("Test data created successfully");
	});

	// ============================================
	// NODE TOOL TESTS
	// ============================================

	describe("Node Tool", () => {
		it("should create a node", async () => {
			const result = await nodeTool.execute({
				action: "create",
				name: "New Test Store",
				type: "restaurant",
				address: "456 Test Ave",
				city: "Test City",
				lat: 12.9716,
				lng: 77.5946,
				phone: "1111111111",
			});

			expect(result.success).toBe(true);
			expect(result.nodeid).toBeDefined();
		});

		it("should get node details", async () => {
			const result = await nodeTool.execute({
				action: "getDetails",
				nodeid: testNodeId,
			});

			expect(result.success).toBe(true);
			expect(result.node).toBeDefined();
			expect(result.node.name).toBe("Test Store");
		});

		it("should update node", async () => {
			const result = await nodeTool.execute({
				action: "update",
				nodeid: testNodeId,
				name: "Updated Test Store",
			});

			expect(result.success).toBe(true);
		});

		it("should search nodes by city", async () => {
			const result = await nodeTool.execute({
				action: "search",
				city: "Test City",
			});

			expect(result.success).toBe(true);
			expect(result.nodes.length).toBeGreaterThan(0);
		});
	});

	// ============================================
	// CONTRIBUTOR TOOL TESTS
	// ============================================

	describe("Contributor Tool", () => {
		it("should create a contributor", async () => {
			const result = await contributorTool.execute({
				action: "create",
				name: "Another Customer",
				email: "another@example.com",
				role: "customer",
			});

			expect(result.success).toBe(true);
			expect(result.contributorid).toBeDefined();
		});

		it("should get contributor details", async () => {
			const result = await contributorTool.execute({
				action: "getDetails",
				contributorid: testContributorId,
			});

			expect(result.success).toBe(true);
			expect(result.contributor).toBeDefined();
			expect(result.contributor.name).toBe("Test Customer");
		});

		it("should update contributor", async () => {
			const result = await contributorTool.execute({
				action: "update",
				contributorid: testContributorId,
				phone: "0000000000",
			});

			expect(result.success).toBe(true);
		});
	});

	// ============================================
	// PRODUCT TOOL TESTS
	// ============================================

	describe("Product Tool", () => {
		it("should create a product", async () => {
			const result = await productTool.execute({
				action: "create",
				nodeid: testNodeId,
				name: "Test Product",
				desc: "A test product",
				category: "Electronics",
				price: 999,
				stock: 10,
			});

			expect(result.success).toBe(true);
			expect(result.productId).toBeDefined();
			testProductId = result.productId!;
		});

		it("should get product details", async () => {
			const result = await productTool.execute({
				action: "getDetails",
				productId: testProductId,
			});

			expect(result.success).toBe(true);
			expect(result.product).toBeDefined();
			expect(result.product.name).toBe("Test Product");
		});

		it("should update product", async () => {
			const result = await productTool.execute({
				action: "update",
				productId: testProductId,
				price: 899,
			});

			expect(result.success).toBe(true);
		});

		it("should search products", async () => {
			const result = await productTool.execute({
				action: "search",
				query: "Test",
				limit: 10,
			});

			expect(result.success).toBe(true);
			expect(result.products.length).toBeGreaterThan(0);
		});

		it("should create product instance", async () => {
			const result = await productTool.execute({
				action: "createInstance",
				productId: testProductId,
				nodeid: testNodeId,
				instanceName: "Red Color",
				instanceType: "variant",
				qty: 5,
				priceadd: 50,
			});

			expect(result.success).toBe(true);
			expect(result.instanceId).toBeDefined();
			testInstanceId = result.instanceId!;
		});

		it("should check instance availability", async () => {
			const result = await productTool.execute({
				action: "checkAvailability",
				instanceId: testInstanceId,
				qty: 2,
			});

			expect(result.success).toBe(true);
			expect(result.available).toBe(true);
		});

		it("should get product instances", async () => {
			const result = await productTool.execute({
				action: "getInstances",
				productId: testProductId,
			});

			expect(result.success).toBe(true);
			expect(result.instances.length).toBeGreaterThan(0);
		});
	});

	// ============================================
	// ORDER TOOL TESTS
	// ============================================

	describe("Order Tool", () => {
		it("should create an order", async () => {
			const result = await orderTool.execute({
				action: "create",
				contributorid: testContributorId,
				nodeid: testNodeId,
				ordertype: "store",
				items: [
					{
						productId: testProductId,
						instanceId: testInstanceId,
						name: "Test Product - Red",
						qty: 2,
						unitprice: 949,
					},
				],
				address: "Test Address",
				phone: "1234567890",
			});

			expect(result.success).toBe(true);
			expect(result.orderId).toBeDefined();
			expect(result.ordernum).toBeDefined();
			testOrderId = result.orderId!;
		});

		it("should get order details", async () => {
			const result = await orderTool.execute({
				action: "getDetails",
				orderId: testOrderId,
			});

			expect(result.success).toBe(true);
			expect(result.order).toBeDefined();
		});

		it("should update order status", async () => {
			const result = await orderTool.execute({
				action: "updateStatus",
				orderId: testOrderId,
				status: "confirmed",
			});

			expect(result.success).toBe(true);
		});

		it("should get orders by contributor", async () => {
			const result = await orderTool.execute({
				action: "getByContributor",
				contributorid: testContributorId,
			});

			expect(result.success).toBe(true);
			expect(result.orders.length).toBeGreaterThan(0);
		});

		it("should cancel order", async () => {
			const result = await orderTool.execute({
				action: "cancel",
				orderId: testOrderId,
			});

			expect(result.success).toBe(true);
		});
	});

	// ============================================
	// SERVICE TOOL TESTS
	// ============================================

	describe("Service Tool", () => {
		it("should create a service", async () => {
			const result = await serviceTool.execute({
				action: "createService",
				nodeid: testNodeId,
				name: "Test Service",
				desc: "A test service",
				category: "medical",
				price: 500,
				duration: 60,
			});

			expect(result.success).toBe(true);
			expect(result.serviceId).toBeDefined();
			testServiceId = result.serviceId!;
		});

		it("should create slots", async () => {
			const result = await serviceTool.execute({
				action: "createSlots",
				serviceId: testServiceId,
				nodeid: testNodeId,
				date: "2025-12-15",
				start: "10:00",
				end: "11:00",
			});

			expect(result.success).toBe(true);
			expect(result.slotId).toBeDefined();
			testSlotId = result.slotId!;
		});

		it("should get available slots", async () => {
			const result = await serviceTool.execute({
				action: "getAvailableSlots",
				serviceId: testServiceId,
				date: "2025-12-15",
			});

			expect(result.success).toBe(true);
			expect(result.slots.length).toBeGreaterThan(0);
		});

		it("should create booking", async () => {
			const result = await serviceTool.execute({
				action: "createBooking",
				contributorid: testContributorId,
				serviceId: testServiceId,
				nodeid: testNodeId,
				slotId: testSlotId,
				date: "2025-12-15",
				start: "10:00",
				end: "11:00",
				duration: 60,
				price: 500,
				customerName: "Test Customer",
				phone: "1234567890",
			});

			expect(result.success).toBe(true);
			expect(result.bookingId).toBeDefined();
			testBookingId = result.bookingId!;
		});

		it("should get booking details", async () => {
			const result = await serviceTool.execute({
				action: "getBookingDetails",
				bookingId: testBookingId,
			});

			expect(result.success).toBe(true);
			expect(result.booking).toBeDefined();
		});

		it("should update booking status", async () => {
			const result = await serviceTool.execute({
				action: "updateBooking",
				bookingId: testBookingId,
				status: "confirmed",
			});

			expect(result.success).toBe(true);
		});
	});

	// ============================================
	// TASK TOOL TESTS
	// ============================================

	describe("Task Tool", () => {
		it("should create a task", async () => {
			const result = await taskTool.execute({
				action: "create",
				reltype: "order",
				relid: testOrderId,
				nodeid: testNodeId,
				tasktype: "prepare",
				title: "Prepare Order",
				seq: 1,
			});

			expect(result.success).toBe(true);
			expect(result.taskId).toBeDefined();
			testTaskId = result.taskId!;
		});

		it("should assign task", async () => {
			const result = await taskTool.execute({
				action: "assign",
				taskId: testTaskId,
				assignedto: testContributorId,
			});

			expect(result.success).toBe(true);
		});

		it("should update task status", async () => {
			const result = await taskTool.execute({
				action: "updateStatus",
				taskId: testTaskId,
				status: "inprogress",
			});

			expect(result.success).toBe(true);
		});

		it("should update task location", async () => {
			const result = await taskTool.execute({
				action: "updateLocation",
				taskId: testTaskId,
				lat: 12.9716,
				lng: 77.5946,
			});

			expect(result.success).toBe(true);
		});

		it("should complete task", async () => {
			const result = await taskTool.execute({
				action: "complete",
				taskId: testTaskId,
			});

			expect(result.success).toBe(true);
		});

		it("should get tasks by order", async () => {
			const result = await taskTool.execute({
				action: "getByOrder",
				relid: testOrderId,
			});

			expect(result.success).toBe(true);
			expect(result.tasks.length).toBeGreaterThan(0);
		});
	});

	// ============================================
	// TRANSACTION TOOL TESTS
	// ============================================

	describe("Transaction Tool", () => {
		it("should create a transaction", async () => {
			const result = await transactionTool.execute({
				action: "create",
				orderid: testOrderId,
				contributorid: testContributorId,
				nodeid: testNodeId,
				amount: 1000,
				paymethod: "card",
				payref: "test-ref-123",
			});

			expect(result.success).toBe(true);
			expect(result.transactionId).toBeDefined();
			expect(result.platformfee).toBe(50); // 5% of 1000
			expect(result.nodefee).toBe(950);
			testTransactionId = result.transactionId!;
		});

		it("should get transaction history", async () => {
			const result = await transactionTool.execute({
				action: "getHistory",
				limit: 10,
			});

			expect(result.success).toBe(true);
			expect(result.transactions.length).toBeGreaterThan(0);
		});

		it("should get transactions by contributor", async () => {
			const result = await transactionTool.execute({
				action: "getByContributor",
				contributorid: testContributorId,
			});

			expect(result.success).toBe(true);
		});

		it("should get transactions by node", async () => {
			const result = await transactionTool.execute({
				action: "getByNode",
				nodeid: testNodeId,
			});

			expect(result.success).toBe(true);
		});

		it("should refund transaction", async () => {
			const result = await transactionTool.execute({
				action: "refund",
				transactionId: testTransactionId,
				amount: 500,
			});

			expect(result.success).toBe(true);
		});
	});

	// ============================================
	// SEARCH TOOL TESTS
	// ============================================

	describe("Search Tool", () => {
		it("should search products", async () => {
			const result = await searchTool.execute({
				action: "products",
				query: "Test",
				limit: 10,
			});

			expect(result.success).toBe(true);
			expect(result.products.length).toBeGreaterThan(0);
		});

		it("should search products with price range", async () => {
			const result = await searchTool.execute({
				action: "products",
				minPrice: 500,
				maxPrice: 1500,
			});

			expect(result.success).toBe(true);
		});

		it("should search services", async () => {
			const result = await searchTool.execute({
				action: "services",
				category: "medical",
			});

			expect(result.success).toBe(true);
		});

		it("should search nodes", async () => {
			const result = await searchTool.execute({
				action: "nodes",
				city: "Test City",
			});

			expect(result.success).toBe(true);
			expect(result.nodes.length).toBeGreaterThan(0);
		});

		it("should search nodes near me", async () => {
			const result = await searchTool.execute({
				action: "nearMe",
				lat: 12.9716,
				lng: 77.5946,
				radius: 10,
			});

			expect(result.success).toBe(true);
		});

		it("should perform semantic search", async () => {
			const result = await searchTool.execute({
				action: "semantic",
				query: "electronics",
			});

			expect(result.success).toBe(true);
			// Note: Currently falls back to text search
		});
	});

	// ============================================
	// REVIEW TOOL TESTS
	// ============================================

	describe("Review Tool", () => {
		it("should create a review", async () => {
			const result = await reviewTool.execute({
				action: "create",
				contributorid: testContributorId,
				targettype: "product",
				targetid: testProductId,
				rating: 5,
				comment: "Great product!",
			});

			expect(result.success).toBe(true);
			expect(result.reviewId).toBeDefined();
			testReviewId = result.reviewId!;
		});

		it("should update review", async () => {
			const result = await reviewTool.execute({
				action: "update",
				reviewId: testReviewId,
				rating: 4,
				comment: "Good product",
			});

			expect(result.success).toBe(true);
		});

		it("should get reviews by target", async () => {
			const result = await reviewTool.execute({
				action: "getByTarget",
				targettype: "product",
				targetid: testProductId,
			});

			expect(result.success).toBe(true);
			expect(result.reviews.length).toBeGreaterThan(0);
			expect(result.averageRating).toBeGreaterThan(0);
		});

		it("should get reviews by contributor", async () => {
			const result = await reviewTool.execute({
				action: "getByContributor",
				contributorid: testContributorId,
			});

			expect(result.success).toBe(true);
		});

		it("should verify review", async () => {
			const result = await reviewTool.execute({
				action: "verify",
				reviewId: testReviewId,
			});

			expect(result.success).toBe(true);
		});
	});

	// ============================================
	// CLEANUP: Remove Test Data
	// ============================================

	afterAll(async () => {
		console.log("Cleaning up test data...");

		// Delete review
		if (testReviewId) {
			await reviewTool.execute({
				action: "delete",
				reviewId: testReviewId,
			});
		}

		console.log("Test cleanup completed");
	});
});

// ============================================
// INTEGRATION TESTS
// ============================================

describe("Commerce Integration Tests", () => {
	it("should complete full order workflow", async () => {
		// 1. Create node
		const nodeResult = await nodeTool.execute({
			action: "create",
			name: "Integration Test Store",
			type: "store",
			address: "Integration Test Address",
			city: "Integration City",
			lat: 12.9716,
			lng: 77.5946,
			phone: "9999999999",
		});
		expect(nodeResult.success).toBe(true);
		const nodeid = nodeResult.nodeid!;

		// 2. Create contributor
		const contributorResult = await contributorTool.execute({
			action: "create",
			name: "Integration Test Customer",
			email: "integration@test.com",
			role: "customer",
		});
		expect(contributorResult.success).toBe(true);
		const contributorid = contributorResult.contributorid!;

		// 3. Create product
		const productResult = await productTool.execute({
			action: "create",
			nodeid,
			name: "Integration Test Product",
			category: "Test",
			price: 1000,
			stock: 10,
		});
		expect(productResult.success).toBe(true);
		const productId = productResult.productId!;

		// 4. Create order
		const orderResult = await orderTool.execute({
			action: "create",
			contributorid,
			nodeid,
			ordertype: "store",
			items: [
				{
					productId,
					name: "Integration Test Product",
					qty: 1,
					unitprice: 1000,
				},
			],
		});
		expect(orderResult.success).toBe(true);
		const orderId = orderResult.orderId!;

		// 5. Create transaction
		const transactionResult = await transactionTool.execute({
			action: "create",
			orderid: orderId,
			contributorid,
			nodeid,
			amount: orderResult.total!,
			paymethod: "card",
		});
		expect(transactionResult.success).toBe(true);

		// 6. Create review
		const reviewResult = await reviewTool.execute({
			action: "create",
			contributorid,
			targettype: "product",
			targetid: productId,
			rating: 5,
			comment: "Integration test review",
		});
		expect(reviewResult.success).toBe(true);

		console.log("Full order workflow completed successfully");
	});

	it("should complete full booking workflow", async () => {
		// 1. Create node
		const nodeResult = await nodeTool.execute({
			action: "create",
			name: "Integration Test Clinic",
			type: "doctor",
			address: "Integration Test Address",
			city: "Integration City",
			lat: 12.9716,
			lng: 77.5946,
			phone: "8888888888",
		});
		const nodeid = nodeResult.nodeid!;

		// 2. Create contributor
		const contributorResult = await contributorTool.execute({
			action: "create",
			name: "Integration Test Patient",
			email: "patient@test.com",
			role: "customer",
		});
		const contributorid = contributorResult.contributorid!;

		// 3. Create service
		const serviceResult = await serviceTool.execute({
			action: "createService",
			nodeid,
			name: "Integration Test Consultation",
			category: "medical",
			price: 500,
			duration: 30,
		});
		const serviceId = serviceResult.serviceId!;

		// 4. Create slot
		const slotResult = await serviceTool.execute({
			action: "createSlots",
			serviceId,
			nodeid,
			date: "2025-12-20",
			start: "14:00",
			end: "14:30",
		});
		const slotId = slotResult.slotId!;

		// 5. Create booking
		const bookingResult = await serviceTool.execute({
			action: "createBooking",
			contributorid,
			serviceId,
			nodeid,
			slotId,
			date: "2025-12-20",
			start: "14:00",
			end: "14:30",
			duration: 30,
			price: 500,
			customerName: "Integration Test Patient",
			phone: "8888888888",
		});
		expect(bookingResult.success).toBe(true);
		const bookingId = bookingResult.bookingId!;

		// 6. Create transaction
		const transactionResult = await transactionTool.execute({
			action: "create",
			bookingid: bookingId,
			contributorid,
			nodeid,
			amount: 500,
			paymethod: "upi",
		});
		expect(transactionResult.success).toBe(true);

		console.log("Full booking workflow completed successfully");
	});
});
