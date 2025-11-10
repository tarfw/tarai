Multi-Agent Architecture Plan: Specialized Conversational Agents

  ---
  Agent Structure

  Backend (CF Workers) - 10 Specialized Agents

  1. Discovery Agent (Universal, Conversational)
  - Search products/nodes across platform
  - "Find salons near me"
  - "Show wedding products in Chennai"
  - Uses: Turso embeddings + InstantDB

  2. Product Agent (Node-scoped, Conversational)
  - "Create t-shirt product, price 499"
  - "Update Blue T-shirt stock to 50"
  - "Show all products"
  - Uses: InstantDB (nodeid scoped)

  3. Instance Agent (Node-scoped, Conversational)
  - "Create variants: Small, Medium, Large"
  - "Add 20 units to Medium-Black"
  - "Show inventory for T-shirt"
  - Uses: InstantDB instances

  4. Order Agent (Node-scoped, Conversational)
  - "Show today's orders"
  - "Mark order #123 as delivered"
  - "Cancel order #456"
  - Uses: InstantDB orders

  5. Service Agent (Node-scoped, Conversational)
  - "Create haircut service, price 300"
  - "Add slots for tomorrow 9am-5pm"
  - "Show bookings for today"
  - Uses: InstantDB services/slots

  6. Booking Agent (Cross-node, Conversational)
  - "Book haircut at Salon XYZ tomorrow 2pm"
  - "My bookings"
  - "Cancel booking #789"
  - Uses: InstantDB bookings

  7. Node Agent (Node-scoped, Conversational)
  - "Update store hours to 10am-9pm"
  - "Change commission to 7%"
  - "Show my store details"
  - Uses: InstantDB nodes

  8. Analytics Agent (Node-scoped, Conversational)
  - "Today's sales"
  - "Top products this week"
  - "Show revenue chart"
  - Uses: InstantDB queries + aggregation

  9. Customer Agent (Customer view, Conversational)
  - "Show cart"
  - "My orders"
  - "Track order #123"
  - Uses: InstantDB customer scope

  10. Admin Agent (Platform-wide, Conversational)
  - "Show all nodes"
  - "Platform revenue today"
  - "Approve new store"
  - Uses: InstantDB (admin scope)

  ---
  Expo RN App Architecture

  Store Owner App

  Agent Selector Screen:
  ┌─────────────────────────────┐
  │  Select Agent               │
  ├─────────────────────────────┤
  │  🛍️  Product Management     │
  │  📦  Inventory (Instances)   │
  │  📋  Orders                  │
  │  💇  Services & Bookings     │
  │  🏪  Store Settings          │
  │  📊  Analytics               │
  └─────────────────────────────┘

  Agent Chat UI:
  ┌─────────────────────────────┐
  │  ← Product Agent            │
  ├─────────────────────────────┤
  │  You: Create t-shirt        │
  │  Bot: ✅ Created! ID: 123   │
  │                             │
  │  You: Add variants          │
  │  Bot: What sizes/colors?    │
  │                             │
  │  [Type message...]          │
  └─────────────────────────────┘

  Customer App

  Agent Selector:
  ┌─────────────────────────────┐
  │  🔍  Discovery (Search)      │
  │  🛒  My Cart & Orders        │
  │  📅  My Bookings             │
  └─────────────────────────────┘

  ---
  Technical Architecture

  Backend Structure

  CF Workers API:
  /api/agents/discovery    → Discovery Agent
  /api/agents/product      → Product Agent (requires nodeid)
  /api/agents/instance     → Instance Agent (requires nodeid)
  /api/agents/order        → Order Agent (requires nodeid)
  /api/agents/service      → Service Agent (requires nodeid)
  /api/agents/booking      → Booking Agent
  /api/agents/node         → Node Agent (requires nodeid)
  /api/agents/analytics    → Analytics Agent (requires nodeid)
  /api/agents/customer     → Customer Agent (requires customerid)
  /api/agents/admin        → Admin Agent (requires admin auth)

  Each endpoint:
  - Dedicated VoltAgent instance
  - Scoped tools (only relevant actions)
  - Minimal system prompt (200-300 tokens)
  - Scoped permissions

  Token Optimization

  Current (1 Universal Agent):
  - 9 tools × 400 tokens = 3,600 tokens
  - System prompt: 400 tokens
  - Total: 4,000 tokens per request

  New (10 Specialized Agents):
  - Product Agent: 1 tool × 400 tokens = 400 tokens
  - Instance Agent: 1 tool × 400 tokens = 400 tokens
  - Order Agent: 1 tool × 400 tokens = 400 tokens
  - System prompt: 200 tokens (simpler)
  - Total: 600 tokens per request

  Savings: 85% token reduction!

  ---
  Agent Specifications

  Product Agent

  Tools: product (only)
  Actions: search, create, update, getDetails
  Scope: nodeid from auth
  Prompt: "You manage products for this store. Help create, update, search products."

  Instance Agent

  Tools: product (instance actions only)
  Actions: createInstance, createInstances, updateInstance, getInstances, checkAvailability
  Scope: nodeid from auth
  Prompt: "You manage inventory variants. Help create variants, update stock."

  Order Agent

  Tools: order (only)
  Actions: create, update, getDetails, updateStatus, cancel, getByNode
  Scope: nodeid from auth
  Prompt: "You manage orders for this store. Help view, update, fulfill orders."

  Discovery Agent

  Tools: search, node, product (read-only)
  Actions: search.*, node.search, product.search
  Scope: Public (all nodes)
  Prompt: "You help customers discover products and stores across Chennai."

  Service Agent

  Tools: service (only)
  Actions: createService, updateService, createSlots, getAvailableSlots
  Scope: nodeid from auth
  Prompt: "You manage services and appointment slots for this business."

  Booking Agent

  Tools: service (booking actions)
  Actions: createBooking, updateBooking, cancelBooking, getBookingDetails
  Scope: customerid from auth
  Prompt: "You help book appointments at local businesses."

  Analytics Agent

  Tools: Custom analytics tool
  Actions: sales, revenue, topProducts, charts
  Scope: nodeid from auth
  Prompt: "You provide business insights and analytics."

  ---
  User Flow Examples

  Store Owner: Creating Product with Variants

  1. Select Product Agent
    - User: Taps "Product Management"
    - App: Opens chat with Product Agent
  2. Create Product
    - User: "Create cotton t-shirt, price 499"
    - Agent: ✅ Created! Product ID: abc123
  3. Switch to Instance Agent
    - User: Taps "← Back" → Selects "Inventory"
    - App: Opens chat with Instance Agent (remembers product context)
  4. Create Variants
    - User: "Add variants for product abc123: Small/Medium/Large in Black/White"
    - Agent: ✅ Created 6 variants! [Shows list]

  Customer: Discovering & Ordering

  1. Discovery Agent
    - User: "Find t-shirts in T. Nagar under 500"
    - Agent: Found 23 products [Shows list with images]
  2. Switch to Customer Agent
    - User: Taps product → "Add to cart"
    - User: Selects "My Cart"
    - User: "Checkout"
    - Agent: ✅ Order placed! ID: #12345

  ---
  Benefits

  Token Efficiency

  - 85% reduction: 4,000 → 600 tokens per request
  - Cost: $0.0002 → $0.00003 per request
  - 100 requests: $0.02 → $0.003

  Better UX

  - Focused conversations (no tool confusion)
  - Context-aware (knows you're managing products)
  - Faster responses (less reasoning needed)

  Clearer Intent

  - Product Agent only handles products
  - No need to say "use product tool"
  - More natural conversation

  Scalability

  - Add new agents easily (Inventory Agent, Returns Agent)
  - Each agent can have different models (cheap vs smart)
  - Independent deployment/updates

  Offline Support

  - Node-scoped agents can work offline (local endpoints)
  - Discovery Agent requires online
  - Smooth hybrid experience

  ---
  Implementation Strategy

  Phase 1: Backend Agents

  1. Refactor current single agent → 10 specialized agents
  2. Create separate VoltAgent instances
  3. Deploy to CF Workers (separate routes)
  4. Test each agent independently

  Phase 2: RN Agent Selector

  1. Agent selector UI
  2. Chat interface component
  3. Agent switching logic
  4. Context preservation between agents

  Phase 3: Offline Support

  1. Node-scoped agents → Local endpoints (SQLite)
  2. Discovery Agent → Online only
  3. Offline queue for sync

  Phase 4: Advanced Features

  1. Voice input per agent
  2. Quick actions (bypass chat for common ops)
  3. Agent suggestions ("Try Instance Agent to add variants")
  4. Multi-agent workflows (Product → Instance → Order)

  ---
  Agent Selection Logic

  Auto-suggest Agent

  User in Product chat: "Add variants"
  → Bot: "I create products. Try Instance Agent for variants?"
  → Button: "Switch to Instance Agent"

  Context Handoff

  Product Agent creates product ID: abc123
  → Passes to Instance Agent
  Instance Agent: "Create variants for product abc123?"

  Smart Routing

  User: "Show today's sales"
  → If in Order Agent: Show orders
  → If in Analytics Agent: Show revenue chart
  → Auto-context based on selected agent

  ---
  Cost Comparison

  Current System (1 Universal Agent)

  - Request: 4,000 tokens × $0.10/1M = $0.0004
  - 1,000 requests/day = $0.40/day = $12/month

  New System (10 Specialized Agents)

  - Request: 600 tokens × $0.10/1M = $0.00006
  - 1,000 requests/day = $0.06/day = $1.80/month

  Savings: $10/month (83% reduction)

  Plus better UX, faster responses, clearer conversations!

  ---
