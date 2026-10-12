/**
 * Generic font stacks the design library falls back to. No named face is shipped; a
 * reference file contributes a family and a substitute, the stack ends here.
 *
 * Kept separate from design.ts so the build-time parser never loads the generated library.
 */

export const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Mukta Malar", sans-serif';
export const SERIF = 'Georgia, "Times New Roman", "Mukta Malar", serif';
export const GROTESK = 'system-ui, -apple-system, "Helvetica Neue", "Mukta Malar", sans-serif';
export const MONO = '"IBM Plex Mono", SFMono-Regular, Consolas, Menlo, monospace';
