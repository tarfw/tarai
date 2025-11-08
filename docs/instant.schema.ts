/**
 * InstantDB Schema - Simplified Commerce Framework
 * Clean, minimal entity names for storage efficiency
 */

import { i } from "@instantdb/admin";

const _schema = i.schema({
	entities: {
		// ============================================
		// CORE ENTITIES (12 simple entities)
		// ============================================

		// 1. NODES - Business/Service Providers
		nodes: i.entity({
			name: i.string(),
			type: i.string(), // "store" | "restaurant" | "service" | "doctor" | "salon"

			// Location
			address: i.string(),
			city: i.string(),
			lat: i.number(),
			lng: i.number(),

			// Contact
			phone: i.string(),
			email: i.string().optional(),

			// Hours (simple strings)
			open: i.string(), // "09:00"
			close: i.string(), // "18:00"
			days: i.string(), // "Mon-Sat"

			// Financial
			commission: i.number(), // Platform commission % (e.g., 5 = 5%)

			// Status
			isopen: i.boolean(),
			verified: i.boolean(),
			rating: i.number(),

			// Media
			avatar: i.string().optional(),
			cover: i.string().optional(),
			bio: i.string().optional(),

			createdat: i.number(),
			updatedat: i.number(),
		}),

		// 2. PRODUCTS - Physical Goods
		products: i.entity({
			nodeid: i.string(),

			name: i.string(),
			desc: i.string().optional(),
			category: i.string(),

			// Pricing
			price: i.number(),
			oldprice: i.number().optional(), // For discounts
			currency: i.string(),

			// Stock
			stock: i.number(),
			instock: i.boolean(),

			// Media
			image: i.string().optional(),
			images: i.json().optional(), // string[]

			// Flags
			featured: i.boolean(),
			active: i.boolean(),

			createdat: i.number(),
			updatedat: i.number(),
		}),

		// 3. INSTANCES - Product/Service Instances (Universal)
		instances: i.entity({
			productid: i.string(),
			nodeid: i.string(), // Which node owns this instance (can differ from product.nodeid)

			name: i.string(), // "Large Blue", "Taxi #5", "Unit #123"
			instancetype: i.string(), // "variant" | "inventory" | "capacity" | "asset" | "unique"

			// For fungible instances (inventory)
			qty: i.number(), // Quantity available
			available: i.number(), // qty - reserved
			reserved: i.number(), // Reserved in pending orders

			// For unique instances (NFT, taxi, equipment)
			serial: i.string().optional(), // Serial number, license plate, VIN
			sku: i.string().optional(),

			// Attributes (flexible for any type)
			attrs: i.json().optional(), // { size: "L", color: "Blue", model: "...", year: 2023 }

			// Price adjustment
			priceadd: i.number(), // +50 for large, -20 for small, 0 for base

			// Status
			status: i.string(), // "available" | "reserved" | "sold" | "inuse" | "maintenance"
			active: i.boolean(),

			createdat: i.number(),
			updatedat: i.number(),
		}),

		// 4. SERVICES - Bookable Services
		services: i.entity({
			nodeid: i.string(),

			name: i.string(),
			desc: i.string().optional(),
			category: i.string(), // "medical" | "salon" | "tutor" | "consultant"

			// Pricing
			price: i.number(),
			currency: i.string(),
			pricetype: i.string(), // "fixed" | "hourly"

			// Duration
			duration: i.number(), // minutes

			// Booking settings
			needapproval: i.boolean(),
			maxperslot: i.number(), // Max bookings per slot

			// Media
			image: i.string().optional(),

			active: i.boolean(),
			createdat: i.number(),
			updatedat: i.number(),
		}),

		// 5. SLOTS - Time Slots for Bookings
		slots: i.entity({
			serviceid: i.string(),
			nodeid: i.string(),

			// Date & Time
			date: i.string().indexed(), // "2024-12-15" - indexed for filtering by date
			start: i.string(), // "09:00"
			end: i.string(), // "10:00"

			// Availability
			status: i.string().indexed(), // "available" | "booked" | "blocked" - indexed for filtering
			capacity: i.number(), // Max bookings
			booked: i.number(), // Current bookings

			createdat: i.number(),
		}),

		// 6. ORDERS - Shopping Orders
		orders: i.entity({
			contributorid: i.string(),
			nodeid: i.string(),

			ordernum: i.string(), // "ORD-001"
			ordertype: i.string(), // "store" | "food" | "delivery"

			// Pricing
			subtotal: i.number(),
			tax: i.number(),
			deliveryfee: i.number(),
			discount: i.number(),
			total: i.number(),
			currency: i.string(), // "INR", "USD"

			// Delivery
			address: i.string().optional(),
			lat: i.number().optional(),
			lng: i.number().optional(),
			phone: i.string().optional(),
			driverid: i.string().optional(), // Assigned driver
			estimateddelivery: i.number().optional(), // ETA timestamp

			// Status
			status: i.string().indexed(), // "pending" | "confirmed" | "preparing" | "outfordelivery" | "delivered" | "cancelled"

			// Payment
			paystatus: i.string(), // "pending" | "paid" | "failed"
			paymethod: i.string().optional(),

			// Timestamps
			createdat: i.number(),
			confirmedat: i.number().optional(),
			deliveredat: i.number().optional(),
		}),

		// 7. LINEITEMS - Order Line Items
		lineitems: i.entity({
			orderid: i.string(),
			productid: i.string(),
			instanceid: i.string().optional(),

			// Snapshot
			name: i.string(),
			instancename: i.string().optional(),

			// Pricing
			qty: i.number(),
			unitprice: i.number(),
			total: i.number(),

			// Customization
			notes: i.string().optional(), // "No onions"

			createdat: i.number(),
		}),

		// 8. BOOKINGS - Service Appointments
		bookings: i.entity({
			contributorid: i.string(),
			serviceid: i.string(),
			nodeid: i.string(),
			slotid: i.string(),

			bookingnum: i.string(), // "BKG-001"

			// Appointment
			date: i.string().indexed(), // Indexed for filtering by date
			start: i.string(),
			end: i.string(),
			duration: i.number(),

			// Pricing
			price: i.number(),

			// Customer
			name: i.string(),
			phone: i.string(),
			email: i.string().optional(),
			notes: i.string().optional(),

			// Status
			status: i.string().indexed(), // "pending" | "confirmed" | "completed" | "cancelled" | "noshow"

			// Payment
			paystatus: i.string(), // "pending" | "paid"
			paymethod: i.string().optional(),

			createdat: i.number(),
			confirmedat: i.number().optional(),
			completedat: i.number().optional(),
		}),

		// 9. TRANSACTIONS - Payment Records (Immutable)
		transactions: i.entity({
			orderid: i.string().unique().optional(),
			bookingid: i.string().unique().optional(),

			contributorid: i.string(),
			nodeid: i.string(),

			// Amount
			amount: i.number(),
			currency: i.string(),

			// Payment
			paymethod: i.string(), // "cash" | "card" | "upi" | "wallet"
			payref: i.string().optional(), // Payment gateway reference

			// Revenue split
			platformfee: i.number(), // Platform commission amount
			nodefee: i.number(), // Amount for node

			// Status
			status: i.string(), // "success" | "failed" | "refunded"

			// Refund (if applicable)
			refundamount: i.number().optional(),
			refundedat: i.number().optional(),

			createdat: i.number(),
		}),

		// 10. TASKS - Workflow Engine ⭐
		tasks: i.entity({
			// Relation
			reltype: i.string(), // "order" | "booking"
			relid: i.string(), // orderId or bookingId
			nodeid: i.string(),

			// Definition
			tasktype: i.string(), // "prepare" | "deliver" | "confirm" | "complete"
			title: i.string(),

			// Assignment
			assignedto: i.string().optional(), // contributorid (staff/driver)
			assignedat: i.number().optional(),

			// Status
			status: i.string().indexed(), // "pending" | "assigned" | "inprogress" | "completed" | "failed"

			// Sequence
			seq: i.number(), // 1, 2, 3...
			dependson: i.string().optional(), // Previous task id

			// Timing
			startedat: i.number().optional(),
			completedat: i.number().optional(),
			dueat: i.number().optional(),

			// Location tracking
			trackloc: i.boolean(),
			lat: i.number().optional(),
			lng: i.number().optional(),
			lastloc: i.number().optional(), // Last location update timestamp

			// Verification
			needotp: i.boolean(),
			otp: i.string().optional(),
			verifiedat: i.number().optional(),

			// Notes
			notes: i.string().optional(),

			createdat: i.number(),
			updatedat: i.number(),
		}),

		// 11. REVIEWS - Contributor Reviews
		reviews: i.entity({
			contributorid: i.string(),

			// What was reviewed
			targettype: i.string(), // "product" | "service" | "node"
			targetid: i.string(),

			// Review
			rating: i.number(), // 1-5
			comment: i.string().optional(),
			images: i.json().optional(), // string[]

			// Verification
			verified: i.boolean(),

			createdat: i.number(),
		}),

		// 12. CONTRIBUTORS - Network Participants (Customers, Staff, Drivers, Admins)
		contributors: i.entity({
			name: i.string(),
			email: i.string().unique(),
			phone: i.string().optional(),
			avatar: i.string().optional(),

			// Role
			role: i.string(), // "customer" | "staff" | "driver" | "admin" | "nodeowner"

			// Default address
			address: i.string().optional(),
			city: i.string().optional(),
			lat: i.number().optional(),
			lng: i.number().optional(),

			active: i.boolean(),
			createdat: i.number(),
			updatedat: i.number(),
		}),

		// ============================================
		// AUXILIARY ENTITIES (for agent memory)
		// ============================================

		conversations: i.entity({
			contributorid: i.string(),
			title: i.string().optional(),
			context: i.json().optional(),
			lastactivity: i.number(),
			createdat: i.number(),
			updatedat: i.number(),
		}),

		memories: i.entity({
			conversationid: i.string(),
			contributorid: i.string(),
			role: i.string(), // "contributor" | "assistant"
			content: i.string(),
			metadata: i.json().optional(),
			createdat: i.number(),
		}),

		chat: i.entity({
			conversationid: i.string(),
			contributorid: i.string(),
			nodeid: i.string().optional(),
			message: i.string(),
			msgtype: i.string(), // "text" | "image" | "file" | "system"
			metadata: i.json().optional(),
			createdat: i.number(),
		}),
	},

	links: {
		// ============================================
		// CORE RELATIONSHIPS
		// ============================================

		// Node relationships
		nodeproducts: {
			forward: { on: "products", has: "one", label: "node" },
			reverse: { on: "nodes", has: "many", label: "products" },
		},

		nodeservices: {
			forward: { on: "services", has: "one", label: "node" },
			reverse: { on: "nodes", has: "many", label: "services" },
		},

		// Product instances
		productinstances: {
			forward: { on: "instances", has: "one", label: "product" },
			reverse: { on: "products", has: "many", label: "instances" },
		},

		// Node instances (instances can belong to different node than product)
		nodeinstances: {
			forward: { on: "instances", has: "one", label: "node" },
			reverse: { on: "nodes", has: "many", label: "instances" },
		},

		// Service slots
		serviceslots: {
			forward: { on: "slots", has: "one", label: "service" },
			reverse: { on: "services", has: "many", label: "slots" },
		},

		// Orders
		ordercontributor: {
			forward: { on: "orders", has: "one", label: "contributor" },
			reverse: { on: "contributors", has: "many", label: "orders" },
		},

		ordernode: {
			forward: { on: "orders", has: "one", label: "node" },
			reverse: { on: "nodes", has: "many", label: "orders" },
		},

		orderlineitems: {
			forward: { on: "lineitems", has: "one", label: "order" },
			reverse: { on: "orders", has: "many", label: "lineitems" },
		},

		// Bookings
		bookingcontributor: {
			forward: { on: "bookings", has: "one", label: "contributor" },
			reverse: { on: "contributors", has: "many", label: "bookings" },
		},

		bookingservice: {
			forward: { on: "bookings", has: "one", label: "service" },
			reverse: { on: "services", has: "many", label: "bookings" },
		},

		bookingslot: {
			forward: { on: "bookings", has: "one", label: "slot" },
			reverse: { on: "slots", has: "one", label: "booking" },
		},

		// Transactions
		transactionorder: {
			forward: { on: "transactions", has: "one", label: "order" },
			reverse: { on: "orders", has: "one", label: "transaction" },
		},

		transactionbooking: {
			forward: { on: "transactions", has: "one", label: "booking" },
			reverse: { on: "bookings", has: "one", label: "transaction" },
		},

		transactioncontributor: {
			forward: { on: "transactions", has: "one", label: "contributor" },
			reverse: { on: "contributors", has: "many", label: "transactions" },
		},

		transactionnode: {
			forward: { on: "transactions", has: "one", label: "node" },
			reverse: { on: "nodes", has: "many", label: "transactions" },
		},

		// Tasks
		taskorder: {
			forward: { on: "tasks", has: "one", label: "order" },
			reverse: { on: "orders", has: "many", label: "tasks" },
		},

		taskbooking: {
			forward: { on: "tasks", has: "one", label: "booking" },
			reverse: { on: "bookings", has: "many", label: "tasks" },
		},

		tasknode: {
			forward: { on: "tasks", has: "one", label: "node" },
			reverse: { on: "nodes", has: "many", label: "tasks" },
		},

		taskassigned: {
			forward: { on: "tasks", has: "one", label: "assignedcontributor" },
			reverse: { on: "contributors", has: "many", label: "assignedtasks" },
		},

		taskdependency: {
			forward: { on: "tasks", has: "one", label: "dependstask" },
			reverse: { on: "tasks", has: "many", label: "blockedtasks" },
		},

		// Reviews
		reviewcontributor: {
			forward: { on: "reviews", has: "one", label: "contributor" },
			reverse: { on: "contributors", has: "many", label: "reviews" },
		},

		// ============================================
		// AUXILIARY RELATIONSHIPS
		// ============================================

		contributorconversations: {
			forward: { on: "conversations", has: "one", label: "contributor" },
			reverse: { on: "contributors", has: "many", label: "conversations" },
		},

		conversationmemories: {
			forward: { on: "memories", has: "one", label: "conversation" },
			reverse: { on: "conversations", has: "many", label: "memories" },
		},

		conversationchat: {
			forward: { on: "chat", has: "one", label: "conversation" },
			reverse: { on: "conversations", has: "many", label: "chat" },
		},

		contributorchat: {
			forward: { on: "chat", has: "one", label: "contributor" },
			reverse: { on: "contributors", has: "many", label: "chat" },
		},

		nodechat: {
			forward: { on: "chat", has: "one", label: "node" },
			reverse: { on: "nodes", has: "many", label: "chat" },
		},
	},
});

export default _schema;
