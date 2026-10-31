# Rivet 3.0 — Food, Restaurant & Delivery Architecture Reference

*(All currency calculations standardized at **$1.00 USD = ₹85.00 INR**)*

---

## 1. Architecture Overview: The 3 Core Data Layers

To handle millions of customers browsing food without crashing servers or paying thousands of dollars in cloud bills, data is separated into three distinct layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. STATIC CATALOG LAYER (Menus, Photos, Descriptions, Base Prices)     │
│    • Stored on Cloudflare R2 / Edge CDN.                               │
│    • Millions browse with 0 ms server compute and $0.00 (₹0) cost.     │
├────────────────────────────────────────────────────────────────────────┤
│ 2. DYNAMIC AVAILABILITY PULSE (Sold Out, Flash Discounts, Open/Close)  │
│    • Ultra-lightweight (30–60 bytes) overlay pushed via CDN or WS.     │
│    • Merged client-side on the phone in 1 millisecond.                 │
├────────────────────────────────────────────────────────────────────────┤
│ 3. TRANSACTIONAL ACTOR LAYER (Orders, KDS, Stock Locks, Live GPS, OTP) │
│    • Powered by isolated Rivet 3.0 Actors with local SQLite.           │
│    • 0.69 ms local NVMe writes; hibernates at 0% CPU / 0% RAM.         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Menu Catalog & Browsing Architecture (Millions at $0 Cost)

Casual window-shoppers account for **99% of app traffic**. Routing casual menu scrollers through active database connections or waking up Rivet Actors is an anti-pattern.

### The "Static Shell + Live Pulse" Pattern

```
                             [ 1,000,000 Window Shoppers ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                     │
           99.9% Traffic (Browsing Menus)             0.1% Traffic (Buying)
                        │                                     │
                        ▼                                     ▼
             [ Cloudflare R2 / CDN ]               [ Rivet Actor (SQLite) ]
             • Photos, descriptions, prices        • Atomic stock lock (< 0.69 ms)
             • Cached at edge data centers         • UPI payment webhook
             • 0 ms server compute                 • Kitchen & Rider WebSockets
             • Cost: $0.00 (₹0)                    • Hibernates when done
```

### The 2 Files Merged on the Customer's Phone

```
    STATIC CATALOG (R2 / CDN)                  DYNAMIC AVAILABILITY (Actor / Edge)
    File: `menu.json` (~15 KB)                 File: `live.json` (~60 bytes)
  ┌─────────────────────────────────┐        ┌──────────────────────────────────┐
  │ ID 101: Chicken Biryani (₹250)  │        │ "sold_out": [102, 105],          │
  │ ID 102: Mutton Biryani  (₹350)  │        │ "is_open": true,                 │
  │ ID 103: Parotta         (₹40)   │        │ "prep_time_mins": 25             │
  │ Cached globally for 7 days      │        │ Updated instantly on stock event │
  └────────────────┬────────────────┘        └─────────────────┬────────────────┘
                   │                                           │
                   └─────────────────────┬─────────────────────┘
                                         ▼
                             [ Customer Mobile App ]
                    • Merges both files on the phone in 1 ms
                    • Shows Mutton Biryani (102) as GREYED OUT ("Sold Out")
```

1. **Static Catalog (`menu.json`):** Contains dish names, photos, descriptions, categories, and prices (~15 KB). Cached on Cloudflare CDN edge nodes and the phone's local SQLite cache.
2. **Dynamic Overlay (`live.json`):** Contains only real-time flags (`sold_out: [102, 105]`, `is_open: true`) (~60 bytes).
3. **Client-Side Merge:** The phone app downloads the 60-byte payload, merges it over the cached menu, and greys out unavailable items in **< 1 ms**.

---

## 3. Product Updates & Real-Time Availability (Sold-Out Engine)

| Event | What Changes | Payload Size | Where It Updates | Speed to User | Compute Cost |
| :--- | :--- | :---: | :--- | :---: | :---: |
| **New Dish / Price Edit** | Full `menu.json` | ~15 KB | Cloudflare R2 CDN | < 150 ms | **$0.00 (₹0)** |
| **Dish Sold Out** | `live.json` overlay | ~60 bytes | CDN cache / WebSocket | < 1 ms | **$0.00 (₹0)** |
| **Restaurant Closes** | Toggle `is_open: false` | ~20 bytes | CDN cache / WebSocket | < 1 ms | **$0.00 (₹0)** |
| **Simultaneous Checkout Race** | Actor SQLite stock lock | In-memory | Local NVMe SSD | 0.69 ms | **$0.00 (₹0)** |

### How Product Edits Propagate (< 150 ms)
1. Restaurant owner updates *Chicken Biryani* from ₹250 ($2.94) to ₹280 ($3.29) on the merchant POS.
2. The Rivet Actor updates its internal SQLite table in **0.69 ms**.
3. In the background, the Actor writes the new `menu.json` to Cloudflare R2 ($0 upload / $0 egress).
4. Actor triggers Cloudflare's free Cache-Tag purge API. Within **150 ms**, edge servers worldwide serve the updated menu.

### How Live Availability Updates Work
* **While Browsing Listings:** The app reads the 60-byte `live.json` from Cloudflare edge cache (30-second TTL). 1,000,000 users reading 60 bytes consumes only 60 MB total bandwidth (~₹0.30 / $0.003).
* **While Inside Restaurant Screen:** The app maintains an open WebSocket to the Actor. When the cook taps *"Mutton Sold Out"*, the Actor broadcasts a 30-byte delta (`{"event": "stock_out", "id": 102}`) to all active viewing screens in **< 1 ms**.

### The Atomic Guard: Race Condition Prevention (< 0.69 ms)
If a customer on a slow 2G connection tries to purchase an item that just sold out:
1. Tap *"Add to Cart & Checkout"*.
2. Request hits the Actor's single-threaded in-memory queue.
3. Actor checks local SQLite: `stock = 0`.
4. The Actor safely declines in **0.69 ms**: *"Sorry! Someone just placed the last order for Mutton Biryani"*.
5. **Guarantee:** Deadlocks and negative inventory (`stock = -1`) are physically impossible.

---

## 4. Scenario 1: Dine-In & Takeaway Lifecycle (*Madurai Bun Parotta Shop*)

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

### Walkthrough Steps

1. **Customer Orders at Table 4:** Customer scans table QR and taps **"Order 2 Bun Parotta (₹120 / $1.41)"**. Sends a ~200-byte action to the shop's Rivet Actor.
2. **Actor Wakes & Commits in 0.69 ms:** Actor wakes in 6.9 ms (if asleep), runs business validation rules, and commits the order to local SQLite on NVMe SSD in **< 0.69 ms** with zero remote database network roundtrips.
3. **Instant KDS & POS Broadcast:** 
   * Cook's kitchen tablet beeps: `Table 4: 2 Bun Parotta`.
   * Cashier POS reflects: `Table 4: Unpaid - ₹120`.
   * Connections run over persistent WebSockets with **$0.00 connection fees**.
4. **15-Minute Kitchen Alarm:** The Actor registers an in-memory alarm (`ctx.storage.setAlarm`). If the cook has not tapped "Ready" in 15 minutes, the Actor wakes and pushes an alert to the manager: *⚠️ "Table 4 Parotta delayed beyond 15 mins"*.
5. **Payment via UPI:** Customer scans UPI QR code. Razorpay webhook hits the Actor. Actor marks the order `PAID` in SQLite, triggers receipt printing, and dispatches a WhatsApp bill.
6. **Hibernation:** Write backs up to Cloudflare R2 in background ($0 egress). Actor hibernates at **0% CPU / 0% RAM**.

### Per-Order Cost Breakdown

| Step | Resource Used | Cost (USD) | Cost (INR) |
| :--- | :--- | :---: | :---: |
| **Actor Wake & Write** | 0.69 ms borrowed vCPU | **$0.00** | **₹0.00** |
| **WebSocket Delivery** | 3 open connections (Table, Cook, POS) | **$0.00** | **₹0.00** |
| **Network Egress** | ~600 bytes total deltas | **$0.00** *(Under 100 GB free tier)* | **₹0.00** |
| **SQLite Storage** | 1 order row (~200 bytes) | **$0.00** *(Under 10 GB free tier)* | **₹0.00** |
| **Total Order Cost** | — | **$0.00** | **₹0.00** |

*A restaurant doing **15,000 orders/month** runs entirely on a single **$4.20 / mo (₹357 / mo)** R-5 Node, costing **₹0.02 (2 paise)** per completed order.*

---

## 5. Scenario 2: End-to-End Online Food Delivery Lifecycle

```
       [ Customer App ] ◄═══════════════════════════╗
     (Watches bike on live map)                     ║
                 ▲                                  ║ Live GPS Stream
                 │ Instant Sync (< 1 ms)            ║ (Every 3 sec, ~50 bytes)
                 ▼                                  ║
    ┌──────────────────────────────────────────┐    ║
    │     Rivet Actor: "order_deliv_8921"      │    ║
    │  • Tracks order state (Cooking ➔ En Route)│    ║
    │  • Calculates 200m geofence proximity     │    ║
    │  • Verifies OTP & executes payout        │    ║
    └──────────────────┬───────────────────────┘    ║
                       │                            ║
         ┌─────────────┴─────────────┐              ║
         ▼                           ▼              ▼
[ Restaurant Tablet ]       [ Delivery Rider Phone ]
"Food Packed ➔ Handover"     "Navigate to Customer (GPS on)"
```

### Complete Lifecycle: From App Open to Doorstep Delivery

#### Step 1: Browsing Restaurants & Menus (The Read Path)
* Customer opens app; list of restaurants and dish photos load from Cloudflare R2 / Edge CDN in **15 ms**.
* Restaurant Actors remain **100% asleep**. Zero database compute charges incurred.

#### Step 2: Live Stock Check & Cart Checkout
* Customer selects *Aasife Biryani*. App opens a WebSocket and receives `live.json`: *Only 2 Mutton Biryanis remaining*.
* Customer adds 1 Biryani (₹350 / $4.12) and taps "Pay".
* Actor validates stock in **0.69 ms**, deducts inventory, and accepts payment.

#### Step 3: Order Actor Spawn & Rider Assignment
* Rivet spins up an ephemeral Delivery Actor (`order_deliv_8921`) in **6.9 ms**.
* Restaurant tablet beeps: `Cook 1 Mutton Biryani`.
* Actor dispatches an internal RPC invitation to the nearest active rider: *“Delivery 1.2 km away. Payout: ₹50 ($0.59). Accept?”*
* Rider accepts on their mobile app.

#### Step 4: Kitchen Handover & High-Frequency GPS Tracking
* Kitchen taps *"Food Packed"*. Customer screen flips to: *"Food ready, Rider picked up"*.
* Rider rides for **25 minutes**. Rider phone streams GPS coordinates (`lat, lng, speed`) every 3 seconds to the Actor.
* The Actor relays the 50-byte coordinate update directly to the Customer's live map.
* **Cost Advantage:** Rivet has zero per-message charges and zero connection duration penalties. 500 GPS updates over 25 minutes cost **$0.00 / ₹0.00**.

#### Step 5: The 200-Meter Geofence Alarm
* Actor evaluates distance on each incoming GPS ping.
* When rider crosses within 200 meters of customer's house, the Actor fires an automated push:  
  *🚀 "Rider Karthik has arrived at your gate! Please share OTP: 4821"*.

#### Step 6: OTP Verification & Instant Settlement
1. Rider asks customer for OTP and types `4821`.
2. Actor verifies OTP in **0.69 ms** and records double-entry bookkeeping in SQLite:
   * **Restaurant Account:** +₹280 ($3.29)
   * **Rider Account:** +₹50 ($0.59)
   * **Platform Fee:** +₹20 ($0.24)
3. Full order log and GPS trail archive to Cloudflare R2 ($0 egress).
4. The ephemeral Delivery Actor terminates, freeing all memory.

### Delivery Cost Comparison: Traditional Cloud vs. Rivet 3.0

*(Based on a single 25-minute delivery trip with 500 live GPS coordinate pings)*

| Resource | Usage (25-Min Delivery) | AWS / Pusher / PubNub Cost | Rivet 3.0 Cost (USD & INR) |
| :--- | :--- | :---: | :---: |
| **Open WebSockets** | 3 devices open for 25 mins | ~$0.05 – $0.15 (connection-min fees) | **$0.00 (₹0)** *(Included in flat node)* |
| **GPS Message Stream** | 500 coordinate messages | ~$0.05 (Pusher charges per 1k msgs) | **$0.00 (₹0)** *(Zero message fees)* |
| **Active Duration** | 25 minutes wall-clock time | $0.024 (Cloudflare DO duration fee) | **$0.00 (₹0)** *(Borrows < 1 ms CPU)* |
| **Bandwidth (Egress)** | ~50 KB total delta payload | ~$0.001 | **$0.00 (₹0)** *(Within 100 GB free tier)* |
| **Total Cloud Fee per Trip** | — | **~$0.12 (₹10.20)** | **$0.00 (₹0.00)** |

---

## 6. Multi-Restaurant Franchise Scaling & Capacity Matrix

Rivet uses the **Blueprint vs. Instance** model. You write the food ordering and delivery TypeScript code **once**. When 10,000 restaurants join, Rivet creates 10,000 isolated SQLite databases pointing to the same 50 KB shared compiled code.

### Capacity & Server Sizing Matrix

| Restaurant Scale | Peak Orders / Sec | Recommended Rivet Server | Monthly Cloud Cost | Per-Order Infrastructure Cost |
| :--- | :---: | :--- | :--- | :---: |
| **10 Restaurants** | ~1 / sec | 1 × R-5 (1 GB RAM) | **$4.20 (₹357)** | **₹0.02 (2 paise)** |
| **100 Restaurants** | ~5 – 10 / sec | 1 × R-5 (1 GB RAM) | **$4.20 (₹357)** | **₹0.002 (0.2 paise)** |
| **1,000 Restaurants** | ~50 / sec | 1 × R-10 (2 GB RAM) | **$8.40 (₹714)** | **₹0.0004 (0.04 paise)** |
| **10,000 Restaurants** | ~500 / sec | 1 × R-40 (8 GB RAM) | **$27.30 (₹2,321)** | **₹0.0001 (0.01 paise)** |
| **100,000 Restaurants** | ~5,000 / sec | 10 × R-160 Enterprise Cluster | **$1,894.70 (₹1,61,050)** | **₹0.0008 (0.08 paise)** |

---

## 7. Direct Comparison: Cloudflare Worker + Central DB vs. Rivet 3.0

| Feature | Legacy Setup (Worker + Central DB + Pusher) | Rivet 3.0 + Cloudflare R2 |
| :--- | :--- | :--- |
| **Menu Browsing** | Hits read replicas or expensive Redis caches | **Static JSON on Cloudflare R2 ($0 compute, $0 egress)** |
| **Stock Lock Latency** | 40 ms – 150 ms (remote DB row locks) | **< 0.69 ms (in-memory queue + local NVMe SSD)** |
| **Deadlock Risk** | High during rush hours (`SQLITE_BUSY` / table locks) | **Zero (each restaurant has its own private SQLite)** |
| **GPS Streaming** | Expensive per-message charges on Pusher / PubNub | **$0.00 (flat node WebSockets, egress-only meter)** |
| **Kitchen Timers** | Requires external cron services / Cloudflare Cron | **Native Actor alarms (`ctx.storage.setAlarm`)** |
| **System Footprint** | 4 separate systems to manage & glue | **1 unified system (Actor + R2)** |
| **Monthly Cost (5,000 Users)** | **$92.00 – $237.00 (₹7,820 – ₹20,145)** | **$8.40 – $28.15 (₹714 – ₹2,393)** |
