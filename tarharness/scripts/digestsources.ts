/**
 * Source reading shared by the design and recipe digests with their drift tests, so both
 * hash the same bytes and compare against the same committed artifacts.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { SourceFile } from '../src/site/designs/build.ts';
import type { SidecarEntry } from '../src/site/designs/contract.ts';

export const HARNESS_ROOT = path.resolve(import.meta.dirname, '..');
export const SOURCE_DIR = path.join(HARNESS_ROOT, '..', 'designmds');
export const OUT_DIR = path.join(HARNESS_ROOT, 'src', 'site', 'designs');
export const TOKENS_DIR = path.join(OUT_DIR, 'tokens');
export const SIDECAR_FILE = path.join(HARNESS_ROOT, 'scripts', 'designtags.json');

export function sourceHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

export function readSources(dir = SOURCE_DIR): SourceFile[] {
  if (!fs.existsSync(dir)) throw new Error(`No design source directory at ${dir}`);
  return fs.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .sort()
    .map((file) => {
      const buffer = fs.readFileSync(path.join(dir, file));
      return { file, markdown: buffer.toString('utf8'), hash: sourceHash(buffer) };
    });
}

export function readSidecar(file = SIDECAR_FILE): Record<string, SidecarEntry> {
  if (!fs.existsSync(file)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`scripts/designtags.json is not valid JSON: ${String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('scripts/designtags.json must be an object keyed by source file name.');
  return parsed as Record<string, SidecarEntry>;
}

export function readCommitted(target: string): string {
  return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
}

export function differs(target: string, text: string): boolean {
  return readCommitted(target) !== text;
}

/** `src/site/recipes`, where the recipe JSON and its generated import map live together. */
export const RECIPE_DIR = path.join(HARNESS_ROOT, 'src', 'site', 'recipes');

/** Every `<type>/<id>.json` under the recipe directory, keyed by its relative path. */
export function readRecipeSources(dir = RECIPE_DIR): { file: string; text: string }[] {
  if (!fs.existsSync(dir)) return [];
  const found: { file: string; text: string }[] = [];
  for (const type of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!type.isDirectory()) continue;
    const folder = path.join(dir, type.name);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      found.push({ file: `${type.name}/${entry.name}`, text: fs.readFileSync(path.join(folder, entry.name), 'utf8') });
    }
  }
  return found.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}
