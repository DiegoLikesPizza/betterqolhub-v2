// The QOLPack contents.
//
// Both downloads contain exactly the same 25 mods — verified by diffing the
// .zip's jar list against the .mrpack manifest plus its overrides. Only the
// packaging differs: the .mrpack lists Modrinth downloads and resolves them at
// install time, the .zip bundles every jar.
//
// `modrinth` is the real project id taken from the pack manifest, so the links
// are the pack's own sources rather than a guess. The two entries without one
// are the pack's overrides: Modrinth will not host them, which is exactly why
// they are shipped as files. That is a useful signal, so the page shows it.

export const PACK = {
  name: 'QOLPack',
  version: '26.1.2',
  minecraft: '26.1.2',
  loader: 'Fabric 0.19.3',
  files: {
    mrpack: {
      href: '/downloads/qolpack-26-1-2.mrpack',
      filename: 'qolpack-26-1-2.mrpack',
      bytes: 12_561_416,
      label: 'Modrinth pack',
      blurb:
        'For Modrinth App, Prism or ATLauncher. Small, because mods are fetched on install.',
    },
    zip: {
      href: '/downloads/qolpack-26-1-2.zip',
      filename: 'qolpack-26-1-2.zip',
      bytes: 91_327_161,
      label: 'Full ZIP',
      blurb:
        'Every jar bundled. Drop the mods folder into any Fabric install — no launcher needed.',
    },
  },
} as const;

export type Mod = {
  name: string;
  version: string;
  /** Modrinth project id, or null when the pack ships the jar directly. */
  modrinth: string | null;
  /** Set when the file is only in the pack, not on Modrinth. */
  bundledOnly?: true;
};

export type ModGroup = {
  key: string;
  title: string;
  blurb: string;
  color: string;
  mods: Mod[];
};

export const MOD_GROUPS: ModGroup[] = [
  {
    key: 'skyblock',
    title: 'Skyblock',
    blurb: 'The reason the pack exists — the mods that actually change how you play.',
    color: '#55FF55',
    mods: [
      { name: 'SkyHanni', version: '7.29.0', modrinth: 'byNkmv5G' },
      { name: 'SkyOcean', version: '1.17.2', modrinth: 'dIczrQAR' },
      { name: 'SkyBlockPv', version: '1.8.8', modrinth: '8yqXwFLl' },
      { name: 'SBO', version: '0.4.3', modrinth: '9lBqVbQF' },
      { name: 'NoFrills', version: '0.4.11', modrinth: 'qpZgAErQ' },
      { name: 'SecretRoutes', version: '1.0.0-beta4', modrinth: 'l1qibtk8' },
      { name: 'Odin', version: '0.2.3', modrinth: 'jJJLywXp' },
    ],
  },
  {
    key: 'risky',
    title: 'Use at your own risk',
    blurb:
      'Shipped as files because Modrinth will not host them. These are the ones that can get an account banned — install deliberately, not by accident.',
    color: '#FF5555',
    mods: [
      { name: 'NoammAddons', version: '1.2.3', modrinth: null, bundledOnly: true },
      { name: 'Odin Client', version: '0.2.3-r1', modrinth: null, bundledOnly: true },
    ],
  },
  {
    key: 'performance',
    title: 'Performance',
    blurb: 'Frames back, stutter gone. Safe on any server.',
    color: '#55FFFF',
    mods: [
      { name: 'Sodium', version: '0.9.1-beta.3', modrinth: 'AANobbMI' },
      { name: 'Sodium Extra', version: '0.9.1', modrinth: 'PtjYWJkn' },
      { name: 'Lithium', version: '0.24.6', modrinth: 'gvQqBUqZ' },
      { name: 'FerriteCore', version: '9.0.0', modrinth: 'uXXizFIs' },
      { name: 'EntityCulling', version: '1.10.5', modrinth: 'NNAgCjsB' },
      { name: 'ImmediatelyFast', version: '1.15.3', modrinth: '5ZwdcRci' },
    ],
  },
  {
    key: 'interface',
    title: 'Interface',
    blurb: 'Small quality-of-life fixes to the vanilla UI.',
    color: '#FFAA00',
    mods: [
      { name: 'Inventory Buttons', version: '1.2.2', modrinth: 'D5cgMv16' },
      { name: 'Longer Chat History', version: '1.8', modrinth: 'f4P7fNKN' },
    ],
  },
  {
    key: 'libraries',
    title: 'Libraries',
    blurb: 'Dependencies the above need. Nothing to configure — do not delete them.',
    color: '#9C92B8',
    mods: [
      { name: 'Fabric API', version: '0.154.0', modrinth: 'P7dR8mSH' },
      { name: 'Fabric Loader', version: '0.19.3', modrinth: 'OoMgWV72' },
      { name: 'Fabric Language Kotlin', version: '1.13.12', modrinth: 'Ha28R6CL' },
      { name: 'Architectury', version: '20.0.7', modrinth: 'lhGA9TYQ' },
      { name: 'Cloth Config', version: '26.1.154', modrinth: '9s6osm5g' },
      { name: 'owo-lib', version: '0.13.0', modrinth: 'ccKDOlHs' },
      { name: 'YetAnotherConfigLib', version: '3.9.5', modrinth: '1eAoo2KR' },
      { name: 'Hypixel Mod API', version: '1.0.2', modrinth: '1A2mKfBx' },
    ],
  },
];

export const TOTAL_MODS = MOD_GROUPS.reduce((n, g) => n + g.mods.length, 0);

export function modrinthUrl(id: string): string {
  return `https://modrinth.com/project/${id}`;
}

export function formatBytes(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}
