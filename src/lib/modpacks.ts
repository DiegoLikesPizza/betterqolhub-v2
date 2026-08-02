// Reading modpacks.
//
// Kept apart from src/lib/modpack.ts on purpose: that file is presentation and
// is imported by client components, this one talks to the database and must
// never end up in a browser bundle.

import { prisma } from '@/lib/prisma';
import { downloadHref } from '@/lib/modpack-storage';
import {
  MOD_GROUPS,
  type ModpackFileKind,
  type ModGroup,
} from '@/lib/modpack';

export type PackFile = {
  kind: ModpackFileKind;
  filename: string;
  bytes: number;
  href: string;
};

export type PackMod = {
  name: string;
  version: string;
  modrinth: string | null;
  bundledOnly: boolean;
};

export type PackSummary = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  minecraft: string;
  loader: string;
  version: string;
  modCount: number;
  files: PackFile[];
};

export type PackDetail = PackSummary & {
  groups: (ModGroup & { mods: PackMod[] })[];
  hasBundled: boolean;
};

const FILE_SELECT = { kind: true, filename: true, bytes: true } as const;

function toFiles(files: { kind: string; filename: string; bytes: number }[]): PackFile[] {
  return files.map((f) => ({
    kind: f.kind as ModpackFileKind,
    filename: f.filename,
    bytes: f.bytes,
    href: downloadHref(f.filename),
  }));
}

/**
 * Published packs, in display order.
 *
 * A pack with no uploaded files is skipped even when published: a download page
 * whose buttons 404 is worse than one pack fewer.
 */
export async function getPublishedModpacks(): Promise<PackSummary[]> {
  const packs = await prisma.modpack.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      minecraft: true,
      loader: true,
      version: true,
      files: { select: FILE_SELECT },
      _count: { select: { mods: true } },
    },
  });

  return packs
    .filter((p) => p.files.length > 0)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      summary: p.summary,
      minecraft: p.minecraft,
      loader: p.loader,
      version: p.version,
      modCount: p._count.mods,
      files: toFiles(p.files),
    }));
}

/** The pack legacy /download/mrpack and /download/zip links still resolve to. */
export async function getPrimaryModpack(): Promise<PackSummary | null> {
  const packs = await getPublishedModpacks();
  return packs[0] ?? null;
}

export async function getModpackBySlug(slug: string): Promise<PackDetail | null> {
  const pack = await prisma.modpack.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      summary: true,
      minecraft: true,
      loader: true,
      version: true,
      isPublished: true,
      files: { select: FILE_SELECT },
      mods: {
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { name: true, version: true, modrinth: true, bundledOnly: true, group: true },
      },
    },
  });

  if (!pack || !pack.isPublished || pack.files.length === 0) return null;

  // Grouped in MOD_GROUPS order rather than by whatever the database returns, so
  // the page's section order is the curated one. Empty groups are dropped.
  const groups = MOD_GROUPS.map((group) => ({
    ...group,
    mods: pack.mods
      .filter((m) => m.group === group.key)
      .map(({ name, version, modrinth, bundledOnly }) => ({
        name,
        version,
        modrinth,
        bundledOnly,
      })),
  })).filter((g) => g.mods.length > 0);

  return {
    id: pack.id,
    slug: pack.slug,
    name: pack.name,
    summary: pack.summary,
    minecraft: pack.minecraft,
    loader: pack.loader,
    version: pack.version,
    modCount: pack.mods.length,
    files: toFiles(pack.files),
    groups,
    hasBundled: pack.mods.some((m) => m.bundledOnly),
  };
}

export type AdminPack = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  minecraft: string;
  loader: string;
  version: string;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string;
  files: PackFile[];
  mods: (PackMod & { id: string; group: string })[];
};

/** Everything, published or not, with the full mod list for editing. */
export async function getAdminModpacks(): Promise<AdminPack[]> {
  const packs = await prisma.modpack.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      files: { select: FILE_SELECT },
      mods: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
    },
  });

  return packs.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    summary: p.summary,
    minecraft: p.minecraft,
    loader: p.loader,
    version: p.version,
    isPublished: p.isPublished,
    sortOrder: p.sortOrder,
    updatedAt: p.updatedAt.toISOString(),
    files: toFiles(p.files),
    mods: p.mods.map((m) => ({
      id: m.id,
      name: m.name,
      version: m.version,
      modrinth: m.modrinth,
      bundledOnly: m.bundledOnly,
      group: m.group,
    })),
  }));
}
