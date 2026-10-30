// Brand styles are data: CSS variables + the variants the brand is known for.
// ingest (designmds/*.md -> this file) runs on our machine; the Worker only
// reads them. A style never carries layout: the spine decides that.

import type { Style } from './types.ts';

export const STYLES: readonly Style[] = [
  {
    id: 'cream-lime',
    title: 'Cream and lime',
    nature: ['food', 'bakery', 'cafe', 'restaurant'],
    vars: {
      '--bg': '#f4f3e7', '--bg-band': '#eae8d6', '--ink': '#1d2417', '--muted': '#5c6450',
      '--accent': '#e6ff55', '--accent-ink': '#1d2417', '--line': '#d8d5c0',
      '--font-display': 'Georgia, "Times New Roman", serif',
      '--font-body': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '--radius': '14px',
    },
    defaultVariants: { nav: 'centered-pill', hero: 'bleed-overlay', catalog: 'photo-grid', story: 'split-photo-text', gallery: 'bento-mosaic', footer: 'hours-map-card' },
  },
  {
    id: 'ink-mono',
    title: 'Ink and paper',
    nature: ['service', 'consulting', 'clinic', 'salon', 'studio'],
    vars: {
      '--bg': '#ffffff', '--bg-band': '#f4f4f2', '--ink': '#111111', '--muted': '#666663',
      '--accent': '#111111', '--accent-ink': '#ffffff', '--line': '#e3e3df',
      '--font-display': '"Helvetica Neue", Arial, sans-serif',
      '--font-body': '"Helvetica Neue", Arial, sans-serif',
      '--radius': '6px',
    },
    defaultVariants: { nav: 'minimal-left', hero: 'typing', catalog: 'menu-sheet', story: 'split-photo-text', gallery: 'horizontal-reel', footer: 'minimal-whatsapp-bar' },
  },
  {
    id: 'warm-paper',
    title: 'Warm paper',
    nature: ['shop', 'retail', 'general'],
    vars: {
      '--bg': '#faf7f2', '--bg-band': '#f1ebe1', '--ink': '#231d16', '--muted': '#6b6155',
      '--accent': '#b4462d', '--accent-ink': '#ffffff', '--line': '#e6ddd0',
      '--font-display': 'Georgia, serif',
      '--font-body': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '--radius': '10px',
    },
    defaultVariants: { nav: 'minimal-left', hero: 'typing', catalog: 'bordered-cells', story: 'big-quote-band', gallery: 'bento-mosaic', footer: 'hours-map-card' },
  },
];

export const findStyle = (id: string): Style => STYLES.find((style) => style.id === id) ?? STYLES[STYLES.length - 1];
