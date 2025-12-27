// TARAI Node Service
// Handles node operations with vector embeddings for semantic search

import type { NodeRecord, NodeType, NodeStatus } from '@/types/node';
import {
  nodeVectorStore,
  nodeSplitter,
  nodeToString,
  COMMERCE_CATEGORIES,
} from '@/services/vectorStores/nodeVectorStore';
import { getDb } from '@/services/database/db';

const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ========== CRUD OPERATIONS ==========

export async function createNode(data: {
  id?: string; // Allow providing custom ID for demo data
  type: NodeType;
  title: string;
  parent?: string;
  data?: string;
  quantity?: number;
  value?: number;
  location?: string;
  status?: NodeStatus;
}): Promise<string> {
  const database = getDb();
  const id = data.id || generateId();
  const now = Date.now();

  await database.execute(
    `INSERT INTO nodes (id, type, title, parent, data, quantity, value, location, status, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.type,
      data.title,
      data.parent || null,
      data.data || null,
      data.quantity || 1,
      data.value || 0,
      data.location || null,
      data.status || 'active',
      now,
      now,
    ]
  );

  // Index in vector store for semantic search (with chunking for long content)
  const searchText = nodeToString({ title: data.title, type: data.type, data: data.data });
  console.log(`[NodeService] Indexing node ${id}: "${searchText.substring(0, 50)}..."`);
  const chunks = await nodeSplitter.splitText(searchText);
  console.log(`[NodeService] Split into ${chunks.length} chunks`);
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[NodeService] Adding chunk ${i + 1}/${chunks.length} to vector store...`);
    await nodeVectorStore.add({
      document: chunks[i],
      metadata: { nodeId: id, type: data.type },
    });
    console.log(`[NodeService] Chunk ${i + 1} added successfully`);
  }

  return id;
}

export async function updateNode(
  id: string,
  updates: Partial<Omit<NodeRecord, 'id' | 'created'>>
): Promise<void> {
  const database = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.parent !== undefined) {
    fields.push('parent = ?');
    values.push(updates.parent);
  }
  if (updates.data !== undefined) {
    fields.push('data = ?');
    values.push(updates.data);
  }
  if (updates.quantity !== undefined) {
    fields.push('quantity = ?');
    values.push(updates.quantity);
  }
  if (updates.value !== undefined) {
    fields.push('value = ?');
    values.push(updates.value);
  }
  if (updates.location !== undefined) {
    fields.push('location = ?');
    values.push(updates.location);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  fields.push('updated = ?');
  values.push(Date.now());
  values.push(id);

  await database.execute(
    `UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  // Update vector store (delete old chunks, re-index with new content)
  await nodeVectorStore.delete({
    predicate: (doc) => doc.metadata?.nodeId === id,
  });
  if (updates.title || updates.data) {
    const node = await getNodeById(id);
    if (node) {
      const searchText = nodeToString({ title: node.title, type: node.type, data: node.data });
      const chunks = await nodeSplitter.splitText(searchText);
      for (const chunk of chunks) {
        await nodeVectorStore.add({
          document: chunk,
          metadata: { nodeId: id, type: node.type },
        });
      }
    }
  }
}

export async function deleteNode(id: string): Promise<void> {
  const database = getDb();
  await database.execute('DELETE FROM nodes WHERE id = ?', [id]);
  // Cascade deletes handled by FK, also clean vector store
  await nodeVectorStore.delete({
    predicate: (doc) => doc.metadata?.nodeId === id,
  });
}

export async function getNodeById(id: string): Promise<NodeRecord | null> {
  const database = getDb();
  const result = await database.execute('SELECT * FROM nodes WHERE id = ?', [id]);
  return (result.rows?.[0] as NodeRecord) || null;
}

// ========== QUERY OPERATIONS ==========

export async function getAllNodes(
  type?: NodeType,
  status?: NodeStatus,
  limit: number = 100
): Promise<NodeRecord[]> {
  const database = getDb();
  let query = 'SELECT * FROM nodes WHERE 1=1';
  const params: (string | number)[] = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY updated DESC LIMIT ?';
  params.push(limit);

  const result = await database.execute(query, params);
  return (result.rows || []) as NodeRecord[];
}

export async function getNodesByType(type: NodeType): Promise<NodeRecord[]> {
  const database = getDb();
  const result = await database.execute(
    'SELECT * FROM nodes WHERE type = ? ORDER BY updated DESC',
    [type]
  );
  return (result.rows || []) as NodeRecord[];
}

export async function getChildNodes(parentId: string): Promise<NodeRecord[]> {
  const database = getDb();
  const result = await database.execute(
    'SELECT * FROM nodes WHERE parent = ? ORDER BY created ASC',
    [parentId]
  );
  return (result.rows || []) as NodeRecord[];
}

export async function getRootNodes(types?: NodeType[]): Promise<NodeRecord[]> {
  const database = getDb();
  let query = 'SELECT * FROM nodes WHERE parent IS NULL';
  const params: string[] = [];

  if (types && types.length > 0) {
    query += ` AND type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }

  query += ' ORDER BY updated DESC';

  const result = await database.execute(query, params);
  return (result.rows || []) as NodeRecord[];
}

// ========== SEARCH OPERATIONS ==========

export async function searchNodes(
  query: string,
  filters?: { type?: NodeType; status?: NodeStatus },
  limit: number = 20
): Promise<NodeRecord[]> {
  const database = getDb();

  console.log(`[Search] Starting semantic search for: "${query}"`);
  console.log(`[Search] Filters:`, filters);

  // Semantic vector search
  console.log(`[Search] Calling nodeVectorStore.query()...`);
  const results = await nodeVectorStore.query({
    queryText: query.trim(),
    nResults: limit * 3,
  });
  console.log(`[Search] Vector store returned ${results.length} results`);

  // Filter by type if specified
  let filteredResults = results;
  if (filters?.type) {
    filteredResults = results.filter((r) => r.metadata?.type === filters.type);
    console.log(`[Search] After type filter: ${filteredResults.length} results`);
  }

  // Deduplicate by nodeId and track max similarity per node
  const nodeIds = [...new Set(filteredResults.map((r) => r.metadata?.nodeId as string))];
  const similarityMap = new Map<string, number>();
  filteredResults.forEach((r) => {
    const nodeId = r.metadata?.nodeId as string;
    if (!similarityMap.has(nodeId) || r.similarity > similarityMap.get(nodeId)!) {
      similarityMap.set(nodeId, r.similarity);
    }
  });

  console.log(`[Search] Unique node IDs found: ${nodeIds.length}`);

  if (nodeIds.length === 0) {
    console.log(`[Search] No results found`);
    return [];
  }

  // Fetch full node records from DB
  const placeholders = nodeIds.map(() => '?').join(',');
  let sql = `SELECT * FROM nodes WHERE id IN (${placeholders})`;
  const params: string[] = [...nodeIds];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  const result = await database.execute(sql, params);
  const nodes = (result.rows || []) as NodeRecord[];

  console.log(`[Search] Fetched ${nodes.length} nodes from DB`);

  // Add similarity and sort by relevance
  const sortedNodes = nodes
    .map((n) => ({ ...n, similarity: similarityMap.get(n.id) || 0 }))
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, limit);

  console.log(`[Search] Returning ${sortedNodes.length} results`);
  sortedNodes.forEach((n, i) => {
    console.log(`[Search] ${i + 1}. ${n.title} (${Math.round((n.similarity || 0) * 100)}%)`);
  });

  return sortedNodes;
}

export async function getSemanticSuggestions(
  partialQuery: string
): Promise<Array<{ text: string; type: string; icon: string }>> {
  if (partialQuery.trim().length === 0) {
    return Object.entries(COMMERCE_CATEGORIES).map(([type, info]) => ({
      text: info.label,
      type,
      icon: info.icon,
    }));
  }

  const queryLower = partialQuery.toLowerCase();
  const suggestions: Array<{ text: string; type: string; icon: string }> = [];

  for (const [type, info] of Object.entries(COMMERCE_CATEGORIES)) {
    if (info.label.toLowerCase().includes(queryLower)) {
      suggestions.push({ text: info.label, type, icon: info.icon });
    } else {
      const matchingExamples = info.examples.filter((ex) =>
        ex.toLowerCase().includes(queryLower)
      );
      suggestions.push(
        ...matchingExamples.map((ex) => ({ text: ex, type, icon: info.icon }))
      );
    }
  }

  return suggestions.slice(0, 10);
}

// ========== STATS ==========

export async function getNodeStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  const database = getDb();

  const totalResult = await database.execute('SELECT COUNT(*) as total FROM nodes');
  const total = totalResult.rows?.[0]?.total || 0;

  const byTypeResult = await database.execute(
    'SELECT type, COUNT(*) as count FROM nodes GROUP BY type'
  );
  const byType: Record<string, number> = {};
  (byTypeResult.rows || []).forEach((row: any) => {
    byType[row.type] = row.count;
  });

  const byStatusResult = await database.execute(
    'SELECT status, COUNT(*) as count FROM nodes GROUP BY status'
  );
  const byStatus: Record<string, number> = {};
  (byStatusResult.rows || []).forEach((row: any) => {
    byStatus[row.status] = row.count;
  });

  return { total, byType, byStatus };
}

// ========== INITIALIZATION ==========

export async function initializeNodeService(): Promise<void> {
  console.log('Initializing TARAI node service...');
  const { initializeDatabase } = await import('./database/schema');
  await initializeDatabase(getDb());
  console.log('TARAI node service initialized');
}

// ========== EXPORTS ==========

export const nodeService = {
  createNode,
  updateNode,
  deleteNode,
  getNodeById,
  getAllNodes,
  getNodesByType,
  getChildNodes,
  getRootNodes,
  searchNodes,
  getSemanticSuggestions,
  getNodeStats,
  initialize: initializeNodeService,
};
