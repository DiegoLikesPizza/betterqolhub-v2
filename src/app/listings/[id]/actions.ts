'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@/lib/authz';
import {
  isValidRating,
  checkReviewBody,
  MAX_BODY_LENGTH,
} from '@/lib/reviews';
import { notifyReview } from '@/lib/discord-bot';
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
    select: { discordId: true },
  });
  if (!account?.discordId) {
    return {
      ok: false,
      message: 'Link your Discord account in Settings before posting a review.',
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
  // The published rules, enforced here rather than only in the form — a server
  // action is a POST endpoint anyone can call directly.
  const problem = checkReviewBody(body);
  if (problem) {
    return { ok: false, message: problem };
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
