// Reading a .mrpack.
//
// A .mrpack is a ZIP holding `modrinth.index.json` — a manifest listing every
// mod as a download URL plus hashes — and an `overrides/` tree of files that are
// shipped literally because Modrinth will not host them.
//
// That manifest is the authoritative contents of a pack, so the admin page reads
// it instead of asking anyone to retype 25 mods per release. What it does *not*
// contain is a display name or a version number: those live behind the Modrinth
// project and version ids embedded in the download URLs, which is why this
// module optionally calls the Modrinth API to resolve them, and falls back to
// parsing the jar filename when that call fails. A pack that imports with
// slightly ugly names beats an upload that fails because an external API was
// down.
//
// The ZIP reading is done by hand rather than with a dependency: only one small
// entry is ever decompressed, and `zlib.inflateRaw` is in the standard library.

import { inflateRawSync } from 'node:zlib';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

/** Max size of the end-of-central-directory record plus its comment. */
const EOCD_SEARCH_WINDOW = 22 + 0xffff;

/** The sentinel a 32-bit size field carries when the real value is in a Zip64 record. */
const ZIP64_SENTINEL = 0xffffffff;

const STORED = 0;
const DEFLATED = 8;

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

export class MrpackError extends Error {}

/**
 * Lists the central directory.
 *
 * Reading the central directory rather than scanning for local headers is what
 * makes this safe against a file whose entries overlap or lie: the directory is
 * the ZIP's own index, and anything not listed there is not part of the archive.
 */
function readDirectory(buffer: Buffer): ZipEntry[] {
  const from = Math.max(0, buffer.length - EOCD_SEARCH_WINDOW);
  let eocd = -1;
  // Backwards: the comment is variable-length, so the last match is the real one.
  for (let i = buffer.length - 22; i >= from; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new MrpackError('Not a ZIP archive — no end-of-central-directory record.');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (offset === ZIP64_SENTINEL) {
    throw new MrpackError('Zip64 archives are not supported.');
  }

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new MrpackError('Corrupt ZIP central directory.');
    }
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);

    entries.push({
      name: buffer.toString('utf8', offset + 46, offset + 46 + nameLength),
      compressionMethod: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function readEntry(buffer: Buffer, entry: ZipEntry): Buffer {
  const start = entry.localHeaderOffset;
  if (start + 30 > buffer.length || buffer.readUInt32LE(start) !== LOCAL_SIGNATURE) {
    throw new MrpackError(`Corrupt local header for ${entry.name}.`);
  }
  // The local header repeats the name and extra-field lengths, and they may
  // differ from the central directory's — the data starts after the local ones.
  const nameLength = buffer.readUInt16LE(start + 26);
  const extraLength = buffer.readUInt16LE(start + 28);
  const from = start + 30 + nameLength + extraLength;
  const slice = buffer.subarray(from, from + entry.compressedSize);

  if (entry.compressionMethod === STORED) return slice;
  if (entry.compressionMethod === DEFLATED) return inflateRawSync(slice);
  throw new MrpackError(`Unsupported compression method ${entry.compressionMethod}.`);
}

/** One mod as it comes out of a pack, before it is given a group. */
export type ParsedMod = {
  name: string;
  version: string;
  modrinth: string | null;
  /** Modrinth *version* id, kept only long enough to resolve a version number. */
  modrinthVersion: string | null;
  bundledOnly: boolean;
  /** Jar filename, used to carry group assignments across a re-upload. */
  file: string;
};

export type ParsedPack = {
  /** Manifest `name`, when it has one. */
  name: string | null;
  /** Manifest `versionId`. */
  version: string | null;
  minecraft: string | null;
  /** e.g. "Fabric 0.19.3" — null when the pack is not a loader this recognises. */
  loader: string | null;
  mods: ParsedMod[];
};

type ManifestFile = {
  path?: unknown;
  downloads?: unknown;
};

type Manifest = {
  name?: unknown;
  versionId?: unknown;
  dependencies?: Record<string, unknown>;
  files?: unknown;
};

/** Loader keys Modrinth uses in `dependencies`, mapped to how the site names them. */
const LOADERS: Record<string, string> = {
  'fabric-loader': 'Fabric',
  forge: 'Forge',
  'neoforge': 'NeoForge',
  quilt: 'Quilt',
  'quilt-loader': 'Quilt',
};

/** `https://cdn.modrinth.com/data/<project>/versions/<version>/<file>.jar` */
const CDN_PATTERN = /\/data\/([A-Za-z0-9]+)\/versions\/([A-Za-z0-9]+)\//;

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Loader names that show up as a token inside a jar's version string. */
const LOADER_TOKENS = new Set(['fabric', 'forge', 'neoforge', 'quilt']);

function versionParts(token: string): number[] | null {
  const cleaned = token.replace(/^mc/i, '');
  if (!/^\d+(\.\d+)*$/.test(cleaned)) return null;
  return cleaned.split('.').map(Number);
}

/**
 * Drops the Minecraft version and loader name from a mod's version string.
 *
 * Jar filenames routinely carry both — `skyhanni-7.29.0-mc26.1.jar`,
 * `inventorybuttons-26.1-1.2.2.jar` — and repeating the pack's own Minecraft
 * version on all 25 rows pushes the part anyone actually reads out of view.
 *
 * The comparison is part-wise rather than by string prefix, which matters more
 * than it looks: Cloth Config genuinely versions itself `26.1.154`, and a naive
 * `startsWith('26.1')` would delete a real version number.
 */
export function cleanVersion(raw: string, minecraft: string | null): string {
  const mc = minecraft ? versionParts(minecraft) : null;

  const kept = raw.split('-').filter((token, index) => {
    if (LOADER_TOKENS.has(token.toLowerCase())) return false;
    if (!mc) return true;

    const parts = versionParts(token);
    if (!parts) return true;
    // A token is the Minecraft version if it agrees with it as far as it goes:
    // "26.1" and "26.1.2" both match 26.1.2, "26.1.154" does not.
    const shared = Math.min(parts.length, mc.length);
    const isMinecraft = parts.slice(0, shared).every((n, i) => n === mc[i]);
    // Never strip the only thing left — a mod whose version *is* the MC version
    // should still show something.
    return !isMinecraft || (index === 0 && raw.split('-').length === 1);
  });

  return kept.join('-') || raw;
}

/**
 * Best-effort display name and version from a jar filename.
 *
 * The rule is the one that actually holds across mod naming: the version is the
 * first dash-separated part that starts with a digit, everything before it is
 * the name.
 */
export function guessFromFilename(file: string): { name: string; version: string } {
  const stem = basename(file).replace(/\.jar$/i, '');
  const parts = stem.split('-');
  const versionAt = parts.findIndex((part, i) => i > 0 && /^\d/.test(part));

  const nameParts = versionAt === -1 ? parts : parts.slice(0, versionAt);
  const version = versionAt === -1 ? '' : parts.slice(versionAt).join('-');

  const name = nameParts
    .join(' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    name: name || stem,
    // Trim the "+mc1.21.5" build suffix: it repeats the pack's own MC version
    // on every row and pushes the part people care about out of view.
    version: version.split('+')[0] ?? '',
  };
}

/**
 * Parses a .mrpack into the pack metadata and its mod list.
 *
 * Does not touch the network — see `enrichFromModrinth` for that, which is kept
 * separate so a failing API cannot fail an upload.
 */
export function parseMrpack(buffer: Buffer): ParsedPack {
  const entries = readDirectory(buffer);

  const indexEntry = entries.find((e) => e.name === 'modrinth.index.json');
  if (!indexEntry) {
    throw new MrpackError('No modrinth.index.json inside — is this really a .mrpack?');
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(readEntry(buffer, indexEntry).toString('utf8')) as Manifest;
  } catch (error) {
    throw new MrpackError(
      `Could not read modrinth.index.json: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const dependencies = manifest.dependencies ?? {};
  const minecraft = typeof dependencies.minecraft === 'string' ? dependencies.minecraft : null;

  let loader: string | null = null;
  for (const [key, label] of Object.entries(LOADERS)) {
    const value = dependencies[key];
    if (typeof value === 'string') {
      loader = `${label} ${value}`;
      break;
    }
  }

  const mods: ParsedMod[] = [];
  const seen = new Set<string>();

  const files = Array.isArray(manifest.files) ? (manifest.files as ManifestFile[]) : [];
  for (const file of files) {
    if (typeof file?.path !== 'string') continue;
    // Packs can carry resource packs and shaders in the same list.
    if (!file.path.startsWith('mods/') || !file.path.endsWith('.jar')) continue;

    const downloads = Array.isArray(file.downloads) ? file.downloads : [];
    const url = downloads.find((d): d is string => typeof d === 'string') ?? '';
    const match = CDN_PATTERN.exec(url);

    const jar = basename(file.path);
    const guess = guessFromFilename(jar);
    seen.add(jar);
    mods.push({
      name: guess.name,
      version: cleanVersion(guess.version, minecraft),
      modrinth: match?.[1] ?? null,
      modrinthVersion: match?.[2] ?? null,
      bundledOnly: false,
      file: jar,
    });
  }

  // Overrides are the jars Modrinth does not host. They are the ones worth
  // flagging on the public page, so they are picked up rather than ignored.
  for (const entry of entries) {
    if (!/^overrides\/mods\/[^/]+\.jar$/i.test(entry.name)) continue;
    const jar = basename(entry.name);
    if (seen.has(jar)) continue;
    const guess = guessFromFilename(jar);
    mods.push({
      ...guess,
      version: cleanVersion(guess.version, minecraft),
      modrinth: null,
      modrinthVersion: null,
      bundledOnly: true,
      file: jar,
    });
  }

  return {
    name: typeof manifest.name === 'string' ? manifest.name : null,
    version: typeof manifest.versionId === 'string' ? manifest.versionId : null,
    minecraft,
    loader,
    mods,
  };
}

const MODRINTH_API = 'https://api.modrinth.com/v2';
/** Modrinth's API policy asks for a contactable User-Agent. */
const USER_AGENT = 'BetterQOLHub/1.0 (newqolhub.xyz)';
const API_TIMEOUT_MS = 8000;

async function modrinthGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${MODRINTH_API}${path}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // Deliberately swallowed: enrichment is an improvement, not a requirement.
    return null;
  }
}

/**
 * Replaces the filename-derived names with the real Modrinth project titles.
 *
 * One bulk call for the whole pack rather than one per mod, and every failure
 * path leaves the guessed names in place — a pack with slightly ugly rows is a
 * far better outcome than an upload that fails because an external API was down.
 *
 * Deliberately only the *title*. Modrinth's `version_number` is noisier than
 * what the filename gives after cleaning — it reports Lithium as
 * `mc26.1.2-0.24.6-fabric` where the jar says `0.24.6` — so versions are left
 * alone.
 */
export async function enrichFromModrinth(mods: ParsedMod[]): Promise<ParsedMod[]> {
  const projectIds = [...new Set(mods.map((m) => m.modrinth).filter((id): id is string => !!id))];
  if (projectIds.length === 0) return mods;

  const projects = await modrinthGet<{ id: string; title: string }[]>(
    `/projects?ids=${encodeURIComponent(JSON.stringify(projectIds))}`
  );
  if (!projects) return mods;

  const titles = new Map(projects.map((p) => [p.id, p.title]));
  return mods.map((mod) => ({
    ...mod,
    name: (mod.modrinth && titles.get(mod.modrinth)) || mod.name,
  }));
}
