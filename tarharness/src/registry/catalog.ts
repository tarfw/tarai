import { posActions } from '../pos/catalog.ts';
import { commerceActions } from '../commerce/catalog.ts';
export type ActionType = 'app' | 'agent' | 'human';
export type InterfacePresentation = 'sheet' | 'screen' | 'flow';
export type FieldKind = 'text' | 'email' | 'number' | 'textarea' | 'record' | 'action-list';

export interface ActionField {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly defaultValue?: string;
  readonly recordType?: string;
}

export interface ActionDefinition {
  readonly id: string;
  readonly version: number;
  readonly type: ActionType;
  readonly title: string;
  readonly description: string;
  readonly interfaceKey: string;
  readonly fields: readonly ActionField[];
  readonly output: readonly string[];
  readonly roles: readonly ('owner' | 'admin' | 'member' | 'guest')[];
  readonly effects: readonly string[];
}

export interface InterfaceContract {
  readonly key: string;
  readonly version: number;
  readonly title: string;
  readonly presentation: InterfacePresentation;
  readonly submitLabel: string;
}

export const interfaceCatalog = [
  { key: 'pos', version: 1, title: 'Point of sale', presentation: 'flow', submitLabel: 'Pay' },
  { key: 'item', version: 1, title: 'Catalog item', presentation: 'screen', submitLabel: 'Save & Publish' },
  { key: 'form', version: 1, title: 'Form', presentation: 'screen', submitLabel: 'Save' },
  { key: 'confirmation', version: 1, title: 'Confirmation', presentation: 'sheet', submitLabel: 'Confirm' },
  { key: 'flow', version: 1, title: 'Flow', presentation: 'flow', submitLabel: 'Start' },
  { key: 'flow-builder', version: 1, title: 'Flow builder', presentation: 'screen', submitLabel: 'Create Flow' },
] as const satisfies readonly InterfaceContract[];

export const actionCatalog = [
  ...posActions,
  ...commerceActions,
  {
    id: 'capability.save', version: 1, type: 'app', title: 'Manage tools',
    description: 'Enable or disable workspace capabilities.', interfaceKey: 'form',
    fields: [
      { key: 'module', label: 'Capability', kind: 'text', required: true },
      { key: 'enabled', label: 'Enabled', kind: 'text', required: true },
      { key: 'baseVersion', label: 'Version', kind: 'number', required: true },
    ],
    output: ['enabled', 'version'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'brief.save', version: 1, type: 'app', title: 'Save brief',
    description: 'Save the workspace brief and classified trade.', interfaceKey: 'form',
    fields: [
      { key: 'brief', label: 'Brief', kind: 'text' },
      { key: 'trade', label: 'Trade', kind: 'text' },
    ],
    output: ['saved'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'record.create', version: 1, type: 'app', title: 'Create record',
    description: 'Add information to this workspace.', interfaceKey: 'form',
    fields: [
      { key: 'type', label: 'Record type', kind: 'text', required: true, defaultValue: 'contact' },
      { key: 'title', label: 'Name or title', kind: 'text', required: true },
    ],
    output: ['record'], roles: ['owner', 'admin', 'member'], effects: ['record_create'],
  },
  {
    id: 'routine.save', version: 1, type: 'app', title: 'Add Space routine',
    description: 'Choose when a workspace and role should become your active Space.', interfaceKey: 'form',
    fields: [
      { key: 'id', label: 'Routine', kind: 'text', hidden: true },
      { key: 'baseVersion', label: 'Version', kind: 'number', hidden: true },
      { key: 'label', label: 'Context name', kind: 'text', required: true },
      { key: 'workspace', label: 'Workspace', kind: 'text', required: true },
      { key: 'role', label: 'Your role', kind: 'text' },
      { key: 'start', label: 'Start time (HH:MM)', kind: 'text', required: true },
      { key: 'end', label: 'End time (HH:MM)', kind: 'text', required: true },
      { key: 'days', label: 'Days (0=Sun, comma separated)', kind: 'text', defaultValue: '0,1,2,3,4,5,6' },
      { key: 'priority', label: 'Priority', kind: 'number', defaultValue: '0' },
    ],
    output: ['record'], roles: ['owner'], effects: ['routine_save'],
  },
  {
    id: 'routine.remove', version: 1, type: 'app', title: 'Remove Space routine',
    description: 'Stop this routine from selecting a Space.', interfaceKey: 'confirmation',
    fields: [
      { key: 'id', label: 'Routine', kind: 'text', required: true, hidden: true },
      { key: 'baseVersion', label: 'Version', kind: 'number', required: true, hidden: true },
    ],
    output: ['id'], roles: ['owner'], effects: ['routine_remove'],
  },
  {
    id: 'agent.save', version: 1, type: 'app', title: 'Name personal agent',
    description: 'Set custom name for your personal agent.', interfaceKey: 'form',
    fields: [
      { key: 'name', label: 'Agent name', kind: 'text', required: true },
    ],
    output: ['name', 'record'], roles: ['owner', 'admin', 'member'], effects: ['record_update'],
  },
  {
    id: 'contact.create', version: 1, type: 'app', title: 'Add person',
    description: 'Create a person record that stays separate from their work history.', interfaceKey: 'form',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true },
      { key: 'email', label: 'Email', kind: 'email' },
      { key: 'phone', label: 'Phone', kind: 'text' },
    ],
    output: ['record'], roles: ['owner', 'admin', 'member'], effects: ['record_create'],
  },
  {
    id: 'organization.create', version: 1, type: 'app', title: 'Add organization',
    description: 'Create an organization record for customers, suppliers or partners.', interfaceKey: 'form',
    fields: [
      { key: 'name', label: 'Organization name', kind: 'text', required: true },
      { key: 'email', label: 'Email', kind: 'email' },
      { key: 'phone', label: 'Phone', kind: 'text' },
      { key: 'website', label: 'Website', kind: 'text' },
    ],
    output: ['record'], roles: ['owner', 'admin', 'member'], effects: ['record_create'],
  },
  {
    id: 'relationship.create', version: 1, type: 'app', title: 'Link person to organization',
    description: 'Record a person’s role at an organization with its own time range.', interfaceKey: 'form',
    fields: [
      { key: 'source', label: 'Person record ID', kind: 'text', required: true },
      { key: 'target', label: 'Organization record ID', kind: 'text', required: true },
      { key: 'role', label: 'Role', kind: 'text', required: true },
      { key: 'since', label: 'Start date (timestamp)', kind: 'number' },
      { key: 'until', label: 'End date (timestamp)', kind: 'number' },
    ],
    output: ['link'], roles: ['owner', 'admin', 'member'], effects: ['relationship_create'],
  },
  {
    id: 'relationship.end', version: 1, type: 'app', title: 'End relationship',
    description: 'Close a person’s current role while keeping its history.', interfaceKey: 'form',
    fields: [
      { key: 'id', label: 'Relationship', kind: 'text', required: true, hidden: true },
      { key: 'until', label: 'End date (timestamp)', kind: 'number', required: true },
    ],
    output: ['id', 'until'], roles: ['owner', 'admin', 'member'], effects: ['relationship_update'],
  },
  {
    id: 'consent.record', version: 1, type: 'app', title: 'Record contact consent',
    description: 'Record an explicit channel and purpose decision with its evidence. An address or relationship is never consent.', interfaceKey: 'form',
    fields: [
      { key: 'contactId', label: 'Contact', kind: 'record', required: true, hidden: true },
      { key: 'channel', label: 'Channel (email, sms, phone, whatsapp)', kind: 'text', required: true },
      { key: 'purpose', label: 'Purpose (marketing, transactional, support)', kind: 'text', required: true },
      { key: 'state', label: 'Decision (granted or revoked)', kind: 'text', required: true },
      { key: 'source', label: 'Evidence or source', kind: 'textarea', required: true },
    ],
    output: ['consent'], roles: ['owner', 'admin', 'member'], effects: ['consent_record'],
  },
  {
    id: 'record.update', version: 2, type: 'app', title: 'Update record',
    description: 'Change an existing record using its current version.', interfaceKey: 'form',
    fields: [
      { key: 'recordId', label: 'Record', kind: 'record', required: true },
      { key: 'baseVersion', label: 'Version', kind: 'number', required: true, hidden: true },
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'state', label: 'Status', kind: 'text', hidden: true },
    ],
    output: ['recordId', 'version'], roles: ['owner', 'admin', 'member'], effects: ['record_update'],
  },
  {
    id: 'task.create', version: 1, type: 'human', title: 'Create task',
    description: 'Assign work that appears in Now.', interfaceKey: 'form',
    fields: [
      { key: 'title', label: 'What needs doing?', kind: 'text', required: true },
      { key: 'assigneeId', label: 'Assignee', kind: 'text' },
    ],
    output: ['record'], roles: ['owner', 'admin', 'member'], effects: ['record_create', 'inbox'],
  },
  {
    id: 'task.complete', version: 1, type: 'human', title: 'Complete task',
    description: 'Complete assigned work and resume its Flow when applicable.', interfaceKey: 'confirmation',
    fields: [{ key: 'taskId', label: 'Task', kind: 'record', required: true, recordType: 'task' }],
    output: ['taskId', 'state'], roles: ['owner', 'admin', 'member'], effects: ['record_update', 'run_resume'],
  },
  {
    id: 'flow.start', version: 1, type: 'app', title: 'Start flow',
    description: 'Start a published process and save its progress.', interfaceKey: 'flow',
    fields: [
      { key: 'flowId', label: 'Flow', kind: 'text', required: true, hidden: true },
      { key: 'recordId', label: 'Related record', kind: 'record' },
    ],
    output: ['run'], roles: ['owner', 'admin', 'member'], effects: ['run_create'],
  },
  {
    id: 'flow.publish', version: 3, type: 'app', title: 'Create Flow Book',
    description: 'Publish a reusable ordered process for this workspace.', interfaceKey: 'flow-builder',
    fields: [
      { key: 'flowId', label: 'Flow ID', kind: 'text', required: true, hidden: true },
      { key: 'name', label: 'Flow name', kind: 'text', required: true },
      { key: 'description', label: 'Description', kind: 'textarea' },
      { key: 'actions', label: 'Actions', kind: 'action-list', required: true, hidden: true },
    ],
    output: ['flowId', 'published'], roles: ['owner', 'admin'], effects: ['definition_publish', 'canvas_update'],
  },
  {
    id: 'flow.advance', version: 1, type: 'app', title: 'Continue Flow Book',
    description: 'Complete the current registered step and save Flow Book progress.', interfaceKey: 'confirmation',
    fields: [
      { key: 'runId', label: 'Run', kind: 'text', required: true, hidden: true },
      { key: 'actionId', label: 'Action', kind: 'text', required: true, hidden: true },
    ],
    output: ['run', 'result'], roles: ['owner', 'admin', 'member'], effects: ['run_advance'],
  },
  {
    id: 'flow.suggest', version: 1, type: 'agent', title: 'Suggest a Flow Book step',
    description: 'Suggest one first step from registered Actions for a user-reviewed Flow Book.', interfaceKey: 'form',
    fields: [{ key: 'prompt', label: 'What outcome should this Flow Book produce?', kind: 'textarea', required: true }],
    output: ['action', 'confidence', 'probabilities', 'review'], roles: ['owner', 'admin'], effects: ['model_inference'],
  },
  {
    id: 'site.generate', version: 1, type: 'agent', title: 'Generate site draft',
    description: 'Build a storefront draft from what the business is and the facts on record. Lists accept comma-separated values.', interfaceKey: 'form',
    fields: [
      { key: 'prompt', label: 'Business description', kind: 'textarea' },
      { key: 'title', label: 'Shop name', kind: 'text' },
      { key: 'audience', label: 'Who it serves', kind: 'text' },
      { key: 'tone', label: 'Voice', kind: 'text' },
      { key: 'city', label: 'City', kind: 'text' },
      { key: 'models', label: 'How customers pay (products, food, booking, quote, digital, bulk)', kind: 'text' },
      { key: 'industry', label: 'Trade', kind: 'text' },
      { key: 'style', label: 'Design', kind: 'text' },
      { key: 'lead', label: 'Lead section', kind: 'text' },
      { key: 'notice', label: 'Notice line', kind: 'text' },
      { key: 'season', label: 'Season or offer', kind: 'text' },
      { key: 'records', label: 'Catalog items', kind: 'text' },
      { key: 'services', label: 'Bookable services', kind: 'text' },
      { key: 'hours', label: 'Opening hours', kind: 'text' },
      { key: 'proofs', label: 'Proof points', kind: 'text' },
      { key: 'features', label: 'Highlights', kind: 'text' },
      { key: 'terms', label: 'Policy lines', kind: 'text' },
      { key: 'minimum', label: 'Minimum order', kind: 'text' },
      { key: 'phone', label: 'Phone', kind: 'text' },
      { key: 'email', label: 'Email', kind: 'email' },
      { key: 'address', label: 'Address', kind: 'text' },
      { key: 'locale', label: 'Language', kind: 'text' },
    ],
    output: ['siteId', 'version', 'site', 'preview', 'gate', 'missing'], roles: ['owner', 'admin'], effects: ['record_create'],
  },
  {
    id: 'site.designs', version: 1, type: 'app', title: 'Read designs',
    description: 'Read the reviewed design library the merchant can choose from, with the sections the store model needs, the layouts each section offers, their settings, and the site’s current overrides.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: false },
      { key: 'models', label: 'Commerce models', kind: 'text', required: false },
    ],
    output: ['designs', 'default', 'models', 'sections', 'recipes', 'settings', 'defaults', 'overrides'], roles: ['owner', 'admin'], effects: [],
  },
  {
    id: 'site.scout', version: 1, type: 'agent', title: 'Scout the site',
    description: 'Run declared checks over the site, repair unambiguous drift as a draft revision, and place one review item in Space. Never publishes.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
    ],
    output: ['siteId', 'revision', 'findings', 'taskId'], roles: ['owner', 'admin'], effects: ['record_update', 'inbox'],
  },
  {
    id: 'site.edit', version: 1, type: 'app', title: 'Edit site patch',
    description: 'Apply a reviewed, typed patch to the site draft with revision checks and locks.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'base', label: 'Revision', kind: 'number', required: true },
    ],
    output: ['siteId', 'version', 'revision', 'diff'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.ask', version: 1, type: 'agent', title: 'Ask for a site change',
    description: 'Resolve a plain-language change into a reviewable patch. Nothing is applied here.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'command', label: 'Change', kind: 'textarea', required: true },
    ],
    output: ['target', 'operations', 'summary', 'questions'], roles: ['owner', 'admin'], effects: ['model_inference'],
  },
  {
    id: 'site.undo', version: 1, type: 'app', title: 'Undo site change',
    description: 'Restore an earlier revision by writing a new revision.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
    ],
    output: ['siteId', 'version', 'revision', 'diff'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.brief.add', version: 1, type: 'app', title: 'Add brief bullet',
    description: 'Add a merchant brief bullet to steer the site generation.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'bullet', label: 'Brief bullet', kind: 'text', required: true },
    ],
    output: ['siteId', 'version', 'site', 'blueprint'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.brief.remove', version: 1, type: 'app', title: 'Remove brief bullet',
    description: 'Remove a merchant brief bullet from site steering.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'bullet', label: 'Brief bullet', kind: 'text', required: true },
    ],
    output: ['siteId', 'version', 'site', 'blueprint'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.notice.set', version: 1, type: 'app', title: 'Set notice banner',
    description: 'Update the urgent announcement banner on the storefront with zero AI call.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'notice', label: 'Notice text', kind: 'text', required: false },
    ],
    output: ['siteId', 'version', 'site', 'notice'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.sections.set', version: 1, type: 'app', title: 'Configure storefront sections',
    description: 'Reorder or toggle visibility of storefront sections. The choice is stored as an override, so it survives regeneration.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'order', label: 'Section order', kind: 'text', required: false },
      { key: 'hidden', label: 'Hidden sections', kind: 'text', required: false },
      { key: 'shown', label: 'Sections turned on', kind: 'text', required: false },
      { key: 'ordering', label: 'Take orders online (on or off)', kind: 'text', required: false },
    ],
    output: ['siteId', 'version', 'state', 'site', 'preview', 'blueprint', 'gate', 'missing'], roles: ['owner', 'admin'], effects: ['record_update', 'model_inference'],
  },
  {
    id: 'site.checks', version: 1, type: 'app', title: 'Read site checks',
    description: 'Read the deterministic checks stored with a compiled candidate.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
    ],
    output: ['releaseId', 'checks'], roles: ['owner', 'admin'], effects: [],
  },
  {
    id: 'site.design.import', version: 1, type: 'app', title: 'Import design.md',
    description: 'Parse a readable design reference into the typed design with recorded decisions.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'markdown', label: 'Design reference', kind: 'textarea', required: true },
    ],
    output: ['siteId', 'revision', 'design', 'decisions', 'designMarkdown'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.asset.upload', version: 1, type: 'app', title: 'Upload site asset',
    description: 'Store a media asset with provenance and rights before it can be published.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'mime', label: 'Type', kind: 'text', required: true },
      { key: 'data', label: 'Base64 data', kind: 'textarea', required: true },
    ],
    output: ['siteId', 'revision', 'assets'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.asset.generate', version: 1, type: 'agent', title: 'Generate site illustration',
    description: 'Generate an illustrative image. Generated media never evidences product facts.', interfaceKey: 'form',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'prompt', label: 'Illustration', kind: 'text', required: true },
    ],
    output: ['siteId', 'revision', 'assets'], roles: ['owner', 'admin'], effects: ['model_inference', 'record_update'],
  },
  {
    id: 'site.assets', version: 1, type: 'app', title: 'List site assets',
    description: 'List site assets with rights, usage and publication URL.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
    ],
    output: ['siteId', 'revision', 'assets'], roles: ['owner', 'admin'], effects: [],
  },
  {
    id: 'site.releases', version: 1, type: 'app', title: 'List site releases',
    description: 'List retained immutable releases available for rollback.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
    ],
    output: ['siteId', 'revision', 'releases'], roles: ['owner', 'admin'], effects: [],
  },
  {
    id: 'site.compile', version: 2, type: 'app', title: 'Compile site candidate',
    description: 'Compile frozen site definition into release candidate manifest.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
    ],
    output: ['releaseId', 'hash', 'previewUrl'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.publish', version: 2, type: 'app', title: 'Publish site',
    description: 'Promote release candidate to live website routing.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'releaseId', label: 'Candidate', kind: 'text', required: true },
      { key: 'hash', label: 'Candidate hash', kind: 'text', required: true },
      { key: 'subdomain', label: 'Subdomain', kind: 'text' },
    ],
    output: ['siteId', 'releaseId', 'liveUrl', 'generation'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.publishLatest', version: 1, type: 'app', title: 'Publish the store',
    description: 'One call: rebuild the storefront when the merchant changed anything it reads, compile the draft, and put that candidate live. A store that is not ready stays a draft and answers with what is still missing.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: false },
      { key: 'prompt', label: 'Business description', kind: 'textarea' },
      { key: 'title', label: 'Shop name', kind: 'text' },
      { key: 'records', label: 'Catalog items', kind: 'text' },
    ],
    output: ['siteId', 'published', 'state', 'releaseId', 'liveUrl', 'publicUrl', 'gate', 'missing', 'blocking'], roles: ['owner', 'admin'], effects: ['record_update', 'model_inference'],
  },
  {
    id: 'site.rollback', version: 1, type: 'app', title: 'Rollback site release',
    description: 'Revert live website to a previous release manifest.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
      { key: 'releaseId', label: 'Release ID', kind: 'text', required: true },
    ],
    output: ['siteId', 'releaseId', 'rolledBack'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.refresh', version: 1, type: 'app', title: 'Refresh public facts',
    description: 'Recompute live catalog and hours into site without AI re-inference.', interfaceKey: 'confirmation',
    fields: [
      { key: 'siteId', label: 'Site', kind: 'record', required: true },
    ],
    output: ['refreshed', 'itemCount'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'site.unpublish', version: 1, type: 'app', title: 'Unpublish site',
    description: 'Stop serving the public site while keeping retained releases.', interfaceKey: 'confirmation',
    fields: [{ key: 'siteId', label: 'Site', kind: 'record', required: true }],
    output: ['siteId', 'unpublished'], roles: ['owner', 'admin'], effects: ['record_update'],
  },
  {
    id: 'web.search', version: 1, type: 'app', title: 'Search the web',
    description: 'Find current public sources for a focused research question.', interfaceKey: 'form',
    fields: [
      { key: 'query', label: 'Search query', kind: 'text', required: true },
      { key: 'location', label: 'Country code', kind: 'text' },
      { key: 'language', label: 'Language code', kind: 'text' },
    ],
    output: ['query', 'sources'], roles: ['owner', 'admin', 'member'], effects: ['web_search'],
  },
] as const satisfies readonly ActionDefinition[];

export type ActionId = typeof actionCatalog[number]['id'];

export function findAction(actionId: string): ActionDefinition | undefined {
  const target = actionId.toLowerCase();
  return actionCatalog.find((action) => action.id === actionId || action.id.toLowerCase() === target);
}
