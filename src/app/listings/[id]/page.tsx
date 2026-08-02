import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { SITE_URL } from '@/lib/site';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@/lib/authz';
import {
  categoryColor,
  categoryLabel,
  linkLabel,
} from '@/lib/categories';
import { summarise, stars, ratingColor } from '@/lib/reviews';
import { fetchGuildEmojis } from '@/lib/discord-bot';
import { recordListingViewFor } from '@/lib/stats';
import { pricingBadge, pricingColor } from '@/lib/pricing';
import { ANNOUNCEMENT_HISTORY_LIMIT } from '@/lib/announcements';
import { UNLISTED_NOTICE } from '@/lib/moderation';
import ReviewForm from './ReviewForm';
import SafetyNotice from '@/app/SafetyNotice';
import ReviewList from './ReviewList';
import Announcements from './Announcements';
import FollowButton from './FollowButton';

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      name: true,
      description: true,
      category: true,
      developer: true,
      isTrusted: true,
      pricing: true,
      price: true,
      reviews: { select: { rating: true } },
    },
  });

  if (!listing) {
    return { title: 'Listing not found' };
  }

  const summary = summarise(listing.reviews.map((r) => r.rating));

  // The facts someone needs before clicking a link a stranger posted: what it
  // is, whether it is vetted, what it costs, and what the community thinks.
  const facts = [
    categoryLabel(listing.category),
    listing.isTrusted ? '✓ Trusted' : '⚠ Unverified',
    pricingBadge(listing.pricing, listing.price),
    summary.average === null
      ? 'No reviews yet'
      : `${summary.average.toFixed(1)}/5 from ${summary.count} ${
          summary.count === 1 ? 'review' : 'reviews'
        }`,
  ].filter(Boolean);

  const title = listing.developer ? `${listing.name} by ${listing.developer}` : listing.name;
  const description = `${facts.join(' · ')} — ${listing.description}`;

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${SITE_URL}/listings/${id}`,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, username: true } } },
      },
      announcements: {
        orderBy: { createdAt: 'desc' },
        take: ANNOUNCEMENT_HISTORY_LIMIT,
        include: { author: { select: { username: true } } },
      },
      _count: { select: { followers: true } },
    },
  });

  if (!listing) notFound();

  // After notFound(), so a 404 does not count as a view of anything.
  await recordListingViewFor(listing.id, (await headers()).get('user-agent'));

  const user = await currentUser();
  const summary = summarise(listing.reviews.map((r) => r.rating));
  const rarity = categoryColor(listing.category);
  const ownReview = user ? listing.reviews.find((r) => r.user.id === user.id) : undefined;

  // Only fetch the things the review form needs when there is someone to show
  // it to, so signed-out visitors never trigger a call to the bot.
  const [account, customEmoji, follow] = user
    ? await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          select: { discordId: true, reviewBannedAt: true },
        }),
        fetchGuildEmojis(),
        prisma.follow.findUnique({
          where: { userId_listingId: { userId: user.id, listingId: listing.id } },
          select: { userId: true },
        }),
      ])
    : [null, [], null];
  const discordLinked = Boolean(account?.discordId);
  const reviewBanned = Boolean(account?.reviewBannedAt);

  // The composer is offered to the listing's owner and to admins. The server
  // action re-derives this from the database, so this only decides what is
  // drawn — it is not what grants the permission.
  const canPost = Boolean(
    user && (user.role === 'ADMIN' || (listing.ownerId && listing.ownerId === user.id))
  );

  // A developer rating their own product is not a review, it is marketing with
  // stars on it. The server action refuses it too; this decides what is drawn.
  const isOwnListing = Boolean(user && listing.ownerId && listing.ownerId === user.id);

  const unlisted = listing.unlistedAt !== null;

  return (
    <div className="container narrow-page">
      <Link href="/listings" className="back-link">← All listings</Link>

      <article className="detail-card" style={{ '--rarity': rarity } as CSSProperties}>
        <header className="detail-head">
          <div>
            <h1 className="pixel detail-title">{listing.name}</h1>
            {listing.developer && <p className="tooltip-dev">by {listing.developer}</p>}
          </div>
          <div className="detail-head-actions">
            {/* While unlisted the trust badge is suppressed rather than shown
                alongside a warning — "✓ Trusted" next to "we are looking into
                reports" is the site contradicting itself. */}
            <span
              className={`trust ${
                unlisted ? 'trust-pulled' : listing.isTrusted ? 'trust-yes' : 'trust-no'
              }`}
            >
              {unlisted ? '⚠ Under review' : listing.isTrusted ? '✓ Trusted' : 'Unverified'}
            </span>
            <FollowButton
              listingId={listing.id}
              signedIn={Boolean(user)}
              following={Boolean(follow)}
              followers={listing._count.followers}
            />
          </div>
        </header>

        {unlisted && <p className="detail-pulled">{UNLISTED_NOTICE}</p>}

        <p className="tooltip-lore" style={{ fontSize: '1.05rem' }}>{listing.description}</p>

        <div className="tooltip-category">
          {categoryLabel(listing.category)}
          {pricingBadge(listing.pricing, listing.price) && (
            <span
              className="price-tag"
              style={{ '--price': pricingColor(listing.pricing) } as CSSProperties}
            >
              {pricingBadge(listing.pricing, listing.price)}
            </span>
          )}
        </div>

        <div className="rating-line">
          <span className="rating-stars" style={{ color: ratingColor(summary.average) }}>
            {stars(summary.average)}
          </span>
          {summary.average !== null ? (
            <span className="rating-meta">
              {summary.average.toFixed(1)} from {summary.count}{' '}
              {summary.count === 1 ? 'review' : 'reviews'}
            </span>
          ) : (
            <span className="rating-meta">No reviews yet</span>
          )}
        </div>

        {/* Both buttons go through /go/<id>, which counts the click and then
            redirects to the real destination. The label still comes from the
            actual URL, so nothing about how it reads changes. */}
        <div className="tooltip-links">
          <a href={`/go/${listing.id}`} target="_blank" rel="noreferrer" className="btn btn-primary">
            {linkLabel(listing.url)}
          </a>
          {listing.secondaryUrl && (
            <a
              href={`/go/${listing.id}?to=secondary`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              {linkLabel(listing.secondaryUrl)}
            </a>
          )}
        </div>

        <SafetyNotice />
      </article>

      {/* Above the reviews but in its own block: the developer's word and the
          community's verdict are different kinds of claim, and the page should
          not let them blur into one another. */}
      <Announcements
        listingId={listing.id}
        canPost={canPost}
        announcements={listing.announcements.map((a) => ({
          id: a.id,
          body: a.body,
          author: a.author.username,
          createdAt: a.createdAt.toISOString(),
        }))}
      />

      <section style={{ marginTop: '3rem' }}>
        <h2 className="pixel section-title" style={{ marginBottom: '1.5rem' }}>
          Community Reviews
        </h2>

        {!user ? (
          <div className="form-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              <Link href={`/login?callbackUrl=/listings/${listing.id}`} style={{ color: 'var(--gold)' }}>
                Sign in
              </Link>{' '}
              to leave a review.
            </p>
          </div>
        ) : isOwnListing ? (
          <div className="form-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              You are listed as this listing&rsquo;s developer, so you cannot review
              it. Use <strong>Post announcement</strong> above to say something.
            </p>
          </div>
        ) : reviewBanned ? (
          // Checked before the Discord prompt: telling a banned account to go
          // link Discord would send them through a setup flow that changes
          // nothing. The reason is not shown — it is an admin note.
          <div className="form-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Your account cannot post reviews. If you think that is a mistake,
              reach out to an admin on Discord.
            </p>
          </div>
        ) : !discordLinked ? (
          // The server action enforces this too; this is just the friendly path.
          <div className="form-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Reviews are tied to a verified Discord account.{' '}
              <Link href="/settings" style={{ color: 'var(--gold)' }}>
                Link yours in Settings
              </Link>{' '}
              to post one.
            </p>
          </div>
        ) : (
          <ReviewForm
            listingId={listing.id}
            customEmoji={customEmoji}
            existing={ownReview ? { rating: ownReview.rating, body: ownReview.body } : null}
          />
        )}

        <ReviewList
          reviews={listing.reviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            body: r.body,
            username: r.user.username,
            userId: r.user.id,
            createdAt: r.createdAt.toISOString(),
          }))}
          viewerId={user?.id ?? null}
          viewerIsAdmin={user?.role === 'ADMIN'}
        />
      </section>
    </div>
  );
}
