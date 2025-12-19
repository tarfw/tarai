// TARAI Listing Service
// Handles local listing operations with vector embeddings

import type { Listing, CachedListing, BrowsedListing, SearchQuery } from "@/types/listing";
import {
  listingSplitter,
  listingToString,
  listingVectorStore,
  generateQueryEmbedding,
  COMMERCE_CATEGORIES
} from "@/services/vectorStores/listingVectorStore";
import { open } from "@op-engineering/op-sqlite";

// Initialize local database
const db = open({
  name: "tarai.db",
  location: "default"
});

// ========== LOCAL CACHE OPERATIONS ==========

export async function cacheUserListings(listings: CachedListing[]): Promise<void> {
  try {
    for (const listing of listings) {
      // Save to database (required)
      await db.execute(
        `INSERT OR REPLACE INTO mycache (id, title, type, price, thumbnail, cached)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [listing.id, listing.title, listing.type, listing.price, listing.thumbnail, Date.now()]
      );

      // Try to add to vector store (optional - may fail if model not loaded)
      try {
        const searchText = `${listing.type}: ${listing.title}`;
        await listingVectorStore.add({
          document: searchText,
          metadata: { listingId: listing.id, type: listing.type }
        });
      } catch (vectorError) {
        // Vector store failed, but data is still in database
        console.warn(`Vector indexing failed for ${listing.id}, text search will be used`);
      }
    }
  } catch (error) {
    console.error('Failed to cache user listings:', error);
    throw error;
  }
}

export async function getCachedListings(): Promise<CachedListing[]> {
  try {
    const result = await db.execute(
      'SELECT * FROM mycache ORDER BY cached DESC'
    );

    // Handle both old and new OP-SQLite row formats
    const rows = result.rows?._array || result.rows || [];
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('Failed to get cached listings:', error);
    return [];
  }
}

export async function clearCache(): Promise<void> {
  try {
    await db.execute('DELETE FROM mycache');
    // Try to clear vector store, but don't fail if table doesn't exist
    try {
      await listingVectorStore.delete({ predicate: () => true });
    } catch (vectorError) {
      // Vector table may not exist yet, that's ok
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
    throw error;
  }
}

// ========== BROWSING HISTORY ==========

export async function addToBrowsed(listing: BrowsedListing): Promise<void> {
  try {
    await db.execute(
      `INSERT OR REPLACE INTO browsed (id, title, type, price, seller, thumbnail, cached)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [listing.id, listing.title, listing.type, listing.price, listing.seller, listing.thumbnail, Date.now()]
    );

    // Keep only last 50 browsed items
    await db.execute(
      `DELETE FROM browsed WHERE id NOT IN (
        SELECT id FROM browsed ORDER BY cached DESC LIMIT 50
      )`
    );
  } catch (error) {
    console.error('Failed to add to browsed:', error);
  }
}

export async function getBrowsedListings(limit: number = 20): Promise<BrowsedListing[]> {
  try {
    const result = await db.execute(
      'SELECT * FROM browsed ORDER BY cached DESC LIMIT ?',
      [limit]
    );

    const rows = result.rows?._array || result.rows || [];
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('Failed to get browsed listings:', error);
    return [];
  }
}

// ========== SEARCH HISTORY ==========

export async function saveSearchQuery(query: string): Promise<void> {
  try {
    const id = `search_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await db.execute(
      'INSERT INTO searches (id, query, created) VALUES (?, ?, ?)',
      [id, query, Date.now()]
    );

    // Keep only last 100 searches
    await db.execute(
      `DELETE FROM searches WHERE id NOT IN (
        SELECT id FROM searches ORDER BY created DESC LIMIT 100
      )`
    );
  } catch (error) {
    console.error('Failed to save search query:', error);
  }
}

export async function getSearchHistory(limit: number = 10): Promise<SearchQuery[]> {
  try {
    const result = await db.execute(
      'SELECT * FROM searches ORDER BY created DESC LIMIT ?',
      [limit]
    );

    const rows = result.rows?._array || result.rows || [];
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('Failed to get search history:', error);
    return [];
  }
}

// ========== VECTOR SEARCH ==========

export async function searchListingsByText(
  query: string,
  filters?: { type?: string },
  limit: number = 20
): Promise<Array<{ listingId: string; similarity: number; type: string }>> {
  try {
    await saveSearchQuery(query);

    // Try vector search first
    try {
      const results = await listingVectorStore.query({
        queryText: query.trim(),
        nResults: limit * 3  // Get more results to account for duplicates
      });

      // Filter by type if specified
      let filteredResults = results;
      if (filters?.type) {
        filteredResults = results.filter(r => r.metadata?.type === filters.type);
      }

      // Deduplicate by listingId and keep highest similarity
      const uniqueResults = new Map<string, { listingId: string; similarity: number; type: string }>();
      for (const r of filteredResults) {
        const listingId = r.metadata?.listingId as string;
        const existing = uniqueResults.get(listingId);
        if (!existing || r.similarity > existing.similarity) {
          uniqueResults.set(listingId, {
            listingId,
            similarity: r.similarity,
            type: r.metadata?.type as string
          });
        }
      }

      // Sort by similarity and limit
      return Array.from(uniqueResults.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (vectorError) {
      console.warn('Vector search failed, falling back to text search:', vectorError);

      // Fallback to simple text search in database
      const queryLower = query.toLowerCase();
      const result = await db.execute(
        `SELECT * FROM mycache WHERE LOWER(title) LIKE ? OR LOWER(type) LIKE ? LIMIT ?`,
        [`%${queryLower}%`, `%${queryLower}%`, limit]
      );

      const rows = result.rows?._array || result.rows || [];
      const rowsArray = Array.isArray(rows) ? rows : [];

      return rowsArray.map(r => ({
        listingId: r.id,
        similarity: 0.5,
        type: r.type
      }));
    }
  } catch (error) {
    console.error('Failed to search listings by text:', error);
    return [];
  }
}

// ========== SEMANTIC SUGGESTIONS ==========

export async function getSemanticSuggestions(
  partialQuery: string
): Promise<Array<{ text: string; type: string; icon: string }>> {
  try {
    if (partialQuery.trim().length === 0) {
      // Return popular categories
      return Object.entries(COMMERCE_CATEGORIES).map(([type, info]) => ({
        text: info.label,
        type,
        icon: info.icon
      }));
    }

    // Generate embedding for partial query
    const queryLower = partialQuery.toLowerCase();

    // Match against commerce categories and examples
    const suggestions: Array<{ text: string; type: string; icon: string }> = [];

    for (const [type, info] of Object.entries(COMMERCE_CATEGORIES)) {
      // Check if label or examples match
      if (info.label.toLowerCase().includes(queryLower)) {
        suggestions.push({
          text: info.label,
          type,
          icon: info.icon
        });
      } else {
        // Check examples
        const matchingExamples = info.examples.filter(ex =>
          ex.toLowerCase().includes(queryLower)
        );
        suggestions.push(...matchingExamples.map(ex => ({
          text: ex,
          type,
          icon: info.icon
        })));
      }
    }

    return suggestions.slice(0, 10);
  } catch (error) {
    console.error('Failed to get semantic suggestions:', error);
    return [];
  }
}

// ========== OFFLINE QUEUE ==========

export async function addToOfflineQueue(transactionData: any): Promise<void> {
  try {
    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await db.execute(
      'INSERT INTO offlinequeue (id, transactiondata, status, retries, created) VALUES (?, ?, ?, ?, ?)',
      [id, JSON.stringify(transactionData), 'pending', 0, Date.now()]
    );
  } catch (error) {
    console.error('Failed to add to offline queue:', error);
  }
}

export async function getOfflineQueue(): Promise<any[]> {
  try {
    const result = await db.execute(
      "SELECT * FROM offlinequeue WHERE status = 'pending' ORDER BY created ASC"
    );

    const rows = result.rows?._array || result.rows || [];
    const rowsArray = Array.isArray(rows) ? rows : [];
    return rowsArray.map(row => ({
      ...row,
      transactiondata: JSON.parse(row.transactiondata)
    }));
  } catch (error) {
    console.error('Failed to get offline queue:', error);
    return [];
  }
}

export async function markQueueItemSynced(id: string): Promise<void> {
  try {
    await db.execute(
      "UPDATE offlinequeue SET status = 'synced', synced = ? WHERE id = ?",
      [Date.now(), id]
    );
  } catch (error) {
    console.error('Failed to mark queue item as synced:', error);
  }
}

// ========== INITIALIZATION ==========

export async function initializeListingService(): Promise<void> {
  try {
    console.log('Initializing TARAI listing service...');

    // Import schema initialization
    const { initializeDatabase } = await import('./database/schema');
    await initializeDatabase(db);

    console.log('TARAI listing service initialized');
  } catch (error) {
    console.error('Failed to initialize listing service:', error);
    throw error;
  }
}

export const listingService = {
  // Cache operations
  cacheUserListings,
  getCachedListings,
  clearCache,

  // Browsing history
  addToBrowsed,
  getBrowsedListings,

  // Search operations
  searchListingsByText,
  getSemanticSuggestions,

  // Search history
  saveSearchQuery,
  getSearchHistory,

  // Offline queue
  addToOfflineQueue,
  getOfflineQueue,
  markQueueItemSynced,

  // Initialization
  initialize: initializeListingService,
};
