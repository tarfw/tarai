// Skills: memory of flow. Words become a plan of registered actions only,
// one confirm makes it a skill, and it runs free forever after.
//
//   L0 literal  the exact words matched a confirmed skill        0 calls
//   L1 shape    the same trigger+action shape matched            0 calls
//   L2 prose    the LLM proposes steps from the registry          1 call
//
// Nothing else runs a model. A plan that names an unregistered action is
// refused, never guessed.

import type { Client } from '@libsql/client/web';
import { badRequest } from '../errors.ts';
import { findAction } from '../registry/catalog.ts';
import { commitWrite } from '../truth/write.ts';
import { fingerprint } from '../gateway/commit.ts';

export interface SkillStep {
  readonly action: string;
  readonly input: Record<string, unknown>;
  /** auto steps run alone; ask steps wait for a person */
  readonly auto?: boolean;
}

export type Trigger =
  | { readonly type: 'tap' }
  | { readonly type: 'schedule'; readonly at: string } // HH:mm in workspace zone
  | { readonly type: 'event'; readonly on: string };   // a move kind

export interface SkillRecord {
  readonly id: string;
  readonly title: string;
  readonly shape: string;
  readonly trigger: Trigger;
  readonly steps: readonly SkillStep[];
  readonly confirmed: boolean;
  /** the words that made this skill; L0 matches them exactly */
  readonly words: string;
}

const json = (value: unknown) => JSON.stringify(value);
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function toRecord(row: { [index: number]: unknown; length: number }): SkillRecord {
  const data = JSON.parse(String(row[4])) as { title?: string; steps?: SkillStep[]; words?: string };
  return {
    id: String(row[0]),
    title: typeof data.title === 'string' ? data.title : 'Skill',
    shape: String(row[1]),
    trigger: JSON.parse(String(row[2])) as Trigger,
    steps: Array.isArray(data.steps) ? data.steps : [],
    confirmed: Number(row[3]) === 1,
    words: typeof data.words === 'string' ? data.words : '',
  };
}

async function selectSkills(client: Client, where = '', args: (string | number)[] = []): Promise<SkillRecord[]> {
  const result = await client.execute({ sql: `SELECT id,shape,trigger,confirmed,data FROM skill ${where}`, args });
  return result.rows.map(toRecord);
}

/** The shape of a request: trigger type + the ordered action ids. Words differ, shapes match. */
export async function shapeOf(trigger: Trigger, steps: readonly { action: string }[]): Promise<string> {
  return fingerprint({ type: trigger.type, actions: steps.map((step) => step.action) });
}

/** A validated plan: every step is a registered action, at most 12 of them. */
export function validatePlan(steps: unknown): SkillStep[] {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 12) throw badRequest('A plan needs one to twelve steps.');
  const parsed = steps.map((entry) => {
    const item = object(entry);
    const action = findAction(String(item.action || ''));
    if (!action) throw badRequest(`This plan uses an unregistered action: ${String(item.action || '')}.`);
    return { action: action.id, input: object(item.input), ...(item.auto === true ? { auto: true } : {}) };
  });
  return parsed;
}

export interface Draft {
  readonly title: string;
  readonly words: string;
  readonly trigger: Trigger;
  readonly steps: readonly SkillStep[];
  readonly shape: string;
}

export interface AskOutcome {
  readonly ladder: 'L0' | 'L1' | 'L2';
  readonly skill: SkillRecord | null;
  /** L2 only: the proposed plan awaiting the one confirm */
  readonly draft: Draft | null;
}

/** L0 then L1 then (caller-supplied) L2. The proposer runs only when both memories miss. */
export async function ask(client: Client, words: string, propose: (words: string) => Promise<{ title: string; trigger: Trigger; steps: SkillStep[] }>): Promise<AskOutcome> {
  const clean = words.trim();
  if (!clean) throw badRequest('Say what TAR should do.');
  const skills = await selectSkills(client);
  // L0: the exact words, already confirmed — zero calls
  const literal = skills.find((skill) => skill.confirmed && skill.words.toLowerCase() === clean.toLowerCase());
  if (literal) return { ladder: 'L0', skill: literal, draft: null };
  // L2 proposal first (shape needs its steps), then L1 match on shape
  const proposal = await propose(clean);
  const steps = validatePlan(proposal.steps);
  const shape = await shapeOf(proposal.trigger, steps);
  const remembered = skills.find((skill) => skill.confirmed && skill.shape === shape);
  if (remembered) return { ladder: 'L1', skill: remembered, draft: null };
  return { ladder: 'L2', skill: null, draft: { title: proposal.title, words: clean, trigger: proposal.trigger, steps, shape } };
}

/** The one confirm: the draft becomes a confirmed skill. Idempotent on the confirm key. */
export async function confirmSkill(client: Client, member: string, draft: Draft, key: string): Promise<SkillRecord> {
  const steps = validatePlan(draft.steps);
  const existing = await selectSkills(client, 'WHERE shape=? AND confirmed=1', [draft.shape]);
  if (existing[0]) return existing[0];
  const id = `skill_${crypto.randomUUID()}`;
  await commitWrite(client, [{
    sql: 'INSERT INTO skill(id,shape,trigger,data,score,confirmed,created) VALUES (?,?,?,?,0,1,?)',
    args: [id, draft.shape, json(draft.trigger), json({ title: draft.title, steps, words: draft.words }), Date.now()],
  }]);
  return { id, title: draft.title, shape: draft.shape, trigger: draft.trigger, steps, confirmed: true, words: draft.words };
}

/** The member's confirmed skills, newest first. */
export async function listSkills(client: Client): Promise<SkillRecord[]> {
  return selectSkills(client, 'WHERE confirmed=1 ORDER BY created DESC');
}

export async function findSkill(client: Client, id: string): Promise<SkillRecord | null> {
  const found = await selectSkills(client, 'WHERE id=?', [id]);
  return found[0] ?? null;
}
