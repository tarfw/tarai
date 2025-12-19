# TARAI Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Enable Demo Data

Edit `app/index.tsx` and uncomment these lines (around line 23-26):

```typescript
// Uncomment these lines:
const { loadDemoListings } = await import("@/services/demo/sampleListings");
setLoadingStatus("Loading demo listings...");
await loadDemoListings();
```

### Step 2: Run the App

```bash
# Start development server
yarn start
# or npm start

# Or run directly on device
yarn android  # For Android
yarn ios      # For iOS
```

Or press:
- `a` for Android
- `i` for iOS
- Or scan QR code with Expo Go

### Step 3: Try Semantic Search

In the marketplace screen, try searching for:
- "book taxi" → Shows Karuppu, Selvam, Ravi's taxis
- "order food" → Shows Lakshmi, Selvi, Murugan's food
- "need plumber" → Shows Selvam's plumbing service
- "haircut" → Shows Priya's salon
- "math tutor" → Shows Karthik's tutoring

---

## ✨ What You'll See

### 1. Loading Screen
```
Loading AI model...
Initializing database...
Setting up vector search...
Loading demo listings...
Ready!
```

### 2. Marketplace Screen
- Search bar at top
- Semantic suggestions as you type
- Grid of listings
- Each card shows: icon, title, price, type

### 3. Semantic Suggestions
As you type, you'll see chips like:
```
🚗 Taxi   🍔 Food   🔧 Services   📅 Bookings
```

---

## 🧪 Test Queries

Copy these into the search bar:

### Transportation
- "taxi from airport"
- "need a ride"
- "book cab"
- "rent a car"

### Services
- "plumber for leak"
- "electrician needed"
- "ac repair"
- "fix my pipe"

### Food
- "order biryani"
- "homemade food"
- "breakfast delivery"
- "idli batter"

### Bookings
- "salon near me"
- "massage spa"
- "haircut appointment"

### Education
- "math tutor"
- "learn english"
- "10th grade help"

### Events
- "concert tickets"
- "comedy show"

---

## 📊 Sample Data Overview

The demo includes **20 listings**:

| Category | Count | Examples |
|----------|-------|----------|
| Transportation | 3 | Karuppu Taxi, Selvam Cab, Ravi Luxury |
| Food Delivery | 3 | Lakshmi Kitchen, Selvi Tiffin, Murugan Biryani |
| Services | 3 | Selvam Plumber, Karthik Electrician, Raja AC |
| Bookings | 2 | Priya Salon, Lakshmi Spa |
| Products | 2 | Murugan Vegetables, Selvi Fruits |
| Education | 2 | Karthik Math, Priya English |
| Events | 2 | AR Rahman Concert, Comedy Night |
| Rentals | 2 | Car Rental, Bike Rental |
| Digital | 1 | React Native Course |

---

## 🔍 How Semantic Search Works

### Example: "book taxi"

1. **User types**: "book taxi"
2. **Embedding generated**: 384D vector
3. **Vector search**: Finds similar listings
4. **Results ranked** by similarity:
   - Karuppu Taxi (0.92 similarity)
   - Selvam Cab (0.89 similarity)
   - Ravi Luxury Car (0.85 similarity)

### Why It's Smart

Traditional keyword search would miss:
- "need a ride" → doesn't contain "taxi" but finds taxis
- "going to airport" → understands context
- "emergency plumber" → finds plumbing services

Vector search understands **meaning**, not just keywords!

---

## 🎯 Next: Add Your Own Listings

### Create a Listing

```typescript
import { listingService } from "@/services/listingService";

// Add your listing
await listingService.cacheUserListings([
  {
    id: "my_service_001",
    title: "Your Service Name",
    type: "service",
    price: 500,
    thumbnail: "url_to_image",
    cached: Date.now()
  }
]);
```

### Commerce Types

Choose from these types:
- `physical_product` - Sell goods
- `service` - Offer services
- `booking` - Appointments
- `transportation` - Rides, moving
- `food_delivery` - Food, groceries
- `event` - Tickets, shows
- `educational` - Courses, tutoring
- `rental` - Rent equipment, spaces
- `digital_product` - Software, courses
- `recurring_service` - Subscriptions

---

## 📱 App Structure (Current)

```
┌─────────────────────────────┐
│   TARAI Marketplace         │
│                             │
│  🔍 [Search bar]            │
│                             │
│  Suggestions:               │
│  [🚗 Taxi] [🍔 Food]       │
│                             │
│  All Listings (20)          │
│  ┌──────┐  ┌──────┐        │
│  │Taxi  │  │Food  │        │
│  │₹350  │  │₹90   │        │
│  └──────┘  └──────┘        │
│  ┌──────┐  ┌──────┐        │
│  │...   │  │...   │        │
│  └──────┘  └──────┘        │
└─────────────────────────────┘
```

---

## 📚 Learn More

- **Full Spec**: Read `TARAI.md` for complete vision
- **Setup Guide**: See `SETUP.md` for detailed docs
- **Code**:
  - Types: `types/listing.ts`
  - Service: `services/listingService.ts`
  - Vector Store: `services/vectorStores/listingVectorStore.ts`
  - UI: `app/marketplace.tsx`

---

## 🐛 Common Issues

### "No listings showing"
→ Uncomment `loadDemoListings()` in `app/index.tsx`

### "Search returns nothing"
→ Wait for "Ready!" message (AI model needs to load first)

### "App stuck on loading screen"
→ Check internet connection (first-time model download ~25MB)

---

## 🎉 You're Ready!

The foundation is set for TARAI's AI-first commerce platform:
- ✅ Vector search working
- ✅ Semantic understanding
- ✅ Local database
- ✅ Commerce types defined

Next steps from TARAI.md:
1. Build AI chat interface (Tab 2)
2. Add task system (Tab 1)
3. Implement messaging (Tab 3)
4. Connect to backend (Cloudflare Workers)

Happy building! 🚀
