// TARAI Universal Cart Service
// Handles cart operations with OPSQLite persistence

import type { CartItem, CartItemInput, CartItemMetadata, CartSummary } from "@/types/cart";
import type { CommerceType } from "@/types/node";
import { open } from "@op-engineering/op-sqlite";

// Use same database instance as nodeService
const db = open({
  name: "tarai.db",
  location: "default"
});

// ========== PRICE CALCULATION ==========

export function calculateItemTotal(item: CartItem): number {
  const { price, quantity, nodeType, metadata } = item;

  switch (nodeType) {
    case "rental":
      // Price per duration unit
      const duration = metadata.duration || 1;
      return price * duration * quantity;

    case "booking":
    case "event":
      // Price per ticket/person
      const tickets = metadata.ticketCount || quantity;
      return price * tickets;

    case "service":
    case "recurring_service":
      // Base price + any service options could add to this
      return price * quantity;

    case "transportation":
      // Flat price per trip
      return price * quantity;

    case "food_delivery":
      // Price per item
      return price * quantity;

    default:
      // physical_product, digital_product, educational
      return price * quantity;
  }
}

// ========== CART CRUD OPERATIONS ==========

export async function addToCart(input: CartItemInput): Promise<string> {
  try {
    // Check if item already exists in cart
    const existing = await db.execute(
      "SELECT * FROM cart WHERE nodeid = ?",
      [input.nodeId]
    );

    const rows = existing.rows?._array || existing.rows || [];
    const existingRows = Array.isArray(rows) ? rows : [];

    if (existingRows.length > 0) {
      // Update quantity instead of adding duplicate
      const existingItem = existingRows[0];
      const newQuantity = existingItem.quantity + (input.quantity || 1);
      await updateQuantity(existingItem.id, newQuantity);
      return existingItem.id;
    }

    // Create new cart item
    const id = `cart_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    await db.execute(
      `INSERT INTO cart (id, nodeid, nodetype, sellerid, title, price, quantity, thumbnail, metadata, added)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.nodeId,
        input.nodeType,
        input.sellerId,
        input.title,
        input.price,
        input.quantity || 1,
        input.thumbnail || "",
        JSON.stringify(input.metadata || {}),
        now
      ]
    );

    console.log(`Added to cart: ${id}`);
    return id;
  } catch (error) {
    console.error("Failed to add to cart:", error);
    throw error;
  }
}

export async function removeFromCart(id: string): Promise<void> {
  try {
    await db.execute("DELETE FROM cart WHERE id = ?", [id]);
    console.log(`Removed from cart: ${id}`);
  } catch (error) {
    console.error("Failed to remove from cart:", error);
    throw error;
  }
}

export async function updateQuantity(id: string, quantity: number): Promise<void> {
  try {
    if (quantity <= 0) {
      await removeFromCart(id);
      return;
    }

    await db.execute(
      "UPDATE cart SET quantity = ? WHERE id = ?",
      [quantity, id]
    );
    console.log(`Updated cart quantity: ${id} -> ${quantity}`);
  } catch (error) {
    console.error("Failed to update cart quantity:", error);
    throw error;
  }
}

export async function updateMetadata(id: string, metadata: CartItemMetadata): Promise<void> {
  try {
    // Get existing metadata and merge
    const existing = await db.execute(
      "SELECT metadata FROM cart WHERE id = ?",
      [id]
    );

    const rows = existing.rows?._array || existing.rows || [];
    const existingRows = Array.isArray(rows) ? rows : [];

    let existingMetadata = {};
    if (existingRows.length > 0 && existingRows[0].metadata) {
      try {
        existingMetadata = JSON.parse(existingRows[0].metadata);
      } catch {
        existingMetadata = {};
      }
    }

    const mergedMetadata = { ...existingMetadata, ...metadata };

    await db.execute(
      "UPDATE cart SET metadata = ? WHERE id = ?",
      [JSON.stringify(mergedMetadata), id]
    );
    console.log(`Updated cart metadata: ${id}`);
  } catch (error) {
    console.error("Failed to update cart metadata:", error);
    throw error;
  }
}

// ========== CART QUERY OPERATIONS ==========

export async function getCartItems(): Promise<CartItem[]> {
  try {
    const result = await db.execute(
      "SELECT * FROM cart ORDER BY added DESC"
    );

    const rows = result.rows?._array || result.rows || [];
    const rowsArray = Array.isArray(rows) ? rows : [];

    return rowsArray.map((row) => ({
      id: row.id,
      nodeId: row.nodeid,
      nodeType: row.nodetype as CommerceType,
      sellerId: row.sellerid,
      title: row.title,
      price: row.price,
      quantity: row.quantity,
      thumbnail: row.thumbnail,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      added: row.added
    }));
  } catch (error) {
    console.error("Failed to get cart items:", error);
    return [];
  }
}

export async function getCartCount(): Promise<number> {
  try {
    const result = await db.execute(
      "SELECT SUM(quantity) as total FROM cart"
    );

    const rows = result.rows?._array || result.rows || [];
    const rowsArray = Array.isArray(rows) ? rows : [];

    return rowsArray.length > 0 ? (rowsArray[0].total || 0) : 0;
  } catch (error) {
    console.error("Failed to get cart count:", error);
    return 0;
  }
}

export async function getCartTotal(): Promise<number> {
  try {
    const items = await getCartItems();
    return items.reduce((total, item) => total + calculateItemTotal(item), 0);
  } catch (error) {
    console.error("Failed to get cart total:", error);
    return 0;
  }
}

export async function getCartSummary(): Promise<CartSummary> {
  try {
    const items = await getCartItems();

    const byType: Record<string, number> = {};
    const bySeller: Record<string, { items: CartItem[]; subtotal: number }> = {};

    let itemCount = 0;
    let subtotal = 0;

    for (const item of items) {
      const itemTotal = calculateItemTotal(item);
      itemCount += item.quantity;
      subtotal += itemTotal;

      // Group by type
      byType[item.nodeType] = (byType[item.nodeType] || 0) + itemTotal;

      // Group by seller
      if (!bySeller[item.sellerId]) {
        bySeller[item.sellerId] = { items: [], subtotal: 0 };
      }
      bySeller[item.sellerId].items.push(item);
      bySeller[item.sellerId].subtotal += itemTotal;
    }

    return {
      itemCount,
      subtotal,
      byType: byType as Record<CommerceType, number>,
      bySeller
    };
  } catch (error) {
    console.error("Failed to get cart summary:", error);
    return {
      itemCount: 0,
      subtotal: 0,
      byType: {} as Record<CommerceType, number>,
      bySeller: {}
    };
  }
}

export async function clearCart(): Promise<void> {
  try {
    await db.execute("DELETE FROM cart");
    console.log("Cart cleared");
  } catch (error) {
    console.error("Failed to clear cart:", error);
    throw error;
  }
}

// ========== CART ITEM HELPERS ==========

export async function getCartItemById(id: string): Promise<CartItem | null> {
  try {
    const result = await db.execute(
      "SELECT * FROM cart WHERE id = ?",
      [id]
    );

    const rows = result.rows?._array || result.rows || [];
    const rowsArray = Array.isArray(rows) ? rows : [];

    if (rowsArray.length === 0) return null;

    const row = rowsArray[0];
    return {
      id: row.id,
      nodeId: row.nodeid,
      nodeType: row.nodetype as CommerceType,
      sellerId: row.sellerid,
      title: row.title,
      price: row.price,
      quantity: row.quantity,
      thumbnail: row.thumbnail,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      added: row.added
    };
  } catch (error) {
    console.error("Failed to get cart item:", error);
    return null;
  }
}

export async function isInCart(nodeId: string): Promise<boolean> {
  try {
    const result = await db.execute(
      "SELECT COUNT(*) as count FROM cart WHERE nodeid = ?",
      [nodeId]
    );

    const rows = result.rows?._array || result.rows || [];
    const rowsArray = Array.isArray(rows) ? rows : [];

    return rowsArray.length > 0 && rowsArray[0].count > 0;
  } catch (error) {
    console.error("Failed to check if in cart:", error);
    return false;
  }
}

// ========== EXPORT SERVICE ==========

export const cartService = {
  // CRUD
  addToCart,
  removeFromCart,
  updateQuantity,
  updateMetadata,
  clearCart,

  // Queries
  getCartItems,
  getCartCount,
  getCartTotal,
  getCartSummary,
  getCartItemById,
  isInCart,

  // Helpers
  calculateItemTotal
};
