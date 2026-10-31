# Rivet 3.0 — Architecture, Cost & TAR Integration Reference

*(All conversions calculated at the exact standard rate of **$1.00 USD = ₹85.00 INR**)*

---

## 1. Core Architecture, Deployment & Credentials

```
[ Merchant Phone / Browser / AI Agent ]
              ▲
              │ ◄─── Public Internet Egress (Live WebSocket text, ~200B/delta)
              ▼
    ┌─────────────────────── Actor Node ────────────────────────┐
    │ Physical server (1 GB – 16 GB RAM) hosting Actors         │
    │                                                           │
    │   ┌────────────── Rivet Actor (72 KB) ────────────────┐   │
    │   │ • 1 Actor = 1 Workspace DB or 1 Agent session     │   │
    │   │ • SQLite embedded in local memory (< 1 ms writes) │   │
    │   │ • Hibernates when idle (0% CPU / 0% RAM)          │   │
    │   │ • Wakes on request in 6.9 ms                      │   │
    │   └───────────────────────────────────────────────────┘   │
    └───────────────────────────────────────────────────────────┘
              ▲                               ▲
              │ Internal sync ($0)            │ Background backups ($0 upload)
              ▼                               ▼
     [ Control Plane ]               [ S3 / Cloudflare R2 ]
 (Traffic router & scheduler)      (Infinite cloud warehouse)
```

### A. The Blueprint vs. Instances Model (Write Once, Run Millions)
You do **not** write code for every shop. You write your `.ts` file **once** as a blueprint:

```
[ The Shared Actor Code (Written Once) ] ──► "Rules: recordSale, updateStock, calculateGST"
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  [ Insert Shop #1 ]       [ Insert Shop #2 ]      [ Insert Shop #1,000,000 ]
     Aambal Tea               Ravi Bakery                 Salem Textiles
 (Plugs in Aambal DB)     (Plugs in Ravi DB)          (Plugs in Salem DB)
```

#### How 1 Code File Serves Millions (The ATM Analogy)
* **The ATM Model:** A bank writes the ATM software **once**. When you insert your card, the ATM executes that software on *your* account. When the next person inserts their card, it executes the exact same software on *their* account.
* **How Rivet Executes It in 3 Steps:**
  1. **Deploy Once (`npx rivet deploy`):** Your TypeScript file compiles into a single ~50 KB bundle sitting once in server memory.
  2. **Shops Create an ID, Not New Code:** When a shop signs up, Rivet creates only an ID (`workspace_aambal_tea`) and an empty private SQLite file (`aambal.db`).
  3. **Runtime Plug-in:** When an order arrives, Rivet points the shared code at that shop's SQLite file, completes the write in **0.69 ms**, and detaches.

#### The 2 Superpowers of This Model
* **Zero Wasted Memory:** 1 Million shops take up **0 extra megabytes** for code. All 1,000,000 shops share the exact same 50 KB compiled file.
* **Instant 1-Second Global Updates:** If you add a new feature (like *"Calculate 18% GST"*), you deploy your `.ts` code once. **All 1,000,000 shops are instantly updated across the platform in 1 second**.

#### The 3 Actor Blueprints in TAR (`tarfw.md` & `paraiv2.md`):
1. **Workspace Actor (Millions):** 1 per shop running its isolated 10-table SQLite ledger, pos sales, and inventory.
2. **Sandbox Actor (Ephemeral):** Spun up on-demand to safely isolate an AI coding agent generating website code (`paraiv2.md` Mode 2).
3. **Channel Actor (Thousands):** Manages live WhatsApp / Telegram customer support streams.

### B. What Runs Inside an Actor? (The 5 Things You Can Write)
SQLite is simply the Actor's private notebook. The Actor itself is a **complete serverless program**:

```
┌──────────────────────────────────────────────────────────┐
│                   YOUR RIVET ACTOR CODE                  │
├──────────────────────────────────────────────────────────┤
│ 1. Business Logic & Tax: Calculate GST, check roles.     │
│ 2. External APIs: Send WhatsApp messages, trigger UPI.   │
│ 3. AI Integrations: Call Gemini, DeepSeek, Claude.       │
│ 4. Scheduled Timers: "Every morning 10 AM, send summary."│
│ 5. Real-Time WebSockets: Broadcast live updates.         │
│ 6. SQLite Memory: Save facts to the local database.      │
└──────────────────────────────────────────────────────────┘
```

1. **Business Rules & Calculations (The Brain):** Validate roles (Cashier vs. Owner), calculate GST, apply discounts, and enforce TAR's double-entry balanced accounting and non-negative stock rules.
2. **External Cloud & Payment APIs:** Trigger UPI/card payments (Razorpay, Stripe), send automated WhatsApp messages (Twilio/Meta), and call AI models (DeepSeek, Gemini, Claude).
3. **Scheduled Timers & Alarms:** Run background jobs (e.g. *"Every day at 10:00 AM, calculate daily sales and send a WhatsApp report to the owner"* — the exact `Ask` skill in `tarfw.md`!).
4. **Live WebSockets & Push Notifications:** Broadcast real-time events (`order_packed`, `new_sale`) to connected screens and trigger OS push notifications (FCM / APNs).
5. **SQLite Reads & Writes:** Query and commit state to its private local database in **0.69 ms**.

> **The Clerk Analogy:** If SQLite is a **paper ledger notebook**, the Actor is the **entire human clerk sitting at the desk**: answering phone calls, talking on WhatsApp, calculating tax, checking IDs at the door, and setting alarm clocks for tomorrow morning.

### C. Cluster Credentials & Deployment
* **Endpoint (`*.onrivet.dev`):** The public web address where merchant apps and WebSockets connect to reach your cluster.
* **Admin Token (`••••••••••`):** The secret master key that authorizes code deployment and actor management (keep server-side only).
* **Deployment:** Simple 1-command deployment (`npx rivet deploy`) from a standard 20-line TypeScript file. Zero Docker, Kubernetes, or complex networking configs required.

### D. Where Components & Metadata Physically Live

| Component | Physical Location | What It Holds | Bandwidth / Egress Cost |
| :--- | :--- | :--- | :---: |
| **Control Plane** | Managed Server RAM | Routing pointer (~150 bytes: *"Actor #1042 lives on Node 3"*). | **$0.00 (₹0)** |
| **Actor Node** | Dedicated Server Disks | The **72 KB Manifest** + active SQLite pages on fast NVMe SSD. | **Primary Egress** (WebSockets to phones) |
| **Actor** | Process inside Node | Embedded code + memory buffers during active execution. | *(Inside Node)* |
| **Storage (S3/R2)** | Cloud Object Storage | Permanent disaster-proof cold archive and delta logs. | **$0.00 (₹0)** ($0 upload; $0 R2 egress) |

> **Bandwidth Rule:** Collaborative text deltas are tiny (~200 bytes). Media (photos/PDFs) **never** pass through the Actor; phones upload them directly to R2, sending only a 50-byte URL link to the Actor.

---

## 2. Dynamic Resources, Concurrent Writes & Conflict Resolution

### A. How CPU & RAM Are Shared (Dynamic Pool)
Actors do **not** have heavy, hard-reserved CPU or RAM locked to them:
* **CPU (Shared):** An Actor borrows a vCPU core for **< 0.69 ms** to record a write or query, then immediately yields it back to the Node.
* **RAM (Shared Dynamic):** While awake, an Actor uses **~1.5 to 2 MB** of working memory. When it hibernates, that RAM is completely freed.
* **State & SQLite (100% Dedicated):** Every Actor has its own private, isolated SQLite database file. No other Actor can read or lock it.

### B. Concurrent Writes (Rivet vs. Turso vs. Uber Model)
* **Across Different Workspaces (100% Parallel):** In traditional central databases (e.g. Postgres or Turso), thousands of shops write to shared tables, creating lock contention. In Rivet, **each workspace has its own database**. 10,000 shops write simultaneously with zero waiting.
* **Inside a Single Workspace (The Single Queue):** If a cashier, a WhatsApp order, and an AI agent write to the *same* shop at the exact same millisecond, the Actor queues them in memory and writes them in sequence. **Database deadlocks (`SQLITE_BUSY`) are physically impossible**.
* **Throughput:** Because writes commit locally to NVMe SSD in **0.69 ms**, a single Actor comfortably processes **1,400+ consecutive writes/sec**.

### C. Conflict Resolution: Turso (Lock & Reject) vs. Rivet + TAR (Queue & Merge)

| Conflict Scenario | Turso DB | Rivet 3.0 + TAR |
| :--- | :--- | :--- |
| **1. Live Simultaneous Clicks** | Central DB locks; 2nd writer gets a **`SQLITE_BUSY` error** and must retry. | **In-memory queue (< 0.69 ms)**; actions process sequentially with zero errors. |
| **2. Offline Reconnects** | Writes overwrite rows (`stock = 9`); earlier changes can be lost. | **Append-only `move` deltas** (`move: -1 chai`). All offline intents merge cleanly without overwriting. |
| **3. Stock Floor Edge Case** *(Last item sold to 2 people offline)* | Database crashes or allows negative stock (`stock = -1`). | **Kernel Gate** safely refuses negative stock and posts an alert row to the Owner's Canvas: `! NEXT Inventory shortage [Audit]`. |

---

## 3. WarpDrive: How Storage Works & Why It Is Safe

WarpDrive eliminates the tradeoff between SSD speed and cloud durability:

```
[ Layer 1: RAM (0.2 ms) ]       ──► Working state in memory.
[ Layer 2: NVMe SSD (0.69 ms) ] ──► Stamped across 3 Availability Zones (AZs) in parallel.
[ Layer 3: S3 / R2 (Deep) ]     ──► Batched quietly in background; never blocks client writes.
```

* **The 3-Building Quorum (0.69 ms):** Every write is simultaneously sent to NVMe SSDs in 3 separate data centers. Once **2 of 3 confirm (0.69 ms)**, the write is guaranteed safe.
* **Disaster Proof:** If a server or an entire data center loses power, the other two continue without downtime or data loss.
* **No Lock-in:** Backups are standard SQLite files in **your own bucket**. Download and inspect them anytime with standard tools (`sqlite3`).

---

## 4. Official Rivet Cloud Pricing & Capacity Matrix

*(Direct from official Rivet Cloud billing console)*

### A. Control Plane Plans

| Plan | Price USD / mo | Price INR / mo | Setup | Max Nodes | Features |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **Free** | **$0.00** | **₹0** | 1 Node / 1 AZ | 1 Node | Community support |
| **Hobby** | **$10.00** | **₹850** | 1 Node / 1 AZ | 3 Nodes | Email support |
| **Team** | **$120.00** | **₹10,200** | 3 Nodes / 3 AZs | 10 Nodes | Slack & Email support |
| **Enterprise** | **$900.00** | **₹76,500** | 5 Nodes / 3 AZs | 50 Nodes | 1.6 TB Hot Cache · 2.5 GB/s Writes · Dedicated support |

### B. Actor Node Sizes & Real-World Concurrency

* **Sleeping Capacity:** Total workspaces registered (~72 KB metadata each on disk).
* **Active Capacity:** Workspaces actively writing at the *exact same second* (~1.5–2 MB RAM each).

| Node Size | vCPU | RAM | Price USD / mo | Price INR / mo | Total Workspaces (Sleeping) | Max Active at Same Second |
| :--- | :---: | :---: | :--- | :--- | :---: | :---: |
| **R-5** | 1/4 | 1 GB | **Free** / **$4.20** | **₹0** / **₹357** | **~10,000** | **~400 – 500** |
| **R-10** | 1/2 | 2 GB | **Free** / **$8.40** | **₹0** / **₹714** | **~25,000** | **~900 – 1,000** |
| **R-20** | 1 | 4 GB | **$16.80** | **₹1,428** | **~50,000** | **~2,000** |
| **R-40** | 4 | 8 GB | **$27.30** | **₹2,321** | **~100,000** | **~4,000** |
| **R-160** | 8 | 16 GB | **$94.50** | **₹8,033** | **~200,000** | **~8,000** |

### C. Authoritative Storage & Bandwidth Overage Rates

| Resource | Included Free (Free-1 Plan) | Overage Rate (USD) | Overage Rate (INR) | Role |
| :--- | :---: | :---: | :---: | :--- |
| **Actor Storage** | **10 GB Free** | **$0.25 / GB** | **₹21.25 / GB-mo** | Fast NVMe SSD storage across 3 AZs for live SQLite states. |
| **Object Storage** | **50 GB Free** | **$0.02 / GB** | **₹1.70 / GB-mo** | Deep S3 warehouse storage for historical deltas and files. |
| **Egress (Bandwidth)** | **100 GB Free** | **$0.06 / GB** | **₹5.10 / GB** | WebSocket messages sent to users' devices. |

### D. WebSocket Cost Rules: Open Connections & 24/7 Collaborators

* **Connection Fee ($0.00 / ₹0):** Zero charge per connection. No connection-minute meters (unlike AWS API Gateway WebSockets at $0.25/M connection minutes, or Pusher/Ably at $99–$199/mo per 1,000 connections).
* **Idle Time Fee ($0.00 / ₹0):** Idle subscriber/collaborator sockets consume only a few KB of Linux OS socket memory. Rivet does **not** meter idle wall-clock duration (unlike Cloudflare Durable Objects charging $12.50/M GB-seconds).
* **Flat Node Inclusion:** Thousands of open, idle WebSockets live comfortably on a single standard node (e.g. R-5 at **$4.20 / ₹357 / mo**).
* **Only Pay for Actual Egress:** You only pay for bytes transmitted over the public internet: **$0.06 / GB (₹5.10 / GB)**, with **100 GB included free** every month.
* **Why This Matters for TAR:** Live state deltas are ~200 bytes each. The 100 GB free tier transmits **~500,000,000 collaborative updates/month**. Even with 10,000 merchant phones connected 24/7, idle WebSockets cost **₹0 extra**.

---

## 5. Concurrency & Sizing: 1,000 to 1,000,000 TAR Workspaces

### The Law of Concurrency ("Active at a Second")
* A database write in TAR (`tarfw.md`) takes **< 1 millisecond (0.69 ms)**.
* 1 CPU core processes **1,000 sales/second**. "Active at a second" means fingers tapping the screen to write during that specific 1,000 ms window—**99% of workspaces sleep at any given moment**.
* **1 Million retail shops** (averaging 100 sales/day each) generate **~2,800 to 5,000 sales/second during peak evening rush (6–8 PM)**.

### Sizing Scale & Sizing Table

| Total Workspaces | Real-World Peak Sales / Sec | Sizing & Recommended Server | Total Monthly Cost | Per-User Cost |
| :--- | :---: | :--- | :--- | :--- |
| **1,000 Shops** | ~3 – 5 / sec | 1 × R-5 (1 GB RAM) | **$4.20 (₹357)** | **₹0.36 / user** |
| **10,000 Shops** | ~30 – 50 / sec | 1 × R-10 (2 GB RAM) | **$8.40 (₹714)** | **₹0.07 / user** |
| **100,000 Shops** | ~300 – 500 / sec | 1 × R-40 (8 GB RAM) | **$27.30 (₹2,321)** | **₹0.02 / user** |
| **1,000,000 Shops** | ~3,000 – 5,000 / sec | 10 × R-160 Cluster (160 GB RAM / 80 vCPUs) | **$1,894.70 (₹1,61,050)** | **₹0.16 / user** *(16 paise)* |

### Itemized Bill for 1 Million Workspaces (Enterprise Cluster)
* **Cluster Base (Enterprise Control Plane + 10 × R-160 Nodes):** $1,845.00 (₹1,56,825.00)
* **Actor Storage (72 GB total − 10 GB free = 62 GB @ $0.25):** $15.50 (₹1,317.50)
* **Object Storage (500 GB total − 50 GB free = 450 GB @ $0.02):** $9.00 (₹765.00)
* **Egress (~520 GB total − 100 GB free = 420 GB @ $0.06):** $25.20 (₹2,142.00)
* **Total:** **$1,894.70 / month (₹1,61,050.00 / month)** $\rightarrow$ Handles peak load at only **5%–10% cluster capacity**.

---

## 6. Production Cost Comparison: Rivet Cloud vs. Cloudflare DO vs. Turso

### The Cloudflare DO Trap
Cloudflare DO charges **$12.50 per million GB-seconds** (128 MB per DO). When agents run continuous loops, background timers, or active collaboration sessions that prevent sleep, compute duration escalates rapidly into thousands of dollars. Rivet uses flat node pricing with **no per-second wake penalty**.

| Workload Scenario | Platform | Total Cost USD | Total Cost INR | Per-User / Workspace Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Small (500 Users)** <br>5 GB data, light traffic | **Rivet Cloud + R2** *(Hobby + 1 Node)* | **$14.20** | **₹1,207** | **$0.028 (₹2.41) / user** |
| | **Turso DB + Server** *($4.99 DB + $7 server)* | **$12.00** | **₹1,020** | **$0.024 (₹2.04) / user** |
| | **Cloudflare DO** *(Base + 970k GB-seconds)* | **$17.00** | **₹1,445** | **$0.034 (₹2.89) / user** |
| | | | | |
| **Medium (5,000 Users)** <br>100 GB data, 40M writes | **Rivet Cloud + R2** *(Hobby + 4GB Node + R2)* | **$28.15** | **₹2,393** | **$0.0056 (₹0.48) / user** *(48 paise)* |
| | **Turso DB + Server** *(Scaler + storage overage)* | **$87.00** | **₹7,395** | **$0.0174 (₹1.48) / user** |
| | **Cloudflare DO** *(Storage + 16.6M GB-seconds)* | **$232.00** | **₹19,720** | **$0.0464 (₹3.94) / user** |
| | | | | |
| **Scale (25,000 Users)** <br>1 TB data, 200M writes | **Rivet Cloud + R2** *(Team + 2 Nodes + 1 TB R2)* | **$189.60** | **₹16,116** | **$0.0076 (₹0.64) / user** *(64 paise)* |
| | **Turso DB + Server** *(Pro + storage/write overage)* | **$990.00** | **₹84,150** | **$0.0396 (₹3.37) / user** |
| | **Cloudflare DO** *(Duration + storage + write penalties)* | **$2,880.00** | **₹2,44,800** | **$0.1152 (₹9.79) / user** |

---

## 7. Self-Hosting Rivet & Cloudflare R2 Connection

### Top VPS Providers for Self-Hosting (BYON)

| Provider | Recommended Plan | Hardware Specs | Monthly Cost | Free Bandwidth | Best For |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **Hetzner** | **CX32** | 8 GB RAM / 4 vCPUs / 80 GB NVMe | **~€7 (₹630)** | **20,000 GB (20 TB)** | **#1 Value & Raw Speed:** Runs 100k+ workspaces for under ₹650/mo. |
| **DigitalOcean** | **Basic Droplet** | 4 GB RAM / 2 vCPUs / 80 GB SSD | **$24 (₹2,040)** | **4,000 GB (4 TB)** | **#1 India Latency:** Dedicated Bangalore (`BLR1`) data center (~15 ms ping). |
| **OVHcloud** | **VPS Comfort** | 8 GB RAM / 4 vCPUs / 100 GB SSD | **~€10 (₹900)** | **100% Unmetered** | **#1 Anti-DDoS:** Guaranteed unlimited traffic with zero overages. |

### Connecting Cloudflare R2 in Self-Host (`config.json`)
```json
{
  "object_storage": {
    "primary": {
      "s3": {
        "bucket": "my-tar-bucket",
        "endpoint": "https://<YOUR_ACCOUNT_ID>.r2.cloudflarestorage.com",
        "region": "auto",
        "access_key_id": "<YOUR_R2_ACCESS_KEY>",
        "secret_access_key": "<YOUR_R2_SECRET_KEY>"
      }
    }
  }
}
```

---

## 8. Direct Integration with TAR (`tarfw.md` & `paraiv2.md`)

```
CURRENT ARCHITECTURE (tarfw.md):
Canvas / Phone ──► API ──► Turso (Hosted DB) + R2 (Files) + CF Worker (Future WS)

WITH RIVET 3.0:
Canvas / Phone ──► Rivet Actor (Code + Local SQLite + WebSockets) ──► Cloudflare R2
```

### A. Core Platform Replacements
1. **Eliminates Cloudflare Worker (`tarharness`):** No separate API gateway or routing worker needed. The Rivet Actor directly handles HTTP endpoints, request routing, authentication, and WebSocket connections in one unified process.
2. **Replaces Turso DB:** Each workspace is one 72 KB Rivet Actor holding its own 10-table SQLite schema. Eliminates network hops to an external database (< 1 ms queries) and cuts recurring database bills.
3. **Replaces External Realtime Hubs:** Real-time synchronization between the merchant Canvas and the Ask agent is handled natively by the Actor over persistent, hibernating WebSockets with zero connection fees.
4. **Powers `paraiv2.md` Mode 2 (Custom Site Builder):** Provides the isolated ephemeral sandbox required to run coding agents, compile Astro sections, and run Playwright verification (`gate.ts`).
5. **Infinite Agent Memory for `Ask`:** All agent conversation turns, skills, and audit logs are safely preserved in R2 at $0.015/GB (₹1.28/GB) without database size limits.

### B. Cloudflare Worker (tarharness) vs. Rivet Actor Comparison

| Feature / Cost Metric | Cloudflare Worker + Turso (`tarharness`) | Rivet Actor (Unified All-in-One) |
| :--- | :--- | :--- |
| **API Gateway / Routing** | Workers Paid ($5.00/mo base + $0.30/M requests) | **$0.00** (Native HTTP routing in Actor Node) |
| **Database Tier (Turso)** | $4.99/mo base + row read/write/storage overages | **$0.00** (Local SQLite embedded on NVMe SSD) |
| **WebSockets (Real-time)** | Durable Objects ($12.50/M GB-s) or Pusher ($99/mo) | **$0.00** (Zero connection fee, 100 GB egress free) |
| **Database Latency** | 20 ms – 150 ms (remote network HTTP roundtrips) | **< 0.69 ms** (committed locally to NVMe SSD) |
| **Scheduled Tasks / Alarms** | Cloudflare Cron Triggers (external wake calls) | Built-in Actor alarms (`ctx.storage.setAlarm`) |
| **Architecture Complexity** | 3 separate moving parts (Worker + Turso DB + R2) | **1 single system** (`.ts` Actor + R2 cold store) |
| **Total Monthly Cost (5k users)** | **$92.00 – $237.00** (₹7,820 – ₹20,145) | **$8.40 – $28.15** (₹714 – ₹2,393) |

### C. Real-Time Collaboration (Team, Agents & Cross-Shop)
* **Single Shared Room:** Cashier (RN App), Owner (Web Dashboard), and AI Agent all connect to the **same Actor instance** over open WebSockets.
* **Instant Broadcast (< 1 ms):** When the cashier records a sale, the Actor commits in 0.69 ms and immediately pushes `sale_recorded` to the owner's screen and agent without polling.
* **Actor-to-Actor RPC:** When Shop A orders inventory from Supplier B, Actor A sends an internal message directly to Actor B in microseconds ($0 public network egress).

### D. Local-First Mobile Architecture (React Native App)
Matches TAR's core rule: *"taps wait in the local queue, replay in order"*.

| Connection State | What Happens on the Phone (React Native) | What Happens on Rivet Actor |
| :--- | :--- | :--- |
| **Online** | Instant UI update; sends action over WebSocket. | Actor receives action, writes to SQLite (< 1 ms), pushes to team. |
| **Offline (No Internet)** | Phone saves action to **local offline queue** (Phone SQLite). Instant checkmark, zero loading spinner. | Actor sleeps (0% CPU / 0 cost). |
| **Reconnecting** | RN app automatically replays queued actions with idempotency keys (`id`). | Actor wakes in 6.9 ms, applies actions sequentially, and saves to S3/R2. **Zero duplicate sales**. |

---

## 9. End-to-End Real World Example: Restaurant Food Order Lifecycle

### Scenario: *Madurai Bun Parotta Shop*
* **1 Restaurant Workspace = 1 Rivet Actor** (`madurai_parotta_actor`).
* **Inside this Actor:** The shop’s menu, active tables, kitchen queue, and its private SQLite ledger.

```
[ Table 4 (Customer QR) ] ──► (Taps: 2 Bun Parotta + 1 Salna)
                                    │
                                    ▼
                 ┌──────────────────────────────────────┐
                 │   Rivet Actor: "madurai_parotta"     │
                 │   • 0.69 ms write to local SQLite    │
                 │   • Sets 15-min kitchen timer        │
                 └──────────────────┬───────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
[ Kitchen Screen (Cook) ]                             [ Cashier POS / Owner ]
"BEEP: Table 4 — Cook Now!"                           "Live Sale Pending: ₹120"
(Instant WebSocket: < 1 ms)                           (Instant WebSocket: < 1 ms)
```

### Step-by-Step Order Flow

#### 1. Customer Orders (Table 4)
The customer scans the QR code on Table 4 and taps **"Order 2 Bun Parotta (₹120 / $1.41)"**.
* Sends a tiny ~200-byte message directly to the restaurant’s Rivet Actor.

#### 2. Actor Wakes & Commits in 0.69 ms
* The Actor wakes up in **6.9 ms** (if sleeping).
* Runs business rules: *Checks if Parotta dough is in stock*.
* Writes the order directly into its embedded SQLite table in **< 0.69 ms**.
* Because it writes locally to NVMe SSD, **there is zero network wait time** (no slow round-trip to an external database like Supabase or Turso).

#### 3. Instant Kitchen & Cashier Broadcast ($0 cost)
The Actor is holding persistent WebSockets with the devices in the shop:
* **Cook's Kitchen Tablet:** Instantly beeps with order ticket: `Table 4: 2 Bun Parotta`.
* **Owner / Cashier Phone:** Dashboard updates instantly with `Table 4: Unpaid - ₹120`.
* **Cost:** **$0.00 (₹0)** connection fee. Only ~200 bytes of data sent.

#### 4. The Built-in 15-Minute Kitchen Alarm
The Actor sets a background timer (`alarm: 15 minutes`):
* If the cook does **not** press *"Ready"* within 15 minutes, the Actor wakes up automatically and pushes an alert to the Owner's phone:  
  *⚠️ "Table 4 Parotta is taking longer than 15 minutes!"*
* No external cron service or Cloudflare scheduler required.

#### 5. Payment via UPI / QR
Customer scans the UPI QR code on their phone:
* Razorpay sends a webhook straight to the Actor's HTTP URL.
* The Actor marks the order `PAID` in SQLite, triggers the receipt printer, and sends a WhatsApp invoice to the customer.

#### 6. Hibernation (Zero Cost)
* The order is completed.
* The write is safely backed up to Cloudflare R2 in the background ($0 egress).
* The Actor immediately hibernates at **0% CPU and 0% RAM**. You pay **$0.00 / ₹0** while waiting for the next customer.

### Cost Breakdown for this Order

| Step | Resource Used | Cost (USD) | Cost (INR) |
| :--- | :--- | :---: | :---: |
| **Actor Wake & CPU** | ~0.69 ms loan from shared vCPU | **$0.00** | **₹0.00** |
| **WebSocket Connection** | 3 open screens (Phone, Kitchen, POS) | **$0.00** | **₹0.00** |
| **Network Egress** | ~600 bytes total (3 updates) | **$0.00** *(Under 100 GB free tier)* | **₹0.00** |
| **SQLite Storage** | 1 order row (~200 bytes) | **$0.00** *(Under 10 GB free tier)* | **₹0.00** |
| **Total Cost for this Order** | — | **$0.00** | **₹0.00** |

> **Summary:** Even if this restaurant processes **15,000 orders every month**, the entire shop runs on a single **$4.20 / mo (₹357 / mo)** R-5 Node—costing only **₹0.02 (2 paise)** per completed order!
