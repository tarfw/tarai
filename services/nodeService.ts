// TARAI Node Service
// Handles local node operations with vector embeddings

import type { Node, CachedNode, BrowsedNode, SearchQuery } from "@/types/node";
import {
  nodeSplitter,
  nodeToString,
  nodeVectorStore,
  generateQueryEmbedding,
  COMMERCE_CATEGORIES
} from "@/services/vectorStores/nodeVectorStore";
import { open } from "@op-engineering/op-sqlite";

// Initialize local database
const db = open({
  name: "tarai.db",
  location: "default"
});

// ========== CRUD OPERATIONS ==========

export async function createNode(data: {
  title: string;
  type: string;
  price: number;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
}): Promise<string> {
  try {
    const id = `node_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    // Save to mycache table with all fields
    await db.execute(
      `INSERT INTO mycache (id, title, type, price, description, category, tags, location, thumbnail, status, cached)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.type,
        data.price,
        data.description || '',
        data.category || '',
        data.tags || '',
        data.location || '',
        '',
        'active',
        now
      ]
    );

    // Try to add to vector store for semantic search
    try {
      const searchText = `${data.type}: ${data.title}. ${data.description || ''} ${data.category || ''} ${data.tags || ''}`;
      await nodeVectorStore.add({
        document: searchText,
        metadata: { nodeId: id, type: data.type }
      });
    } catch (vectorError) {
      console.warn(`Vector indexing failed for ${id}, text search will be used`);
    }

    console.log(`Created node: ${id}`);
    return id;
  } catch (error) {
    console.error('Failed to create node:', error);
    throw error;
  }
}

export async function updateNode(id: string, data: {
  title?: string;
  type?: string;
  price?: number;
  description?: string;
  category?: string;
  tags?: string;
  location?: string;
}): Promise<void> {
  try {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      values.push(data.title);
    }
    if (data.type !== undefined) {
      updates.push('type = ?');
      values.push(data.type);
    }
    if (data.price !== undefined) {
      updates.push('price = ?');
      values.push(data.price);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.category !== undefined) {
      updates.push('category = ?');
      values.push(data.category);
    }
    if (data.tags !== undefined) {
      updates.push('tags = ?');
      values.push(data.tags);
    }
    if (data.location !== undefined) {
      updates.push('location = ?');
      values.push(data.location);
    }

    updates.push('cached = ?');
    values.push(Date.now());
    values.push(id);

    await db.execute(
      `UPDATE mycache SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Update vector store
    try {
      // Remove old vector entry
      await nodeVectorStore.delete({
        predicate: (doc) => doc.metadata?.nodeId === id
      });

      // Add new vector entry
      const searchText = `${data.type}: ${data.title}. ${data.description || ''} ${data.category || ''} ${data.tags || ''}`;
      await nodeVectorStore.add({
        document: searchText,
        metadata: { nodeId: id, type: data.type }
      });
    } catch (vectorError) {
      console.warn(`Vector update failed for ${id}`);
    }

    console.log(`Updated node: ${id}`);
  } catch (error) {
    console.error('Failed to update node:', error);
    throw error;
  }
}

export async function deleteNode(id: string): Promise<void> {
  try {
    await db.execute('DELETE FROM mycache WHERE id = ?', [id]);

    // Remove from vector store
    try {
      await nodeVectorStore.delete({
        predicate: (doc) => doc.metadata?.nodeId === id
      });
    } catch (vectorError) {
      console.warn(`Vector deletion failed for ${id}`);
    }

    console.log(`Deleted node: ${id}`);
  } catch (error) {
    console.error('Failed to delete node:', error);
    throw error;
  }
}

export async function getNodeById(id: string): Promise<CachedNode | null> {
  try {
    const result = await db.execute(
      'SELECT * FROM mycache WHERE id = ?',
      [id]
    );

    const rows = result.rows?._array || result.rows || [];
    const rowsArray = Array.isArray(rows) ? rows : [];
    return rowsArray.length > 0 ? rowsArray[0] : null;
  } catch (error) {
    console.error('Failed to get node:', error);
    return null;
  }
}

// ========== LOCAL CACHE OPERATIONS ==========

export async function cacheUserNodes(nodes: CachedNode[]): Promise<void> {
  try {
    for (const node of nodes) {
      // Save to database (required)
      await db.execute(
        `INSERT OR REPLACE INTO mycache (id, title, type, price, thumbnail, cached)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [node.id, node.title, node.type, node.price, node.thumbnail, Date.now()]
      );

      // Try to add to vector store (optional - may fail if model not loaded)
      try {
        const searchText = `${node.type}: ${node.title}`;
        await nodeVectorStore.add({
          document: searchText,
          metadata: { nodeId: node.id, type: node.type }
        });
      } catch (vectorError) {
        // Vector store failed, but data is still in database
        console.warn(`Vector indexing failed for ${node.id}, text search will be used`);
      }
    }
  } catch (error) {
    console.error('Failed to cache user nodes:', error);
    throw error;
  }
}

export async function getCachedNodes(): Promise<CachedNode[]> {
  try {
    const result = await db.execute(
      'SELECT * FROM mycache ORDER BY cached DESC'
    );

    // Handle both old and new OP-SQLite row formats
    const rows = result.rows?._array || result.rows || [];
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('Failed to get cached nodes:', error);
    return [];
  }
}

export async function clearCache(): Promise<void> {
  try {
    await db.execute('DELETE FROM mycache');
    // Try to clear vector store, but don't fail if table doesn't exist
    try {
      await nodeVectorStore.delete({ predicate: () => true });
    } catch (vectorError) {
      // Vector table may not exist yet, that's ok
    }
  } catch (error) {
    console.error('Failed to clear cache:', error);
    throw error;
  }
}

// ========== BROWSING HISTORY ==========

export async function addToBrowsed(node: BrowsedNode): Promise<void> {
  try {
    await db.execute(
      `INSERT OR REPLACE INTO browsed (id, title, type, price, seller, thumbnail, cached)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [node.id, node.title, node.type, node.price, node.seller, node.thumbnail, Date.now()]
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

export async function getBrowsedNodes(limit: number = 20): Promise<BrowsedNode[]> {
  try {
    const result = await db.execute(
      'SELECT * FROM browsed ORDER BY cached DESC LIMIT ?',
      [limit]
    );

    const rows = result.rows?._array || result.rows || [];
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('Failed to get browsed nodes:', error);
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

export async function searchNodesByText(
  query: string,
  filters?: { type?: string },
  limit: number = 20
): Promise<Array<{ nodeId: string; similarity: number; type: string }>> {
  try {
    await saveSearchQuery(query);

    // Try vector search first
    try {
      const results = await nodeVectorStore.query({
        queryText: query.trim(),
        nResults: limit * 3  // Get more results to account for duplicates
      });

      // Filter by type if specified
      let filteredResults = results;
      if (filters?.type) {
        filteredResults = results.filter(r => r.metadata?.type === filters.type);
      }

      // Deduplicate by nodeId and keep highest similarity
      const uniqueResults = new Map<string, { nodeId: string; similarity: number; type: string }>();
      for (const r of filteredResults) {
        const nodeId = r.metadata?.nodeId as string;
        const existing = uniqueResults.get(nodeId);
        if (!existing || r.similarity > existing.similarity) {
          uniqueResults.set(nodeId, {
            nodeId,
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
        nodeId: r.id,
        similarity: 0.5,
        type: r.type
      }));
    }
  } catch (error) {
    console.error('Failed to search nodes by text:', error);
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

export async function initializeNodeService(): Promise<void> {
  try {
    console.log('Initializing TARAI node service...');

    // Import schema initialization
    const { initializeDatabase } = await import('./database/schema');
    await initializeDatabase(db);

    console.log('TARAI node service initialized');
  } catch (error) {
    console.error('Failed to initialize node service:', error);
    throw error;
  }
}

export const nodeService = {
  // CRUD operations
  createNode,
  updateNode,
  deleteNode,
  getNodeById,

  // Cache operations
  cacheUserNodes,
  getCachedNodes,
  clearCache,

  // Browsing history
  addToBrowsed,
  getBrowsedNodes,

  // Search operations
  searchNodesByText,
  getSemanticSuggestions,

  // Search history
  saveSearchQuery,
  getSearchHistory,

  // Offline queue
  addToOfflineQueue,
  getOfflineQueue,
  markQueueItemSynced,

  // Initialization
  initialize: initializeNodeService,
};
