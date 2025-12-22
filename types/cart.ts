// TARAI Universal Cart Types
// Supports all node types with flexible metadata

import type { CommerceType } from "./node";

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
  nodeId: string;
  nodeType: CommerceType;
  sellerId: string;
  title: string;
  price: number;
  quantity: number;
  thumbnail?: string;
  metadata: CartItemMetadata;
  added: number;
}

export interface CartItemInput {
  nodeId: string;
  nodeType: CommerceType;
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
