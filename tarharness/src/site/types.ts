// The site model, small on purpose (paraiv2): merchant data + an ordered
// section stack + one brand style. Nothing else is stored.

export type SectionKind = 'nav' | 'hero' | 'catalog' | 'story' | 'gallery' | 'footer';

export interface SectionChoice {
  readonly kind: SectionKind;
  readonly variant: string;
  readonly hidden?: boolean;
}

export interface Style {
  readonly id: string;
  readonly title: string;
  /** Jev tags: which trades this style fits. */
  readonly nature: readonly string[];
  readonly vars: Record<string, string>;
  readonly defaultVariants: Partial<Record<SectionKind, string>>;
}

export interface SiteContact {
  readonly phone?: string;
  readonly email?: string;
  readonly whatsapp?: string;
  readonly address?: string;
}

export interface SiteData {
  readonly styleId: string;
  readonly sections: readonly SectionChoice[];
  readonly title: string;
  readonly tagline: string;
  readonly about: string;
  readonly notice?: string;
  readonly hours?: readonly string[];
  readonly contact?: SiteContact;
  /** record ids bound to the catalog section; never a copy of the data. */
  readonly items: readonly string[];
  readonly assets: readonly { readonly id: string; readonly mime: string; readonly alt?: string }[];
  readonly revision: number;
  readonly policy?: { readonly publicOrdering?: boolean };
  readonly releases?: readonly { readonly id: string; readonly hash: string; readonly created: number }[];
}

export interface ReleaseFile {
  readonly path: string;
  readonly mime: string;
  readonly bytes: number;
  readonly hash: string;
  readonly key: string;
}

export interface ReleaseManifest {
  readonly id: string;
  readonly siteId: string;
  readonly epoch: number;
  readonly host?: string;
  readonly version: number;
  readonly generation: number;
  readonly created: number;
  readonly hash: string;
  readonly files: readonly ReleaseFile[];
  readonly checks: { readonly blocking: number; readonly advisory: number };
}

export const isSiteData = (value: unknown): value is SiteData => {
  if (value === null || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.styleId === 'string' && Array.isArray(data.sections)
    && typeof data.title === 'string' && typeof data.revision === 'number';
};
