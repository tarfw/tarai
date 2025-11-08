# Decentralized Commerce Framework - Production Schema

## 🎯 Philosophy: Simple, Minimal, Scalable

**Core Principle:** Everyone in the network is a **contributor** - customers, providers, staff, drivers, and node owners all contribute value.

---

## 📊 THE PRODUCTION SCHEMA (15 Entities)

### **Core Commerce Entities (12)**

1. **nodes** - Business/service providers
2. **products** - Physical goods catalog
3. **instances** - Product instances (variants, inventory, capacity units)
4. **services** - Bookable services
5. **slots** - Time slots for appointments
6. **orders** - Shopping orders
7. **lineitems** - Order line items
8. **bookings** - Service appointments
9. **transactions** - Payment records (immutable)
10. **tasks** - Workflow engine
11. **reviews** - Customer reviews
12. **contributors** - Network participants

### **Auxiliary Entities (3)**

13. **conversations** - Agent conversations
14. **memories** - Chat history
15. **chat** - Real-time messaging

---

## 🗂️ DETAILED SCHEMA

### 1. NODES (Business/Service Providers)

```typescript
nodes: {
  // Identity
  name: string
  type: string  // "store" | "restaurant" | "service" | "doctor" | "salon"

  // Location
  address: string
  city: string
  lat: number
  lng: number

  // Contact
  phone: string
  email: string (optional)

  // Hours
  open: string      // "09:00"
  close: string     // "18:00"
  days: string      // "Mon-Sat"

  // Financial
  commission: number  // Platform commission % (e.g., 5 = 5%)

  // Status
  isopen: boolean
  verified: boolean
  rating: number

  // Media
  avatar: string (optional)
  cover: string (optional)
  bio: string (optional)

  // Timestamps
  createdat: number
  updatedat: number
}
```

**Relationships:**
- → products (many)
- → services (many)
- → instances (many)
- → orders (many)
- → transactions (many)
- → tasks (many)
- → chat (many)

---

### 2. PRODUCTS (Physical Goods)

```typescript
products: {
  nodeid: string

  name: string
  desc: string (optional)
  category: string

  // Pricing
  price: number
  oldprice: number (optional)  // For showing discounts
  currency: string

  // Stock
  stock: number
  instock: boolean

  // Media
  image: string (optional)
  images: json (optional)  // string[]

  // Flags
  featured: boolean
  active: boolean

  createdat: number
  updatedat: number
}
```

**Relationships:**
- ← node (one)
- → instances (many)

**Used by:** StoreBlock, FoodBlock

---

### 3. INSTANCES (Product Instances - Universal)

```typescript
instances: {
  productid: string
  nodeid: string  // Can differ from product.nodeid (multi-location)

  name: string  // "Large Blue", "Taxi #5", "Batch-001"
  instancetype: string  // "variant" | "inventory" | "capacity" | "asset" | "unique"

  // For fungible instances (inventory)
  qty: number
  available: number
  reserved: number

  // For unique instances
  serial: string (optional)  // Serial number, license plate, VIN
  sku: string (optional)

  // Flexible attributes
  attrs: json (optional)  // { size: "L", color: "Blue", model: "..." }

  // Pricing
  priceadd: number  // Price adjustment (+50 for large, -20 for small)

  // Status
  status: string  // "available" | "reserved" | "sold" | "inuse" | "maintenance"
  active: boolean

  createdat: number
  updatedat: number
}
```

**Relationships:**
- ← product (one)
- ← node (one)

**Use Cases:**
- **E-commerce Variants:** "T-Shirt Large Blue" (instancetype: "variant")
- **Inventory Batches:** "Bananas Batch-Dec" (instancetype: "inventory")
- **Service Capacity:** "Taxi #5" (instancetype: "capacity")
- **Unique Assets:** "Camera #007" (instancetype: "asset")

---

### 4. SERVICES (Bookable Services)

```typescript
services: {
  nodeid: string

  name: string
  desc: string (optional)
  category: string  // "medical" | "salon" | "tutor" | "consultant"

  // Pricing
  price: number
  currency: string
  pricetype: string  // "fixed" | "hourly"

  // Duration
  duration: number  // minutes

  // Booking settings
  needapproval: boolean
  maxperslot: number  // Max bookings per slot

  // Media
  image: string (optional)

  active: boolean
  createdat: number
  updatedat: number
}
```

**Relationships:**
- ← node (one)
- → slots (many)
- → bookings (many)

**Used by:** BookingBlock, AppointmentBlock

---

### 5. SLOTS (Time Slots)

```typescript
slots: {
  serviceid: string
  nodeid: string

  // Date & Time
  date: string (indexed)  // "2024-12-15"
  start: string           // "09:00"
  end: string             // "10:00"

  // Availability
  status: string (indexed)  // "available" | "booked" | "blocked"
  capacity: number          // Max bookings
  booked: number            // Current bookings

  createdat: number
}
```

**Relationships:**
- ← service (one)
- → booking (one)

**Indexed:** date, status (for fast availability queries)

---

### 6. ORDERS (Shopping Orders)

```typescript
orders: {
  contributorid: string
  nodeid: string

  ordernum: string
  ordertype: string  // "store" | "food" | "delivery"

  // Pricing
  subtotal: number
  tax: number
  deliveryfee: number
  discount: number
  total: number
  currency: string

  // Delivery
  address: string (optional)
  lat: number (optional)
  lng: number (optional)
  phone: string (optional)
  driverid: string (optional)
  estimateddelivery: number (optional)  // ETA timestamp

  // Status
  status: string (indexed)  // "pending" | "confirmed" | "preparing" | "outfordelivery" | "delivered" | "cancelled"

  // Payment
  paystatus: string  // "pending" | "paid" | "failed"
  paymethod: string (optional)

  // Timestamps
  createdat: number
  confirmedat: number (optional)
  deliveredat: number (optional)
}
```

**Relationships:**
- ← contributor (one)
- ← node (one)
- → lineitems (many)
- → tasks (many)
- → transaction (one)

**Indexed:** status (for dashboard queries)

---

### 7. LINEITEMS (Order Line Items)

```typescript
lineitems: {
  orderid: string
  productid: string
  instanceid: string (optional)

  // Snapshot (prices at time of order)
  name: string
  instancename: string (optional)

  // Pricing
  qty: number
  unitprice: number
  total: number

  // Customization
  notes: string (optional)  // "No onions", "Extra cheese"

  createdat: number
}
```

**Relationships:**
- ← order (one)

---

### 8. BOOKINGS (Service Appointments)

```typescript
bookings: {
  contributorid: string
  serviceid: string
  nodeid: string
  slotid: string

  bookingnum: string

  // Appointment
  date: string (indexed)
  start: string
  end: string
  duration: number

  // Pricing
  price: number

  // Customer
  name: string
  phone: string
  email: string (optional)
  notes: string (optional)

  // Status
  status: string (indexed)  // "pending" | "confirmed" | "completed" | "cancelled" | "noshow"

  // Payment
  paystatus: string  // "pending" | "paid"
  paymethod: string (optional)

  createdat: number
  confirmedat: number (optional)
  completedat: number (optional)
}
```

**Relationships:**
- ← contributor (one)
- ← service (one)
- ← slot (one)
- → tasks (many)
- → transaction (one)

**Indexed:** date, status (for calendar views)

---

### 9. TRANSACTIONS (Payment Records - Immutable)

```typescript
transactions: {
  orderid: string (unique, optional)
  bookingid: string (unique, optional)

  contributorid: string
  nodeid: string

  // Amount
  amount: number
  currency: string

  // Payment
  paymethod: string  // "cash" | "card" | "upi" | "wallet"
  payref: string (optional)  // Payment gateway reference

  // Revenue split
  platformfee: number  // Platform commission amount
  nodefee: number      // Amount for node

  // Status
  status: string  // "success" | "failed" | "refunded"

  // Refund
  refundamount: number (optional)
  refundedat: number (optional)

  createdat: number
}
```

**Relationships:**
- ← order (one)
- ← booking (one)
- ← contributor (one)
- ← node (one)

**Purpose:** Immutable record for accounting, analytics, compliance

---

### 10. TASKS (Workflow Engine)

```typescript
tasks: {
  // Relation
  reltype: string  // "order" | "booking"
  relid: string    // orderId or bookingId
  nodeid: string

  // Definition
  tasktype: string  // "prepare" | "deliver" | "confirm" | "complete"
  title: string

  // Assignment
  assignedto: string (optional)  // contributorid
  assignedat: number (optional)

  // Status
  status: string (indexed)  // "pending" | "assigned" | "inprogress" | "completed" | "failed"

  // Sequence
  seq: number         // 1, 2, 3...
  dependson: string (optional)  // Previous task id

  // Timing
  startedat: number (optional)
  completedat: number (optional)
  dueat: number (optional)

  // Location tracking (for delivery tasks)
  trackloc: boolean
  lat: number (optional)
  lng: number (optional)
  lastloc: number (optional)  // Last location update timestamp

  // Verification
  needotp: boolean
  otp: string (optional)
  verifiedat: number (optional)

  // Notes
  notes: string (optional)

  createdat: number
  updatedat: number
}
```

**Relationships:**
- ← order (one)
- ← booking (one)
- ← node (one)
- ← assignedcontributor (one)
- ← dependstask (one) [self-referencing]
- → blockedtasks (many) [self-referencing]

**Indexed:** status (for task dashboards)

---

### 11. REVIEWS (Customer Reviews)

```typescript
reviews: {
  contributorid: string

  // What was reviewed
  targettype: string  // "product" | "service" | "node"
  targetid: string

  // Review
  rating: number  // 1-5
  comment: string (optional)
  images: json (optional)  // string[]

  // Verification
  verified: boolean

  createdat: number
}
```

**Relationships:**
- ← contributor (one)

---

### 12. CONTRIBUTORS (Network Participants)

```typescript
contributors: {
  name: string
  email: string (unique)
  phone: string (optional)
  avatar: string (optional)

  // Role
  role: string  // "customer" | "staff" | "driver" | "admin" | "nodeowner"

  // Default address
  address: string (optional)
  city: string (optional)
  lat: number (optional)
  lng: number (optional)

  active: boolean
  createdat: number
  updatedat: number
}
```

**Relationships:**
- → orders (many)
- → bookings (many)
- → assignedtasks (many)
- → transactions (many)
- → reviews (many)
- → conversations (many)
- → chat (many)

**Philosophy:** Everyone is a contributor - no distinction between "users" and "providers" at the entity level. Roles determine permissions and capabilities.

---

## 🔄 WORKFLOW EXAMPLES

### Food Order Flow

```
1. Customer creates order
   ├─ orders (status: "pending")
   └─ lineitems

2. Auto-generate tasks:
   Task 1: "Receive Order" (seq: 1, status: "completed")
   Task 2: "Prepare Food" (seq: 2, dependson: task1, assignedto: chef)
   Task 3: "Assign Delivery" (seq: 3, dependson: task2)
   Task 4: "Deliver" (seq: 4, dependson: task3, assignedto: driver, trackloc: true)

3. Task updates propagate to order.status:
   Task 2 inprogress → order.status = "preparing"
   Task 4 inprogress → order.status = "outfordelivery"
   All tasks completed → order.status = "delivered"

4. Create transaction (immutable record)
```

### Booking Flow

```
1. Customer selects slot
   └─ slots (status: "available")

2. Create booking
   ├─ bookings (status: "pending")
   └─ Update slot (status: "booked", booked++)

3. Auto-generate tasks:
   Task 1: "Confirm Booking" (status: "completed")
   Task 2: "Send Reminder" (dueat: appointmentTime - 2hrs)
   Task 3: "Check-in" (assignedto: reception-staff)
   Task 4: "Complete Service" (assignedto: doctor)

4. Task completion → booking.status = "completed"

5. Create transaction
```

---

## 🎨 FRONTEND BLOCK MAPPING

```typescript
// StoreBlock.tsx
db.useQuery({
  products: {
    $: { where: { nodeid: storeId } },
    instances: {
      $: { where: { status: "available" } }
    }
  }
})

// FoodBlock.tsx
db.useQuery({
  orders: {
    $: { where: { contributorid: userId } },
    lineitems: {},
    tasks: {}  // Show order progress
  }
})

// BookingBlock.tsx
db.useQuery({
  slots: {
    $: { where: { date: "2024-12-15", status: "available" } },
    service: {}
  }
})

// DriverApp.tsx
db.useQuery({
  tasks: {
    $: {
      where: {
        assignedto: driverId,
        status: { in: ["assigned", "inprogress"] }
      }
    },
    order: {
      lineitems: {}
    }
  }
})
```

---

## ✅ DESIGN PRINCIPLES

### 1. **Minimal Field Names**
- No underscores: `createdat` not `created_at`
- Short names: `desc` not `description`, `qty` not `quantity`
- **Why:** Reduces storage costs by ~15-30%

### 2. **Essential Indexes Only**
- Only 5 indexed fields: `orders.status`, `bookings.status`, `bookings.date`, `slots.status`, `slots.date`, `tasks.status`
- **Why:** Indexes cost storage, only index frequently queried fields

### 3. **Separation over Polymorphism**
- Separate entities for `orders` vs `bookings`
- Separate entities for `products` vs `services`
- **Why:** Simpler queries, clearer code, better performance

### 4. **Contributors over Users**
- Everyone is a "contributor" with a `role`
- **Why:** Fits decentralized philosophy, one entity for all participants

### 5. **Task-Driven Status**
- No hardcoded status transitions
- Order/booking status derived from task completion
- **Why:** Flexible workflows, complete audit trail, parallel processing

---

## 📈 SCALABILITY

### Storage Efficiency
- **Field names:** 15-30% smaller than traditional schemas
- **Indexes:** Only 6 indexed fields across all entities
- **No redundancy:** Single source of truth for each data point

### Query Performance
- **Indexes on critical paths:** status, date filters
- **Linked entities:** Direct relationships, no joins needed
- **Task-based:** Parallel task execution

### Multi-Location Support
- `instances.nodeid` enables products sold by multiple nodes
- `nodes` can be hierarchical (future: add `parentnodeid`)

---

## 🚀 DEPLOYMENT STATUS

✅ Schema deployed to InstantDB (App ID: d2c4873f-988d-4a4d-977b-9b4746b94936)
✅ 15 entities created
✅ All relationships configured
✅ Essential indexes applied

**Last Updated:** 2024-12-15

---

## 📚 NEXT STEPS

1. **Build UI Blocks:**
   - StoreBlock (products + instances)
   - FoodBlock (orders + tasks)
   - BookingBlock (services + slots)
   - DriverApp (tasks with location tracking)

2. **Create Task Templates:**
   - Food delivery workflow
   - Doctor appointment workflow
   - Taxi ride workflow
   - Store purchase workflow

3. **Implement Business Logic:**
   - Auto-generate tasks on order/booking creation
   - Task status → Order/Booking status propagation
   - Revenue calculation (platformfee + nodefee)
   - Slot availability management

4. **Build Analytics:**
   - Transaction-based revenue reports
   - Task completion metrics
   - Contributor performance tracking
   - Node commission calculations

---

## 🤖 AGENT ARCHITECTURE PLAN

### Token Efficiency Strategy: Domain-Clustered Tools

**Problem:** Individual tools (47+ tools) = ~7,050 tokens per agent invocation
**Solution:** Domain-clustered tools (8 tools) = ~1,600 tokens per agent invocation
**Savings:** ~77% token reduction

### Tool Organization

#### 1. **productTool** (Product & Instance Management)
**Actions:**
- `search` - Search products (text + semantic)
- `create` - Create new product
- `update` - Update product details
- `getDetails` - Get product information
- `createInstance` - Create product instance (variant/inventory)
- `updateInstance` - Update instance details
- `getInstances` - Get all instances for a product
- `checkAvailability` - Check instance availability

**Token Impact:** 1 tool (~200 tokens) vs 8 individual tools (~1,200 tokens)

#### 2. **orderTool** (Order Management)
**Actions:**
- `create` - Create new order
- `update` - Update order details
- `getDetails` - Get order information
- `addItems` - Add line items to order
- `updateStatus` - Update order status workflow
- `cancel` - Cancel order
- `getByContributor` - Get orders by contributor
- `getByNode` - Get orders by node

**Token Impact:** 1 tool vs 8 individual tools

#### 3. **serviceTool** (Service & Booking Management)
**Actions:**
- `createService` - Create bookable service
- `updateService` - Update service details
- `createSlots` - Generate time slots
- `getAvailableSlots` - Query available slots by date
- `createBooking` - Create service booking
- `updateBooking` - Update booking status
- `cancelBooking` - Cancel booking
- `getBookingDetails` - Get booking information

**Token Impact:** 1 tool vs 8 individual tools

#### 4. **nodeTool** (Node/Business Management)
**Actions:**
- `create` - Create new node
- `update` - Update node details
- `getDetails` - Get node information
- `getProducts` - Get node's products
- `getServices` - Get node's services
- `getOrders` - Get node's orders
- `search` - Search nodes by location/type

**Token Impact:** 1 tool vs 7 individual tools

#### 5. **contributorTool** (Participant Management)
**Actions:**
- `create` - Create contributor
- `update` - Update contributor details
- `getDetails` - Get contributor information
- `getOrders` - Get contributor's orders
- `getBookings` - Get contributor's bookings
- `getTasks` - Get assigned tasks

**Token Impact:** 1 tool vs 6 individual tools

#### 6. **taskTool** (Workflow Task Management)
**Actions:**
- `create` - Create workflow task
- `assign` - Assign task to contributor
- `updateStatus` - Update task status
- `complete` - Mark task complete
- `updateLocation` - Update task location tracking
- `verifyOTP` - Verify task completion OTP
- `getByOrder` - Get tasks for an order
- `getByBooking` - Get tasks for a booking

**Token Impact:** 1 tool vs 8 individual tools

#### 7. **searchTool** (Advanced Search)
**Actions:**
- `semantic` - Semantic/vector search
- `hybrid` - Hybrid text + vector search
- `products` - Product-specific search
- `services` - Service-specific search
- `nodes` - Node search by location/type
- `nearMe` - Geo-based search

**Token Impact:** 1 tool vs 6 individual tools

#### 8. **transactionTool** (Payment Management)
**Actions:**
- `create` - Record payment transaction
- `refund` - Process refund
- `getHistory` - Get transaction history
- `getRevenueSplit` - Calculate revenue splits
- `getByContributor` - Get contributor transactions
- `getByNode` - Get node transactions

**Token Impact:** 1 tool vs 6 individual tools

### Total Token Savings

| Approach | Tools | Avg Tokens/Tool | Total Tokens |
|----------|-------|-----------------|--------------|
| Individual Tools | 47 | 150 | ~7,050 |
| Domain-Clustered | 8 | 200 | ~1,600 |
| **Savings** | **-83%** | - | **~5,450** |

### Tool Implementation Pattern

```typescript
export const productTool = createTool({
  name: "product",
  description: "Manage products and instances (variants, inventory)",
  parameters: z.object({
    action: z.enum([
      "search", "create", "update", "getDetails",
      "createInstance", "updateInstance", "getInstances", "checkAvailability"
    ]),
    // Action-specific parameters
    productId: z.string().optional(),
    instanceId: z.string().optional(),
    query: z.string().optional(),
    // ... other params
  }),
  execute: async ({ action, ...params }) => {
    switch (action) {
      case "search":
        return await searchProducts(params);
      case "create":
        return await createProduct(params);
      // ... other cases
    }
  }
});
```

### Workflow Updates Required

**Order Processing Workflow:**
```typescript
1. Validate inventory → productTool.checkAvailability()
2. Create order → orderTool.create()
3. Generate tasks → taskTool.create() (multiple)
4. Record payment → transactionTool.create()
5. Update instances → productTool.updateInstance()
```

**Service Booking Workflow:**
```typescript
1. Check availability → serviceTool.getAvailableSlots()
2. Create booking → serviceTool.createBooking()
3. Update slot → serviceTool.updateSlot()
4. Generate tasks → taskTool.create()
5. Record payment → transactionTool.create()
```

**Product Discovery Workflow:**
```typescript
1. Semantic search → searchTool.semantic()
2. Filter by location → nodeTool.search()
3. Check availability → productTool.checkAvailability()
4. Rank results → (in workflow logic)
```

### Migration Strategy

**Phase 1: Database Adapter** (PRIORITY)
- Update `src/db/index.ts` with InstantDB methods
- Implement all CRUD operations for new entities
- Add instance management methods
- Add slot/booking methods

**Phase 2: Tools Refactor**
- Rewrite `src/tools/commerce.ts` with 8 domain tools
- Implement action-based routing
- Add comprehensive error handling

**Phase 3: Workflows**
- Update `src/workflows/commerce.ts`
- Add service booking workflow
- Add task management workflow
- Update order workflow for instances

**Phase 4: Testing**
- Unit tests for each tool action
- Integration tests for workflows
- Token consumption validation

### Expected Performance

**Agent Efficiency:**
- ✅ Fewer tools = faster tool selection
- ✅ Grouped actions = clearer intent
- ✅ Domain boundaries = better context retention
- ✅ 77% token reduction = more conversation turns
- ✅ Clearer agent prompts = better success rate

**Scalability:**
- ✅ Easy to add new actions to existing tools
- ✅ Can split tools if they get too large
- ✅ Clean separation of concerns
- ✅ Consistent patterns across all tools

### Success Metrics

- ✅ Token reduction: >70%
- ✅ Tool count: <10 domain tools
- ✅ Response time: <2s per action
- ✅ Maintainability: Easy to add features
- ✅ Agent effectiveness: High success rate

---

**This schema is production-ready and optimized for decentralized commerce at scale.** 🎯
