// TARAI People Service
// Manages memory <-> person relationships

import { PeopleRecord, PersonRole } from '@/types/memory';
import { getDb } from '@/services/database/db';

// Add a person to a memory
export const addPersonToMemory = async (
  memoryid: string,
  personid: string,
  role: PersonRole
): Promise<void> => {
  const database = getDb();
  await database.execute(
    `INSERT OR REPLACE INTO people (memoryid, personid, role) VALUES (?, ?, ?)`,
    [memoryid, personid, role]
  );
};

// Remove a person from a memory
export const removePersonFromMemory = async (
  memoryid: string,
  personid: string
): Promise<void> => {
  const database = getDb();
  await database.execute(
    `DELETE FROM people WHERE memoryid = ? AND personid = ?`,
    [memoryid, personid]
  );
};

// Get all people for a memory
export const getPeopleByMemory = async (memoryid: string): Promise<PeopleRecord[]> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT memoryid, personid, role FROM people WHERE memoryid = ?`,
    [memoryid]
  );
  return (result.rows || []) as PeopleRecord[];
};

// Get all memories for a person
export const getMemoriesByPerson = async (
  personid: string,
  role?: PersonRole
): Promise<PeopleRecord[]> => {
  const database = getDb();
  let query = `SELECT memoryid, personid, role FROM people WHERE personid = ?`;
  const params: (string | PersonRole)[] = [personid];

  if (role) {
    query += ` AND role = ?`;
    params.push(role);
  }

  const result = await database.execute(query, params);
  return (result.rows || []) as PeopleRecord[];
};

// Get all people with a specific role
export const getPeopleByRole = async (role: PersonRole): Promise<PeopleRecord[]> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT memoryid, personid, role FROM people WHERE role = ?`,
    [role]
  );
  return (result.rows || []) as PeopleRecord[];
};

// Get unique person IDs (all people in system)
export const getAllPeople = async (): Promise<string[]> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT DISTINCT personid FROM people ORDER BY personid`
  );
  return (result.rows || []).map((row: any) => row.personid);
};

// Get person with their roles across all memories
export const getPersonWithRoles = async (personid: string): Promise<{
  personid: string;
  roles: { memoryid: string; role: PersonRole }[];
}> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT memoryid, role FROM people WHERE personid = ?`,
    [personid]
  );
  return {
    personid,
    roles: (result.rows || []).map((row: any) => ({
      memoryid: row.memoryid,
      role: row.role as PersonRole,
    })),
  };
};

// Bulk add people to a memory
export const addPeopleToMemory = async (
  memoryid: string,
  people: { personid: string; role: PersonRole }[]
): Promise<void> => {
  const database = getDb();
  for (const person of people) {
    await database.execute(
      `INSERT OR REPLACE INTO people (memoryid, personid, role) VALUES (?, ?, ?)`,
      [memoryid, person.personid, person.role]
    );
  }
};

// Remove all people from a memory
export const clearMemoryPeople = async (memoryid: string): Promise<void> => {
  const database = getDb();
  await database.execute(`DELETE FROM people WHERE memoryid = ?`, [memoryid]);
};

// Count people by role for a memory
export const countPeopleByRole = async (
  memoryid: string
): Promise<Record<PersonRole, number>> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT role, COUNT(*) as count FROM people WHERE memoryid = ? GROUP BY role`,
    [memoryid]
  );
  const counts: Record<string, number> = {};
  (result.rows || []).forEach((row: any) => {
    counts[row.role] = row.count;
  });
  return counts as Record<PersonRole, number>;
};

// Search people - semantic search via memory vector store
export const searchPeople = async (query: string, limit: number = 50): Promise<PeopleRecord[]> => {
  const database = getDb();
  const { memoryVectorStore } = await import('@/services/vectorStores/memoryVectorStore');

  // If empty query, return all
  if (!query.trim()) {
    const result = await database.execute(
      `SELECT DISTINCT personid, memoryid, role FROM people ORDER BY personid LIMIT ?`,
      [limit]
    );
    return (result.rows || []) as PeopleRecord[];
  }

  // Semantic vector search
  const vectorResults = await memoryVectorStore.query({
    queryText: query.trim(),
    nResults: limit * 2,
  });

  // Get memoryIds from vector results
  const memoryIds = [...new Set(vectorResults.map((r) => r.metadata?.memoryId as string).filter(Boolean))];

  if (memoryIds.length === 0) {
    return [];
  }

  // Fetch people for matched memories
  const placeholders = memoryIds.map(() => '?').join(',');
  const result = await database.execute(
    `SELECT DISTINCT personid, memoryid, role FROM people WHERE memoryid IN (${placeholders}) ORDER BY personid LIMIT ?`,
    [...memoryIds, limit]
  );
  return (result.rows || []) as PeopleRecord[];
};

// Get people stats
export const getPeopleStats = async (): Promise<{
  total: number;
  byRole: Record<string, number>;
}> => {
  const database = getDb();

  const totalResult = await database.execute(
    `SELECT COUNT(DISTINCT personid) as total FROM people`
  );
  const total = totalResult.rows?.[0]?.total || 0;

  const byRoleResult = await database.execute(
    `SELECT role, COUNT(DISTINCT personid) as count FROM people GROUP BY role`
  );
  const byRole: Record<string, number> = {};
  (byRoleResult.rows || []).forEach((row: any) => {
    byRole[row.role] = row.count;
  });

  return { total, byRole };
};

// Legacy exports for compatibility
export const addPersonToNode = addPersonToMemory;
export const removePersonFromNode = removePersonFromMemory;
export const getPeopleByNode = getPeopleByMemory;
export const getNodesByPerson = getMemoriesByPerson;
export const addPeopleToNode = addPeopleToMemory;
export const clearNodePeople = clearMemoryPeople;
