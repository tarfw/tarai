import { Effect } from 'effect';
import { HarnessError, conflict, forbidden, notFound, unavailable } from '../errors.ts';
import type { AccessContext, Identity, Member, Role, Workspace } from '../types.ts';

const now = () => Date.now();
const row = <T>(result: D1Result<T>): T | null => result.results[0] ?? null;
type WorkspaceInput = { identity: Identity; name: string; slug: string; databaseName: string; mode: Workspace['mode'] };

function workspace(value: Record<string, unknown>): Workspace {
  return {
    id: String(value.id), name: String(value.name), slug: String(value.slug), mode: value.mode === 'personal' ? 'personal' : 'work',
    databaseName: String(value.database_name), databaseHost: typeof value.database_host === 'string' ? value.database_host : null,
    state: String(value.state) as Workspace['state'],
    ownerName: typeof value.owner_name === 'string' ? value.owner_name : undefined,
  };
}

function member(value: Record<string, unknown>): Member {
  const workRole = typeof value.work_role === 'string' && value.work_role.trim() ? value.work_role : 'general';
  let roles: string[] = [];
  try {
    const parsed = JSON.parse(String(value.member_roles ?? value.roles ?? '[]'));
    if (Array.isArray(parsed)) roles = parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch { /* Older rows retain their primary work role. */ }
  return { workspaceId: String(value.workspace_id), userId: String(value.user_id), role: String(value.role) as Role, workRole, roles: roles.length ? roles : [workRole], state: String(value.state) as Member['state'] };
}

export class ControlStore {
  constructor(private readonly database: D1Database) {}

  upsertUser(identity: Identity): Effect.Effect<void, ReturnType<typeof unavailable>> {
    const stamp = now();
    return Effect.tryPromise({
      try: async () => {
        const email = identity.email.trim().toLowerCase();
        await this.database.batch([
          this.database.prepare(`INSERT INTO users (id,email,name,created_at,updated_at) VALUES (?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,updated_at=excluded.updated_at`).bind(identity.id, email, identity.name, stamp, stamp),
          this.database.prepare(`INSERT INTO members (workspace_id,user_id,role,state,created_at,updated_at,work_role,roles)
            SELECT workspace_id,?,role,'active',?,?,work_role,roles FROM workspace_invites WHERE email=? AND state='pending'
            ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role,work_role=excluded.work_role,roles=excluded.roles,state='active',updated_at=excluded.updated_at WHERE members.role!='owner'`).bind(identity.id, stamp, stamp, email),
          this.database.prepare(`UPDATE workspace_invites SET state='accepted',updated_at=? WHERE email=? AND state='pending'`).bind(stamp, email),
        ]);
      },
      catch: (cause) => unavailable('Could not save identity.', cause),
    });
  }

  listWorkspaces(userId: string): Effect.Effect<Array<{ workspace: Workspace; role: Role; workRole: Member['workRole']; roles: readonly string[] }>, ReturnType<typeof unavailable>> {
    return Effect.tryPromise({
      try: async () => (await this.database.prepare(`SELECT w.*,m.role AS member_role,m.work_role,m.roles AS member_roles,u.name AS owner_name FROM workspaces w JOIN members m ON m.workspace_id=w.id
        JOIN users u ON u.id=w.owner_id WHERE m.user_id=? AND m.state='active' AND w.state!='archived'
        ORDER BY CASE w.mode WHEN 'personal' THEN 0 ELSE 1 END,w.created_at DESC`).bind(userId).all<Record<string, unknown>>()).results.map((value) => ({
          workspace: workspace(value), role: String(value.member_role) as Role,
          workRole: member({ workspace_id: value.id, user_id: userId, role: value.member_role, work_role: value.work_role, member_roles: value.member_roles, state: 'active' }).workRole,
          roles: member({ workspace_id: value.id, user_id: userId, role: value.member_role, work_role: value.work_role, member_roles: value.member_roles, state: 'active' }).roles || [],
        })),
      catch: (cause) => unavailable('Could not list workspaces.', cause),
    });
  }

  listAccess(identity: Identity): Effect.Effect<AccessContext[], ReturnType<typeof unavailable>> {
    return Effect.map(this.listWorkspaces(identity.id), (items) => items
      .filter((item) => item.workspace.state === 'active' && Boolean(item.workspace.databaseHost))
      .map((item) => ({
        identity,
        workspace: item.workspace,
        member: { workspaceId: item.workspace.id, userId: identity.id, role: item.role, workRole: item.workRole, roles: item.roles, state: 'active' },
      })));
  }

  ensurePersonalWorkspace(input: WorkspaceInput): Effect.Effect<Workspace, ReturnType<typeof unavailable>> {
    const stamp = now();
    return Effect.tryPromise({
      try: async () => {
        const existing = row(await this.database.prepare(`SELECT * FROM workspaces WHERE owner_id=? AND mode='personal' LIMIT 1`).bind(input.identity.id).all<Record<string, unknown>>());
        if (existing) {
          if (existing.state === 'error') await this.database.prepare(`UPDATE workspaces SET state='provisioning',error_message=NULL,updated_at=? WHERE id=?`).bind(stamp, existing.id).run();
          return { ...workspace(existing), state: existing.state === 'error' ? 'provisioning' : workspace(existing).state };
        }
        const id = `ws_${crypto.randomUUID()}`;
        await this.database.batch([
          this.database.prepare(`INSERT INTO workspaces (id,owner_id,name,slug,mode,database_name,state,created_at,updated_at)
            VALUES (?,?,?,?, 'personal', ?, 'provisioning', ?, ?)`).bind(id, input.identity.id, input.name, input.slug, input.databaseName, stamp, stamp),
          this.database.prepare(`INSERT INTO members (workspace_id,user_id,role,state,created_at,updated_at)
            VALUES (?,?,'owner','active',?,?)`).bind(id, input.identity.id, stamp, stamp),
        ]);
        return { id, name: input.name, slug: input.slug, mode: 'personal', databaseName: input.databaseName, databaseHost: null, state: 'provisioning' };
      },
      catch: (cause) => unavailable('Could not prepare Personal workspace.', cause),
    });
  }

  resumeErroredWorkspace(input: WorkspaceInput): Effect.Effect<Workspace | null, ReturnType<typeof unavailable>> {
    return Effect.tryPromise({
      try: async () => {
        const existing = row(await this.database.prepare(`SELECT * FROM workspaces WHERE owner_id=? AND slug=? AND state='error'`)
          .bind(input.identity.id, input.slug).all<Record<string, unknown>>());
        if (!existing) return null;
        const stamp = now();
        await this.database.prepare(`UPDATE workspaces SET name=?, database_name=?, database_host=NULL, state='provisioning', error_message=NULL, updated_at=? WHERE id=?`)
          .bind(input.name, input.databaseName, stamp, existing.id).run();
        return { id: String(existing.id), name: input.name, slug: input.slug, mode: input.mode, databaseName: input.databaseName, databaseHost: null, state: 'provisioning' };
      },
      catch: (cause) => unavailable('Could not resume workspace provisioning.', cause),
    });
  }

  createPendingWorkspace(input: WorkspaceInput): Effect.Effect<Workspace, ReturnType<typeof conflict> | ReturnType<typeof unavailable>> {
    const id = `ws_${crypto.randomUUID()}`; const stamp = now();
    return Effect.tryPromise({
      try: async () => {
        const statements = [
          this.database.prepare(`INSERT INTO workspaces (id,owner_id,name,slug,mode,database_name,state,created_at,updated_at)
            VALUES (?,?,?,?, ?, ?, 'provisioning', ?, ?)`).bind(id, input.identity.id, input.name, input.slug, input.mode, input.databaseName, stamp, stamp),
          this.database.prepare(`INSERT INTO members (workspace_id,user_id,role,state,created_at,updated_at)
            VALUES (?,?,'owner','active',?,?)`).bind(id, input.identity.id, stamp, stamp),
        ];
        await this.database.batch(statements);
        return { id, name: input.name, slug: input.slug, mode: input.mode, databaseName: input.databaseName, databaseHost: null, state: 'provisioning' };
      },
      catch: (cause) => cause instanceof Error && /unique/i.test(cause.message) ? conflict('A workspace with this name already exists.') : unavailable('Could not create workspace.', cause),
    });
  }

  activateWorkspace(id: string, host: string): Effect.Effect<void, ReturnType<typeof unavailable>> {
    return Effect.tryPromise({
      try: () => this.database.prepare(`UPDATE workspaces SET database_host=?, state='active', error_message=NULL, updated_at=? WHERE id=?`).bind(host, now(), id).run().then(() => undefined),
      catch: (cause) => unavailable('Could not activate workspace.', cause),
    });
  }

  failWorkspace(id: string, cause: unknown): Effect.Effect<void, ReturnType<typeof unavailable>> {
    return Effect.tryPromise({
      try: () => this.database.prepare(`UPDATE workspaces SET state='error', error_message=?, updated_at=? WHERE id=?`).bind('Provisioning failed. Retry workspace creation.', now(), id).run().then(() => undefined),
      catch: (error) => unavailable('Could not save workspace failure.', error),
    });
  }

  inviteMember(input: { workspaceId: string; email: string; role: Exclude<Role, 'owner'>; invitedBy: string }): Effect.Effect<void, ReturnType<typeof unavailable>> {
    const stamp = now();
    return Effect.tryPromise({
      try: () => this.database.prepare(`INSERT INTO workspace_invites (id,workspace_id,email,role,invited_by,state,created_at,updated_at)
        VALUES (?,?,?,?,?,'pending',?,?) ON CONFLICT(workspace_id,email) DO UPDATE SET role=excluded.role,invited_by=excluded.invited_by,state='pending',updated_at=excluded.updated_at`)
        .bind(`inv_${crypto.randomUUID()}`, input.workspaceId, input.email.trim().toLowerCase(), input.role, input.invitedBy, stamp, stamp).run().then(() => undefined),
      catch: (cause) => unavailable('Could not save workspace invitation.', cause),
    });
  }

  access(identity: Identity, slug: string): Effect.Effect<AccessContext, ReturnType<typeof forbidden> | ReturnType<typeof notFound> | ReturnType<typeof unavailable>> {
    return Effect.tryPromise({
      try: async () => {
        const found = row(await this.database.prepare(`SELECT w.*,m.user_id,m.role,m.work_role,m.roles AS member_roles,m.state AS member_state FROM workspaces w
          LEFT JOIN members m ON m.workspace_id=w.id AND m.user_id=? WHERE w.slug=?`).bind(identity.id, slug).all<Record<string, unknown>>());
        if (!found) throw notFound('Workspace not found.');
        if (found.member_state !== 'active') throw forbidden();
        const current = workspace(found); if (current.state !== 'active' || !current.databaseHost) throw notFound('Workspace is not ready.');
        return { identity, workspace: current, member: member({ workspace_id: current.id, user_id: identity.id, role: found.role, work_role: found.work_role, member_roles: found.member_roles, state: found.member_state }) };
      },
      catch: (cause) => cause instanceof HarnessError ? cause : unavailable('Could not resolve workspace access.', cause),
    });
  }

  accessFor(workspaceId: string, userId: string): Effect.Effect<AccessContext, ReturnType<typeof forbidden> | ReturnType<typeof notFound> | ReturnType<typeof unavailable>> {
    return Effect.tryPromise({
      try: async () => {
        const found = row(await this.database.prepare(`SELECT w.*,u.id AS actor,u.email,u.name AS actorname,m.role,m.work_role,m.roles AS member_roles,m.state AS memberstate
          FROM workspaces w JOIN users u ON u.id=? LEFT JOIN members m ON m.workspace_id=w.id AND m.user_id=u.id
          WHERE w.id=?`).bind(userId, workspaceId).all<Record<string, unknown>>());
        if (!found) throw notFound('Workspace or actor not found.');
        if (found.memberstate !== 'active') throw forbidden();
        const current = workspace(found);
        if (current.state !== 'active' || !current.databaseHost) throw notFound('Workspace is not ready.');
        const identity: Identity = { id: userId, email: String(found.email), name: typeof found.actorname === 'string' ? found.actorname : null };
        return { identity, workspace: current, member: member({ workspace_id: current.id, user_id: userId, role: found.role, work_role: found.work_role, member_roles: found.member_roles, state: found.memberstate }) };
      },
      catch: (cause) => cause instanceof HarnessError ? cause : unavailable('Could not resolve current workspace access.', cause),
    });
  }
}
