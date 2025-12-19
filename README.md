# 🤖 TARAI - Universal Commerce AI Agent Platform

**The World's First AI-Agent Driven Universal Commerce System**

A React Native marketplace platform with on-device AI-powered semantic search for universal commerce.

---

## ✨ Features (Phase 1)

- 🔍 **Semantic Search** - Understands "book taxi" not just keywords
- 🤖 **Local AI** - all-MiniLM-L6-v2 embeddings (384D) on-device
- 📦 **Universal Commerce** - 10 commerce types in one platform
- 💾 **Offline-First** - Vector search works without internet
- 🎯 **Smart Suggestions** - Context-aware autocomplete
- 📊 **OP-SQLite** - Local database with vector extensions

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
yarn install
# or
npm install
```

### 2. Enable Demo Data (Optional)
Uncomment in `app/index.tsx` (around line 24):
```typescript
const { loadDemoListings } = await import("@/services/demo/sampleListings");
setLoadingStatus("Loading demo listings...");
await loadDemoListings();
```

### 3. Run the App
```bash
yarn start
# or npm start

# For Android
yarn android

# For iOS
yarn ios
```

### 4. Try Semantic Search
- "book taxi" → Finds Karuppu, Selvam, Ravi's taxis
- "order food" → Finds Lakshmi Kitchen, Selvi Tiffin
- "need plumber" → Finds Selvam Plumbing
- "haircut" → Finds Priya Salon

---

## 📚 Documentation

- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 3 steps
- **[COMMANDS.md](COMMANDS.md)** - All commands reference
- **[TARAI.md](TARAI.md)** - Complete specification (2700+ lines)
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Current implementation
- **[SETUP.md](SETUP.md)** - Detailed API reference
- **[CHANGES.md](CHANGES.md)** - What changed from notes app

---

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   React Native App (Expo)          │
│   ├── Marketplace UI                │
│   ├── Semantic Search               │
│   └── Smart Suggestions             │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Listing Service                   │
│   ├── Cache Management              │
│   ├── Vector Search                 │
│   ├── History Tracking              │
│   └── Offline Queue                 │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   OP-SQLite + Vector Store          │
│   ├── mycache (listings)            │
│   ├── browsed (history)             │
│   ├── searches (queries)            │
│   ├── offlinequeue (pending)        │
│   └── tarai_listing_vectors (384D)  │
└─────────────────────────────────────┘
```

---

## 🎯 Commerce Types Supported

1. 📦 **Physical Products** - Electronics, Fashion, Groceries
2. 🔧 **Services** - Plumbing, Electrical, Cleaning
3. 📅 **Bookings** - Hotels, Restaurants, Salons
4. 🚗 **Transportation** - Taxi, Auto, Car Rental
5. 🍔 **Food Delivery** - Restaurants, Cloud Kitchens
6. 🎉 **Events** - Concerts, Shows, Workshops
7. 📚 **Educational** - Tutoring, Courses, Training
8. 🏠 **Rentals** - Apartments, Equipment, Vehicles
9. 💾 **Digital Products** - Software, eBooks, Courses
10. 🔄 **Subscriptions** - Memberships, SaaS

---

## 📊 Tech Stack

### Mobile
- **Framework**: Expo (React Native)
- **Language**: TypeScript
- **Navigation**: Expo Router

### AI & Data
- **Embeddings**: all-MiniLM-L6-v2 (384D)
- **Vector DB**: OP-SQLite with sqlite-vec
- **RAG**: react-native-rag
- **Inference**: react-native-executorch

---

## 🧪 Demo Data

Includes 20 sample listings:
- 3 Taxi services (Karuppu, Selvam, Ravi)
- 3 Food delivery (Lakshmi, Selvi, Murugan)
- 3 Home services (Plumbing, Electrical, AC)
- 2 Salons & Spas (Priya, Lakshmi)
- 2 Groceries (Murugan, Selvi)
- 2 Education (Karthik, Priya)
- 2 Events (Concerts, Comedy)
- 2 Rentals (Car, Bike)
- 1 Digital product (Course)

---

## 📱 Current UI

```
┌─────────────────────────────────────┐
│  🔍 [Search marketplace...]         │
├─────────────────────────────────────┤
│  Suggestions:                       │
│  [🚗 Taxi] [🍔 Food] [🔧 Services] │
├─────────────────────────────────────┤
│  All Listings (20)                  │
│                                     │
│  ┌────────────┐  ┌────────────┐   │
│  │ 🚗         │  │ 🍔         │   │
│  │ Karuppu    │  │ Lakshmi    │   │
│  │ Taxi       │  │ Kitchen    │   │
│  │ ₹350       │  │ ₹90        │   │
│  └────────────┘  └────────────┘   │
└─────────────────────────────────────┘
```

---

## 🔬 How Semantic Search Works

```typescript
// 1. User types query
"book taxi from airport"

// 2. Generate embedding (384D vector)
const embedding = await generateEmbedding(query);

// 3. Search vector store
const results = await listingVectorStore.query({
  queryText: query,
  k: 20
});

// 4. Results ranked by similarity
[
  { listingId: "taxi_001", similarity: 0.92 },  // Karuppu Taxi
  { listingId: "taxi_002", similarity: 0.89 },  // Selvam Cab
  { listingId: "taxi_003", similarity: 0.85 }   // Ravi Luxury
]
```

---

## 🚧 Roadmap

### ✅ Phase 1: Foundation (Complete)
- Local AI & vector search
- Database schema
- Marketplace UI
- Demo data

### 🚧 Phase 2: AI Interface (Next)
- AI Chat Tab
- Task System Tab
- Chat Messaging Tab
- VoltAgent integration

### 📋 Phase 3: Backend
- Cloudflare Workers API
- InstantDB (hot data)
- Turso (vectors)
- Upstash Redis (memory)
- R2 (storage)
- Payment integration

---

## 📖 API Reference

### listingService

```typescript
// Search
const results = await listingService.searchListingsByText(
  "book taxi",
  { type: "transportation" },
  20
);

// Suggestions
const suggestions = await listingService.getSemanticSuggestions("tax");

// Cache
await listingService.cacheUserListings(listings);
const cached = await listingService.getCachedListings();

// History
const browsed = await listingService.getBrowsedListings(20);
const searches = await listingService.getSearchHistory(10);
```

---

## 🎓 Learn More

### Original Blog Posts (Notes App)
- [Part 1: Text Semantic Search](https://blog.swmansion.com/building-an-ai-note-taking-app-with-react-native-executorch-and-rag-3f3c94a2f92b)
- [Part 2: Image Semantic Search](https://blog.swmansion.com/building-an-ai-powered-note-taking-app-in-react-native-part-2-image-semantic-search-0456895cdf17)
- [Part 3: Local RAG](https://blog.swmansion.com/building-an-ai-powered-note-taking-app-in-react-native-part-3-local-rag-868ba75f818b)

### Resources
- [React Native ExecuTorch](https://github.com/software-mansion/react-native-executorch)
- [React Native RAG](https://github.com/software-mansion-labs/react-native-rag)
- [OP-SQLite](https://github.com/OP-Engineering/op-sqlite)

---

## 🤝 Contributing

This is the Phase 1 implementation of TARAI. See `TARAI.md` for the complete vision.

---

## 📄 License

MIT

---

## 🎉 Status

**Phase 1: ✅ Complete**
- Vector search working
- Local database setup
- Demo data ready
- Basic UI functional

**Next**: Phase 2 - AI Chat Interface & Task System

---

Built with ❤️ using React Native, Expo, and on-device AI
