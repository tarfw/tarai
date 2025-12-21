// TARAI Universal Cart Types
// Supports all listing types with flexible metadata

import type { CommerceType } from "./listing";

export interface CartItemMetadata {
  // Rental specific
  startDate?: number;
  endDate?: number;
  duration?: number;
  durationUnit?: "hours" | "days" | "weeks" | "months";

  // Service/Booking specific
  scheduledDate?: number;
  scheduledTime?: string;
  serviceOptions?: string[];

  // Event specific
  ticketCount?: number;
  ticketType?: string;

  // Product specific
  variant?: string;
  size?: string;
  color?: string;

  // Food delivery specific
  specialInstructions?: string;

  // Transportation specific
  pickupLocation?: string;
  dropoffLocation?: string;

  // Generic custom fields
  [key: string]: any;
}

export interface CartItem {
  id: string;
  listingId: string;
  listingType: CommerceType;
  sellerId: string;
  title: string;
  price: number;
  quantity: number;
  thumbnail?: string;
  metadata: CartItemMetadata;
  added: number;
}

export interface CartItemInput {
  listingId: string;
  listingType: CommerceType;
  sellerId: string;
  title: string;
  price: number;
  quantity?: number;
  thumbnail?: string;
  metadata?: CartItemMetadata;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  byType: Record<CommerceType, number>;
  bySeller: Record<string, { items: CartItem[]; subtotal: number }>;
}
