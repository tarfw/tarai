// TARAI Listing Vector Store
// Using all-MiniLM-L6-v2 (384D) as per TARAI.md specification

import { RecursiveCharacterTextSplitter } from 'react-native-rag';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ExecuTorchEmbeddings } from '@react-native-rag/executorch';
import { ALL_MINILM_L6_V2 } from "react-native-executorch";

console.log("ALL_MINILM_L6_V2 config:", JSON.stringify(ALL_MINILM_L6_V2));

// Create embeddings instance with proper config
const embeddings = new ExecuTorchEmbeddings({
  modelSource: ALL_MINILM_L6_V2.modelSource,
  tokenizerSource: ALL_MINILM_L6_V2.tokenizerSource,
  onDownloadProgress: (progress) => {
    console.log("all-MiniLM-L6-v2 model download progress:", Math.round(progress * 100) + "%");
  }
});

// Vector store for commerce listings
export const listingVectorStore = new OPSQLiteVectorStore({
  name: "tarai_listing_vectors",
  embeddings: embeddings,
});

// Convert listing to searchable string
// Combines title, description, category, and tags for semantic search
export const listingToString = (listing: {
  title: string;
  description: string;
  category: string;
  tags: string;
  type: string;
}) => {
  return `${listing.type}: ${listing.title}

${listing.description}

Category: ${listing.category}
Tags: ${listing.tags}`;
};

// Text splitter for long descriptions
export const listingSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

// Helper to generate embedding for a query
export const generateQueryEmbedding = async (query: string): Promise<number[]> => {
  const embeddings = listingVectorStore.embeddings;
  if (!embeddings) {
    throw new Error('Embeddings not initialized');
  }

  // Generate embedding for the query
  const result = await embeddings.embedQuery(query);
  return Array.from(result);
};

// Commerce type categories for suggestion system
export const COMMERCE_CATEGORIES = {
  physical_product: {
    icon: '📦',
    label: 'Products',
    examples: ['Electronics', 'Fashion', 'Home & Living', 'Grocery', 'Books']
  },
  service: {
    icon: '🔧',
    label: 'Services',
    examples: ['Plumbing', 'Electrical', 'Cleaning', 'Repair', 'Painting']
  },
  booking: {
    icon: '📅',
    label: 'Bookings',
    examples: ['Hotels', 'Restaurants', 'Salon', 'Doctor', 'Gym']
  },
  transportation: {
    icon: '🚗',
    label: 'Transport',
    examples: ['Taxi', 'Auto', 'Bike Taxi', 'Car Rental', 'Moving']
  },
  food_delivery: {
    icon: '🍔',
    label: 'Food',
    examples: ['Restaurants', 'Cloud Kitchen', 'Homemade', 'Bakery', 'Groceries']
  },
  event: {
    icon: '🎉',
    label: 'Events',
    examples: ['Concerts', 'Shows', 'Sports', 'Workshops', 'Festivals']
  },
  educational: {
    icon: '📚',
    label: 'Education',
    examples: ['Tutoring', 'Courses', 'Training', 'Coaching', 'Classes']
  },
  rental: {
    icon: '🏠',
    label: 'Rentals',
    examples: ['Apartments', 'Equipment', 'Vehicles', 'Tools', 'Electronics']
  },
  digital_product: {
    icon: '💾',
    label: 'Digital',
    examples: ['Software', 'eBooks', 'Courses', 'Music', 'Templates']
  },
  recurring_service: {
    icon: '🔄',
    label: 'Subscriptions',
    examples: ['Memberships', 'SaaS', 'Meal Plans', 'Fitness', 'Streaming']
  },
};
