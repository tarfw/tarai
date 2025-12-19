# TARAI Setup Documentation

## 🎯 What Changed

The app has been transitioned from a notes application to the **TARAI Universal Commerce Platform** as specified in `TARAI.md`.

### Key Changes

1. **Vector Store**: Changed from `notes_vector_store` to `tarai_listing_vectors`
2. **Database Schema**: New local OP-SQLite tables for commerce listings
3. **Types**: New TypeScript types for listings, not notes
4. **Service Layer**: `listingService` replaces `notesService`
5. **UI**: `marketplace.tsx` replaces `notes.tsx`

---

## 📁 New File Structure

```
tarai/
├── types/
│   └── listing.ts                    # Commerce listing types
├── services/
│   ├── database/
│   │   └── schema.ts                 # Local database schema
│   ├── vectorStores/
│   │   ├── listingVectorStore.ts    # Vector store for listings
│   │   ├── textVectorStore.ts       # (old - can keep for reference)
│   │   └── imageVectorStore.ts      # (old - can remove if not needed)
│   ├── demo/
│   │   └── sampleListings.ts        # Demo data for testing
│   └── listingService.ts            # Main listing service
├── app/
│   ├── index.tsx                     # Updated entry point
│   └── marketplace.tsx               # Main marketplace UI
└── TARAI.md                          # Full specification
```

---

## 🗄️ Database Schema

### Local OP-SQLite Tables

All tables use **single-word column names** as per TARAI spec:

#### 1. `mycache` - User's Cached Listings
```sql
CREATE TABLE mycache (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,        -- commerce type
  price REAL NOT NULL,
  thumbnail TEXT,
  cached INTEGER NOT NULL    -- timestamp
);
```

#### 2. `browsed` - Recently Viewed Listings
```sql
CREATE TABLE browsed (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  price REAL NOT NULL,
  seller TEXT NOT NULL,
  thumbnail TEXT,
  cached INTEGER NOT NULL
);
```

#### 3. `searches` - Search History
```sql
CREATE TABLE searches (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  created INTEGER NOT NULL
);
```

#### 4. `offlinequeue` - Offline Transaction Queue
```sql
CREATE TABLE offlinequeue (
  id TEXT PRIMARY KEY,
  transactiondata TEXT NOT NULL,  -- JSON
  status TEXT NOT NULL,
  retries INTEGER DEFAULT 0,
  created INTEGER NOT NULL,
  synced INTEGER
);
```

---

## 🤖 Vector Search Setup

### Embedding Model
- **Model**: `all-MiniLM-L6-v2`
- **Dimensions**: 384D
- **Purpose**: Semantic search for marketplace listings

### How It Works

1. **Listing Creation**: When a listing is created, its text is converted to embeddings
   ```typescript
   const searchText = `${type}: ${title}\n\n${description}\n\nCategory: ${category}`;
   const embedding = await generateEmbedding(searchText);
   ```

2. **Search Query**: User's query is converted to embedding and matched
   ```typescript
   const results = await listingVectorStore.query({
     queryText: "book taxi from airport",
     k: 20
   });
   ```

3. **Similarity**: Cosine similarity is used to rank results

---

## 🎨 Commerce Types

The platform supports 10 main commerce types:

1. **physical_product** 📦 - Electronics, Fashion, Groceries, etc.
2. **service** 🔧 - Plumbing, Electrical, Cleaning, etc.
3. **booking** 📅 - Hotels, Restaurants, Salons, Doctors
4. **transportation** 🚗 - Taxis, Auto, Rentals, Moving
5. **food_delivery** 🍔 - Restaurants, Cloud Kitchens, Homemade
6. **event** 🎉 - Concerts, Shows, Sports, Workshops
7. **educational** 📚 - Tutoring, Courses, Training
8. **rental** 🏠 - Apartments, Equipment, Vehicles
9. **digital_product** 💾 - Software, eBooks, Courses
10. **recurring_service** 🔄 - Memberships, Subscriptions

---

## 🧪 Testing with Demo Data

### Option 1: Load Demo Listings on Startup

Uncomment these lines in `app/index.tsx`:

```typescript
const { loadDemoListings } = await import("@/services/demo/sampleListings");
setLoadingStatus("Loading demo listings...");
await loadDemoListings();
```

### Option 2: Load Demo Data Manually

```typescript
import { loadDemoListings } from "@/services/demo/sampleListings";

// In your component or test
await loadDemoListings();
```

This will load 20+ sample listings including:
- 3 Taxi services (Karuppu, Selvam, Ravi)
- 3 Food delivery (Lakshmi, Selvi, Murugan)
- 3 Home services (Plumber, Electrician, AC)
- 2 Salons & Spas
- Educational tutoring
- Events & concerts
- Vehicle rentals
- Digital products

---

## 🔍 Using the Search

### Text Search Examples

```typescript
// Search for taxi
const results = await listingService.searchListingsByText("book taxi");

// Search for plumber
const results = await listingService.searchListingsByText("need plumber");

// Search for food
const results = await listingService.searchListingsByText("order biryani");
```

### Semantic Suggestions

```typescript
// Get suggestions as user types
const suggestions = await listingService.getSemanticSuggestions("tax");
// Returns: [{ text: "Taxi", type: "transportation", icon: "🚗" }, ...]
```

### Filter by Commerce Type

```typescript
const results = await listingService.searchListingsByText(
  "book",
  { type: "transportation" }  // Only show transportation
);
```

---

## 📊 API Reference

### `listingService`

#### Cache Operations
```typescript
// Cache user's listings
await listingService.cacheUserListings(listings);

// Get cached listings
const cached = await listingService.getCachedListings();

// Clear cache
await listingService.clearCache();
```

#### Browsing History
```typescript
// Add to browsed
await listingService.addToBrowsed({
  id: "taxi_001",
  title: "Karuppu Taxi",
  type: "transportation",
  price: 350,
  seller: "Karuppu",
  thumbnail: "...",
  cached: Date.now()
});

// Get browsed listings
const browsed = await listingService.getBrowsedListings(20);
```

#### Search Operations
```typescript
// Vector search
const results = await listingService.searchListingsByText(
  "book taxi from airport",
  { type: "transportation" },  // optional filter
  20                           // limit
);

// Get semantic suggestions
const suggestions = await listingService.getSemanticSuggestions("tax");

// Get search history
const history = await listingService.getSearchHistory(10);
```

#### Offline Queue
```typescript
// Add transaction to offline queue
await listingService.addToOfflineQueue({
  type: "booking",
  listingId: "taxi_001",
  amount: 350
});

// Get pending transactions
const queue = await listingService.getOfflineQueue();

// Mark as synced
await listingService.markQueueItemSynced("tx_id");
```

---

## 🚀 Next Steps

As per TARAI.md implementation plan:

### Day 1: Foundation ✅
- [x] Setup OP-SQLite with vector support
- [x] Create database schemas
- [x] Setup all-MiniLM-L6-v2 embeddings
- [x] Implement vector search

### Day 2: AI Interface (Next)
- [ ] Build AI chat interface (Tab 2)
- [ ] Implement semantic suggestions
- [ ] Create task system (Tab 1)
- [ ] Build chat messaging (Tab 3)

### Day 3: Full Platform
- [ ] Listing creation UI
- [ ] Image upload to R2
- [ ] Payment integration
- [ ] Deploy backend (Cloudflare Workers)
- [ ] VoltAgent integration

---

## 🔧 Development Commands

```bash
# Install dependencies
yarn install
# or npm install

# Start development server
yarn start
# or npm start

# Run on Android
yarn android
# or npm run android

# Run on iOS
yarn ios
# or npm run ios

# Clear cache and restart
yarn start --clear
# or npm start -- --clear
```

---

## 📝 Notes

### Single-Word Columns
All database columns use single words (no underscores) as per TARAI spec:
- `userid` not `user_id`
- `created` not `created_at`
- `thumbnail` not `thumbnail_url`

### Tamil Names
Demo data uses Tamil names as per specification:
- Murugan, Karuppu, Lakshmi, Selvi, Selvam, Karthik, Ravi, Priya

### Vector Store Name
- Changed from: `notes_vector_store`
- Changed to: `tarai_listing_vectors`

---

## ❓ Troubleshooting

### "Vector stores failed to load"
- Ensure device has internet for first-time model download
- Model size: ~25MB for all-MiniLM-L6-v2
- Check storage permissions

### "No listings showing"
- Uncomment `loadDemoListings()` in `app/index.tsx`
- Or manually add listings using the service

### "Search not working"
- Verify vector store loaded: check console for "model loading progress"
- Ensure database initialized: check for "TARAI local database initialized"
- Try clearing app data and restarting

---

## 📚 References

- Full specification: `TARAI.md`
- Vector search: `services/vectorStores/listingVectorStore.ts`
- Database schema: `services/database/schema.ts`
- Main service: `services/listingService.ts`
- Demo data: `services/demo/sampleListings.ts`
