# TARAI Architecture Plan

## Overview

A universal commerce platform with local-first architecture, real-time sync, and semantic search capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Native App                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  OP-SQLite (Local)                                        │  │
│  │  ├── Tasks        - 45+ commerce workflow tasks           │  │
│  │  ├── Carts        - Shopping cart items                   │  │
│  │  ├── Orders       - Order history & status                │  │
│  │  └── Inventory    - Stock levels, variants                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │  Realtime                       │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  InstantDB (Cloud Sync)                                   │  │
│  │  ├── Real-time cross-device sync                          │  │
│  │  ├── Offline-first support                                │  │
│  │  └── Live updates via WebSocket                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │  API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Fly.io Server                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  LanceDB (Long-term Memory)                               │  │
│  │  ├── Semantic search with embeddings                      │  │
│  │  ├── Commerce types memories                              │  │
│  │  ├── People relationships                                 │  │
│  │  └── Geospatial queries                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Storage Layers

### Layer 1: Short-term Memory (OP-SQLite - Local)

Fast, transactional data for operational workflows.

#### Data Models

**Tasks**
```typescript
interface Task {
  id: string;
  memoryId?: string;          // Link to long-term memory
  personId?: string;          // Assignee
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description?: string;
  dueDate?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

**Task Types (45+)**
```typescript
type TaskType =
  // Commerce workflows
  | 'product_create'
  | 'product_update'
  | 'product_delete'
  | 'inventory_restock'
  | 'inventory_count'
  | 'order_create'
  | 'order_process'
  | 'order_ship'
  | 'order_deliver'
  | 'order_cancel'
  | 'refund_process'
  | 'payment_pending'
  | 'payment_complete'
  | 'booking_confirm'
  | 'booking_cancel'
  | 'rental_start'
  | 'rental_end'
  | 'subscription_renew'
  | 'subscription_cancel'
  | 'event_create'
  | 'event_update'
  | 'food_order'
  | 'transport_book'
  | 'transport_track'
  | 'education_enroll'
  | 'realestate_list'
  | 'realestate_tour'
  | 'healthcare_book'
  | 'healthcare_visit'
  // Communication
  | 'message_send'
  | 'message_receive'
  | 'notification_send'
  // General
  | 'note_create'
  | 'search_perform'
  | 'agent_task';
```

**Carts**
```typescript
interface Cart {
  id: string;
  memoryId: string;           // Product/service memory
  quantity: number;
  price: number;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

**Orders**
```typescript
interface Order {
  id: string;
  cartId: string;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  shippingAddress?: Address;
  billingAddress?: Address;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Inventory**
```typescript
interface Inventory {
  id: string;
  memoryId: string;           // Product memory
  variantId?: string;
  quantity: number;
  reserved: number;           // Reserved for orders
  available: number;          // quantity - reserved
  location?: string;          // Warehouse/shelf
  metadata?: Record<string, any>;
  updatedAt: Date;
}
```

---

### Layer 2: Real-time Sync (InstantDB)

Syncs short-term memories across devices with live updates.

#### Sync Strategy

```typescript
// InstantDB Schema Concept
{
  shorts: {
    tasks: { /* task data */ },
    carts: { /* cart data */ },
    orders: { /* order data */ },
    inventory: { /* inventory data */ }
  }
}
```

#### Real-time Events

| Event | Trigger | Action |
|-------|---------|--------|
| `task_created` | User creates task | Broadcast to all devices |
| `cart_updated` | Item added/removed | Live cart sync |
| `order_status_changed` | Order processed | Update all views |
| `inventory_low` | Stock < threshold | Notify relevant users |

#### Offline Support

1. All writes go to OP-SQLite first
2. When online, sync to InstantDB
3. Resolve conflicts via last-write-wins or custom logic

---

### Layer 3: Long-term Memory (LanceDB on Fly.io)

Semantic search and persistent memories with embeddings.

#### Data Models

**Memory**
```typescript
interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  title?: string;
  description?: string;
  embedding?: number[];           // 384D vector (all-MiniLM-L6-v2)
  metadata?: MemoryMetadata;
  status: MemoryStatus;
  parentId?: string;              // Hierarchical relationships
  createdAt: Date;
  updatedAt: Date;
}
```

**Memory Types (Commerce)**
```typescript
type MemoryType =
  // Core commerce
  | 'product'
  | 'service'
  | 'subscription'
  | 'digital'
  // Booking-based
  | 'booking'
  | 'rental'
  | 'event'
  | 'food'
  | 'transport'
  | 'education'
  // Property
  | 'realestate'
  // Healthcare
  | 'healthcare'
  // Structural
  | 'variant'
  | 'inventory_item'
  | 'store'
  | 'cart_item'
  | 'order_item'
  | 'search_query';
```

**Memory Metadata**
```typescript
interface MemoryMetadata {
  // Commerce fields
  price?: number;
  currency?: string;
  category?: string;
  tags?: string[];
  brand?: string;

  // Location fields (for geospatial queries)
  location?: {
    lat: number;
    lng: number;
    address?: string;
    city?: string;
    country?: string;
  };

  // Availability
  availability?: {
    status: 'available' | 'unavailable' | 'limited';
    stock?: number;
    nextAvailable?: Date;
  };

  // Ratings & reviews
  rating?: number;
  reviewCount?: number;

  // Custom fields
  [key: string]: any;
}
```

**People**
```typescript
interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: PersonRole;
  metadata?: Record<string, any>;
  embedding?: number[];           // For semantic person search
  createdAt: Date;
  updatedAt: Date;
}
```

**Person Roles**
```typescript
type PersonRole =
  | 'seller'
  | 'buyer'
  | 'driver'
  | 'staff'
  | 'host'
  | 'instructor'
  | 'student'
  | 'doctor'
  | 'patient'
  | 'landlord'
  | 'tenant'
  | 'agent'
  | 'manager'
  | 'support'
  | 'cohost';
```

---

## Search Capabilities

### Semantic Search (LanceDB)

```typescript
// Example: Search for "Italian restaurant"
const results = await memoryService.searchMemories({
  query: "Italian restaurant",
  type: 'food',
  limit: 10,
  minScore: 0.5
});
```

### Geospatial Search (LanceDB + Metadata)

```typescript
// Example: Find nearest taxi
const results = await memoryService.findNearest({
  lat: 37.7849,
  lng: -122.4094,
  type: 'transport',
  limit: 5
});
```

### Hybrid Search (Semantic + Geospatial)

```typescript
// Example: "Good Italian restaurant near me"
const results = await memoryService.hybridSearch({
  query: "Italian restaurant",
  lat: 37.7849,
  lng: -122.4094,
  radiusKm: 5,
  minRating: 4.0,
  limit: 10
});
```

---

## Agent Scenarios

### Scenario 1: Book Taxi

```
Step 1: Discovery (LanceDB)
User: "I need a taxi to airport"
Query → LanceDB semantic search
Returns: taxi memories (Uber, local cab, shuttle)

Step 2: Geospatial Filter (LanceDB)
Filter by distance to user's location
Returns sorted by nearest

Step 3: Booking (OP-SQLite)
Create task: book_taxi
Create cart: taxi_ride
Create order: pending

Step 4: Sync (InstantDB)
Order synced to cloud
Available on all user's devices

Step 5: Complete (OP-SQLite)
Order status: completed
Optional: Log trip in LanceDB (past_trip memory)
```

### Scenario 2: Order Product

```
Step 1: Search (LanceDB)
User: "wireless headphones"
Query → LanceDB semantic search
Returns: product memories

Step 2: Select (OP-SQLite)
Add to cart (creates cart_item memory)
Cart saved locally

Step 3: Sync (InstantDB)
Cart synced across devices
User can check cart from any device

Step 4: Checkout (OP-SQLite)
Create order
Process payment

Step 5: Track (OP-SQLite + InstantDB)
Task: order_ship
Real-time tracking updates via InstantDB
```

### Scenario 3: Restaurant Booking

```
Step 1: Discover (LanceDB + Geospatial)
User: "Italian food nearby"
Query → LanceDB with location filter
Returns: restaurants sorted by distance + rating

Step 2: Book (OP-SQLite)
Create task: booking_confirm
Create order: food_order

Step 3: Sync (InstantDB)
Booking synced
Share with dining companions (via InstantDB permissions)

Step 4: Complete (OP-SQLite)
Rate restaurant
Optional: Log experience in LanceDB (review memory)
```

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  USER ACTION                                                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ├──┬────────────────────────────────────────────────┐
         │                                                 │
         ▼                                                 ▼
┌─────────────────────┐                          ┌─────────────────────┐
│  READ OPERATION     │                          │  WRITE OPERATION    │
├─────────────────────┤                          ├─────────────────────┤
│ 1. Check OP-SQLite  │                          │ 1. Write OP-SQLite  │
│ 2. If not found,    │                          │ 2. Sync InstantDB   │
│    query LanceDB    │                          │ 3. Return success   │
│ 3. Return result    │                          │                     │
└─────────────────────┘                          └─────────────────────┘
         │                                                 │
         │                                                 ├──→ Other devices (realtime)
         │                                                 │
         ▼                                                 ▼
┌─────────────────────┐                          ┌─────────────────────┐
│  SEARCH OPERATION   │                          │  OFFLINE SCENARIO   │
├─────────────────────┤                          ├─────────────────────┤
│ 1. LanceDB query    │                          │ 1. Write OP-SQLite  │
│ 2. Return matches   │                          │ 2. Queue for sync   │
│ 3. Cache locally    │                          │ 3. Sync when online │
└─────────────────────┘                          └─────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Short-term Memory (OP-SQLite)
- [ ] Implement tasks CRUD
- [ ] Implement carts CRUD
- [ ] Implement orders CRUD
- [ ] Implement inventory CRUD
- [ ] Add sync hooks for InstantDB

### Phase 2: Real-time Sync (InstantDB)
- [ ] Setup InstantDB project
- [ ] Implement sync service
- [ ] Handle offline/online states
- [ ] Implement conflict resolution

### Phase 3: Long-term Memory (LanceDB)
- [ ] Setup Fly.io server
- [ ] Deploy LanceDB
- [ ] Implement memory CRUD API
- [ ] Implement semantic search
- [ ] Add geospatial support

### Phase 4: Integration
- [ ] Connect app to LanceDB API
- [ ] Implement hybrid search UI
- [ ] Test full workflow scenarios
- [ ] Optimize performance

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Local Database** | OP-SQLite | Short-term memory, fast CRUD |
| **Cloud Sync** | InstantDB | Real-time cross-device sync |
| **Vector Database** | LanceDB (Fly.io) | Long-term memory, semantic search |
| **Embeddings** | all-MiniLM-L6-v2 | 384D text embeddings |
| **Frontend** | React Native (Expo) | Mobile app |
| **Server** | Node.js (Fly.io) | LanceDB API host |

---

## Key Design Principles

1. **Local-first**: All writes go to OP-SQLite first for speed
2. **Offline support**: Full functionality without internet
3. **Real-time sync**: InstantDB keeps devices in sync
4. **Semantic search**: LanceDB enables intelligent discovery
5. **Geospatial**: Location-based queries for local services
6. **Hierarchical**: Memories can have parent/child relationships
7. **Type-safe**: TypeScript throughout
