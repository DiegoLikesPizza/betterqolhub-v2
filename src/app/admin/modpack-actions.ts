'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { removeStored } from '@/lib/modpack-storage';
import {
  isGroupKey,
  isValidSlug,
  slugify,
  MAX_NAME_LENGTH,
  MAX_SUMMARY_LENGTH,
} from '@/lib/modpack';

export type ModpackState = { ok?: boolean; message?: string } | undefined;

/** Every route a pack change can show up on. */
function revalidateModpacks(slug?: string): void {
  revalidatePath('/modpacks');
  if (slug) revalidatePath(`/modpacks/${slug}`);
  revalidatePath('/admin/modpacks');
}

const MAX_FIELD_LENGTH = 60;

type PackInput = {
  slug: string;
  name: string;
  summary: string;
  minecraft: string;
  loader: string;
  version: string;
};

/** Shared by create and update so the two can never validate differently. */
function readPackForm(formData: FormData): PackInput | { error: string } {
  const name = String(formData.get('name') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim();
  const minecraft = String(formData.get('minecraft') ?? '').trim();
  const loader = String(formData.get('loader') ?? '').trim();
  const version = String(formData.get('version') ?? '').trim();
  // Blank means "derive it from the name", which is what an admin wants almost
  // every time — but it stays editable, because a slug is a URL and changing one
  // later breaks links.
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const slug = rawSlug ? slugify(rawSlug) : slugify(name);

  if (!name || !summary || !minecraft || !loader || !version) {
    return { error: 'Name, summary, Minecraft version, loader and pack version are required.' };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  }
  if (summary.length > MAX_SUMMARY_LENGTH) {
    return { error: `Summary must be ${MAX_SUMMARY_LENGTH} characters or fewer.` };
  }
  if ([minecraft, loader, version].some((v) => v.length > MAX_FIELD_LENGTH)) {
    return { error: `Version and loader fields must be ${MAX_FIELD_LENGTH} characters or fewer.` };
  }
  if (!isValidSlug(slug)) {
    return { error: 'Slug must be lowercase letters, numbers and dashes.' };
  }

  return { slug, name, summary, minecraft, loader, version };
}

/** Prisma's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = 'P2002';

function isDuplicateSlug(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION
  );
}

export async function createModpack(
  _prev: ModpackState,
  formData: FormData
): Promise<ModpackState> {
  await requireAdmin();

  const input = readPackForm(formData);
  if ('error' in input) return { ok: false, message: input.error };

  // Sorted last rather than sharing position 0 with everything else. Order is
  // not only cosmetic here: the first published pack is the one legacy
  // /download/mrpack links resolve to, so a new pack must never be able to take
  // that spot by accident.
  const last = await prisma.modpack.aggregate({ _max: { sortOrder: true } });
  const sortOrder = (last._max.sortOrder ?? -1) + 1;

  try {
    // Created unpublished: the files have not been uploaded yet, and a pack
    // whose download buttons point at nothing has no business being public.
    await prisma.modpack.create({ data: { ...input, isPublished: false, sortOrder } });
  } catch (error) {
    if (isDuplicateSlug(error)) {
      return { ok: false, message: `A pack with the slug "${input.slug}" already exists.` };
    }
    throw error;
  }

  revalidateModpacks(input.slug);
  return { ok: true, message: 'Pack created. Upload its files next.' };
}

export async function updateModpack(
  _prev: ModpackState,
  formData: FormData
): Promise<ModpackState> {
  await requireAdmin();

  const id = String(formData.get('modpackId') ?? '');
  if (!id) return { ok: false, message: 'Missing pack.' };

  const input = readPackForm(formData);
  if ('error' in input) return { ok: false, message: input.error };

  const existing = await prisma.modpack.findUnique({ where: { id }, select: { slug: true } });
  if (!existing) return { ok: false, message: 'That pack no longer exists.' };

  try {
    await prisma.modpack.update({ where: { id }, data: input });
  } catch (error) {
    if (isDuplicateSlug(error)) {
      return { ok: false, message: `A pack with the slug "${input.slug}" already exists.` };
    }
    throw error;
  }

  // Both, since the slug may have moved the public page.
  revalidateModpacks(existing.slug);
  revalidateModpacks(input.slug);
  return { ok: true, message: 'Saved.' };
}

/**
 * Returns its outcome rather than throwing, because "upload a file first" is
 * something the admin needs to read — a thrown error would reach the client as
 * a generic failure in production.
 */
export async function setModpackPublished(
  id: string,
  published: boolean
): Promise<ModpackState> {
  await requireAdmin();

  const pack = await prisma.modpack.findUnique({
    where: { id },
    select: { slug: true, _count: { select: { files: true } } },
  });
  if (!pack) return { ok: false, message: 'That pack no longer exists.' };
  if (published && pack._count.files === 0) {
    return { ok: false, message: 'Upload at least one file before publishing.' };
  }

  await prisma.modpack.update({ where: { id }, data: { isPublished: published } });
  revalidateModpacks(pack.slug);
  return { ok: true };
}

export async function deleteModpack(id: string): Promise<void> {
  await requireAdmin();

  const pack = await prisma.modpack.findUnique({
    where: { id },
    select: { slug: true, files: { select: { filename: true } } },
  });
  if (!pack) return;

  // Row first: the uploaded files are large and orphaning one is harmless,
  // whereas a row pointing at a file that is already gone is a broken download.
  await prisma.modpack.delete({ where: { id } });
  for (const file of pack.files) await removeStored(file.filename);

  revalidateModpacks(pack.slug);
}

/**
 * Saves the editable columns of a pack's mod list.
 *
 * Names and versions come out of the .mrpack automatically, which gets them
 * right but not always *pretty* — Modrinth calls the Fabric loader "Fake Fabric
 * Loader" — so they stay editable. `group` is the field that genuinely cannot be
 * derived, since it is a curation call.
 */
export async function saveMods(_prev: ModpackState, formData: FormData): Promise<ModpackState> {
  await requireAdmin();

  const modpackId = String(formData.get('modpackId') ?? '');
  if (!modpackId) return { ok: false, message: 'Missing pack.' };

  const pack = await prisma.modpack.findUnique({
    where: { id: modpackId },
    select: { slug: true, mods: { select: { id: true } } },
  });
  if (!pack) return { ok: false, message: 'That pack no longer exists.' };

  // Only rows that belong to this pack are touched, so a forged form field
  // cannot rewrite another pack's mods.
  const owned = new Set(pack.mods.map((m) => m.id));

  const updates: { id: string; name: string; version: string; group: string }[] = [];
  for (const id of formData.getAll('modId').map(String)) {
    if (!owned.has(id)) continue;

    const name = String(formData.get(`name:${id}`) ?? '').trim();
    const version = String(formData.get(`version:${id}`) ?? '').trim();
    const group = String(formData.get(`group:${id}`) ?? '').trim();

    if (!name) return { ok: false, message: 'Every mod needs a name.' };
    if (name.length > MAX_FIELD_LENGTH || version.length > MAX_FIELD_LENGTH) {
      return { ok: false, message: `Mod names and versions must be ${MAX_FIELD_LENGTH} characters or fewer.` };
    }
    if (!isGroupKey(group)) return { ok: false, message: 'Invalid group.' };

    updates.push({ id, name, version, group });
  }

  await prisma.$transaction(
    updates.map((u) =>
      prisma.modpackMod.update({
        where: { id: u.id },
        data: { name: u.name, version: u.version, group: u.group },
      })
    )
  );

  revalidateModpacks(pack.slug);
  return { ok: true, message: `Saved ${updates.length} mods.` };
}
