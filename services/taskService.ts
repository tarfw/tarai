// TARAI Task Service
// Manages tasks generated from orders

import { TaskRecord, TaskType, TaskStatus } from '@/types/memory';
import { getDb } from '@/services/database/db';

const generateId = () => `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Create a new task
export const createTask = async (
  task: Omit<TaskRecord, 'id' | 'created' | 'updated'>
): Promise<string> => {
  const database = getDb();
  const id = generateId();
  const now = Date.now();

  await database.execute(
    `INSERT INTO tasks (id, memoryid, personid, type, title, status, priority, due, data, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      task.memoryid,
      task.personid,
      task.type,
      task.title,
      task.status || 'pending',
      task.priority || 0,
      task.due || null,
      task.data || null,
      now,
      now,
    ]
  );

  return id;
};

// Get task by ID
export const getTaskById = async (id: string): Promise<TaskRecord | null> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT * FROM tasks WHERE id = ?`,
    [id]
  );
  return (result.rows?.[0] as TaskRecord) || null;
};

// Update task
export const updateTask = async (
  id: string,
  updates: Partial<Omit<TaskRecord, 'id' | 'created'>>
): Promise<void> => {
  const database = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.memoryid !== undefined) {
    fields.push('memoryid = ?');
    values.push(updates.memoryid);
  }
  if (updates.personid !== undefined) {
    fields.push('personid = ?');
    values.push(updates.personid);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    values.push(updates.type);
  }
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    values.push(updates.priority);
  }
  if (updates.due !== undefined) {
    fields.push('due = ?');
    values.push(updates.due);
  }
  if (updates.data !== undefined) {
    fields.push('data = ?');
    values.push(updates.data);
  }

  fields.push('updated = ?');
  values.push(Date.now());
  values.push(id);

  await database.execute(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
};

// Delete task
export const deleteTask = async (id: string): Promise<void> => {
  const database = getDb();
  await database.execute(`DELETE FROM tasks WHERE id = ?`, [id]);
};

// Get tasks by person
export const getTasksByPerson = async (
  personid: string,
  status?: TaskStatus
): Promise<TaskRecord[]> => {
  const database = getDb();
  let query = `SELECT * FROM tasks WHERE personid = ?`;
  const params: string[] = [personid];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY priority DESC, due ASC, created DESC`;

  const result = await database.execute(query, params);
  return (result.rows || []) as TaskRecord[];
};

// Get tasks by memory
export const getTasksByMemory = async (memoryid: string): Promise<TaskRecord[]> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT * FROM tasks WHERE memoryid = ? ORDER BY created ASC`,
    [memoryid]
  );
  return (result.rows || []) as TaskRecord[];
};

// Get all tasks
export const getAllTasks = async (
  status?: TaskStatus,
  limit: number = 100
): Promise<TaskRecord[]> => {
  const database = getDb();
  let query = `SELECT * FROM tasks`;
  const params: (string | number)[] = [];

  if (status) {
    query += ` WHERE status = ?`;
    params.push(status);
  }

  query += ` ORDER BY priority DESC, due ASC, created DESC LIMIT ?`;
  params.push(limit);

  const result = await database.execute(query, params);
  return (result.rows || []) as TaskRecord[];
};

// Get overdue tasks
export const getOverdueTasks = async (): Promise<TaskRecord[]> => {
  const database = getDb();
  const now = Date.now();
  const result = await database.execute(
    `SELECT * FROM tasks WHERE status = 'pending' AND due IS NOT NULL AND due < ? ORDER BY due ASC`,
    [now]
  );
  return (result.rows || []) as TaskRecord[];
};

// Get tasks by type
export const getTasksByType = async (type: TaskType): Promise<TaskRecord[]> => {
  const database = getDb();
  const result = await database.execute(
    `SELECT * FROM tasks WHERE type = ? ORDER BY created DESC`,
    [type]
  );
  return (result.rows || []) as TaskRecord[];
};

// Update task status
export const updateTaskStatus = async (
  id: string,
  status: TaskStatus
): Promise<void> => {
  await updateTask(id, { status });
};

// Complete a task
export const completeTask = async (id: string): Promise<void> => {
  await updateTaskStatus(id, 'completed');
};

// Cancel a task
export const cancelTask = async (id: string): Promise<void> => {
  await updateTaskStatus(id, 'cancelled');
};

// Start a task (mark as in progress)
export const startTask = async (id: string): Promise<void> => {
  await updateTaskStatus(id, 'progress');
};

// Bulk create tasks for an order
export const createOrderTasks = async (
  memoryid: string,
  tasks: { personid: string; type: TaskType; title: string; due?: number; priority?: number }[]
): Promise<string[]> => {
  const ids: string[] = [];
  for (const task of tasks) {
    const id = await createTask({
      memoryid,
      personid: task.personid,
      type: task.type,
      title: task.title,
      status: 'pending',
      priority: task.priority || 0,
      due: task.due,
    });
    ids.push(id);
  }
  return ids;
};

// Delete all tasks for a memory
export const deleteTasksByMemory = async (memoryid: string): Promise<void> => {
  const database = getDb();
  await database.execute(`DELETE FROM tasks WHERE memoryid = ?`, [memoryid]);
};

// Get task stats
export const getTaskStats = async (): Promise<{
  total: number;
  pending: number;
  progress: number;
  completed: number;
  cancelled: number;
  overdue: number;
}> => {
  const database = getDb();
  const now = Date.now();

  const result = await database.execute(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'progress' THEN 1 ELSE 0 END) as progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
      SUM(CASE WHEN status = 'pending' AND due IS NOT NULL AND due < ${now} THEN 1 ELSE 0 END) as overdue
    FROM tasks
  `);

  const row = result.rows?.[0] || {};
  return {
    total: row.total || 0,
    pending: row.pending || 0,
    progress: row.progress || 0,
    completed: row.completed || 0,
    cancelled: row.cancelled || 0,
    overdue: row.overdue || 0,
  };
};

// Search tasks - semantic search via memory vector store
export const searchTasks = async (query: string, limit: number = 50): Promise<TaskRecord[]> => {
  const database = getDb();
  const { memoryVectorStore } = await import('@/services/vectorStores/memoryVectorStore');

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

  // Fetch tasks for matched memories
  const placeholders = memoryIds.map(() => '?').join(',');
  const result = await database.execute(
    `SELECT * FROM tasks WHERE memoryid IN (${placeholders}) ORDER BY priority DESC, created DESC LIMIT ?`,
    [...memoryIds, limit]
  );
  const tasks = (result.rows || []) as TaskRecord[];

  // Create similarity map from vector results
  const similarityMap = new Map<string, number>();
  vectorResults.forEach((r) => {
    const memoryId = r.metadata?.memoryId as string;
    if (memoryId && (!similarityMap.has(memoryId) || r.similarity > similarityMap.get(memoryId)!)) {
      similarityMap.set(memoryId, r.similarity);
    }
  });

  // Add similarity to tasks based on their memory's similarity
  return tasks
    .map((t) => ({ ...t, similarity: similarityMap.get(t.memoryid) || 0 }))
    .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
};

// Get tasks due soon (within hours)
export const getTasksDueSoon = async (hours: number = 24): Promise<TaskRecord[]> => {
  const database = getDb();
  const now = Date.now();
  const future = now + hours * 60 * 60 * 1000;
  const result = await database.execute(
    `SELECT * FROM tasks WHERE status = 'pending' AND due IS NOT NULL AND due BETWEEN ? AND ? ORDER BY due ASC`,
    [now, future]
  );
  return (result.rows || []) as TaskRecord[];
};

// Legacy exports for compatibility
export const getTasksByNode = getTasksByMemory;
export const deleteTasksByNode = deleteTasksByMemory;
