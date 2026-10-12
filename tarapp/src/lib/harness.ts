import { randomUUID } from 'expo-crypto';
import { getValidIdToken, invalidateGoogleToken } from './auth';
import type { AskOutcome, Asset, AssetSummary, Checks, DesignLibrary, EditOutcome, PublishOutcome, ReleaseManifest, SiteDocument, SiteGenerateInput, SiteGenerateResult, SiteSnapshot } from './site-schema';

export const HARNESS_URL = (process.env.EXPO_PUBLIC_TARHARNESS_URL || 'https://tarharness.tar-54d.workers.dev').replace(/\/$/, '');
export const SITES_URL = (process.env.EXPO_PUBLIC_SITES_URL || 'https://tar-sites.tar-54d.workers.dev').replace(/\/$/, '');

export type HarnessRole = 'owner' | 'admin' | 'member' | 'guest';
export type WorkRole = string;
export type ChatProvider = 'slack' | 'discord' | 'google-chat';
export interface HarnessMember { id: string; email: string; name: string | null; role: HarnessRole; workRole: WorkRole; roles?: WorkRole[]; brief?: string; access?: string[]; state: 'active' | 'pending' | 'revoked'; }
export interface ToolAccessEvaluation {
  id: string;
  title: string;
  description: string;
  kind: 'tool' | 'human' | 'channel' | 'flow' | 'site';
  reach: 'none' | 'customer' | 'money' | 'data';
  probability: number;
  on: boolean;
  ask: boolean;
}
export interface MemberAccessResult {
  brief: string;
  evaluations: ToolAccessEvaluation[];
  suggestedAccess: string[];
  model?: string;
  review: true;
}
export interface FlowStepMatch {
  line: string;
  stepNumber: number;
  kind: 'tool' | 'human';
  toolId: string | null;
  toolTitle: string | null;
  confidence: number;
  asksFirst: boolean;
  suggestions?: { toolId: string; title: string; score: number }[];
}
export interface FlowMatchResult {
  steps: FlowStepMatch[];
  model?: string;
  review: true;
}
export interface DetectedVariant {
  name: string;
  dimension: string;
  option: string;
  priceDelta?: number;
}
export interface VariantDetectionResult {
  dimension: string;
  variants: DetectedVariant[];
  source: 'jev' | 'deterministic';
  category?: string;
  unit?: string;
  tax?: number;
  title?: string;
  sku?: string;
}
export interface TeamChatState {
  commands: { id: string; state: string; result: string | null; createdAt: number }[];
  connection: { provider: ChatProvider; name: string; joinUrl: string } | null;
  identity: { provider: ChatProvider; name: string } | null;
  providers: { id: ChatProvider; name: string; configured: boolean; installUrl: string }[];
  canManage: boolean; role: HarnessRole; workRole: WorkRole;
  requests: { id: string; provider: ChatProvider; purpose: 'destination' | 'identity'; expiresAt: number; candidate: { userName: string; userId: string; channelName: string; channelId: string } | null }[];
}
export interface HarnessWorkspace { id: string; name: string; slug: string; scope: string; role: HarnessRole; workRole?: WorkRole; roles?: WorkRole[]; owner?: string; mode: 'personal' | 'work'; state: 'provisioning' | 'active' | 'error' | 'archived'; }
export interface HarnessRecord { id: string; type: string; title: string; state: string; data: Record<string, unknown>; owner: string | null; assignee: string | null; version: number; createdAt: number; updatedAt: number; }
export interface HarnessFlowBook { id: string; name: string; version: number; data: Record<string, unknown>; }
export interface HarnessFlowStep { id: string; action: string; occurrence: number; state: string; input: Record<string, unknown>; output: Record<string, unknown> | null; version: number; created: number; updated: number; }
export interface HarnessFlowRun { id: string; flowId: string; name?: string; flowVersion: number; state: string; actionId: string | null; recordId: string | null; step?: number; version: number; updatedAt: number; context?: Record<string, unknown>; steps?: HarnessFlowStep[]; }
export interface Link { id: string; role: string; since: number | null; until: number | null; other: { id: string; type: string; name: string }; }
export interface Consent { id: string; contact: string; channel: string; purpose: string; state: 'granted' | 'revoked'; source: string; actor: string; created: number; }
export type HarnessFieldKind = 'text' | 'email' | 'number' | 'textarea' | 'record' | 'action-list';
export interface HarnessActionField { key: string; label: string; kind: HarnessFieldKind; required?: boolean; hidden?: boolean; defaultValue?: string; recordType?: string; }
export interface HarnessAction { id: string; version: number; title: string; description: string; type: 'app' | 'agent' | 'human'; interfaceKey: string; fields: HarnessActionField[]; output: string[]; roles: HarnessRole[]; effects: string[]; workRoles?: string[]; }
export interface HarnessInterfaceContract { key: string; version: number; title: string; presentation: 'sheet' | 'screen' | 'flow'; submitLabel: string; }
export interface HarnessTool { id: string; title: string; description: string; icon: string; category?: 'work' | 'create' | 'manage' | 'explore'; module: 'core' | 'pos' | 'commerce' | 'site'; kind: 'tool' | 'human' | 'channel' | 'flow' | 'site' | 'action' | 'flows'; reach?: 'none' | 'customer' | 'money' | 'data'; action: string; input: Record<string, unknown>; }
export interface HarnessTools { tools: HarnessTool[]; modules: { id: 'pos' | 'commerce' | 'site'; title: string; description: string; enabled: boolean }[]; version: number; canManage: boolean; role: string; brief?: string[]; trade?: string | null; }
export interface HarnessSpaceContext {
  id: string; label: string; role: string; owner: string; confidence: number;
  source: 'default' | 'routine' | 'override'; held: boolean;
  workspace: { id: string; slug: string; name: string; mode: 'personal' | 'work' };
}
export interface NowRow {
  id: string; source: string; target: string; kind: 'action' | 'flow' | 'status' | 'artifact';
  role: string; lane: 'mine' | 'available' | 'waiting'; title: string; parent: string | null;
  quantity: number | null; state: string; due: number | null; version: number;
  action: string | null; input: Record<string, unknown>; updated: number; workspace: HarnessWorkspace;
}
export interface NowFeed {
  rows: NowRow[]; partial: boolean; failed: string[]; sync: Record<string, number>;
  grants?: Record<string, string>;
  sources: { id: string; name: string; slug: string; mode: 'personal' | 'work'; role: string; owner: string }[];
  next?: string | null; context?: HarnessSpaceContext; decision?: 'automatic' | 'confirm'; alternatives?: HarnessSpaceContext[];
}
export class HarnessRequestError extends Error { constructor(readonly status: number, message: string, readonly code?: string) { super(message); } }
export function createOperationKey(prefix: string) { return `${prefix}:${randomUUID()}`; }
let syncRouteAvailable = true;

async function request<T>(path: string, options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: object; key?: string; missingRouteOk?: boolean } = {}): Promise<T> {
  const method = options.method || 'GET';
  const route = path.split('?')[0];
  const started = Date.now();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const isLongRunning = path.includes('/site') || path.includes('/actions/site.') || path.includes('/ai/') || path.startsWith('/v1/inbox') || path.includes('/flows');
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new HarnessRequestError(408, 'TAR did not respond in time. Check your connection and retry.'));
    }, isLongRunning ? 60_000 : 30_000);
  });
  const operation = (async () => {
    const token = await getValidIdToken();
    if (!token) throw new HarnessRequestError(0, 'Connect and sign in to refresh TAR.', 'offline_auth');
    let response: Response;
    try {
      response = await fetch(`${HARNESS_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(method === 'POST' || method === 'PUT' || method === 'DELETE' ? { 'Idempotency-Key': options.key || createOperationKey('tarapp') } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined, signal: controller.signal });
    } catch (cause) {
      if (controller.signal.aborted) throw new HarnessRequestError(408, 'TAR did not respond in time. Check your connection and retry.');
      throw cause;
    }
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (__DEV__) console.info(`[Harness] ${method} ${route} ${response.status} ${Date.now() - started}ms${response.headers.get('cf-ray') ? ` ray=${response.headers.get('cf-ray')}` : ''}`);
    if (!response.ok) {
      if (response.status === 401) await invalidateGoogleToken();
      throw new HarnessRequestError(response.status, typeof payload.error === 'string' ? payload.error : 'Harness request failed.', typeof payload.code === 'string' ? payload.code : undefined);
    }
    return payload as T;
  })();
  try { return await Promise.race([operation, deadline]); }
  catch (cause) {
    const status = cause instanceof HarnessRequestError ? cause.status : 'network';
    const code = cause instanceof HarnessRequestError && cause.code ? ` code=${cause.code}` : '';
    if (__DEV__ && !(options.missingRouteOk && cause instanceof HarnessRequestError && cause.status === 404 && cause.message === 'Route not found.'))
      console.info(`[Harness] ${method} ${route} failed status=${status}${code} after ${Date.now() - started}ms: ${cause instanceof Error ? cause.message : String(cause)}`);
    throw cause;
  }
  finally { if (timeout) clearTimeout(timeout); }
}

const registryCache = new Map<string, { actions: HarnessAction[]; interfaces: HarnessInterfaceContract[] }>();

const ITEM_CONTRACT: HarnessInterfaceContract = {
  key: 'item',
  version: 1,
  title: 'Catalog item',
  presentation: 'screen',
  submitLabel: 'Save & Publish',
};

async function workspaceRegistry(slug: string, forceFresh = false): Promise<{ actions: HarnessAction[]; interfaces: HarnessInterfaceContract[] }> {
  if (!forceFresh && registryCache.has(slug)) {
    return registryCache.get(slug)!;
  }
  const result = await request<{ actions: HarnessAction[]; interfaces: HarnessInterfaceContract[] }>(workspacePath(slug, 'actions'));
  const actions = result.actions.map((act) =>
    act.id === 'catalog.item.save' ? { ...act, interfaceKey: 'item' } : act
  );
  const interfaces = result.interfaces.some((it) => it.key === 'item')
    ? result.interfaces
    : [...result.interfaces, ITEM_CONTRACT];
  const enhanced = { actions, interfaces };
  registryCache.set(slug, enhanced);
  return enhanced;
}

export function clearRegistryCache(slug?: string) {
  if (slug) registryCache.delete(slug);
  else registryCache.clear();
}

const workspacePath = (slug: string, suffix = '') => suffix ? `/v1/workspaces/${encodeURIComponent(slug)}/${suffix}` : `/v1/workspaces/${encodeURIComponent(slug)}`;
export const harness = {
  deleteWorkspace: (slug: string) => request<{ deleted: boolean }>(workspacePath(slug), { method: 'DELETE' }),
  pos: <T>(slug: string, section: string, search = '', offset = 0) => request<T>(workspacePath(slug, 'pos/' + section) + '?q=' + encodeURIComponent(search) + '&offset=' + offset),
  posOverview: (slug: string) => request<{ settings: unknown | null }>(workspacePath(slug, 'pos/overview'), { missingRouteOk: true }),
  posProductContent: (slug: string, productId: string) => request<{ content: Record<string, unknown> }>(workspacePath(slug, `pos/products/${encodeURIComponent(productId)}/content`)),
  health: () => request<{ ok: boolean }>('/health'),
  registry: async (): Promise<{ actions: HarnessAction[]; interfaces: HarnessInterfaceContract[] }> => {
    const result = await request<{ actions: HarnessAction[]; interfaces: HarnessInterfaceContract[] }>('/v1/actions');
    const actions = result.actions.map((act) =>
      act.id === 'catalog.item.save' ? { ...act, interfaceKey: 'item' } : act
    );
    const interfaces = result.interfaces.some((it) => it.key === 'item')
      ? result.interfaces
      : [...result.interfaces, ITEM_CONTRACT];
    return { actions, interfaces };
  },
  workspaceRegistry,
  workspaceTools: (slug: string) => request<HarnessTools>(workspacePath(slug, 'tools'), { missingRouteOk: true }),
  members: (slug: string) => request<{ members: HarnessMember[]; currentUserId: string }>(workspacePath(slug, 'members')),
  updateMember: (slug: string, id: string, input: { role?: HarnessRole; workRole?: WorkRole; roles?: WorkRole[]; brief?: string; access?: string[]; email?: string; state?: 'revoked' }) => request(workspacePath(slug, `members/${encodeURIComponent(id)}`), { method: 'PUT', body: input }),
  teamChat: (slug: string) => request<TeamChatState>(workspacePath(slug, 'team-chat')),
  beginChatLink: (slug: string, provider: ChatProvider, purpose: 'destination' | 'identity') => request<{ id: string; command: string; expiresAt: number }>(workspacePath(slug, 'team-chat/link'), { method: 'POST', body: { provider, purpose } }),
  confirmChatLink: (slug: string, id: string, joinUrl: string) => request(workspacePath(slug, 'team-chat/confirm'), { method: 'POST', body: { id, joinUrl } }),
  disconnectChat: (slug: string, destination: boolean) => request(workspacePath(slug, 'team-chat/disconnect'), { method: 'POST', body: { destination } }),
  actions: async () => harness.registry(),
  listWorkspaces: () => request<{ workspaces: HarnessWorkspace[] }>('/v1/workspaces'),
  holdContext: (scope: string, duration = 43_200_000, role?: string) => request<{ context: { mode: 'hold'; scope: string; role: string | null; expires: number } }>('/v1/context', { method: 'PUT', body: { mode: 'hold', scope, duration, role } }),
  resumeContext: () => request<{ context: { mode: 'auto'; scope: null; expires: null } }>('/v1/context', { method: 'PUT', body: { mode: 'auto' } }),
  now: (refresh?: string) => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const query = new URLSearchParams({ zone });
    if (refresh) query.set('refresh', refresh);
    return request<NowFeed>(`/v1/inbox?${query.toString()}`);
  },
  nowSync: async () => {
    type Access = { url: string; authToken: string; expiresAt: number; database: string };
    if (!syncRouteAvailable) return request<Access>('/v1/inbox/replica');
    try { return await request<Access>('/v1/inbox/sync'); }
    catch (cause) {
      if (!(cause instanceof HarnessRequestError) || cause.status !== 404) throw cause;
      syncRouteAvailable = false;
      return request<Access>('/v1/inbox/replica');
    }
  },
  nowDetail: (slug: string, id: string) => request<{ row: NowRow; record: HarnessRecord; workspace: HarnessWorkspace }>(workspacePath(slug, `now/${encodeURIComponent(id)}`)),
  createWorkspace: (name: string, slug: string) => request<{ workspace: HarnessWorkspace }>('/v1/workspaces', { method: 'POST', body: { name, slug }, key: createOperationKey(`workspace:${slug}`) }),
  suggestWorkspace: (brief: string) => request<{ capabilities: { pos: boolean; commerce: boolean; site: boolean; register?: boolean; team?: boolean }; trade?: { id: string; title: string; confidence: number }; tools?: string[]; confidence: Record<string, number>; model?: string; review: true }>('/v1/ai/workspace-suggest', { method: 'POST', body: { brief } }),
  suggestMember: (slug: string, duties: string) => request<{ role: HarnessRole; workRole: WorkRole; roles: WorkRole[]; tools?: string[]; suggestedActions: string[]; permissions: string[]; confidence: number | null; model?: string; review: true }>(workspacePath(slug, 'ai/member-suggest'), { method: 'POST', body: { duties } }),
  evaluateMemberAccess: (slug: string, brief: string) => request<MemberAccessResult>(workspacePath(slug, 'ai/member-access'), { method: 'POST', body: { brief } }),
  matchFlowSteps: (slug: string, steps: string[]) => request<FlowMatchResult>(workspacePath(slug, 'ai/flow-match'), { method: 'POST', body: { steps } }),
  inviteMember: (slug: string, email: string, role: Exclude<HarnessRole, 'owner'> = 'member', workRole: WorkRole = 'general', roles: WorkRole[] = [workRole], brief?: string, access?: string[]) => request<{ invitation: { email: string; role: Exclude<HarnessRole, 'owner'>; state: 'pending' } }>(workspacePath(slug, 'members'), { method: 'POST', body: { email, role, workRole, roles, ...(brief ? { brief } : {}), ...(access ? { access } : {}) }, key: createOperationKey(`invite:${slug}:${email}`) }),
    records: (slug: string, type?: string, offset = 0, search = '') => request<{ records: HarnessRecord[]; next: number | null }>(`${workspacePath(slug, 'records')}?${type ? `type=${encodeURIComponent(type)}&` : ''}q=${encodeURIComponent(search)}&offset=${offset}`),
    record: (slug: string, id: string) => request<{ record: HarnessRecord }>(workspacePath(slug, `records/${encodeURIComponent(id)}`)),
  contacts: (slug: string, search = '', offset = 0) => request<{ contacts: HarnessRecord[]; next: number | null }>(`${workspacePath(slug, 'contacts')}?q=${encodeURIComponent(search)}&offset=${offset}`),
  links: (slug: string, id: string) => request<{ links: Link[] }>(workspacePath(slug, `records/${encodeURIComponent(id)}/links`)),
  consents: (slug: string, id: string) => request<{ consents: Consent[] }>(workspacePath(slug, `records/${encodeURIComponent(id)}/consents`)),
  flows: (slug: string) => request<{ books: HarnessFlowBook[]; runs: HarnessFlowRun[] }>(workspacePath(slug, 'flows')),
  flowRun: (slug: string, id: string) => request<{ run: HarnessFlowRun }>(workspacePath(slug, `runs/${encodeURIComponent(id)}`)),
  detectVariants: (slug: string, input: { product: string; input?: string; brief?: string; trade?: string }) =>
    request<VariantDetectionResult>(workspacePath(slug, 'actions/catalog.item.detect'), { method: 'POST', body: input, key: createOperationKey('catalog.item.detect') }),
  executeAction: <T extends Record<string, unknown> = Record<string, unknown>>(slug: string, actionId: string, input: Record<string, unknown>, operationKey: string) => request<T>(workspacePath(slug, `actions/${encodeURIComponent(actionId)}`), { method: 'POST', body: input, key: operationKey }),
  createRecord: (slug: string, input: { type: string; title: string; data?: Record<string, unknown> }) => request<{ record: HarnessRecord }>(workspacePath(slug, 'actions/record.create'), { method: 'POST', body: input, key: createOperationKey('record.create') }),
  createTask: (slug: string, title: string) => request<{ record: HarnessRecord }>(workspacePath(slug, 'actions/task.create'), { method: 'POST', body: { title }, key: createOperationKey('task.create') }),
  completeTask: (slug: string, taskId: string) => request<{ taskId: string; state: 'completed' }>(workspacePath(slug, 'actions/task.complete'), { method: 'POST', body: { taskId }, key: createOperationKey(`task.complete:${taskId}`) }),
  site: {
    get: (slug: string) => request<SiteSnapshot>(workspacePath(slug, 'site')),
    available: (slug: string) => request<{ site: unknown | null }>(workspacePath(slug, 'site'), { missingRouteOk: true }),
    reset: (slug: string) => request<{ reset: boolean; siteId: string; site: SiteDocument }>(workspacePath(slug, 'site'), { method: 'DELETE' }),
    generate: (slug: string, input: SiteGenerateInput = {}, operationKey?: string) =>
      request<SiteGenerateResult>(
        workspacePath(slug, 'actions/site.generate'),
        { method: 'POST', body: input, key: operationKey || createOperationKey('site.generate') }
      ),
    briefAdd: (slug: string, siteId: string, bullet: string, operationKey?: string) =>
      request<{ siteId: string; version: number; state: string; site: SiteDocument; preview: { html: string; css: string; hash: string } }>(
        workspacePath(slug, 'actions/site.brief.add'),
        { method: 'POST', body: { siteId, bullet }, key: operationKey || createOperationKey('site.brief.add') }
      ),
    briefRemove: (slug: string, siteId: string, bullet: string, operationKey?: string) =>
      request<{ siteId: string; version: number; state: string; site: SiteDocument; preview: { html: string; css: string; hash: string } }>(
        workspacePath(slug, 'actions/site.brief.remove'),
        { method: 'POST', body: { siteId, bullet }, key: operationKey || createOperationKey('site.brief.remove') }
      ),
    noticeSet: (slug: string, siteId: string, notice: string, operationKey?: string) =>
      request<{ siteId: string; version: number; state: string; site: SiteDocument; preview: { html: string; css: string; hash: string }; notice: string }>(
        workspacePath(slug, 'actions/site.notice.set'),
        { method: 'POST', body: { siteId, notice }, key: operationKey || createOperationKey('site.notice.set') }
      ),
    sectionsSet: (slug: string, siteId: string, order: string[], hidden?: string[], shown?: string[], operationKey?: string) =>
      request<{ siteId: string; version: number; state: string; site: SiteDocument; preview: { html: string; css: string; hash: string } }>(
        workspacePath(slug, 'actions/site.sections.set'),
        { method: 'POST', body: { siteId, order, ...(hidden ? { hidden } : {}), ...(shown ? { shown } : {}) }, key: operationKey || createOperationKey('site.sections.set') }
      ),
    ask: (slug: string, siteId: string, command: string, target?: string, operationKey?: string) =>
      request<AskOutcome>(
        workspacePath(slug, 'actions/site.ask'),
        { method: 'POST', body: { siteId, command, ...(target ? { target } : {}) }, key: operationKey || createOperationKey('site.ask') }
      ),
    edit: (slug: string, siteId: string, base: number, operations: unknown[], summary?: string, operationKey?: string) =>
      request<EditOutcome>(
        workspacePath(slug, 'actions/site.edit'),
        { method: 'POST', body: { siteId, base, operations, ...(summary ? { summary } : {}) }, key: operationKey || createOperationKey('site.edit') }
      ),
    undo: (slug: string, siteId: string, revision?: number, operationKey?: string) =>
      request<EditOutcome & { undone: number }>(
        workspacePath(slug, 'actions/site.undo'),
        { method: 'POST', body: { siteId, ...(revision === undefined ? {} : { revision }) }, key: operationKey || createOperationKey('site.undo') }
      ),
    assetUpload: (slug: string, input: { siteId: string; mime: string; kind?: string; data: string; alt?: string; width?: number; height?: number; rights?: { source?: string; license?: string; approved?: boolean } }, operationKey?: string) =>
      request<{ siteId: string; revision: number; site: SiteDocument; assets: Asset[] }>(
        workspacePath(slug, 'actions/site.asset.upload'),
        { method: 'POST', body: input, key: operationKey || createOperationKey('site.asset.upload') }
      ),
    assetGenerate: (slug: string, siteId: string, prompt: string, operationKey?: string) =>
      request<{ siteId: string; revision: number; site: SiteDocument; assets: Asset[] }>(
        workspacePath(slug, 'actions/site.asset.generate'),
        { method: 'POST', body: { siteId, prompt }, key: operationKey || createOperationKey('site.asset.generate') }
      ),
    assets: (slug: string, siteId: string) =>
      request<{ siteId: string; revision: number; assets: AssetSummary[] }>(workspacePath(slug, 'actions/site.assets'), { method: 'POST', body: { siteId }, key: createOperationKey('site.assets') }),
    designImport: (slug: string, siteId: string, markdown: string, operationKey?: string) =>
      request<{ siteId: string; revision: number; design: SiteDocument['design']; decisions: { area: string; question: string; choice: string }[]; notes: string[]; designMarkdown: string }>(
        workspacePath(slug, 'actions/site.design.import'),
        { method: 'POST', body: { siteId, markdown }, key: operationKey || createOperationKey('site.design.import') }
      ),
    checks: (slug: string, siteId: string, releaseId?: string) =>
      request<{ siteId: string; releaseId: string; checks: Checks | null; created: number | null }>(
        workspacePath(slug, 'actions/site.checks'),
        { method: 'POST', body: { siteId, ...(releaseId ? { releaseId } : {}) }, key: createOperationKey('site.checks') }
      ),
    publishLatest: (slug: string, siteId?: string, operationKey?: string) =>
      request<PublishOutcome>(
        workspacePath(slug, 'actions/site.publishLatest'),
        { method: 'POST', body: siteId ? { siteId } : {}, key: operationKey || createOperationKey('site.publishLatest') }
      ),
    rollback: (slug: string, siteId: string, releaseId: string, operationKey?: string) =>
      request<{ siteId: string; releaseId: string; rolledBack: boolean; publicUrl?: string }>(
        workspacePath(slug, 'actions/site.rollback'),
        { method: 'POST', body: { siteId, releaseId }, key: operationKey || createOperationKey('site.rollback') }
      ),
    refresh: (slug: string, siteId: string, operationKey?: string) =>
      request<{ refreshed: boolean; itemCount: number }>(
        workspacePath(slug, 'actions/site.refresh'),
        { method: 'POST', body: { siteId }, key: operationKey || createOperationKey('site.refresh') }
      ),
    unpublish: (slug: string, siteId: string, operationKey?: string) =>
      request<{ siteId: string; unpublished: boolean }>(
        workspacePath(slug, 'actions/site.unpublish'),
        { method: 'POST', body: { siteId }, key: operationKey || createOperationKey('site.unpublish') }
      ),
    releases: (slug: string, siteId: string) =>
      request<{ siteId: string; revision: number; releases: ReleaseManifest[] }>(workspacePath(slug, 'actions/site.releases'), { method: 'POST', body: { siteId }, key: createOperationKey('site.releases') }),
    designs: (slug: string, input: { siteId?: string; models?: string[] } = {}) =>
      request<DesignLibrary>(workspacePath(slug, 'actions/site.designs'), { method: 'POST', body: input, key: createOperationKey('site.designs') }),
  },
};
