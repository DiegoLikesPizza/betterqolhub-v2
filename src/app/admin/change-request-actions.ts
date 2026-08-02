'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/authz';
import { requireListingTeam } from '@/lib/team-access';
import {
  MAX_CHANGE_NOTE_LENGTH,
  MAX_DECISION_NOTE_LENGTH,
  CHANGE_FIELDS,
  type ChangeSnapshot,
} from '@/lib/change-requests';
import {
  isPricingKey,
  pricingForCategory,
  priceForPricing,
  normalisePrice,
  MAX_PRICE_LENGTH,
  type PricingKey,
} from '@/lib/pricing';
import { notifyListing, notifyChangeRequest } from '@/lib/discord-bot';
import { MAX_LINK_LABEL_LENGTH } from '@/lib/categories';
import { MAX_FEATURES_LENGTH } from '@/lib/markdown';

export type ChangeRequestState = { ok?: boolean; message?: string } | undefined;

function readSnapshot(
  formData: FormData,
  category: string
): ChangeSnapshot | { error: string } {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const developer = String(formData.get('developer') ?? '').trim();
  const secondaryUrl = String(formData.get('secondaryUrl') ?? '').trim();
  const urlLabel = String(formData.get('urlLabel') ?? '').trim();
  const secondaryUrlLabel = String(formData.get('secondaryUrlLabel') ?? '').trim();
  const features = String(formData.get('features') ?? '').trim();

  if (!name || !description || !url) {
    return { error: 'Name, description and primary link are required.' };
  }

  const rawPricing = String(formData.get('pricing') ?? '').trim();
  if (rawPricing && !isPricingKey(rawPricing)) {
    return { error: 'Invalid pricing option.' };
  }
  const rawPrice = normalisePrice(String(formData.get('price') ?? ''));
  if (rawPrice.length > MAX_PRICE_LENGTH) {
    return { error: `Price must be ${MAX_PRICE_LENGTH} characters or fewer.` };
  }

  // Coerced against the listing's *current* category, which teams cannot
  // propose changes to — so a proposal cannot smuggle in a price for a category
  // where pricing does not apply.
  if (urlLabel.length > MAX_LINK_LABEL_LENGTH || secondaryUrlLabel.length > MAX_LINK_LABEL_LENGTH) {
    return { error: `Button labels must be ${MAX_LINK_LABEL_LENGTH} characters or fewer.` };
  }
  if (features.length > MAX_FEATURES_LENGTH) {
    return { error: `Feature list must be ${MAX_FEATURES_LENGTH} characters or fewer.` };
  }

  const pricing = pricingForCategory(category, rawPricing ? (rawPricing as PricingKey) : null);

  return {
    name,
    description,
    url,
    developer: developer || null,
    secondaryUrl: secondaryUrl || null,
    urlLabel: urlLabel || null,
    secondaryUrlLabel: secondaryUrl ? secondaryUrlLabel || null : null,
    features: features || null,
    pricing,
    price: priceForPricing(pricing, rawPrice),
  };
}

/**
 * A team proposes an edit to its own listing.
 *
 * Nothing is written to the listing here. The proposal is a row an admin reads
 * and applies — see src/lib/change-requests.ts for why that separation is the
 * whole point of the feature.
 */
export async function submitChangeRequest(
  _prev: ChangeRequestState,
  formData: FormData
): Promise<ChangeRequestState> {
  const listingId = String(formData.get('listingId') ?? '').trim();
  if (!listingId) return { ok: false, message: 'Missing listing.' };

  const author = await requireListingTeam(listingId).catch(() => null);
  if (!author) {
    return { ok: false, message: 'Only this listing’s team can propose changes.' };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { category: true },
  });
  if (!listing) return { ok: false, message: 'That listing no longer exists.' };

  const snapshot = readSnapshot(formData, listing.category);
  if ('error' in snapshot) return { ok: false, message: snapshot.error };

  const note = String(formData.get('note') ?? '').trim();
  if (note.length > MAX_CHANGE_NOTE_LENGTH) {
    return { ok: false, message: `Note must be ${MAX_CHANGE_NOTE_LENGTH} characters or fewer.` };
  }

  // One open proposal per listing. A queue of three half-finished edits from the
  // same team is not extra flexibility, it is three chances for an admin to
  // apply the wrong one.
  const open = await prisma.listingChangeRequest.findFirst({
    where: { listingId, status: 'PENDING' },
    select: { id: true },
  });
  if (open) {
    await prisma.listingChangeRequest.update({
      where: { id: open.id },
      data: { ...snapshot, note: note || null, authorId: author.id },
    });
    revalidatePath('/admin', 'layout');
    revalidatePath(`/listings/${listingId}`);
    return { ok: true, message: 'Updated your pending proposal.' };
  }

  await prisma.listingChangeRequest.create({
    data: { ...snapshot, listingId, authorId: author.id, note: note || null },
  });

  // Only on a *new* proposal. Editing one that is already waiting would DM the
  // admins again for something they have already been told about, and a
  // notification that fires on every keystroke-level revision is one people
  // learn to ignore.
  await dmAdmins(listingId, author.name ?? 'A developer', snapshot, note);

  revalidatePath('/admin', 'layout');
  revalidatePath(`/listings/${listingId}`);
  return { ok: true, message: 'Sent for review. An admin will look at it.' };
}

export async function approveChangeRequest(
  _prev: ChangeRequestState,
  formData: FormData
): Promise<ChangeRequestState> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, message: 'Admin access required.' };

  const id = String(formData.get('requestId') ?? '').trim();
  const request = await prisma.listingChangeRequest.findUnique({
    where: { id },
    include: { listing: { select: { id: true, name: true, category: true, isTrusted: true } } },
  });
  if (!request) return { ok: false, message: 'That request no longer exists.' };
  if (request.status !== 'PENDING') {
    return { ok: false, message: 'That request has already been decided.' };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const listing = await tx.listing.update({
      where: { id: request.listingId },
      data: {
        name: request.name,
        description: request.description,
        developer: request.developer,
        url: request.url,
        secondaryUrl: request.secondaryUrl,
        urlLabel: request.urlLabel,
        secondaryUrlLabel: request.secondaryUrlLabel,
        features: request.features,
        pricing: request.pricing,
        price: request.price,
      },
    });

    await tx.listingChangeRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedById: admin.id,
        decisionNote: String(formData.get('decisionNote') ?? '').trim() || null,
      },
    });

    return listing;
  });

  // Mirrors the edit into Discord, the same as an admin editing it by hand would.
  await notifyListing('updated', {
    id: updated.id,
    name: updated.name,
    description: updated.description,
    category: updated.category,
    developer: updated.developer,
    url: updated.url,
    secondaryUrl: updated.secondaryUrl,
    isTrusted: updated.isTrusted,
    pricing: updated.pricing,
    price: updated.price,
  });

  revalidatePath('/admin', 'layout');
  revalidatePath('/listings', 'layout');
  return { ok: true, message: `Applied to ${updated.name}.` };
}

export async function rejectChangeRequest(
  _prev: ChangeRequestState,
  formData: FormData
): Promise<ChangeRequestState> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, message: 'Admin access required.' };

  const id = String(formData.get('requestId') ?? '').trim();
  const decisionNote = String(formData.get('decisionNote') ?? '').trim();
  if (decisionNote.length > MAX_DECISION_NOTE_LENGTH) {
    return {
      ok: false,
      message: `Note must be ${MAX_DECISION_NOTE_LENGTH} characters or fewer.`,
    };
  }

  const request = await prisma.listingChangeRequest.findUnique({
    where: { id },
    select: { status: true, listingId: true },
  });
  if (!request) return { ok: false, message: 'That request no longer exists.' };
  if (request.status !== 'PENDING') {
    return { ok: false, message: 'That request has already been decided.' };
  }

  await prisma.listingChangeRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedById: admin.id,
      // Unlike a moderation note this *is* shown to the team: it is feedback
      // they are meant to act on, not a record about them.
      decisionNote: decisionNote || null,
    },
  });

  revalidatePath('/admin', 'layout');
  revalidatePath(`/listings/${request.listingId}`);
  return { ok: true, message: 'Rejected.' };
}

/**
 * Tells the admins a proposal is waiting.
 *
 * Wrapped so a failure here cannot fail the submission: the team's proposal is
 * already saved, and a DM that did not go out is not their problem.
 */
async function dmAdmins(
  listingId: string,
  author: string,
  proposed: ChangeSnapshot,
  note: string
): Promise<void> {
  try {
    const [listing, admins] = await Promise.all([
      prisma.listing.findUnique({
        where: { id: listingId },
        select: {
          name: true,
          developer: true,
          description: true,
          url: true,
          secondaryUrl: true,
          pricing: true,
          price: true,
        },
      }),
      prisma.user.findMany({
        where: { role: 'ADMIN', discordId: { not: null } },
        select: { discordId: true },
      }),
    ]);
    if (!listing) return;

    // Named rather than counted: "Name, Primary link" tells you whether this
    // needs looking at now, where "2 fields" does not.
    const current = listing as unknown as Record<string, string | null>;
    const fields = CHANGE_FIELDS.filter(
      ({ key }) => (current[key] ?? '') !== ((proposed as Record<string, string | null>)[key] ?? '')
    ).map(({ label }) => label);

    await notifyChangeRequest({
      listingName: listing.name,
      author,
      fields,
      note: note || null,
      recipients: admins.map((a) => a.discordId!).filter(Boolean),
    });
  } catch (error) {
    console.error('[change-requests] could not notify admins', error);
  }
}
