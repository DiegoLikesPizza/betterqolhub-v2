// Modpack presentation.
//
// The packs themselves live in the database (see prisma/schema.prisma) since
// they went plural and became something an admin uploads. What stays here is the
// part that is curated copy rather than data: the mod *groups*. Their titles,
// blurbs and colours are editorial voice, and a .mrpack manifest cannot tell you
// which bucket a mod belongs in — so uploading fills in the mods and an admin
// assigns the groups.

export type ModGroup = {
  key: string;
  title: string;
  blurb: string;
  color: string;
};

/**
 * Order matters: this is the order the groups render in on the pack page.
 *
 * `other` is last and deliberately dull — it is where freshly imported mods land
 * before anyone has sorted them, so it should look like an unfinished job rather
 * than a category.
 */
export const MOD_GROUPS: ModGroup[] = [
  {
    key: 'skyblock',
    title: 'Skyblock',
    blurb: 'The reason the pack exists — the mods that actually change how you play.',
    color: '#55FF55',
  },
  {
    key: 'risky',
    title: 'Use at your own risk',
    blurb:
      'Shipped as files because Modrinth will not host them. These are the ones that can get an account banned — install deliberately, not by accident.',
    color: '#FF5555',
  },
  {
    key: 'performance',
    title: 'Performance',
    blurb: 'Frames back, stutter gone. Safe on any server.',
    color: '#55FFFF',
  },
  {
    key: 'interface',
    title: 'Interface',
    blurb: 'Small quality-of-life fixes to the vanilla UI.',
    color: '#FFAA00',
  },
  {
    key: 'libraries',
    title: 'Libraries',
    blurb: 'Dependencies the above need. Nothing to configure — do not delete them.',
    color: '#9C92B8',
  },
  {
    key: 'other',
    title: 'Other',
    blurb: 'Not sorted into a group yet.',
    color: '#AAAAAA',
  },
];

export const DEFAULT_GROUP = 'other';
/** Where the .mrpack's overrides land: "not on Modrinth" is what this group means. */
export const BUNDLED_GROUP = 'risky';

export function isGroupKey(value: string): boolean {
  return MOD_GROUPS.some((g) => g.key === value);
}

export function groupLabel(key: string): string {
  return MOD_GROUPS.find((g) => g.key === key)?.title ?? key;
}

export const MODPACK_FILE_KINDS = ['MRPACK', 'ZIP'] as const;
export type ModpackFileKind = (typeof MODPACK_FILE_KINDS)[number];

export function isFileKind(value: string): value is ModpackFileKind {
  return (MODPACK_FILE_KINDS as readonly string[]).includes(value);
}

/** Copy for each download card. Fixed per kind — it describes the format, not the pack. */
export const FILE_KINDS: Record<
  ModpackFileKind,
  { label: string; blurb: string; extension: string }
> = {
  MRPACK: {
    label: 'Modrinth pack',
    blurb:
      'For Modrinth App, Prism or ATLauncher. Small, because mods are fetched on install.',
    extension: '.mrpack',
  },
  ZIP: {
    label: 'Full ZIP',
    blurb:
      'Every jar bundled. Drop the mods folder into any Fabric install — no launcher needed.',
    extension: '.zip',
  },
};

export function modrinthUrl(id: string): string {
  return `https://modrinth.com/project/${id}`;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Splits a trailing "Pack" off a name so it can be accented.
 *
 * Exists so "QOLPack" keeps rendering as QOL + a coloured "Pack", which is how
 * the page has always looked, without hardcoding that one name.
 */
export function splitAccent(name: string): { head: string; tail: string } {
  const match = /^(.*\S)(pack)$/i.exec(name);
  if (!match) return { head: name, tail: '' };
  return { head: match[1]!, tail: match[2]! };
}

export const MAX_SLUG_LENGTH = 48;
export const MAX_NAME_LENGTH = 60;
export const MAX_SUMMARY_LENGTH = 200;

/**
 * A URL- and filename-safe slug.
 *
 * Used for both, which is why it is this strict: the slug becomes part of the
 * name the file is written under, so anything that could traverse a directory or
 * confuse a shell has to be gone before it gets near the filesystem.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= MAX_SLUG_LENGTH;
}
