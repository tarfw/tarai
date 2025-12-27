# Plan: Unified Schema for On-Device RAG + Task Management

## Overview

3 tables for complete commerce + task workflow:
- `nodes` - All commerce entities (products, orders, carts, etc.)
- `people` - Node ↔ Person associations with roles
- `tasks` - Actionable items generated from orders

---

## Schema

### 1. Nodes Table (11 columns)

```sql
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- Commerce or structural type
  title TEXT NOT NULL,          -- Display name + RAG searchable
  parent TEXT,                  -- FK to parent node (NULL for roots)
  data TEXT,                    -- JSON for extras
  quantity INTEGER DEFAULT 1,   -- Stock/cart quantity
  value REAL DEFAULT 0,         -- Price/cost
  location TEXT,                -- Geographic location
  embedding BLOB,               -- Vector as binary (Float32Array)
  status TEXT DEFAULT 'active', -- active, pending, completed, cancelled
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_parent ON nodes(parent);
CREATE INDEX idx_nodes_type_parent ON nodes(type, parent);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_updated ON nodes(updated);
```

### 2. People Table (junction)

```sql
CREATE TABLE IF NOT EXISTS people (
  nodeid TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  personid TEXT NOT NULL,
  role TEXT,                    -- seller, buyer, driver, staff, etc.
  PRIMARY KEY (nodeid, personid)
);

CREATE INDEX idx_people_personid ON people(personid);
CREATE INDEX idx_people_role ON people(personid, role);
```

### 3. Tasks Table

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  nodeid TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  personid TEXT NOT NULL,       -- Assigned to
  type TEXT NOT NULL,           -- Task type
  title TEXT NOT NULL,          -- Display title
  status TEXT DEFAULT 'pending',-- pending, progress, completed, cancelled
  priority INTEGER DEFAULT 0,   -- 0=normal, 1=high, 2=urgent
  due INTEGER,                  -- Due timestamp
  data TEXT,                    -- JSON for task-specific details
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);

CREATE INDEX idx_tasks_personid ON tasks(personid);
CREATE INDEX idx_tasks_nodeid ON tasks(nodeid);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_personid_status ON tasks(personid, status);
CREATE INDEX idx_tasks_due ON tasks(due);
```

---

## Column Reference

### Nodes (11 columns)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | Unique identifier |
| `type` | TEXT | Commerce/structural type (18 values) |
| `title` | TEXT | Name for display + RAG |
| `parent` | TEXT | Hierarchy (product→variant→inventory) |
| `data` | TEXT | Minimal JSON for extras |
| `quantity` | INT | Stock/cart quantity |
| `value` | REAL | Price/cost |
| `location` | TEXT | Geographic location |
| `embedding` | BLOB | Vector for semantic search |
| `status` | TEXT | active, pending, completed, cancelled |
| `created` | INT | Created timestamp |
| `updated` | INT | Updated timestamp |

### People (3 columns)

| Column | Type | Purpose |
|--------|------|---------|
| `nodeid` | TEXT | FK to nodes |
| `personid` | TEXT | User ID |
| `role` | TEXT | Role in context |

### Tasks (11 columns)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | Unique identifier |
| `nodeid` | TEXT | FK to source order/node |
| `personid` | TEXT | Assigned person |
| `type` | TEXT | Task type (40+ values) |
| `title` | TEXT | Display title |
| `status` | TEXT | pending, progress, completed, cancelled |
| `priority` | INT | 0=normal, 1=high, 2=urgent |
| `due` | INT | Due timestamp |
| `data` | TEXT | JSON extras |
| `created` | INT | Created timestamp |
| `updated` | INT | Updated timestamp |

---

## Node Types (18 total)

### Commerce Types (12) - Orderable entities

| Type | Description | Example |
|------|-------------|---------|
| `product` | Physical goods | iPhone, Shoes, Groceries |
| `digital` | Digital goods | eBooks, Software, Music |
| `service` | One-time service | Plumbing, Cleaning, Repair |
| `subscription` | Recurring service | Netflix, Gym, SaaS |
| `booking` | Appointment slots | Salon, Doctor, Consultant |
| `rental` | Temporary usage | Car, Equipment, Venue |
| `event` | Ticketed events | Concert, Workshop, Webinar |
| `food` | Food delivery | Restaurant, Cloud Kitchen |
| `transport` | Ride/logistics | Cab, Courier, Moving |
| `education` | Learning | Course, Tutoring, Coaching |
| `realestate` | Property | Sale, Rent, PG/Hostel |
| `healthcare` | Medical | Consultation, Lab, Pharmacy |

### Structural Types (6) - Supporting nodes

| Type | Description | Parent |
|------|-------------|--------|
| `variant` | Product variation (size/color/tier) | Any commerce type |
| `inventory` | Stock tracking | variant or commerce |
| `store` | Physical location | commerce |
| `cart` | Shopping cart item | variant |
| `order` | Confirmed order | variant |
| `search` | Search history | - |

---

## People Roles (15 total)

| Role | Used In | Description |
|------|---------|-------------|
| `seller` | All commerce | Product/service owner |
| `buyer` | Orders, Cart | Customer |
| `staff` | Service, Booking | Employee |
| `driver` | Food, Transport | Delivery person |
| `host` | Event | Event organizer |
| `cohost` | Event | Co-organizer |
| `instructor` | Education | Teacher/trainer |
| `student` | Education | Learner |
| `landlord` | Realestate | Property owner |
| `tenant` | Realestate | Renter |
| `doctor` | Healthcare | Medical professional |
| `patient` | Healthcare | Customer |
| `agent` | Realestate | Broker/agent |
| `manager` | Store | Location manager |
| `support` | All | Customer support |

---

## Task Types (45 total)

### Universal Tasks (8)

| Type | Actor | Description |
|------|-------|-------------|
| `pay` | buyer | Make payment |
| `confirm` | seller | Accept order |
| `reject` | seller | Decline order |
| `cancel` | buyer/seller | Cancel order |
| `refund` | seller | Process refund |
| `rate` | buyer | Rate & review |
| `support` | support | Handle issue |
| `notify` | system | Send notification |

### Product Tasks (6)

| Type | Actor | Description |
|------|-------|-------------|
| `pack` | seller | Pack items |
| `ship` | seller | Hand to courier |
| `pickup` | driver | Collect package |
| `transit` | driver | In transit update |
| `deliver` | driver | Complete delivery |
| `receive` | buyer | Confirm receipt |

### Food Delivery Tasks (6)

| Type | Actor | Description |
|------|-------|-------------|
| `accept` | seller | Accept food order |
| `prepare` | seller | Cook/prepare food |
| `ready` | seller | Mark ready for pickup |
| `collect` | driver | Pick up from restaurant |
| `enroute` | driver | On the way |
| `handover` | driver | Deliver to customer |

### Booking Tasks (5)

| Type | Actor | Description |
|------|-------|-------------|
| `schedule` | seller | Set appointment time |
| `remind` | system | Send reminder |
| `checkin` | buyer | Mark arrival |
| `serve` | staff | Provide service |
| `complete` | staff | Mark completed |

### Service Tasks (4)

| Type | Actor | Description |
|------|-------|-------------|
| `assign` | seller | Assign to staff |
| `arrive` | staff | Reach location |
| `perform` | staff | Do the work |
| `verify` | buyer | Verify completion |

### Rental Tasks (6)

| Type | Actor | Description |
|------|-------|-------------|
| `reserve` | seller | Block inventory |
| `handover` | seller | Give to customer |
| `use` | buyer | Active rental period |
| `return` | buyer | Return item |
| `inspect` | seller | Check condition |
| `close` | seller | Complete rental |

### Event Tasks (5)

| Type | Actor | Description |
|------|-------|-------------|
| `register` | buyer | RSVP/register |
| `ticket` | seller | Issue ticket |
| `admit` | host | Check-in attendee |
| `attend` | buyer | Mark attendance |
| `feedback` | buyer | Post-event feedback |

### Transport Tasks (5)

| Type | Actor | Description |
|------|-------|-------------|
| `dispatch` | seller | Assign vehicle |
| `board` | buyer | Start ride |
| `travel` | driver | In transit |
| `alight` | buyer | End ride |
| `settle` | buyer | Final payment |

---

## Task Flow Examples

### Food Delivery Flow

```
Order (type='food', status='pending')
│
├─ Customer Tasks:
│  ├─ pay (pending)
│  └─ rate (pending, due=after delivery)
│
├─ Restaurant Tasks:
│  ├─ accept (pending)
│  ├─ prepare (pending, after accept)
│  └─ ready (pending, after prepare)
│
└─ Driver Tasks (assigned when ready):
   ├─ collect (pending)
   ├─ enroute (pending, after collect)
   └─ handover (pending, after enroute)
```

### Product Order Flow

```
Order (type='product', status='pending')
│
├─ Customer Tasks:
│  ├─ pay (pending)
│  ├─ receive (pending, due=delivery date)
│  └─ rate (pending, due=after receive)
│
├─ Seller Tasks:
│  ├─ confirm (pending)
│  ├─ pack (pending, after confirm+pay)
│  └─ ship (pending, after pack)
│
└─ Driver Tasks:
   ├─ pickup (pending)
   ├─ transit (pending)
   └─ deliver (pending)
```

### Booking Flow

```
Order (type='booking', status='pending')
│
├─ Customer Tasks:
│  ├─ pay (pending)
│  ├─ checkin (pending, due=appointment time)
│  └─ rate (pending)
│
└─ Seller/Staff Tasks:
   ├─ confirm (pending)
   ├─ remind (pending, due=24h before)
   ├─ serve (pending, due=appointment time)
   └─ complete (pending)
```

### Rental Flow

```
Order (type='rental', status='pending')
│
├─ Customer Tasks:
│  ├─ pay (pending)
│  ├─ return (pending, due=end date)
│  └─ rate (pending)
│
└─ Seller Tasks:
   ├─ confirm (pending)
   ├─ reserve (pending)
   ├─ handover (pending, due=start date)
   ├─ inspect (pending, after return)
   └─ close (pending)
```

---

## Hierarchy Examples

```
product (iPhone 15)
├─ people: [{personid: "seller_1", role: "seller"}]
├─ variant (128GB Black) → value=999
│  └─ inventory → quantity=50, location="Mumbai"
├─ variant (256GB White) → value=1099
│  └─ inventory → quantity=30, location="Delhi"
│
└─ order (confirmed purchase)
   ├─ people: [{personid: "buyer_1", role: "buyer"},
   │           {personid: "seller_1", role: "seller"},
   │           {personid: "driver_1", role: "driver"}]
   └─ tasks: [confirm, pack, ship, pickup, deliver, receive, rate]

food (Pizza Palace)
├─ people: [{personid: "owner_1", role: "seller"},
│           {personid: "chef_1", role: "staff"}]
├─ variant (Margherita) → value=299
├─ variant (Pepperoni) → value=399
│
└─ order (delivery order)
   ├─ people: [{personid: "buyer_1", role: "buyer"},
   │           {personid: "owner_1", role: "seller"},
   │           {personid: "driver_1", role: "driver"}]
   └─ tasks: [pay, accept, prepare, ready, collect, enroute, handover, rate]

booking (Dr. Smith Clinic)
├─ people: [{personid: "doctor_1", role: "doctor"},
│           {personid: "nurse_1", role: "staff"}]
├─ variant (Consultation) → value=500
├─ variant (Follow-up) → value=300
│
└─ order (appointment)
   ├─ people: [{personid: "patient_1", role: "patient"},
   │           {personid: "doctor_1", role: "doctor"}]
   └─ tasks: [pay, confirm, remind, checkin, serve, complete, rate]
```

---

## Data JSON Examples

### Node Data

```json
// Product
{"desc": "Latest iPhone", "img": ["uri1", "uri2"], "tags": "phone,apple", "specs": {"ram": "8GB"}}

// Variant
{"color": "Black", "size": "128GB", "sku": "IP15-BLK-128"}

// Order
{"items": [{"variantid": "v1", "qty": 2}], "total": 1998, "address": "123 Main St"}

// Food
{"cuisine": "Italian", "veg": true, "preptime": 30}

// Booking
{"duration": 30, "slots": ["09:00", "10:00", "11:00"]}
```

### Task Data

```json
// Delivery task
{"address": "123 Main St", "contact": "+91...", "otp": "1234", "instructions": "Ring bell twice"}

// Prepare task
{"items": ["Margherita x2", "Coke x1"], "special": "Extra cheese, no onion"}

// Booking task
{"slot": "2024-01-15T10:00", "service": "Consultation", "room": "101"}

// Payment task
{"amount": 999, "method": "upi", "due": 1705312800}
```

---

## Key Queries

```sql
-- All commerce items for marketplace
SELECT * FROM nodes
WHERE type IN ('product','digital','service','subscription','booking','rental','event','food','transport','education','realestate','healthcare')
AND parent IS NULL AND status = 'active';

-- Get variants of a product
SELECT * FROM nodes WHERE parent = ?;

-- Cart items for a user
SELECT n.* FROM nodes n
JOIN people p ON n.id = p.nodeid
WHERE n.type = 'cart' AND p.personid = ? AND p.role = 'buyer';

-- All nodes by a seller
SELECT n.* FROM nodes n
JOIN people p ON n.id = p.nodeid
WHERE p.personid = ? AND p.role = 'seller';

-- My pending tasks
SELECT * FROM tasks
WHERE personid = ? AND status = 'pending'
ORDER BY priority DESC, due ASC;

-- Tasks for an order
SELECT t.*, p.role FROM tasks t
JOIN people p ON t.nodeid = p.nodeid AND t.personid = p.personid
WHERE t.nodeid = ?;

-- Overdue tasks
SELECT * FROM tasks
WHERE status = 'pending' AND due < strftime('%s', 'now')
ORDER BY due;

-- Active orders for a driver
SELECT DISTINCT n.* FROM nodes n
JOIN tasks t ON n.id = t.nodeid
WHERE t.personid = ? AND t.status IN ('pending', 'progress')
AND n.type = 'order';

-- Search history
SELECT title FROM nodes
WHERE type = 'search'
ORDER BY created DESC LIMIT 20;

-- RAG: Get embeddable nodes
SELECT id, title, data, embedding FROM nodes
WHERE type NOT IN ('cart','search','inventory','order')
AND embedding IS NOT NULL;
```

---

## Files to Modify

| File | Action |
|------|--------|
| `types/node.ts` | Add `NodeRecord`, `NodeType`, `PeopleRecord`, `TaskRecord`, `TaskType` |
| `services/database/schema.ts` | Create 3 tables: nodes, people, tasks |
| `services/nodeService.ts` | Unified CRUD + `getByType()`, `getChildren()` |
| `services/peopleService.ts` | NEW: Manage node-person associations |
| `services/taskService.ts` | NEW: Task CRUD + `getByPerson()`, `getByNode()` |
| `services/cartService.ts` | Cart = nodes where type='cart' |
| `services/orderService.ts` | NEW: Order creation + task generation |
| `services/vectorStores/nodeVectorStore.ts` | Index commerce types |
| `app/(tabs)/marketplace.tsx` | Query commerce type nodes |
| `app/(tabs)/cart.tsx` | Query cart type nodes |
| `app/(tabs)/tasks.tsx` | NEW: Task list view |
| `app/(tabs)/nodes.tsx` | Show hierarchy with children |
| `app/node/add.tsx` | Save to unified schema |
| `services/demo/sampleNodes.ts` | Demo data with people + tasks |

---

## Benefits

- **3 tables** - Clean separation: entities, relationships, actions
- **Indexed queries** - O(log n) for all common operations
- **BLOB embeddings** - 3-4x storage savings vs JSON text
- **Flexible roles** - Same person can be buyer in one, seller in another
- **Task automation** - Generate tasks from order type templates
- **RAG-ready** - embedding column + title for semantic search
- **Extensible** - Add new types/roles without schema changes
- **Offline-first** - All data local, sync when online
