/**
 * Recipe checking (parai §5.4): a recipe is admitted only when its shape, its layout word,
 * its slot grammar and its token paths are all real. Markup, colours and measurements stay
 * in code, so what is checked here is the contract between a recipe and the renderer.
 */

import { COMMERCE_MODELS } from '../blueprint.ts';
import { LAYOUT_COLLAPSES, LAYOUT_HEIGHTS, LAYOUT_RATIOS, SECTION_LAYOUTS } from '../document.ts';
import { TOKENS } from '../design.ts';
import { SECTION_TYPES, SETTING_TYPES, SLOT_NEEDS, type Recipe } from './recipe.ts';

export interface RecipeCheck {
  file: string;
  recipe?: Recipe;
  problems: string[];
}

/** `brief.*`, `facts.*`, `route.*`, `photos[i]`, `items[i..j]`, `services[i..j]`. */
const SLOT_SOURCE = /^(?:brief|facts|route)\.[a-z][a-z0-9]{0,23}$|^(?:photos|items|services)\[\d{1,3}\]$|^(?:photos|items|services)\[\d{1,3}\.\.\d{1,3}\]$/;
const WORD = /^[a-z][a-z0-9]{0,23}$/;
const HEX = /#[0-9a-f]{3,8}\b/i;
const LENGTH = /\d+(px|rem|em|vw|vh|s|ms)\b/;
/** An in-page anchor or a page path: the two shapes the compiler can point a button at. */
const TARGET = /^(?:[#/][a-z0-9][a-z0-9-]{0,60})$/;
/** The grammar a recipe may name; `flow` and `flex` are documents, not layouts. */
const GRAMMAR = SECTION_LAYOUTS.filter((kind) => kind !== 'flow' && kind !== 'flex');

const object = (value: unknown): Record<string, unknown> => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const word = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

function checkText(problems: string[], value: unknown, at: string, max: number): void {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) problems.push(`${at} must be written.`);
  else if (text.length > max) problems.push(`${at} is longer than ${max} characters.`);
}

/** A recipe may only name a token the design system carries. */
function checkTokenPath(problems: string[], value: unknown, at: string): void {
  const path = word(value).replace(/^token:/, '');
  if (!path) { problems.push(`${at} names no token.`); return; }
  if (!TOKENS.some((token) => `${token.group}.${token.key}` === path)) problems.push(`${at} names ${path}, which no design carries.`);
}

function checkLayout(problems: string[], layout: unknown, at: string): void {
  const spec = object(layout);
  const kind = word(spec.kind);
  if (!GRAMMAR.includes(kind as (typeof GRAMMAR)[number])) {
    problems.push(`${at}.kind must name a layout primitive (${GRAMMAR.join(', ')}).`);
    return;
  }
  if (spec.ratio !== undefined) {
    if (kind !== 'split') problems.push(`${at}.ratio belongs to a split.`);
    if (!LAYOUT_RATIOS.includes(word(spec.ratio) as (typeof LAYOUT_RATIOS)[number])) problems.push(`${at}.ratio must be one of ${LAYOUT_RATIOS.join(', ')}.`);
  }
  if (spec.collapse !== undefined) {
    if (kind !== 'split' && kind !== 'row') problems.push(`${at}.collapse belongs to a split or a row.`);
    if (!LAYOUT_COLLAPSES.includes(word(spec.collapse) as (typeof LAYOUT_COLLAPSES)[number])) problems.push(`${at}.collapse must be stack or keep.`);
  }
  if (spec.height !== undefined) {
    if (kind !== 'overlay') problems.push(`${at}.height belongs to an overlay.`);
    if (!LAYOUT_HEIGHTS.includes(word(spec.height) as (typeof LAYOUT_HEIGHTS)[number])) problems.push(`${at}.height must be one of ${LAYOUT_HEIGHTS.join(', ')}.`);
  }
  if (spec.scrim !== undefined) {
    if (kind !== 'overlay') problems.push(`${at}.scrim belongs to an overlay.`);
    else checkTokenPath(problems, spec.scrim, `${at}.scrim`);
  }
  if (spec.columns !== undefined) {
    if (kind !== 'grid') problems.push(`${at}.columns belongs to a grid.`);
    if (typeof spec.columns !== 'number' || spec.columns < 1 || spec.columns > 6) problems.push(`${at}.columns must be 1 to 6.`);
  }
}

function checkSlots(problems: string[], slots: unknown, needs: unknown, at: string): void {
  const record = object(slots);
  if (!Object.keys(record).length) problems.push(`${at} has no slots; a renderer cannot be chosen for it.`);
  const needsRecord = object(needs);
  for (const [name, value] of Object.entries(record)) {
    const slot = object(value);
    const atSlot = `${at}.${name}`;
    if (!WORD.test(name)) problems.push(`${atSlot} must be one lowercase word.`);
    if (!SLOT_SOURCE.test(word(slot.source))) problems.push(`${atSlot}.source ${word(slot.source) || '(empty)'} is not in the slot grammar.`);
    if (slot.max !== undefined && (typeof slot.max !== 'number' || slot.max < 1 || slot.max > 500)) problems.push(`${atSlot}.max must be 1 to 500.`);
    if (slot.count !== undefined && (typeof slot.count !== 'number' || slot.count < 1 || slot.count > 12)) problems.push(`${atSlot}.count must be 1 to 12.`);
    if (!Object.prototype.hasOwnProperty.call(needsRecord, name)) problems.push(`${atSlot} is not declared in needs.`);
  }
  for (const name of Object.keys(needsRecord)) {
    if (!Object.prototype.hasOwnProperty.call(record, name)) problems.push(`${at}.needs names ${name}, which has no slot.`);
    else if (!SLOT_NEEDS.includes(word(needsRecord[name]) as (typeof SLOT_NEEDS)[number])) problems.push(`${at}.needs.${name} must be required or optional.`);
  }
}

function checkSettings(problems: string[], settings: unknown, at: string): void {
  const record = object(settings);
  for (const [name, value] of Object.entries(record)) {
    const setting = object(value);
    const atSetting = `${at}.${name}`;
    if (!WORD.test(name)) problems.push(`${atSetting} must be one lowercase word.`);
    const type = word(setting.type);
    if (!SETTING_TYPES.includes(type as (typeof SETTING_TYPES)[number])) {
      problems.push(`${atSetting}.type must be boolean, text or choice.`);
      continue;
    }
    if (type === 'boolean' && typeof setting.default !== 'boolean') problems.push(`${atSetting}.default must be true or false.`);
    if (type === 'text') {
      checkText(problems, setting.default, `${atSetting}.default`, 120);
      if (setting.max !== undefined && (typeof setting.max !== 'number' || setting.max < 1 || setting.max > 120)) problems.push(`${atSetting}.max must be 1 to 120.`);
    }
    if (type === 'choice') {
      const options = list(setting.options).map(word);
      if (options.length < 2 || new Set(options).size !== options.length) problems.push(`${atSetting}.options must hold two or more distinct choices.`);
      if (!options.includes(word(setting.default))) problems.push(`${atSetting}.default must be one of its options.`);
    }
  }
}

/** parai §5.5: a recipe carries structure, never a colour, a length or a font name. */
function checkNoLiterals(problems: string[], value: unknown, at: string): void {
  if (typeof value === 'string') {
    if (HEX.test(value)) problems.push(`${at} writes a colour as a hex value; name a token instead.`);
    if (LENGTH.test(value)) problems.push(`${at} writes a measurement; the design system owns lengths.`);
    return;
  }
  if (Array.isArray(value)) { value.forEach((entry, index) => checkNoLiterals(problems, entry, `${at}[${index}]`)); return; }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) checkNoLiterals(problems, entry, `${at}.${key}`);
  }
}

export function checkRecipe(raw: unknown, file: string): RecipeCheck {
  const problems: string[] = [];
  const recipe = object(raw);
  const folder = file.replace(/\\/g, '/').split('/').slice(-2);
  const [typeFolder, idFile] = folder;

  const id = word(recipe.id);
  const type = word(recipe.type);
  if (!WORD.test(id)) problems.push('Recipe id must be one lowercase word that names the layout.');
  if (!SECTION_TYPES.includes(type as (typeof SECTION_TYPES)[number])) problems.push(`Recipe type ${type || '(empty)'} is not one of the 14 section types.`);
  if (idFile && idFile !== `${id}.json`) problems.push(`Recipe ${idFile} declares id ${id || '(empty)'}.`);
  if (typeFolder && typeFolder !== type) problems.push(`Recipe folder ${typeFolder}/ declares type ${type || '(empty)'}.`);

  const models = list(recipe.models).map(word);
  if (!models.length) problems.push('A recipe names the commerce models it serves.');
  for (const model of models) if (!COMMERCE_MODELS.includes(model as (typeof COMMERCE_MODELS)[number])) problems.push(`Unknown commerce model ${model}.`);

  checkLayout(problems, recipe.layout, 'layout');
  checkSlots(problems, recipe.slots, recipe.needs, 'slots');
  checkSettings(problems, recipe.settings, 'settings');

  for (const [role, value] of Object.entries(object(recipe.tokens))) {
    if (!WORD.test(role)) problems.push(`Token role ${role} must be one lowercase word.`);
    checkTokenPath(problems, value, `tokens.${role}`);
  }
  for (const [name, value] of Object.entries(object(recipe.fallback))) {
    if (!Object.prototype.hasOwnProperty.call(object(recipe.slots), name)) problems.push(`fallback.${name} is not a slot.`);
    const text = word(value);
    if (!text) problems.push(`fallback.${name} must hold neutral stand-in copy.`);
    else if (text.startsWith('token:')) checkTokenPath(problems, text, `fallback.${name}`);
    else if (TARGET.test(text)) continue;
    else if (text.length > 120) problems.push(`fallback.${name} is longer than 120 characters.`);
    else if (!/^[A-Z]/.test(text)) problems.push(`fallback.${name} looks like a sentence fragment, not a neutral label.`);
  }

  checkText(problems, object(recipe.source).pattern, 'source.pattern', 300);
  checkText(problems, object(recipe.source).reference, 'source.reference', 300);
  checkNoLiterals(problems, recipe.tokens, 'tokens');
  checkNoLiterals(problems, recipe.settings, 'settings');
  checkNoLiterals(problems, recipe.layout, 'layout');
  checkNoLiterals(problems, recipe.fallback, 'fallback');

  return problems.length ? { file, problems } : { file, recipe: recipe as unknown as Recipe, problems };
}
