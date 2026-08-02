import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { SITE_URL } from '@/lib/site';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@/lib/authz';
import { listingAccessFor, isOnListingTeam } from '@/lib/team-access';
import { getChangeRequests } from '@/lib/team-queries';
import {
  categoryColor,
  categoryLabel,
  linkLabelFor,
} from '@/lib/categories';
import { summarise, stars, ratingColor } from '@/lib/reviews';
import { fetchGuildEmojis } from '@/lib/discord-bot';
import { recordListingViewFor } from '@/lib/stats';
import { pricingBadge, pricingColor } from '@/lib/pricing';
import { ANNOUNCEMENT_HISTORY_LIMIT } from '@/lib/announcements';
import { UNLISTED_NOTICE } from '@/lib/moderation';
import ReviewDialog from './ReviewDialog';
import ReviewList from './ReviewList';
import Announcements from './Announcements';
import FollowButton from './FollowButton';
import ProposeChanges from './ProposeChanges';
import { renderMarkdown } from '@/lib/markdown';

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

  // The composer is offered to the listing's team and to admins. The server
  // action re-derives this from the database, so this only decides what is
  // drawn — it is not what grants the permission.
  const access = await listingAccessFor(user, listing.id);
  const canPost = access.isMember;

  // A developer rating their own product is not a review, it is marketing with
  // stars on it.
  //
  // Deliberately the same helper the server action calls, rather than deriving
  // it from `access` — that counts admins as members everywhere, so an admin who
  // genuinely is on the team would have been shown a form the action then
  // refuses. Asking the identical question keeps the two in step.
  const isOwnListing = await isOnListingTeam(user, listing.id);

  // Only fetched for people who can act on it — a visitor has no business
  // triggering this query, let alone seeing a proposal that is still private.
  const changeRequests = canPost ? await getChangeRequests({ listingId: listing.id }) : [];
  const pendingProposal = changeRequests.find((r) => r.status === 'PENDING') ?? null;
  const lastDecision = changeRequests.find((r) => r.status !== 'PENDING') ?? null;

  const unlisted = listing.unlistedAt !== null;
  // Rendered once here rather than inside the markup, so the section can be
  // skipped entirely when the list is empty or only whitespace.
  const features = renderMarkdown(listing.features);

  // The one question the reviews section asks. Everything else there is the
  // explanation for a `false`.
  const canReview = Boolean(user) && !isOwnListing && !reviewBanned && discordLinked;

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
            {linkLabelFor(listing.url, listing.urlLabel)}
          </a>
          {listing.secondaryUrl && (
            <a
              href={`/go/${listing.id}?to=secondary`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              {linkLabelFor(listing.secondaryUrl, listing.secondaryUrlLabel)}
            </a>
          )}
        </div>

        {/* Collapsed by default: a long list would otherwise push the reviews —
            the part of the page that is not the vendor's own words — below the
            fold. <details> rather than a modal, so it works without JavaScript,
            behaves on a phone, and leaves the text in the document for search. */}
        {features && (
          <details className="features">
            <summary className="features-summary">Features</summary>
            <div className="markdown-body features-body">{features}</div>
          </details>
        )}
      </article>

      {canPost && (
        <ProposeChanges
          listingId={listing.id}
          category={listing.category}
          defaults={{
            name: listing.name,
            developer: listing.developer,
            description: listing.description,
            url: listing.url,
            secondaryUrl: listing.secondaryUrl,
            urlLabel: listing.urlLabel,
            secondaryUrlLabel: listing.secondaryUrlLabel,
            features: listing.features,
            pricing: listing.pricing,
            price: listing.price,
          }}
          pending={
            pendingProposal && {
              authorUsername: pendingProposal.authorUsername,
              createdAt: pendingProposal.createdAt,
              note: pendingProposal.note,
              diffs: pendingProposal.diffs,
            }
          }
          lastDecision={
            lastDecision && {
              status: lastDecision.status,
              decisionNote: lastDecision.decisionNote,
              reviewedAt: lastDecision.reviewedAt,
            }
          }
        />
      )}

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
        <div className="reviews-head">
          <h2 className="pixel section-title">Community Reviews</h2>
          {canReview && (
            <ReviewDialog
              listingId={listing.id}
              customEmoji={customEmoji}
              existing={ownReview ? { rating: ownReview.rating, body: ownReview.body } : null}
            />
          )}
        </div>

        {/* Shown only in place of the button. Someone who can review does not
            need to be told why they can. */}
        {!canReview && (
          <div className="form-card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              {!user ? (
                <>
                  <Link
                    href={`/login?callbackUrl=/listings/${listing.id}`}
                    style={{ color: 'var(--gold)' }}
                  >
                    Sign in
                  </Link>{' '}
                  to leave a review.
                </>
              ) : isOwnListing ? (
                <>
                  You are on this listing&rsquo;s team, so you cannot review it. Use{' '}
                  <strong>Post announcement</strong> above to say something.
                </>
              ) : reviewBanned ? (
                // Before the Discord prompt: sending a banned account through a
                // setup flow that changes nothing would be a lie. The reason is
                // not shown — it is an admin note.
                <>
                  Your account cannot post reviews. If you think that is a mistake,
                  reach out to an admin on Discord.
                </>
              ) : (
                <>
                  Reviews are tied to a verified Discord account.{' '}
                  <Link href="/settings" style={{ color: 'var(--gold)' }}>
                    Link yours in Settings
                  </Link>{' '}
                  to post one.
                </>
              )}
            </p>
          </div>
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
