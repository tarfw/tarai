// TARAI Commerce Listing Types
// Based on TARAI.md specification

export type CommerceType =
  | 'physical_product'
  | 'digital_product'
  | 'service'
  | 'recurring_service'
  | 'booking'
  | 'rental'
  | 'event'
  | 'food_delivery'
  | 'transportation'
  | 'educational';

export type ListingStatus = 'draft' | 'active' | 'paused' | 'sold';

export interface Listing {
  id: string;
  userid: string;

  // Core fields
  type: CommerceType;
  title: string;
  description: string;
  category: string;
  tags: string; // comma-separated

  // Pricing
  price: number;
  currency: string;

  // Location
  location: string;

  // Media
  images: string; // comma-separated URIs
  thumbnail: string;

  // Metadata
  status: ListingStatus;
  sales: number;
  rating: number;

  // Timestamps
  created: number;
  updated: number;

  // Client-side only (for search results)
  similarity?: number;
}

// For local cache
export interface CachedListing {
  id: string;
  title: string;
  type: CommerceType;
  price: number;
  thumbnail: string;
  cached: number;
}

// For browsing history
export interface BrowsedListing {
  id: string;
  title: string;
  type: CommerceType;
  price: number;
  seller: string;
  thumbnail: string;
  cached: number;
}

// Search query with embedding
export interface SearchQuery {
  id: string;
  query: string;
  created: number;
}
