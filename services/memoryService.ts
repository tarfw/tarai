// TARAI Memory Service
// Handles memory operations with vector embeddings for semantic search

import type { MemoryRecord, MemoryType, MemoryStatus } from '@/types/memory';
import {
  memoryVectorStore,
  memorySplitter,
  memoryToString,
  COMMERCE_CATEGORIES,
} from '@/services/vectorStores/memoryVectorStore';
import { getDb } from '@/services/database/db';

const generateId = () => `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ========== CRUD OPERATIONS ==========

export async function createMemory(data: {
  id?: string; // Allow providing custom ID for demo data
  type: MemoryType;
  title: string;
  parent?: string;
  data?: string;
  quantity?: number;
  value?: number;
  location?: string;
  status?: MemoryStatus;
}): Promise<string> {
  const database = getDb();
  const id = data.id || generateId();
  const now = Date.now();

  await database.execute(
    `INSERT INTO memories (id, type, title, parent, data, quantity, value, location, status, created, updated)
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
  const searchText = memoryToString({ title: data.title, type: data.type, data: data.data });
  console.log(`[MemoryService] Indexing memory ${id}: "${searchText.substring(0, 50)}..."`);
  const chunks = await memorySplitter.splitText(searchText);
  console.log(`[MemoryService] Split into ${chunks.length} chunks`);
  for (let i = 0; i < chunks.length; i++) {
    console.log(`[MemoryService] Adding chunk ${i + 1}/${chunks.length} to vector store...`);
    await memoryVectorStore.add({
      document: chunks[i],
      metadata: { memoryId: id, type: data.type },
    });
    console.log(`[MemoryService] Chunk ${i + 1} added successfully`);
  }

  return id;
}

export async function updateMemory(
  id: string,
  updates: Partial<Omit<MemoryRecord, 'id' | 'created'>>
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
    `UPDATE memories SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  // Update vector store (delete old chunks, re-index with new content)
  await memoryVectorStore.delete({
    predicate: (doc) => doc.metadata?.memoryId === id,
  });
  if (updates.title || updates.data) {
    const memory = await getMemoryById(id);
    if (memory) {
      const searchText = memoryToString({ title: memory.title, type: memory.type, data: memory.data });
      const chunks = await memorySplitter.splitText(searchText);
      for (const chunk of chunks) {
        await memoryVectorStore.add({
          document: chunk,
          metadata: { memoryId: id, type: memory.type },
        });
      }
    }
  }
}

export async function deleteMemory(id: string): Promise<void> {
  const database = getDb();
  await database.execute('DELETE FROM memories WHERE id = ?', [id]);
  // Cascade deletes handled by FK, also clean vector store
  await memoryVectorStore.delete({
    predicate: (doc) => doc.metadata?.memoryId === id,
  });
}

export async function getMemoryById(id: string): Promise<MemoryRecord | null> {
  const database = getDb();
  const result = await database.execute('SELECT * FROM memories WHERE id = ?', [id]);
  return (result.rows?.[0] as MemoryRecord) || null;
}

// ========== QUERY OPERATIONS ==========

export async function getAllMemories(
  type?: MemoryType,
  status?: MemoryStatus,
  limit: number = 100
): Promise<MemoryRecord[]> {
  const database = getDb();
  let query = 'SELECT * FROM memories WHERE 1=1';
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
  return (result.rows || []) as MemoryRecord[];
}

export async function getMemoriesByType(type: MemoryType): Promise<MemoryRecord[]> {
  const database = getDb();
  const result = await database.execute(
    'SELECT * FROM memories WHERE type = ? ORDER BY updated DESC',
    [type]
  );
  return (result.rows || []) as MemoryRecord[];
}

export async function getChildMemories(parentId: string): Promise<MemoryRecord[]> {
  const database = getDb();
  const result = await database.execute(
    'SELECT * FROM memories WHERE parent = ? ORDER BY created ASC',
    [parentId]
  );
  return (result.rows || []) as MemoryRecord[];
}

export async function getRootMemories(types?: MemoryType[]): Promise<MemoryRecord[]> {
  const database = getDb();
  let query = 'SELECT * FROM memories WHERE parent IS NULL';
  const params: string[] = [];

  if (types && types.length > 0) {
    query += ` AND type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }

  query += ' ORDER BY updated DESC';

  const result = await database.execute(query, params);
  return (result.rows || []) as MemoryRecord[];
}

// ========== SEARCH OPERATIONS ==========

export async function searchMemories(
  query: string,
  filters?: { type?: MemoryType; status?: MemoryStatus },
  limit: number = 20
): Promise<MemoryRecord[]> {
  const database = getDb();

  console.log(`[Search] Starting semantic search for: "${query}"`);
  console.log(`[Search] Filters:`, filters);

  // Semantic vector search
  console.log(`[Search] Calling memoryVectorStore.query()...`);
  const results = await memoryVectorStore.query({
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

  // Deduplicate by memoryId and track max similarity per memory
  const memoryIds = [...new Set(filteredResults.map((r) => r.metadata?.memoryId as string))];
  const similarityMap = new Map<string, number>();
  filteredResults.forEach((r) => {
    const memoryId = r.metadata?.memoryId as string;
    if (!similarityMap.has(memoryId) || r.similarity > similarityMap.get(memoryId)!) {
      similarityMap.set(memoryId, r.similarity);
    }
  });

  console.log(`[Search] Unique memory IDs found: ${memoryIds.length}`);

  if (memoryIds.length === 0) {
    console.log(`[Search] No results found`);
    return [];
  }

  // Fetch full memory records from DB
  const placeholders = memoryIds.map(() => '?').join(',');
  let sql = `SELECT * FROM memories WHERE id IN (${placeholders})`;
  const params: string[] = [...memoryIds];

  if (filters?.status) {
    sql += ' AND status = ?';
    params.push(filters.status);
  }

  const result = await database.execute(sql, params);
  const memories = (result.rows || []) as MemoryRecord[];

  console.log(`[Search] Fetched ${memories.length} memories from DB`);

  // Add similarity and sort by relevance
  const sortedMemories = memories
    .map((n) => ({ ...n, similarity: similarityMap.get(n.id) || 0 }))
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
    .slice(0, limit);

  console.log(`[Search] Returning ${sortedMemories.length} results`);
  sortedMemories.forEach((n, i) => {
    console.log(`[Search] ${i + 1}. ${n.title} (${Math.round((n.similarity || 0) * 100)}%)`);
  });

  return sortedMemories;
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

export async function getMemoryStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}> {
  const database = getDb();

  const totalResult = await database.execute('SELECT COUNT(*) as total FROM memories');
  const total = totalResult.rows?.[0]?.total || 0;

  const byTypeResult = await database.execute(
    'SELECT type, COUNT(*) as count FROM memories GROUP BY type'
  );
  const byType: Record<string, number> = {};
  (byTypeResult.rows || []).forEach((row: any) => {
    byType[row.type] = row.count;
  });

  const byStatusResult = await database.execute(
    'SELECT status, COUNT(*) as count FROM memories GROUP BY status'
  );
  const byStatus: Record<string, number> = {};
  (byStatusResult.rows || []).forEach((row: any) => {
    byStatus[row.status] = row.count;
  });

  return { total, byType, byStatus };
}

// ========== INITIALIZATION ==========

export async function initializeMemoryService(): Promise<void> {
  console.log('Initializing TARAI memory service...');
  const { initializeDatabase } = await import('./database/schema');
  await initializeDatabase(getDb());
  console.log('TARAI memory service initialized');
}

// ========== EXPORTS ==========

export const memoryService = {
  createMemory,
  updateMemory,
  deleteMemory,
  getMemoryById,
  getAllMemories,
  getMemoriesByType,
  getChildMemories,
  getRootMemories,
  searchMemories,
  getSemanticSuggestions,
  getMemoryStats,
  initialize: initializeMemoryService,
};
