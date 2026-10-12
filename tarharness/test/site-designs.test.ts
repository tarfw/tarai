import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildLibrary, LIBRARY_VOCABULARY, renderJson, type SourceFile } from '../src/site/designs/build.ts';
import { parseDesignMd, paletteContrast, pickRole } from '../src/site/designs/parse.ts';
import { CODE_FLOORS, LEGACY_IDS, libraryDesignIds, tokensFor } from '../src/site/designs/library.ts';
import { DEFAULT_DESIGN, resolveDesign } from '../src/site/design.ts';
import { normalizeDocument } from '../src/site/adapt.ts';
import { defaultBlueprint } from '../src/site/blueprint.ts';
import { DOCUMENT_VERSION, type SiteDocument } from '../src/site/document.ts';
import type { SidecarEntry } from '../src/site/designs/contract.ts';
import { OUT_DIR, SOURCE_DIR, readSidecar, readSources } from '../scripts/digestsources.ts';

function sidecar(): Record<string, SidecarEntry> {
  return readSidecar();
}

function tagsFor(file: string, overrides: Partial<SidecarEntry> = {}): SidecarEntry {
  return {
    id: 'sample',
    label: 'Sample look',
    desc: 'A reviewed sample.',
    tone: 'light',
    density: 'balanced',
    industries: ['general'],
    models: ['products'],
    imagery: 'editorial',
    direction: { audience: 'Shoppers', purpose: 'Storefront', voice: 'Direct', idea: 'Plain paper' },
    guidance: ['Keep it plain'],
    license: { kind: 'reference', note: 'measurements only', approved: true },
    reviewer: 'tarfw',
    ...overrides,
  };
}

const GOOD_MARKDOWN = `# Sample — Style Reference
> plain paper, dark text.

**Theme:** light

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Paper | \`#ffffff\` | \`--color-paper\` | Page canvas |
| Ink | \`#111111\` | \`--color-ink\` | Primary text |
| Panel | \`#f2f2f2\` | \`--color-panel\` | Card surfaces |
| Fill | \`#1f1f1f\` | \`--color-fill\` | Filled pill buttons |

## Tokens — Typography

### Inter — Body text and headings. · \`--font-inter\`
- **Substitute:** Arial
- **Weights:** 400, 600

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| body | Inter | 400 | 16px | 1.5 | 0px | \`--text-body\` |
| display | Inter | 600 | 48px | 1.1 | -0.5px | \`--text-display\` |

## Tokens — Spacing & Shapes

**Base unit:** 8px

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 8 | 8px | \`--spacing-8\` |
| 32 | 32px | \`--spacing-32\` |

### Border Radius

| Element | Value |
|---------|-------|
| cards | 12px |
| media | 20px |
| pills | 9999px |

### Layout

- **Section gap:** 32px
`;

function build(markdown: string, tags?: SidecarEntry) {
  const sources: SourceFile[] = [{ file: 'SAMPLE.md', markdown, hash: 'sample' }];
  return buildLibrary(sources, tags ? { 'SAMPLE.md': tags } : {}, LIBRARY_VOCABULARY);
}

describe('design library build', () => {
  it('regenerates the committed artifacts byte for byte', () => {
    const result = buildLibrary(readSources(), sidecar(), LIBRARY_VOCABULARY);
    expect(result.errors).toEqual([]);
    expect(fs.readFileSync(path.join(OUT_DIR, 'index.json'), 'utf8')).toBe(renderJson(result.index));
    expect(fs.readFileSync(path.join(OUT_DIR, 'review.json'), 'utf8')).toBe(renderJson(result.review));
    expect(fs.readFileSync(path.join(OUT_DIR, 'library.generated.ts'), 'utf8')).toBe(result.library);
    expect(result.tokens.length).toBeGreaterThan(0);
    for (const token of result.tokens) {
      expect(fs.readFileSync(path.join(OUT_DIR, 'tokens', `${token.id}.json`), 'utf8')).toBe(token.text);
    }
  });

  it('ships the three migrated references with readable palettes', () => {
    const result = buildLibrary(readSources(), sidecar(), LIBRARY_VOCABULARY);
    const ids = result.index.designs.map((row) => row.id);
    expect(ids).toEqual(['bold', 'luxury', 'warm']);
    expect(result.index.default).toBe('luxury');
    expect(result.review.excluded).toEqual([]);

    const luxury = result.tokens.find((token) => token.id === 'luxury')!;
    expect(JSON.parse(luxury.text)).toMatchObject({
      color: { canvas: '#ffffff', ink: '#000000', accent: '#3b281d', surface: '#f7f4f1', success: '#1e681d', danger: '#99001c' },
      space: { unit: 4, section: 80, container: 1200 },
      shape: { sm: 4, md: 16, lg: 24, pill: 9999 },
      type: { base: 16, scale: 1.25, leading: 1.4, weight: 600 },
    });
    for (const token of result.tokens.map((entry) => JSON.parse(entry.text))) {
      expect(paletteContrast(token.color)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('records the source hash and license note it ships with', () => {
    const result = build(GOOD_MARKDOWN, tagsFor('SAMPLE.md'));
    expect(result.errors).toEqual([]);
    const tokens = JSON.parse(result.tokens[0].text);
    expect(tokens.source).toMatchObject({ file: 'SAMPLE.md', hash: 'sample', brand: 'Sample', license: { kind: 'reference', note: 'measurements only' } });
    expect(tokens.source.brand).toBeTruthy();
  });

  it('proposes tags for a source nobody has signed', () => {
    const result = build(GOOD_MARKDOWN);
    expect(result.index.designs).toEqual([]);
    expect(result.review.excluded[0].findings[0]).toMatchObject({ check: 'tags' });
    expect(result.proposals['SAMPLE.md']).toMatchObject({ tone: 'light', density: 'balanced', license: { approved: false } });
  });

  it('fails the build on a duplicate id and never ships both', () => {
    const sources: SourceFile[] = [
      { file: 'A.md', markdown: GOOD_MARKDOWN, hash: 'a' },
      { file: 'B.md', markdown: GOOD_MARKDOWN, hash: 'b' },
    ];
    const result = buildLibrary(sources, { 'A.md': tagsFor('A.md'), 'B.md': tagsFor('B.md') }, LIBRARY_VOCABULARY);
    expect(result.errors.join(' ')).toContain('Duplicate design id "sample"');
    expect(result.index.designs).toHaveLength(1);
  });

  it('rejects ids that are not one lowercase word', () => {
    const result = build(GOOD_MARKDOWN, tagsFor('SAMPLE.md', { id: 'dark-luxury' }));
    expect(result.review.excluded[0].findings.map((finding) => finding.check)).toContain('id');
  });

  it('requires an approved license note before a design ships', () => {
    const unsigned = build(GOOD_MARKDOWN, tagsFor('SAMPLE.md', { license: { kind: 'reference', note: 'unknown', approved: false } }));
    expect(unsigned.review.excluded[0].findings.map((finding) => finding.check)).toContain('source');
    const unreviewed = build(GOOD_MARKDOWN, tagsFor('SAMPLE.md', { reviewer: '' }));
    expect(unreviewed.review.excluded[0].findings.length).toBeGreaterThan(0);
  });

  it('checks the tone tag against the parsed palette', () => {
    const dark = GOOD_MARKDOWN.replace('Paper | `#ffffff`', 'Paper | `#0d0d0f`');
    const result = build(dark, tagsFor('SAMPLE.md', { id: 'midnight' }));
    const checks = result.review.excluded[0]?.findings.map((finding) => finding.message).join(' ') ?? '';
    expect(checks).toContain('tone tag must be dark');
  });

  it('blocks a palette that cannot reach 4.5:1 and excludes the design', () => {
    const muddy = GOOD_MARKDOWN
      .replace('| Paper | `#ffffff`', '| Paper | `#808080`')
      .replace('| Ink | `#111111`', '| Ink | `#7a7a7a`');
    const result = build(muddy, tagsFor('SAMPLE.md', { id: 'muddy' }));
    expect(result.review.excluded[0].findings.map((finding) => finding.check)).toContain('contrast');
    expect(result.index.designs).toEqual([]);
  });

  it('blocks unknown industry and model tags', () => {
    const result = build(GOOD_MARKDOWN, tagsFor('SAMPLE.md', { industries: ['textiles'], models: ['subscriptions'] }));
    const messages = result.review.excluded[0].findings.map((finding) => finding.message);
    expect(messages).toContain('Industry "textiles" is not in the trade taxonomy.');
    expect(messages).toContain('Model "subscriptions" is not a commerce model.');
  });

  it('reads a section gap range as its midpoint and a missing base unit from the scale', () => {
    const ranged = GOOD_MARKDOWN
      .replace('**Base unit:** 8px\n\n', '')
      .replace('- **Section gap:** 32px', '- **Section gap:** 80-120px');
    const reference = parseDesignMd(ranged, 'RANGED.md');
    expect(reference.baseUnit).toBe(8);
    expect(reference.sectionGap).toBe(100);
    expect(reference.notes.join(' ')).toContain('midpoint 100px');
    expect(reference.notes.join(' ')).toContain('smallest spacing step');

    const parsed = parseDesignMd(GOOD_MARKDOWN, 'SAMPLE.md');
    expect(parsed.cardPadding).toBeUndefined();
    expect(parsed.elementGap).toBeUndefined();
    expect(parsed.maxWidth).toBeUndefined();
  });

  it('parses gradients separately so they never enter contrast maths', () => {
    const gradient = GOOD_MARKDOWN.replace('| Paper | `#ffffff` | `--color-paper` | Page canvas |', '| Wash | `linear-gradient(45deg, #060b0e 0%, #254764 100%)` | `--color-wash` | Product media backdrop |\n| Paper | `#ffffff` | `--color-paper` | Page canvas |');
    const parsed = parseDesignMd(gradient, 'GRADIENT.md');
    expect(parsed.gradients).toHaveLength(1);
    expect(parsed.gradients[0].name).toBe('Wash');
    expect(parsed.colors.some((color) => color.name === 'Wash')).toBe(false);
    const result = build(gradient, tagsFor('GRADIENT.md'));
    expect(result.index.designs).toHaveLength(1);
  });
});

describe('design loader', () => {
  it('resolves every retired id to the design it was renamed into', () => {
    for (const [legacy, id] of Object.entries(LEGACY_IDS)) {
      expect(resolveDesign(legacy)).toEqual(resolveDesign(id));
    }
    expect(libraryDesignIds()).toEqual(['bold', 'luxury', 'warm']);
    expect(resolveDesign('')).toEqual(DEFAULT_DESIGN);
    expect(resolveDesign('nonsense')).toEqual(DEFAULT_DESIGN);
    expect(resolveDesign(null)).toEqual(DEFAULT_DESIGN);
  });

  it('keeps the measurements the retired catalog hand-coded', () => {
    const luxury = resolveDesign('dark-luxury');
    expect(luxury.color).toMatchObject({
      canvas: '#ffffff', ink: '#000000', accent: '#3b281d', accentink: '#ffffff',
      surface: '#f7f4f1', success: '#1e681d', danger: '#99001c',
    });
    expect(luxury.space).toEqual({ unit: 4, section: 80, container: 1200 });
    expect(luxury.shape).toEqual({ sm: 4, md: 16, lg: 24, pill: 9999 });
    expect(luxury.type.leading).toBe(1.4);
    expect(luxury.type.weight).toBe(600);
    expect(luxury.type.display).toContain('"Inter Variable"');
    expect(luxury.theme).toBe('luxury');
    expect(luxury.source?.reference).toContain('DESIGN1.md');
    expect(luxury.source?.revision).toBe(0);
    for (const id of libraryDesignIds()) {
      const design = resolveDesign(id);
      expect(design.elevation).toEqual(CODE_FLOORS.elevation);
      expect(design.layout).toEqual(CODE_FLOORS.layout);
      expect(design.motion).toEqual(CODE_FLOORS.motion);
      expect(tokensFor(id)?.id).toBe(id);
    }
  });
});

describe('reference parsing', () => {
  it('reads the colour, type and spacing tables out of DESIGN1.md', () => {
    const markdown = fs.readFileSync(path.join(SOURCE_DIR, 'DESIGN1.md'), 'utf8');
    const parsed = parseDesignMd(markdown, 'DESIGN1.md');
    expect(parsed.brand).toBe('Mollie');
    expect(parsed.theme).toBe('light');
    expect(parsed.vibe).toContain('cashmere counter');
    expect(pickRole(parsed, 'canvas')?.value).toBe('#ffffff');
    expect(pickRole(parsed, 'ink')?.value).toBe('#000000');
    expect(pickRole(parsed, 'accent')?.name).toBe('Ledger Brown');
    expect(pickRole(parsed, 'success')?.value).toBe('#1e681d');
    expect(pickRole(parsed, 'danger')?.value).toBe('#99001c');
    expect(parsed.gradients).toHaveLength(1);
    expect(parsed.fonts.find((font) => font.family === 'Inter Variable')?.substitute).toBe('Inter');
    expect(parsed.scale.map((row) => row.role)).toContain('display');
    expect(parsed.baseUnit).toBe(4);
    expect(parsed.sectionGap).toBe(32);
    expect(parsed.maxWidth).toBeUndefined();
    expect(parsed.spacing.length).toBeGreaterThan(8);
    expect(parsed.radii.find((row) => row.element === 'cards')?.value).toBe(16);
  });

  it('keeps em-dash placeholder cells out of the type scale', () => {
    const markdown = fs.readFileSync(path.join(SOURCE_DIR, 'DESIGN3.md'), 'utf8');
    const parsed = parseDesignMd(markdown, 'DESIGN3.md');
    const caption = parsed.scale.find((row) => row.role === 'caption');
    expect(caption?.family).toBeUndefined();
    expect(caption?.weight).toBeUndefined();
    expect(caption?.size).toBe(12);
    expect(pickRole(parsed, 'danger')).toBeUndefined();
    expect(parsed.radii.find((row) => row.element === 'tags')?.value).toBe(9999);
  });
});

describe('stored design ids', () => {
  function stored(theme: string, style: string): SiteDocument {
    return {
      schema: DOCUMENT_VERSION,
      design: { ...DEFAULT_DESIGN, theme },
      blueprint: { ...defaultBlueprint(), style },
      pages: [],
      redirects: [],
    } as unknown as SiteDocument;
  }

  it('hands a reader the library id instead of the one on disk', () => {
    const doc = stored('dark-luxury', 'arte');
    const read = normalizeDocument(doc);
    expect(read.design.theme).toBe('luxury');
    expect(read.blueprint?.style).toBe('warm');
    expect(doc.design.theme).toBe('dark-luxury');
    expect(doc.blueprint?.style).toBe('arte');
  });

  it('leaves an id the library does not carry alone', () => {
    const read = normalizeDocument(stored('shop-own-look', 'shop-own-look'));
    expect(read.design.theme).toBe('shop-own-look');
    expect(read.blueprint?.style).toBe('shop-own-look');
  });
});
