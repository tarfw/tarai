// The card floor: what may become a custom card, and how a plan reads back to
// a merchant. One tap on a core card is already a card; a custom card must do
// something the tap cannot — a time, or a second action.

import { badRequest } from '../errors.ts';
import { findAction } from '../registry/catalog.ts';
import { TOOL_IDS, findTool, toolForAction, type ToolId } from '../tools/registry.ts';
import { matchCoreTools } from '../tools/match.ts';
import type { SkillStep, Trigger } from './engine.ts';

const CORE_TAPS = new Set(
  TOOL_IDS.map((id) => findTool(id)?.card.tap.action).filter((action): action is string => Boolean(action)),
);

export interface CardShape {
  readonly title: string;
  readonly words?: string;
  readonly trigger: Trigger;
  readonly steps: readonly SkillStep[];
}

/** The tool whose one tap this step is, when it is exactly a core tap. */
export function coreTapOf(step: SkillStep): ToolId | null {
  const owner = toolForAction(step.action);
  const tool = owner ? findTool(owner) : undefined;
  return tool && tool.card.tap.action === step.action ? tool.id : null;
}

/** A custom card names no core card, and is more than a lone core tap. */
export function assertCard(draft: CardShape): void {
  // a trigger or a second action earns the card; a lone tap stays a core tap
  const flow = draft.trigger.type !== 'tap' || draft.steps.length >= 2;
  if (flow) return;
  const core = [...matchCoreTools(draft.title), ...matchCoreTools(draft.words ?? '')];
  if (core.length) {
    throw badRequest(`That is the ${findTool(core[0])?.card.title ?? core[0]} card. Add it to the canvas instead.`);
  }
  if (draft.steps.length === 1 && CORE_TAPS.has(draft.steps[0].action)) {
    throw badRequest('That is already one tap on a card. Give it a time or a second action.');
  }
}

/** The plan in plain words: action titles and the values given, never ids. */
export function planPreview(draft: { readonly trigger: Trigger; readonly steps: readonly SkillStep[] }): string[] {
  const lines: string[] = [];
  if (draft.trigger.type === 'schedule') lines.push(`Every day at ${draft.trigger.at}`);
  else if (draft.trigger.type === 'event') lines.push(`When ${draft.trigger.on.replace(/[._]/g, ' ')} happens`);
  for (const step of draft.steps) {
    const title = findAction(step.action)?.title ?? step.action;
    const values = Object.values(step.input)
      .filter((value) => typeof value === 'string' || typeof value === 'number')
      .map(String)
      .filter((value) => value.trim())
      .slice(0, 2);
    lines.push(values.length ? `${title} · ${values.join(' · ')}` : title);
  }
  return lines;
}
