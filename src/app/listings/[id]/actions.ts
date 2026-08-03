'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { currentUser, requireUser } from '@/lib/authz';
import {
  requireListingTeam,
  requireListingLead,
  isOnListingTeam,
} from '@/lib/team-access';
import { MAX_ANNOUNCEMENT_LENGTH } from '@/lib/announcements';
import {
  MAX_CHANGELOG_LENGTH,
  MAX_VERSION_LENGTH,
} from '@/lib/changelog';
import {
  parseWebhookUrl,
  sendChangelogWebhook,
  sendWebhookTest,
} from '@/lib/discord-webhook';
import { isValidRating, MAX_BODY_LENGTH } from '@/lib/reviews';
import { notifyReview, notifyAnnouncement } from '@/lib/discord-bot';
import {
  countCustomEmoji,
  displayLength,
  MAX_CUSTOM_EMOJI_PER_REVIEW,
} from '@/lib/emoji';

export type ReviewFormState = {
  ok?: boolean;
  message?: string;
} | undefined;

export async function submitReview(
  _prevState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, message: 'You need to be signed in to post a review.' };
  }

  // Reviews carry weight on a site whose whole premise is vetting, so they are
  // tied to a verified Discord identity rather than a throwaway signup.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { discordId: true, reviewBannedAt: true },
  });
  if (!account?.discordId) {
    return {
      ok: false,
      message: 'Link your Discord account in Settings before posting a review.',
    };
  }
  // Checked here rather than only by hiding the form: this is a POST endpoint
  // anyone can call, and a ban can land while someone already has the page open.
  // The reason is deliberately not echoed back — it is a moderation note, not a
  // published accusation.
  if (account.reviewBannedAt) {
    return {
      ok: false,
      message: 'Your account cannot post reviews. Contact an admin if you think that is wrong.',
    };
  }

  const listingId = String(formData.get('listingId') ?? '');
  const rating = Number(formData.get('rating'));
  const body = String(formData.get('body') ?? '').trim();

  if (!listingId) {
    return { ok: false, message: 'Missing listing.' };
  }
  if (!isValidRating(rating)) {
    return { ok: false, message: 'Choose a rating between 1 and 5 stars.' };
  }
  // Only that there is something to read. There is deliberately no length or
  // word floor (see REVIEW_RULE): whether a review helps anyone is a judgement
  // a character count cannot make, so it is left to moderation.
  if (!body) {
    return { ok: false, message: 'Write something about the listing.' };
  }
  // Measured as rendered, so `<:emoji:123…>` counts as one glyph rather than
  // twenty-odd characters of markup.
  if (displayLength(body) > MAX_BODY_LENGTH) {
    return { ok: false, message: `Reviews are limited to ${MAX_BODY_LENGTH} characters.` };
  }
  if (countCustomEmoji(body) > MAX_CUSTOM_EMOJI_PER_REVIEW) {
    return {
      ok: false,
      message: `Please use at most ${MAX_CUSTOM_EMOJI_PER_REVIEW} custom emoji per review.`,
    };
  }

  // Guard against reviewing a listing that has since been deleted — the FK
  // would throw a less helpful error.
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, name: true },
  });
  if (!listing) {
    return { ok: false, message: 'That listing no longer exists.' };
  }
  // A developer rating their own product is not a review. Enforced here rather
  // than only by hiding the form, since this is a POST endpoint anyone can call
  // — and someone can join the team after already loading the page.
  if (await isOnListingTeam(user, listing.id)) {
    return {
      ok: false,
      message: 'You are on this listing’s team, so you cannot review it.',
    };
  }

  let saved;
  try {
    // Upsert on the composite unique: posting twice edits rather than duplicates.
    saved = await prisma.review.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      update: { rating, body },
      create: { rating, body, userId: user.id, listingId },
    });
  } catch (error) {
    // Log the cause: a swallowed database error is undebuggable in production,
    // where this message is all anyone ever sees.
    console.error('[reviews] failed to save review', error);
    return { ok: false, message: 'Could not save your review. Try again.' };
  }

  // The bot treats a repeat id as an edit, so this covers both cases.
  await notifyReview('created', {
    id: saved.id,
    rating: saved.rating,
    body: saved.body,
    username: user.name ?? 'A member',
    listingId: listing.id,
    listingName: listing.name,
  });

  revalidatePath(`/listings/${listingId}`);
  revalidatePath('/listings');
  return { ok: true, message: 'Review posted.' };
}

/**
 * Follows or unfollows a listing, returning the state the button should show.
 *
 * The delete/create pair is driven by what the caller says it wants rather than
 * by reading first and toggling, so two rapid clicks cannot race into the wrong
 * final state. The composite primary key makes both ends idempotent.
 */
export async function setFollowing(listingId: string, following: boolean): Promise<boolean> {
  const user = await requireUser();

  if (following) {
    await prisma.follow.upsert({
      where: { userId_listingId: { userId: user.id, listingId } },
      create: { userId: user.id, listingId },
      update: {},
    });
  } else {
    // deleteMany rather than delete: unfollowing something already unfollowed
    // should be a no-op, not a "record not found" throw.
    await prisma.follow.deleteMany({
      where: { userId: user.id, listingId },
    });
  }

  revalidatePath(`/listings/${listingId}`);
  return following;
}

export type AnnouncementFormState = {
  ok?: boolean;
  message?: string;
} | undefined;

/**
 * Publishes an announcement on a listing the caller develops.
 *
 * This *is* mirrored to Discord, but only into the listing's own forum thread —
 * never into the general reviews channel. That distinction is the point: someone
 * who followed that thread asked to hear from this developer, whereas a broadcast
 * would put unvetted vendor claims in front of the whole server under the hub's
 * name. It doubles as the notification mechanism, since Discord already pings
 * thread followers.
 */
export async function postAnnouncement(
  _prevState: AnnouncementFormState,
  formData: FormData
): Promise<AnnouncementFormState> {
  const listingId = String(formData.get('listingId') ?? '').trim();
  if (!listingId) {
    return { ok: false, message: 'Missing listing.' };
  }

  let author;
  try {
    author = await requireListingTeam(listingId);
  } catch {
    return { ok: false, message: 'Only this listing’s team can post here.' };
  }

  const body = String(formData.get('body') ?? '').trim();
  if (!body) {
    return { ok: false, message: 'Write something to announce.' };
  }
  if (body.length > MAX_ANNOUNCEMENT_LENGTH) {
    return {
      ok: false,
      message: `Announcements are limited to ${MAX_ANNOUNCEMENT_LENGTH} characters.`,
    };
  }

  let saved;
  try {
    saved = await prisma.announcement.create({
      data: { listingId, authorId: author.id, body },
      include: { listing: { select: { name: true } } },
    });
  } catch (error) {
    console.error('[announcements] failed to save', error);
    return { ok: false, message: 'Could not post that. Try again.' };
  }

  // After the write, and never able to undo it: the announcement is live on the
  // site whether or not Discord hears about it.
  await notifyAnnouncement({
    id: saved.id,
    listingId,
    listingName: saved.listing.name,
    body: saved.body,
    author: author.name ?? 'The developer',
  });

  revalidatePath(`/listings/${listingId}`);
  return { ok: true, message: 'Announcement posted.' };
}

export async function deleteAnnouncement(announcementId: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: { listingId: true },
  });
  if (!announcement) return;

  // Authorised against the listing the announcement belongs to, not against the
  // author: a team may remove a post left by a member who has since left, and an
  // admin may remove any.
  await requireListingTeam(announcement.listingId);

  await prisma.announcement.delete({ where: { id: announcementId } });

  revalidatePath(`/listings/${announcement.listingId}`);
}

export type ChangelogFormState = {
  ok?: boolean;
  message?: string;
  /**
   * Set when the entry saved but Discord did not take it. Reported apart from
   * `message` because the two mean opposite things to the reader: one is a
   * failure to publish, the other is a published release whose mirror missed.
   */
  webhookWarning?: string;
} | undefined;

/**
 * Publishes a release on a listing the caller develops.
 *
 * Not gated behind the change-request queue that listing *edits* go through. The
 * reason that queue exists is that the site vouches for what a listing claims to
 * be, and a developer must not be able to rewrite that after being marked
 * trusted. A changelog makes no such claim: it is dated, attributed, sits under
 * its own heading, and moves no rating. Holding a release note until an admin
 * wakes up would make the feature useless on the one day it matters.
 */
export async function publishChangelog(
  _prevState: ChangelogFormState,
  formData: FormData
): Promise<ChangelogFormState> {
  const listingId = String(formData.get('listingId') ?? '').trim();
  if (!listingId) {
    return { ok: false, message: 'Missing listing.' };
  }

  let author;
  try {
    author = await requireListingTeam(listingId);
  } catch {
    return { ok: false, message: 'Only this listing’s team can publish releases.' };
  }

  const version = String(formData.get('version') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!version) {
    return { ok: false, message: 'Give the release a version.' };
  }
  if (version.length > MAX_VERSION_LENGTH) {
    return { ok: false, message: `Versions are limited to ${MAX_VERSION_LENGTH} characters.` };
  }
  if (!body) {
    return { ok: false, message: 'Write what changed.' };
  }
  if (body.length > MAX_CHANGELOG_LENGTH) {
    return {
      ok: false,
      message: `Release notes are limited to ${MAX_CHANGELOG_LENGTH} characters.`,
    };
  }

  // Optional, so old releases can be entered with the date they actually
  // shipped. A future date is refused rather than clamped: it would sit at the
  // top of the history forever, and silently changing what someone typed is
  // worse than telling them it was wrong.
  const releasedRaw = String(formData.get('releasedAt') ?? '').trim();
  let releasedAt = new Date();
  if (releasedRaw) {
    const parsed = new Date(`${releasedRaw}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, message: 'That release date is not a date.' };
    }
    if (parsed.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return { ok: false, message: 'A release cannot be dated in the future.' };
    }
    releasedAt = parsed;
  }

  let saved;
  try {
    saved = await prisma.changelogEntry.create({
      data: { listingId, authorId: author.id, version, body, releasedAt },
      include: {
        listing: { select: { name: true, changelogWebhookUrl: true } },
      },
    });
  } catch (error) {
    console.error('[changelog] failed to save', error);
    return { ok: false, message: 'Could not publish that. Try again.' };
  }

  revalidatePath(`/listings/${listingId}`);

  // After the write, and unable to undo it. The release is live here whether or
  // not the team's own Discord hears about it — so a failure is reported as a
  // note on a success, not as a failure.
  let webhookWarning: string | undefined;
  if (saved.listing.changelogWebhookUrl) {
    const result = await sendChangelogWebhook(saved.listing.changelogWebhookUrl, {
      listingId,
      listingName: saved.listing.name,
      version: saved.version,
      body: saved.body,
      author: author.name ?? 'The developer',
      releasedAt: saved.releasedAt,
    });
    if (!result.ok) {
      webhookWarning = `Published here, but the Discord webhook failed: ${result.reason}`;
    }
  }

  return { ok: true, message: 'Release published.', webhookWarning };
}

export async function deleteChangelogEntry(entryId: string) {
  const entry = await prisma.changelogEntry.findUnique({
    where: { id: entryId },
    select: { listingId: true },
  });
  if (!entry) return;

  // Against the listing rather than the author, so a team can clean up after a
  // member who has since left — the same rule announcements use.
  await requireListingTeam(entry.listingId);

  await prisma.changelogEntry.delete({ where: { id: entryId } });

  revalidatePath(`/listings/${entry.listingId}`);
}

export type WebhookFormState = {
  ok?: boolean;
  message?: string;
} | undefined;

/**
 * Points a listing's releases at a Discord webhook, or clears it.
 *
 * Lead-only. The URL is a standing credential for a channel in someone else's
 * server, and handing every member of the team the ability to redirect it is a
 * different thing from letting them publish a release.
 */
export async function setChangelogWebhook(
  _prevState: WebhookFormState,
  formData: FormData
): Promise<WebhookFormState> {
  const listingId = String(formData.get('listingId') ?? '').trim();
  if (!listingId) {
    return { ok: false, message: 'Missing listing.' };
  }

  try {
    await requireListingLead(listingId);
  } catch {
    return { ok: false, message: 'Only a team lead can change this.' };
  }

  // Removal is its own button rather than "save an empty field". The input is
  // always empty when the dialog opens — it cannot be prefilled, since the
  // stored URL is a credential the browser never receives — so an empty submit
  // is far more likely to be a slip than an intention to disconnect.
  if (String(formData.get('intent') ?? '') === 'remove') {
    await prisma.listing.update({
      where: { id: listingId },
      data: { changelogWebhookUrl: null },
    });
    revalidatePath(`/listings/${listingId}`);
    return { ok: true, message: 'Webhook removed. Releases stay on the site.' };
  }

  const raw = String(formData.get('webhookUrl') ?? '').trim();
  if (!raw) {
    return { ok: false, message: 'Paste a webhook URL, or use “Remove” to disconnect.' };
  }

  const parsed = parseWebhookUrl(raw);
  if (!parsed) {
    return {
      ok: false,
      message:
        'That is not a Discord webhook URL. In Discord: Channel settings → Integrations → Webhooks → Copy Webhook URL.',
    };
  }

  await prisma.listing.update({
    where: { id: listingId },
    data: { changelogWebhookUrl: parsed.url },
  });

  revalidatePath(`/listings/${listingId}`);
  return { ok: true, message: 'Webhook saved. Use “Send test” to check it.' };
}

/**
 * Posts a fixed message to the configured webhook.
 *
 * Reads the URL from the database rather than taking one from the caller: a
 * parameter would turn this into a button that makes the server POST to an
 * address of the caller's choosing, which is the thing parseWebhookUrl exists to
 * prevent.
 */
export async function testChangelogWebhook(listingId: string): Promise<WebhookFormState> {
  try {
    await requireListingLead(listingId);
  } catch {
    return { ok: false, message: 'Only a team lead can do that.' };
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { name: true, changelogWebhookUrl: true },
  });
  if (!listing?.changelogWebhookUrl) {
    return { ok: false, message: 'No webhook is set for this listing.' };
  }

  const result = await sendWebhookTest(listing.changelogWebhookUrl, listing.name);
  return result.ok
    ? { ok: true, message: 'Sent. Check the channel.' }
    : { ok: false, message: result.reason };
}

export async function deleteReview(reviewId: string) {
  const user = await currentUser();
  if (!user) throw new Error('Unauthorized: sign in required.');

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { userId: true, listingId: true },
  });
  if (!review) return;

  // A member may delete their own review; an admin may delete any.
  if (review.userId !== user.id && user.role !== 'ADMIN') {
    throw new Error('Forbidden: that is not your review.');
  }

  await prisma.review.delete({ where: { id: reviewId } });

  await notifyReview('deleted', { id: reviewId });

  revalidatePath(`/listings/${review.listingId}`);
  revalidatePath('/listings');
  revalidatePath('/admin', 'layout');
}
