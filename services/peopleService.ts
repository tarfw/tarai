// TARAI People Service
// Manages node <-> person relationships

import { PeopleRecord, PersonRole } from '@/types/node';
import { getDb } from '@/services/database/db';

// Add a person to a node
export const addPersonToNode = async (
  nodeid: string,
  personid: string,
  role: PersonRole
): Promise<void> => {
  const database = getDb();
  await database.execute(
    `INSERT OR REPLACE INTO people (nodeid, personid, role) VALUES (?, ?, ?)`,
    [nodeid, personid, role]
  );
};

// Remove a person from a node
export const removePersonFromNode = async (
  nodeid: string,
  personid: string
): Promise<void> => {
  const database = getDb();
  await database.execute(
    `DELETE FROM people WHERE nodeid = ? AND personid = ?`,
    [nodeid, personid]
  );
};

// Get all people for a node
export const getPeopleByNode = async (nodeid: string): Promise<PeopleRecord[]> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT nodeid, personid, role FROM people WHERE nodeid = ?`,
    [nodeid]
  );
  return (result.rows || []) as PeopleRecord[];
};

// Get all nodes for a person
export const getNodesByPerson = async (
  personid: string,
  role?: PersonRole
): Promise<PeopleRecord[]> => {
  const database = getDb();
  let query = `SELECT nodeid, personid, role FROM people WHERE personid = ?`;
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
    `SELECT nodeid, personid, role FROM people WHERE role = ?`,
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

// Get person with their roles across all nodes
export const getPersonWithRoles = async (personid: string): Promise<{
  personid: string;
  roles: { nodeid: string; role: PersonRole }[];
}> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT nodeid, role FROM people WHERE personid = ?`,
    [personid]
  );
  return {
    personid,
    roles: (result.rows || []).map((row: any) => ({
      nodeid: row.nodeid,
      role: row.role as PersonRole,
    })),
  };
};

// Bulk add people to a node
export const addPeopleToNode = async (
  nodeid: string,
  people: { personid: string; role: PersonRole }[]
): Promise<void> => {
  const database = getDb();
  for (const person of people) {
    await database.execute(
      `INSERT OR REPLACE INTO people (nodeid, personid, role) VALUES (?, ?, ?)`,
      [nodeid, person.personid, person.role]
    );
  }
};

// Remove all people from a node
export const clearNodePeople = async (nodeid: string): Promise<void> => {
  const database = getDb();
  await database.execute(`DELETE FROM people WHERE nodeid = ?`, [nodeid]);
};

// Count people by role for a node
export const countPeopleByRole = async (
  nodeid: string
): Promise<Record<PersonRole, number>> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT role, COUNT(*) as count FROM people WHERE nodeid = ? GROUP BY role`,
    [nodeid]
  );
  const counts: Record<string, number> = {};
  (result.rows || []).forEach((row: any) => {
    counts[row.role] = row.count;
  });
  return counts as Record<PersonRole, number>;
};

// Search people - semantic search via node vector store
export const searchPeople = async (query: string, limit: number = 50): Promise<PeopleRecord[]> => {
  const database = getDb();
  const { nodeVectorStore } = await import('@/services/vectorStores/nodeVectorStore');

  // If empty query, return all
  if (!query.trim()) {
    const result = await database.execute(
      `SELECT DISTINCT personid, nodeid, role FROM people ORDER BY personid LIMIT ?`,
      [limit]
    );
    return (result.rows || []) as PeopleRecord[];
  }

  // Semantic vector search
  const vectorResults = await nodeVectorStore.query({
    queryText: query.trim(),
    nResults: limit * 2,
  });

  // Get nodeIds from vector results
  const nodeIds = [...new Set(vectorResults.map((r) => r.metadata?.nodeId as string).filter(Boolean))];

  if (nodeIds.length === 0) {
    return [];
  }

  // Fetch people for matched nodes
  const placeholders = nodeIds.map(() => '?').join(',');
  const result = await database.execute(
    `SELECT DISTINCT personid, nodeid, role FROM people WHERE nodeid IN (${placeholders}) ORDER BY personid LIMIT ?`,
    [...nodeIds, limit]
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
