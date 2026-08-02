'use server';

import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isCategoryKey } from '@/lib/categories';
import {
  isPricingKey,
  pricingForCategory,
  priceForPricing,
  normalisePrice,
  MAX_PRICE_LENGTH,
  type PricingKey,
} from '@/lib/pricing';
import { requireAdmin } from '@/lib/authz';
import { MAX_UNLIST_REASON_LENGTH } from '@/lib/moderation';
import { notifyListing } from '@/lib/discord-bot';

export type AddListingState = {
  ok?: boolean;
  message?: string;
} | undefined;

type ListingInput = {
  name: string;
  category: string;
  description: string;
  url: string;
  developer: string | null;
  secondaryUrl: string | null;
  isTrusted: boolean;
  pricing: PricingKey | null;
  price: string | null;
};

/** Shared by add and edit so the two can never validate differently. */
function readListingForm(formData: FormData): ListingInput | { error: string } {
  const name = String(formData.get('name') ?? '').trim();
  const category = String(formData.get('category') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  const developer = String(formData.get('developer') ?? '').trim();
  const secondaryUrl = String(formData.get('secondaryUrl') ?? '').trim();

  if (!name || !description || !url) {
    return { error: 'Name, description and primary link are required.' };
  }
  if (!isCategoryKey(category)) {
    return { error: 'Please choose a valid category.' };
  }

  // Pricing is optional; the empty option means "not specified", which is
  // distinct from claiming a listing is free.
  const rawPricing = String(formData.get('pricing') ?? '').trim();
  if (rawPricing && !isPricingKey(rawPricing)) {
    return { error: 'Invalid pricing option.' };
  }

  // The form hides the price field for free and unpriced listings, so a value
  // arriving here for one of those is a stale input rather than intent —
  // priceForPricing() drops it. Length is capped in the markup too; this is the
  // check that actually holds, since the form is not the only caller shape.
  const rawPrice = normalisePrice(String(formData.get('price') ?? ''));
  if (rawPrice.length > MAX_PRICE_LENGTH) {
    return { error: `Price must be ${MAX_PRICE_LENGTH} characters or fewer.` };
  }

  const pricing = pricingForCategory(category, rawPricing ? (rawPricing as PricingKey) : null);

  return {
    name,
    category,
    description,
    url,
    developer: developer || null,
    secondaryUrl: secondaryUrl || null,
    // An unchecked checkbox is simply absent from FormData.
    isTrusted: formData.get('isTrusted') === 'on',
    // Coerced by category, so recategorising a client into a shop drops its
    // pricing instead of leaving a stale badge behind.
    pricing,
    // Same idea one level down: marking a paid listing free clears its price
    // rather than keeping a number nobody can see.
    price: priceForPricing(pricing, rawPrice),
  };
}

export async function addListing(
  _prevState: AddListingState,
  formData: FormData
): Promise<AddListingState> {
  // Authorization is re-checked here, not inherited from the page. Server
  // actions are POST endpoints that can be invoked directly.
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: 'Admin access required.' };
  }

  const input = readListingForm(formData);
  if ('error' in input) return { ok: false, message: input.error };

  let created;
  try {
    created = await prisma.listing.create({ data: input });
  } catch (error) {
    console.error('[admin] failed to create listing', error);
    return { ok: false, message: 'Failed to create listing.' };
  }
  const name = input.name;

  // Best-effort mirror to Discord; never fails the save.
  await notifyListing('created', created);

  revalidatePath('/admin', 'layout');
  revalidatePath('/listings');
  return { ok: true, message: `Added "${name}" successfully.` };
}

export type EditListingState = {
  ok?: boolean;
  message?: string;
} | undefined;

export async function editListing(
  _prevState: EditListingState,
  formData: FormData
): Promise<EditListingState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: 'Admin access required.' };
  }

  const listingId = String(formData.get('listingId') ?? '').trim();
  if (!listingId) return { ok: false, message: 'Missing listing.' };

  const input = readListingForm(formData);
  if ('error' in input) return { ok: false, message: input.error };

  let updated;
  try {
    updated = await prisma.listing.update({ where: { id: listingId }, data: input });
  } catch (error) {
    console.error('[admin] failed to update listing', error);
    return { ok: false, message: 'Failed to update the listing.' };
  }

  // The bot edits the existing forum post in place. If the category changed it
  // cannot move a forum post between channels, so it deletes and recreates —
  // which loses that thread's replies. Worth knowing before recategorising.
  await notifyListing('updated', updated);

  revalidatePath('/admin', 'layout');
  revalidatePath('/listings');
  revalidatePath(`/listings/${listingId}`);

  return { ok: true, message: `Saved changes to "${updated.name}".` };
}

export async function deleteListing(listingId: string) {
  await requireAdmin();

  // Reviews cascade via the FK, so this also clears the listing's review rows.
  await prisma.listing.delete({ where: { id: listingId } });

  await notifyListing('deleted', { id: listingId });

  revalidatePath('/admin', 'layout');
  revalidatePath('/listings');
}

export async function setListingTrust(listingId: string, isTrusted: boolean) {
  await requireAdmin();

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: { isTrusted },
  });

  await notifyListing('updated', updated);

  revalidatePath('/admin', 'layout');
  revalidatePath('/listings');
}

export type UnlistState = {
  ok?: boolean;
  message?: string;
} | undefined;

/**
 * Pulls a listing from the public catalogue while something is looked into, or
 * puts it back.
 *
 * Not a delete: reviews, stats and announcements stay, so relisting is one
 * click and nothing is lost if the accusation does not hold up. What it does
 * do is stop the hub promoting the thing — hidden from /listings and from the
 * public API, and the Discord post is removed, since a post the bot left up is
 * still the hub recommending it.
 */
export async function setListingUnlisted(
  _prevState: UnlistState,
  formData: FormData
): Promise<UnlistState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: 'Admin access required.' };
  }

  const listingId = String(formData.get('listingId') ?? '').trim();
  const unlist = formData.get('unlist') === '1';
  const reason = String(formData.get('reason') ?? '').trim();

  if (!listingId) return { ok: false, message: 'Missing listing.' };
  if (unlist && !reason) {
    // Required so the admin log is not a row of unexplained removals nobody can
    // review later.
    return { ok: false, message: 'Say why — it is only visible to admins.' };
  }

  const updated = await prisma.listing.update({
    where: { id: listingId },
    data: unlist
      ? { unlistedAt: new Date(), unlistedReason: reason.slice(0, MAX_UNLIST_REASON_LENGTH) }
      : { unlistedAt: null, unlistedReason: null },
  });

  // Removing the post and putting it back are the same two calls the bot
  // already understands from add and delete.
  await notifyListing(unlist ? 'deleted' : 'created', unlist ? { id: listingId } : updated);

  revalidatePath('/admin', 'layout');
  revalidatePath('/listings');
  revalidatePath(`/listings/${listingId}`);

  return {
    ok: true,
    message: unlist ? 'Unlisted and removed from Discord.' : 'Listed again.',
  };
}

export type SetOwnerState = {
  ok?: boolean;
  message?: string;
} | undefined;

/**
 * Assigns the account allowed to post announcements on a listing, or clears it
 * when the username is blank.
 *
 * Kept as its own action rather than a field on the listing form: it needs a
 * lookup the shared form validator cannot do, and granting it is supposed to be
 * a deliberate step taken *after* checking the person's identity over Discord.
 * Nothing here verifies that — only an admin can call this, and the check is
 * theirs to make.
 */
export async function setListingOwner(
  _prevState: SetOwnerState,
  formData: FormData
): Promise<SetOwnerState> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, message: 'Admin access required.' };
  }

  const listingId = String(formData.get('listingId') ?? '').trim();
  const username = String(formData.get('ownerUsername') ?? '').trim();
  if (!listingId) return { ok: false, message: 'Missing listing.' };

  if (!username) {
    await prisma.listing.update({ where: { id: listingId }, data: { ownerId: null } });
    revalidatePath('/admin', 'layout');
    revalidatePath(`/listings/${listingId}`);
    return { ok: true, message: 'Owner cleared.' };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, discordId: true },
  });
  if (!user) {
    return { ok: false, message: `No member called “${username}”.` };
  }
  // The same bar reviews already clear. Announcements are published under this
  // account's name, so it has to be one that was verified over Discord.
  if (!user.discordId) {
    return {
      ok: false,
      message: `“${username}” has not linked a Discord account yet.`,
    };
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { ownerId: user.id },
  });

  revalidatePath('/admin', 'layout');
  revalidatePath(`/listings/${listingId}`);
  return { ok: true, message: `${username} can now post announcements.` };
}

export async function setUserRole(userId: string, makeAdmin: boolean) {
  const admin = await requireAdmin();

  // Refuse to demote yourself — that is the one change that can lock every
  // admin out of the dashboard with no way back in short of a DB edit.
  if (userId === admin.id && !makeAdmin) {
    throw new Error('You cannot remove your own admin access.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: makeAdmin ? 'ADMIN' : 'USER' },
  });

  revalidatePath('/admin', 'layout');
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}
