// Sample TARAI Listings for Testing
// Following Tamil names and realistic Indian commerce scenarios from TARAI.md

import type { CachedListing } from "@/types/listing";

export const SAMPLE_LISTINGS: CachedListing[] = [
  // Transportation - Taxis
  {
    id: "taxi_001",
    title: "Karuppu - Airport Taxi Service",
    type: "transportation",
    price: 350,
    thumbnail: "https://placeholder.com/taxi1.jpg",
    cached: Date.now()
  },
  {
    id: "taxi_002",
    title: "Selvam - City Cab (AC)",
    type: "transportation",
    price: 380,
    thumbnail: "https://placeholder.com/taxi2.jpg",
    cached: Date.now()
  },
  {
    id: "taxi_003",
    title: "Ravi - Luxury Car Service",
    type: "transportation",
    price: 500,
    thumbnail: "https://placeholder.com/taxi3.jpg",
    cached: Date.now()
  },

  // Food Delivery - Cloud Kitchens
  {
    id: "food_001",
    title: "Lakshmi's Kitchen - Homemade Idli Batter",
    type: "food_delivery",
    price: 90,
    thumbnail: "https://placeholder.com/food1.jpg",
    cached: Date.now()
  },
  {
    id: "food_002",
    title: "Selvi's Tiffin Service - Daily South Indian Meals",
    type: "food_delivery",
    price: 150,
    thumbnail: "https://placeholder.com/food2.jpg",
    cached: Date.now()
  },
  {
    id: "food_003",
    title: "Murugan Biryani - Chicken Biryani",
    type: "food_delivery",
    price: 250,
    thumbnail: "https://placeholder.com/food3.jpg",
    cached: Date.now()
  },

  // Services - Home Services
  {
    id: "service_001",
    title: "Selvam Plumbing - Pipe Repair & Installation",
    type: "service",
    price: 500,
    thumbnail: "https://placeholder.com/plumber.jpg",
    cached: Date.now()
  },
  {
    id: "service_002",
    title: "Karthik Electrician - Wiring & Repairs",
    type: "service",
    price: 600,
    thumbnail: "https://placeholder.com/electrician.jpg",
    cached: Date.now()
  },
  {
    id: "service_003",
    title: "Raja AC Service - Installation & Repair",
    type: "service",
    price: 800,
    thumbnail: "https://placeholder.com/ac.jpg",
    cached: Date.now()
  },

  // Bookings - Salons
  {
    id: "booking_001",
    title: "Priya Beauty Salon - Haircut & Styling",
    type: "booking",
    price: 300,
    thumbnail: "https://placeholder.com/salon1.jpg",
    cached: Date.now()
  },
  {
    id: "booking_002",
    title: "Lakshmi Spa - Full Body Massage",
    type: "booking",
    price: 1500,
    thumbnail: "https://placeholder.com/spa.jpg",
    cached: Date.now()
  },

  // Physical Products - Groceries
  {
    id: "product_001",
    title: "Murugan Stores - Fresh Vegetables",
    type: "physical_product",
    price: 50,
    thumbnail: "https://placeholder.com/vegetables.jpg",
    cached: Date.now()
  },
  {
    id: "product_002",
    title: "Selvi Organic Farm - Fresh Fruits",
    type: "physical_product",
    price: 100,
    thumbnail: "https://placeholder.com/fruits.jpg",
    cached: Date.now()
  },

  // Educational - Tutoring
  {
    id: "edu_001",
    title: "Karthik - Mathematics Tutoring (10th-12th)",
    type: "educational",
    price: 500,
    thumbnail: "https://placeholder.com/tutor1.jpg",
    cached: Date.now()
  },
  {
    id: "edu_002",
    title: "Priya - Spoken English Classes",
    type: "educational",
    price: 400,
    thumbnail: "https://placeholder.com/tutor2.jpg",
    cached: Date.now()
  },

  // Events - Concerts
  {
    id: "event_001",
    title: "AR Rahman Concert - Chennai",
    type: "event",
    price: 2000,
    thumbnail: "https://placeholder.com/concert.jpg",
    cached: Date.now()
  },
  {
    id: "event_002",
    title: "Stand-up Comedy Night",
    type: "event",
    price: 500,
    thumbnail: "https://placeholder.com/comedy.jpg",
    cached: Date.now()
  },

  // Rentals - Vehicles
  {
    id: "rental_001",
    title: "Karuppu - Self-Drive Car Rental",
    type: "rental",
    price: 1200,
    thumbnail: "https://placeholder.com/car-rental.jpg",
    cached: Date.now()
  },
  {
    id: "rental_002",
    title: "Ravi - Bike Rental (Activa)",
    type: "rental",
    price: 300,
    thumbnail: "https://placeholder.com/bike-rental.jpg",
    cached: Date.now()
  },

  // Digital Products
  {
    id: "digital_001",
    title: "Karthik - React Native Course",
    type: "digital_product",
    price: 2999,
    thumbnail: "https://placeholder.com/course1.jpg",
    cached: Date.now()
  },
];

// Test queries to demonstrate semantic search
export const TEST_QUERIES = [
  "Book taxi from airport",
  "Need plumber for leak",
  "Order food",
  "Haircut near me",
  "Math tutor for 10th",
  "Rent a car",
  "Buy vegetables",
  "Concert tickets",
  "Learn React Native",
  "AC repair service",
];

// Function to initialize demo data
export async function loadDemoListings() {
  try {
    const { listingService } = await import('../listingService');

    console.log('Loading demo listings...');

    // Check if already loaded
    const existing = await listingService.getCachedListings();
    console.log(`Existing cached listings: ${existing.length}`);

    if (existing.length >= SAMPLE_LISTINGS.length) {
      console.log('Demo listings already loaded, skipping...');
      return existing;
    }

    // Cache listings (vector store table is created during load in index.tsx)
    await listingService.cacheUserListings(SAMPLE_LISTINGS);

    // Verify data was saved
    const loaded = await listingService.getCachedListings();
    console.log(`After loading - cached listings: ${loaded.length}`);

    console.log(`Loaded ${SAMPLE_LISTINGS.length} demo listings`);
    console.log('Try searching with queries like:', TEST_QUERIES.slice(0, 3));

    return loaded;
  } catch (error) {
    console.error('Failed to load demo listings:', error);
    throw error;
  }
}
