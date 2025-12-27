// TARAI Commerce Types
// 3-table schema: nodes, people, tasks

// ============================================
// NODE TYPES (18 total)
// ============================================

// Commerce Types (12) - Orderable entities
export type CommerceType =
  | 'product'      // Physical goods
  | 'digital'      // Digital goods
  | 'service'      // One-time service
  | 'subscription' // Recurring service
  | 'booking'      // Appointment slots
  | 'rental'       // Temporary usage
  | 'event'        // Ticketed events
  | 'food'         // Food delivery
  | 'transport'    // Ride/logistics
  | 'education'    // Learning
  | 'realestate'   // Property
  | 'healthcare';  // Medical

// Structural Types (6) - Supporting nodes
export type StructuralType =
  | 'variant'   // Product variation
  | 'inventory' // Stock tracking
  | 'store'     // Physical location
  | 'cart'      // Shopping cart item
  | 'order'     // Confirmed order
  | 'search';   // Search history

export type NodeType = CommerceType | StructuralType;

export type NodeStatus = 'active' | 'pending' | 'completed' | 'cancelled';

// Main node record (matches DB schema)
export interface NodeRecord {
  id: string;
  type: NodeType;
  title: string;
  parent?: string;        // FK to parent node
  data?: string;          // JSON for extras
  quantity: number;
  value: number;          // Price/cost
  location?: string;
  status: NodeStatus;
  created: number;
  updated: number;
  // Client-side only (set by semantic search)
  similarity?: number;
}

// Parsed node data by type
export interface ProductData {
  desc?: string;
  img?: string[];
  tags?: string;
  specs?: Record<string, string>;
}

export interface VariantData {
  color?: string;
  size?: string;
  sku?: string;
  [key: string]: string | undefined;
}

export interface OrderData {
  items?: { variantid: string; qty: number }[];
  total?: number;
  address?: string;
}

export interface FoodData {
  cuisine?: string;
  veg?: boolean;
  preptime?: number;
}

export interface BookingData {
  duration?: number;
  slots?: string[];
}

// ============================================
// PEOPLE TYPES
// ============================================

export type PersonRole =
  | 'seller'     // Product/service owner
  | 'buyer'      // Customer
  | 'staff'      // Employee
  | 'driver'     // Delivery person
  | 'host'       // Event organizer
  | 'cohost'     // Co-organizer
  | 'instructor' // Teacher/trainer
  | 'student'    // Learner
  | 'landlord'   // Property owner
  | 'tenant'     // Renter
  | 'doctor'     // Medical professional
  | 'patient'    // Customer (healthcare)
  | 'agent'      // Broker/agent
  | 'manager'    // Location manager
  | 'support';   // Customer support

export interface PeopleRecord {
  nodeid: string;
  personid: string;
  role: PersonRole;
}

// ============================================
// TASK TYPES (45 total)
// ============================================

// Universal Tasks (8)
export type UniversalTaskType =
  | 'pay'      // Make payment
  | 'confirm'  // Accept order
  | 'reject'   // Decline order
  | 'cancel'   // Cancel order
  | 'refund'   // Process refund
  | 'rate'     // Rate & review
  | 'support'  // Handle issue
  | 'notify';  // Send notification

// Product Tasks (6)
export type ProductTaskType =
  | 'pack'     // Pack items
  | 'ship'     // Hand to courier
  | 'pickup'   // Collect package
  | 'transit'  // In transit update
  | 'deliver'  // Complete delivery
  | 'receive'; // Confirm receipt

// Food Delivery Tasks (6)
export type FoodTaskType =
  | 'accept'   // Accept food order
  | 'prepare'  // Cook/prepare food
  | 'ready'    // Mark ready for pickup
  | 'collect'  // Pick up from restaurant
  | 'enroute'  // On the way
  | 'handover';// Deliver to customer

// Booking Tasks (5)
export type BookingTaskType =
  | 'schedule' // Set appointment time
  | 'remind'   // Send reminder
  | 'checkin'  // Mark arrival
  | 'serve'    // Provide service
  | 'complete';// Mark completed

// Service Tasks (4)
export type ServiceTaskType =
  | 'assign'   // Assign to staff
  | 'arrive'   // Reach location
  | 'perform'  // Do the work
  | 'verify';  // Verify completion

// Rental Tasks (6)
export type RentalTaskType =
  | 'reserve'  // Block inventory
  | 'use'      // Active rental period
  | 'return'   // Return item
  | 'inspect'  // Check condition
  | 'close';   // Complete rental (handover already in FoodTaskType)

// Event Tasks (5)
export type EventTaskType =
  | 'register' // RSVP/register
  | 'ticket'   // Issue ticket
  | 'admit'    // Check-in attendee
  | 'attend'   // Mark attendance
  | 'feedback';// Post-event feedback

// Transport Tasks (5)
export type TransportTaskType =
  | 'dispatch' // Assign vehicle
  | 'board'    // Start ride
  | 'travel'   // In transit
  | 'alight'   // End ride
  | 'settle';  // Final payment

export type TaskType =
  | UniversalTaskType
  | ProductTaskType
  | FoodTaskType
  | BookingTaskType
  | ServiceTaskType
  | RentalTaskType
  | EventTaskType
  | TransportTaskType;

export type TaskStatus = 'pending' | 'progress' | 'completed' | 'cancelled';

export interface TaskRecord {
  id: string;
  nodeid: string;         // FK to source order/node
  personid: string;       // Assigned person
  type: TaskType;
  title: string;
  status: TaskStatus;
  priority: number;       // 0=normal, 1=high, 2=urgent
  due?: number;           // Due timestamp
  data?: string;          // JSON for task-specific details
  created: number;
  updated: number;
  // Client-side only
  similarity?: number;    // Semantic search score
}

// Task data by type
export interface DeliveryTaskData {
  address?: string;
  contact?: string;
  otp?: string;
  instructions?: string;
}

export interface PrepareTaskData {
  items?: string[];
  special?: string;
}

export interface BookingTaskData {
  slot?: string;
  service?: string;
  room?: string;
}

export interface PaymentTaskData {
  amount?: number;
  method?: string;
  due?: number;
}

// ============================================
// COMMERCE CATEGORIES (for UI)
// ============================================

export const COMMERCE_TYPES: CommerceType[] = [
  'product', 'digital', 'service', 'subscription',
  'booking', 'rental', 'event', 'food',
  'transport', 'education', 'realestate', 'healthcare'
];

export const STRUCTURAL_TYPES: StructuralType[] = [
  'variant', 'inventory', 'store', 'cart', 'order', 'search'
];

export const PERSON_ROLES: PersonRole[] = [
  'seller', 'buyer', 'staff', 'driver', 'host', 'cohost',
  'instructor', 'student', 'landlord', 'tenant',
  'doctor', 'patient', 'agent', 'manager', 'support'
];

// ============================================
// LEGACY EXPORTS (for compatibility)
// ============================================

export type Node = NodeRecord;
export type CachedNode = NodeRecord;
export interface BrowsedNode {
  id: string;
  title: string;
  type: NodeType;
  price: number;
  seller: string;
  thumbnail: string;
  cached: number;
}
export interface SearchQuery {
  id: string;
  query: string;
  created: number;
}
