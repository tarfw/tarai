// TARAI Commerce Node Types
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

export type NodeStatus = 'draft' | 'active' | 'paused' | 'sold';

export interface Node {
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
  status: NodeStatus;
  sales: number;
  rating: number;

  // Timestamps
  created: number;
  updated: number;

  // Client-side only (for search results)
  similarity?: number;
}

// For local cache
export interface CachedNode {
  id: string;
  title: string;
  type: CommerceType;
  price: number;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
  thumbnail?: string;
  status?: string;
  cached: number;
}

// For browsing history
export interface BrowsedNode {
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
