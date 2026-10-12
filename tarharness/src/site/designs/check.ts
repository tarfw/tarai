/**
 * The five validation rules from parai §3.3, plus the review step that decides whether a
 * design may ship. A finding never throws: the digest excludes the design and writes the
 * reason to `review.json`, so one bad reference cannot break the build.
 */

import { contrast } from '../contrast.ts';
import {
  DENSITY_WORDS,
  IMAGERY_WORDS,
  TONE_WORDS,
  DESIGN_ID,
  type DesignTokens,
  type ParsedReference,
  type ReviewFinding,
  type SidecarEntry,
} from './contract.ts';
import { pickRole } from './parse.ts';

export interface CheckVocabulary {
  industries: readonly string[];
  models: readonly string[];
}

const MEASURED_ROLES = ['canvas', 'ink', 'surface', 'accent'] as const;

export function tagCheck(tags: SidecarEntry | undefined, file: string, vocab: CheckVocabulary): ReviewFinding[] {
  if (!tags) return [{ check: 'tags', level: 'blocking', message: `${file} has no entry in scripts/designtags.json.` }];
  const findings: ReviewFinding[] = [];
  const id = tags.id ?? '';
  if (!DESIGN_ID.test(id)) findings.push({ check: 'id', level: 'blocking', message: `Id "${id}" must be one lowercase semantic word.` });
  if (!tags.label?.trim()) findings.push({ check: 'tags', level: 'blocking', message: `${id || file} needs an owner-facing label.` });
  if (!tags.desc?.trim()) findings.push({ check: 'tags', level: 'blocking', message: `${id || file} needs a one-line description for the picker.` });
  if (!tags.tone || !TONE_WORDS.includes(tags.tone)) findings.push({ check: 'tags', level: 'blocking', message: `${id || file} tone must be ${TONE_WORDS.join(' or ')}.` });
  if (!tags.density || !DENSITY_WORDS.includes(tags.density)) findings.push({ check: 'tags', level: 'blocking', message: `${id || file} density must be ${DENSITY_WORDS.join(', ') || 'set'}.` });
  if (!tags.imagery || !IMAGERY_WORDS.includes(tags.imagery)) findings.push({ check: 'tags', level: 'blocking', message: `${id || file} imagery must be one of ${IMAGERY_WORDS.join(', ')}.` });
  if (!tags.industries?.length) findings.push({ check: 'tags', level: 'blocking', message: `${id || file} needs at least one industry.` });
  for (const industry of tags.industries ?? []) {
    if (!vocab.industries.includes(industry)) findings.push({ check: 'tags', level: 'blocking', message: `Industry "${industry}" is not in the trade taxonomy.` });
  }
  if (!tags.models?.length) findings.push({ check: 'tags', level: 'blocking', message: `${id || file} needs at least one commerce model.` });
  for (const model of tags.models ?? []) {
    if (!vocab.models.includes(model)) findings.push({ check: 'tags', level: 'blocking', message: `Model "${model}" is not a commerce model.` });
  }
  if (!tags.license?.kind?.trim() || !tags.license?.note?.trim()) {
    findings.push({ check: 'source', level: 'blocking', message: `${id || file} has no license kind and note.` });
  } else if (tags.license.approved !== true) {
    findings.push({ check: 'source', level: 'blocking', message: `${id || file} license is recorded but not approved.` });
  }
  if (!tags.reviewer?.trim()) findings.push({ check: 'source', level: 'blocking', message: `${id || file} has no reviewer.` });
  const direction = tags.direction;
  if (!direction || !direction.audience || !direction.purpose || !direction.voice || !direction.idea) {
    findings.push({ check: 'tags', level: 'blocking', message: `${id || file} direction needs audience, purpose, voice and idea.` });
  }
  return findings;
}

/** Structural rules that read the reference file itself. */
export function referenceCheck(ref: ParsedReference): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  if (!ref.colors.length) findings.push({ check: 'tokens', level: 'blocking', message: 'No colour table rows parsed.' });
  for (const role of MEASURED_ROLES) {
    if (!pickRole(ref, role)) findings.push({ check: 'tokens', level: 'blocking', message: `No colour in the file reads as the ${role} role.` });
  }
  if (!ref.radii.length) findings.push({ check: 'tokens', level: 'blocking', message: 'No Border Radius table found.' });
  if (!ref.scale.length) findings.push({ check: 'tokens', level: 'blocking', message: 'No Type Scale table found.' });
  if (!ref.fonts.length) findings.push({ check: 'tokens', level: 'blocking', message: 'No font blocks found.' });
  for (const note of ref.notes) {
    if (/not a plain hex|not a px or rem/.test(note)) findings.push({ check: 'units', level: 'blocking', message: note });
  }
  return findings;
}

/** Contrast and tone, measured on the resolved tokens so the code floors count. */
export function tokensCheck(tokens: DesignTokens): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  const body = contrast(tokens.color.ink, tokens.color.canvas);
  if (body === null) findings.push({ check: 'contrast', level: 'blocking', message: 'Body ink is not a plain hex value.' });
  else if (body < 4.5) findings.push({ check: 'contrast', level: 'blocking', message: `Body text on paper is ${body.toFixed(2)}:1, below 4.5:1.` });
  const label = contrast(tokens.color.accentink, tokens.color.accent);
  if (label === null) findings.push({ check: 'contrast', level: 'blocking', message: 'Button label or accent is not a plain hex value.' });
  else if (label < 4.5) findings.push({ check: 'contrast', level: 'blocking', message: `Paper on accent is ${label.toFixed(2)}:1, below 4.5:1.` });
  if (tokens.type.base < 16) findings.push({ check: 'tokens', level: 'blocking', message: `Base type ${tokens.type.base}px is below the 16px floor.` });
  if (tokens.space.unit <= 0 || tokens.space.unit > 32) findings.push({ check: 'tokens', level: 'blocking', message: `Spacing unit ${tokens.space.unit}px is out of range.` });
  return findings;
}

/** §3.3 "tone matches the palette": a dark canvas must be tagged dark, and the reverse. */
export function toneCheck(tokens: DesignTokens): ReviewFinding[] {
  const value = contrast(tokens.color.canvas, '#000000');
  if (value === null) return [];
  const canvasIsDark = value < 4.5;
  if (canvasIsDark && tokens.tone !== 'dark') {
    return [{ check: 'tags', level: 'blocking', message: `Canvas ${tokens.color.canvas} is dark, so the tone tag must be dark.` }];
  }
  if (!canvasIsDark && tokens.tone !== 'light') {
    return [{ check: 'tags', level: 'blocking', message: `Canvas ${tokens.color.canvas} is light, so the tone tag must be light.` }];
  }
  return [];
}

export function checkDesign(ref: ParsedReference, tokens: DesignTokens): ReviewFinding[] {
  return [...referenceCheck(ref), ...tokensCheck(tokens), ...toneCheck(tokens)];
}

export function blocking(findings: ReviewFinding[]): ReviewFinding[] {
  return findings.filter((finding) => finding.level === 'blocking');
}

export function advisories(findings: ReviewFinding[]): ReviewFinding[] {
  return findings.filter((finding) => finding.level === 'advisory');
}
