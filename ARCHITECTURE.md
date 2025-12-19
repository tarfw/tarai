# TARAI Architecture - Current Implementation

## 📁 Project Structure

```
tarai/
├── app/
│   ├── _layout.tsx              # Root layout (Stack navigation)
│   ├── index.tsx                # Entry point with initialization
│   └── marketplace.tsx          # Main marketplace UI
│
├── types/
│   └── listing.ts               # TypeScript types for listings
│
├── services/
│   ├── database/
│   │   └── schema.ts            # OP-SQLite local schema
│   ├── vectorStores/
│   │   └── listingVectorStore.ts # Vector embeddings (384D)
│   ├── demo/
│   │   └── sampleListings.ts    # Demo data for testing
│   └── listingService.ts        # Main service layer
│
├── constants/
│   └── theme.ts                 # App colors and theme
│
├── TARAI.md                     # Complete specification
├── SETUP.md                     # Detailed setup guide
├── QUICKSTART.md                # Quick start guide
└── ARCHITECTURE.md              # This file
```

---

## 🏗️ Architecture Overview

### Layer 1: UI (React Native)
```
app/marketplace.tsx
    ↓
[Search Bar] → [Suggestions] → [Listing Grid]
```

### Layer 2: Service Layer
```
services/listingService.ts
    ↓
- Cache operations
- Search operations
- History tracking
- Offline queue
```

### Layer 3: Data Layer
```
┌─────────────────────────────────────────┐
│ LOCAL (OP-SQLite)                       │
│  ├── mycache (user's listings)          │
│  ├── browsed (viewing history)          │
│  ├── searches (search history)          │
│  └── offlinequeue (pending sync)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ VECTOR STORE                             │
│  Name: tarai_listing_vectors            │
│  Model: all-MiniLM-L6-v2 (384D)        │
│  Purpose: Semantic search               │
└─────────────────────────────────────────┘
```

---

## 🎯 Current Status (Phase 1)

### ✅ Implemented

1. **Local AI & Vector Search**
   - all-MiniLM-L6-v2 embedding model (384D)
   - OP-SQLite with sqlite-vec extension
   - Semantic search for listings
   - Offline-first architecture

2. **Database Schema**
   - `mycache` - Cached listings
   - `browsed` - Browsing history
   - `searches` - Search queries
   - `offlinequeue` - Pending transactions

3. **Commerce Types**
   - 10 main types defined
   - Icons and labels
   - Category taxonomy

4. **Service Layer**
   - listingService with full API
   - Cache management
   - Vector search
   - Semantic suggestions
   - History tracking

5. **Demo Data**
   - 20 sample listings
   - Tamil names (Murugan, Karuppu, etc.)
   - All commerce types covered

6. **UI**
   - Marketplace screen
   - Search with suggestions
   - Listing grid display

### 🚧 Not Yet Implemented (Phase 2 & 3)

According to TARAI.md Day 2 & 3:

**Day 2: AI Interface**
- [ ] AI Chat Tab (Tab 2)
- [ ] Task System (Tab 1)
- [ ] Chat Messaging (Tab 3)
- [ ] VoltAgent conversation flows
- [ ] Multi-step booking workflows

**Day 3: Backend & Integration**
- [ ] Cloudflare Workers API
- [ ] VoltAgent multi-agent system
- [ ] InstantDB integration
- [ ] Turso for vectors (API only)
- [ ] Upstash Redis (agent memory)
- [ ] R2 image storage
- [ ] Payment integration (Stripe)

---

## 🗄️ Database Schema (Current)

### Local OP-SQLite Tables

All tables use **single-word columns**:

```sql
-- User's cached listings
CREATE TABLE mycache (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  thumbnail TEXT,
  cached INTEGER NOT NULL
);

-- Browsing history
CREATE TABLE browsed (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  seller TEXT NOT NULL,
  thumbnail TEXT,
  cached INTEGER NOT NULL
);

-- Search history
CREATE TABLE searches (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  created INTEGER NOT NULL
);

-- Offline transaction queue
CREATE TABLE offlinequeue (
  id TEXT PRIMARY KEY,
  transactiondata TEXT NOT NULL,
  status TEXT NOT NULL,
  retries INTEGER DEFAULT 0,
  created INTEGER NOT NULL,
  synced INTEGER
);
```

---

## 🤖 Vector Search Implementation

### Embedding Model
- **Name**: all-MiniLM-L6-v2
- **Dimensions**: 384
- **Provider**: react-native-executorch
- **Size**: ~25MB
- **Purpose**: Convert text to semantic vectors

### Search Flow
```
User Query: "book taxi"
    ↓
1. Generate embedding (384D vector)
    ↓
2. Query vector store (cosine similarity)
    ↓
3. Return top K results with similarity scores
    ↓
4. Map to cached listings
    ↓
5. Display results
```

### Listing Embedding
```typescript
// When adding listing
const searchText = `${type}: ${title}

${description}

Category: ${category}
Tags: ${tags}`;

const embedding = await generateEmbedding(searchText);
await vectorStore.add({ document: searchText, metadata: { listingId } });
```

---

## 📊 Commerce Type Taxonomy

### 10 Main Types

| Type | Icon | Examples |
|------|------|----------|
| physical_product | 📦 | Electronics, Fashion, Groceries |
| service | 🔧 | Plumbing, Electrical, Cleaning |
| booking | 📅 | Hotels, Restaurants, Salons |
| transportation | 🚗 | Taxi, Auto, Car Rental |
| food_delivery | 🍔 | Restaurants, Cloud Kitchens |
| event | 🎉 | Concerts, Shows, Workshops |
| educational | 📚 | Tutoring, Courses, Training |
| rental | 🏠 | Apartments, Equipment, Vehicles |
| digital_product | 💾 | Software, eBooks, Courses |
| recurring_service | 🔄 | Memberships, Subscriptions |

---

## 🔌 API Reference

### listingService

```typescript
// Cache operations
await listingService.cacheUserListings(listings);
const cached = await listingService.getCachedListings();
await listingService.clearCache();

// Search
const results = await listingService.searchListingsByText(
  query,
  { type: 'transportation' },  // optional filter
  20                           // limit
);

// Suggestions
const suggestions = await listingService.getSemanticSuggestions("tax");
// Returns: [{ text: "Taxi", type: "transportation", icon: "🚗" }]

// History
await listingService.addToBrowsed(listing);
const browsed = await listingService.getBrowsedListings(20);
const searches = await listingService.getSearchHistory(10);

// Offline queue
await listingService.addToOfflineQueue(transaction);
const queue = await listingService.getOfflineQueue();
await listingService.markQueueItemSynced(id);
```

---

## 🎨 UI Components (Current)

### Marketplace Screen
```
┌─────────────────────────────────────┐
│  🔍 [Search marketplace...]     ✕   │
├─────────────────────────────────────┤
│  Suggestions:                       │
│  [🚗 Taxi] [🍔 Food] [🔧 Service]  │
├─────────────────────────────────────┤
│  All Listings (20)                  │
│                                     │
│  ┌────────────┐  ┌────────────┐   │
│  │ 🚗         │  │ 🍔         │   │
│  │ Karuppu    │  │ Lakshmi    │   │
│  │ Taxi       │  │ Kitchen    │   │
│  │ ₹350       │  │ ₹90        │   │
│  └────────────┘  └────────────┘   │
│                                     │
│  ┌────────────┐  ┌────────────┐   │
│  │ 🔧         │  │ 📅         │   │
│  │ Selvam     │  │ Priya      │   │
│  │ Plumber    │  │ Salon      │   │
│  │ ₹500       │  │ ₹300       │   │
│  └────────────┘  └────────────┘   │
└─────────────────────────────────────┘
```

---

## 🚀 Next Steps

### Immediate (Ready to implement)

1. **Enable demo data** - Uncomment in `app/index.tsx`
2. **Test searches** - Try the semantic search
3. **Verify vector search** - Check similarity scores

### Phase 2: AI Interface (Day 2 from TARAI.md)

1. **Create 3-tab layout**
   ```
   [📋 Tasks] [🤖 AI] [💬 Chat]
   ```

2. **AI Tab**
   - Conversation interface
   - Message types (text, suggestions, cards)
   - Multi-step flows

3. **Tasks Tab**
   - Todo list for buyers
   - Todo list for sellers
   - Action buttons
   - Real-time updates

4. **Chat Tab**
   - Direct messaging
   - Order threads
   - Real-time chat

### Phase 3: Backend (Day 3 from TARAI.md)

1. **Cloudflare Workers**
   - Hono.js API
   - VoltAgent integration
   - Agent endpoints

2. **Databases**
   - InstantDB (hot data, auth, tasks)
   - Turso (vectors + metadata)
   - Upstash Redis (agent memory)
   - R2 (images, cold storage)

3. **Integrations**
   - Payment (Stripe/Razorpay)
   - Push notifications (Expo)
   - Email (Cloudflare)

---

## 📏 Design Principles

### 1. Offline-First
- Local vector search works without internet
- Queue transactions for later sync
- Cache user's listings locally

### 2. AI-First
- Semantic understanding, not keyword matching
- Natural language queries
- Smart suggestions

### 3. Simplicity
- Single-word column names
- Flat structure
- No over-engineering

### 4. Universal
- One platform for all commerce types
- Everyone is buyer + seller
- Unified interface

---

## 🔧 Tech Stack (Current)

### Mobile App
- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Navigation**: Expo Router
- **UI**: React Native core components

### Local AI
- **Embeddings**: all-MiniLM-L6-v2 (384D)
- **Library**: react-native-executorch
- **Vector DB**: OP-SQLite with sqlite-vec
- **RAG**: react-native-rag

### Data
- **Local DB**: OP-SQLite
- **Vector Store**: OPSQLiteVectorStore
- **Storage**: Expo FileSystem

---

## 📝 Naming Conventions

### Database Columns
**Single words only** (per TARAI.md spec):
- ✅ `userid` not `user_id`
- ✅ `created` not `created_at`
- ✅ `thumbnail` not `thumbnail_url`
- ✅ `cached` not `cached_at`

### File Structure
- `services/` - Business logic
- `types/` - TypeScript definitions
- `app/` - UI screens
- `constants/` - Config and theme

### Tamil Names
Demo data uses Tamil names:
- Murugan, Karuppu, Lakshmi, Selvi, Selvam, Karthik, Ravi, Priya

---

## 📚 Documentation

- **TARAI.md** - Complete specification and vision
- **SETUP.md** - Detailed setup and API reference
- **QUICKSTART.md** - 3-step quick start guide
- **ARCHITECTURE.md** - This file (current implementation)

---

## 🎯 Summary

**Current State**: Phase 1 Complete ✅
- Vector search working
- Local database setup
- Demo data ready
- Basic UI functional

**Next**: Phase 2 - AI Interface & Tasks
**After**: Phase 3 - Backend & Integration

The foundation for TARAI's AI-first universal commerce platform is solid and ready for the next phase!
