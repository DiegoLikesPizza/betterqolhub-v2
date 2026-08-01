import { prisma } from '@/lib/prisma';
import { CATEGORIES } from '@/lib/categories';
import { summarise, type RatingSummary } from '@/lib/reviews';

export type DashboardListing = {
  id: string;
  name: string;
  category: string;
  isTrusted: boolean;
  createdAt: Date;
  rating: RatingSummary;
  // Carried so the edit dialog can prefill without a second round trip.
  description: string;
  developer: string | null;
  url: string;
  secondaryUrl: string | null;
  pricing: string | null;
  price: string | null;
  /// Username of the account allowed to post announcements, or null.
  ownerUsername: string | null;
};

/**
 * One query set per admin page rather than one that serves all of them.
 *
 * The dashboard used to be a single route, so a single function loaded every
 * listing with its reviews, every user, every rating and thirty days of stats —
 * even to render four headline numbers. Splitting the page into routes let the
 * headline numbers become counts and aggregates, and let each table load only
 * on the page that shows it.
 */

export type AdminMember = {
  id: string;
  username: string;
  role: string;
  reviewCount: number;
  createdAt: Date;
  discordUsername: string | null;
  discordLinkedAt: Date | null;
};

export type AdminReview = {
  id: string;
  rating: number;
  body: string;
  username: string;
  listingId: string;
  listingName: string;
  createdAt: Date;
};

/** Just enough of a listing to flag it and link to it. */
export type AttentionListing = {
  id: string;
  name: string;
  category: string;
  isTrusted: boolean;
  rating: RatingSummary;
};

export type OverviewData = {
  totals: {
    listings: number;
    members: number;
    admins: number;
    reviews: number;
    averageRating: number | null;
    untrusted: number;
    unreviewed: number;
  };
  categoryBreakdown: { key: string; label: string; color: string; count: number }[];
  needsAttention: AttentionListing[];
};

export async function getOverviewData(): Promise<OverviewData> {
  const [
    listings,
    members,
    admins,
    reviews,
    ratingAgg,
    untrusted,
    unreviewed,
    byCategory,
    ratedListings,
  ] = await Promise.all([
    prisma.listing.count(),
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.review.count(),
    prisma.review.aggregate({ _avg: { rating: true } }),
    prisma.listing.count({ where: { isTrusted: false } }),
    prisma.listing.count({ where: { reviews: { none: {} } } }),
    prisma.listing.groupBy({ by: ['category'], _count: { _all: true } }),
    // The only place that still needs per-listing ratings, and it takes just the
    // rating numbers rather than whole review rows.
    prisma.listing.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        isTrusted: true,
        reviews: { select: { rating: true } },
      },
    }),
  ]);

  const withRatings: AttentionListing[] = ratedListings.map(({ reviews: rs, ...rest }) => ({
    ...rest,
    rating: summarise(rs.map((r) => r.rating)),
  }));

  // Ordered by CATEGORIES rather than by count, so a category's colour and
  // position stay put as the numbers move.
  const counts = new Map(byCategory.map((row) => [row.category, row._count._all]));
  const categoryBreakdown = CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    color: c.color,
    count: counts.get(c.key) ?? 0,
  }));

  // What an admin of a *vetting* site actually needs to act on: entries the
  // community rates badly, and entries nobody has vouched for yet.
  const poorlyRated = withRatings
    .filter((l) => l.rating.count >= 2 && (l.rating.average ?? 5) < 3)
    .sort((a, b) => (a.rating.average ?? 5) - (b.rating.average ?? 5));
  const untrustedListings = withRatings.filter((l) => !l.isTrusted);

  return {
    totals: {
      listings,
      members,
      admins,
      reviews,
      averageRating: ratingAgg._avg.rating,
      untrusted,
      unreviewed,
    },
    categoryBreakdown,
    needsAttention: [
      ...poorlyRated,
      ...untrustedListings.filter((l) => !poorlyRated.some((p) => p.id === l.id)),
    ],
  };
}

export async function getAdminListings(): Promise<DashboardListing[]> {
  const rows = await prisma.listing.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      category: true,
      isTrusted: true,
      createdAt: true,
      description: true,
      developer: true,
      url: true,
      secondaryUrl: true,
      pricing: true,
      price: true,
      owner: { select: { username: true } },
      reviews: { select: { rating: true } },
    },
  });

  return rows.map(({ reviews, owner, ...rest }) => ({
    ...rest,
    ownerUsername: owner?.username ?? null,
    rating: summarise(reviews.map((r) => r.rating)),
  }));
}

export async function getAdminMembers(): Promise<AdminMember[]> {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      discordUsername: true,
      discordLinkedAt: true,
      _count: { select: { reviews: true } },
    },
  });

  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    role: u.role,
    reviewCount: u._count.reviews,
    createdAt: u.createdAt,
    discordUsername: u.discordUsername,
    discordLinkedAt: u.discordLinkedAt,
  }));
}

/**
 * Every review, newest first. Not capped: on its own page the feed is paginated
 * client-side like the other tables, so the old "8 most recent" limit — which
 * existed because the feed shared a page with everything else — is gone.
 */
export async function getAdminReviews(): Promise<AdminReview[]> {
  const rows = await prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      user: { select: { username: true } },
      listing: { select: { id: true, name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    username: r.user.username,
    listingId: r.listing.id,
    listingName: r.listing.name,
    createdAt: r.createdAt,
  }));
}

/** How many days of history the stats panel covers. */
export const STATS_WINDOW_DAYS = 30;

/** How many listings the "most clicked" table shows. */
export const STATS_TOP_LISTINGS = 10;

export type StatsData = {
  windowDays: number;
  /** Oldest day in the window, as an ISO date, for the panel's subheading. */
  since: string;
  totals: { views: number; clicks: number; downloads: number };
  /** One entry per day in the window, oldest first, zero-filled. */
  daily: { day: string; views: number; clicks: number }[];
  topListings: {
    id: string;
    name: string;
    views: number;
    clicks: number;
    /** Clicks per view, or null when nobody has looked at it yet. */
    rate: number | null;
  }[];
  pages: { path: string; hits: number }[];
};

/** Midnight UTC, `daysAgo` days back. Matches how stats.ts buckets a hit. */
function utcDay(daysAgo: number): Date {
  const now = new Date();
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(day - daysAgo * 86_400_000);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getStatsData(): Promise<StatsData> {
  const since = utcDay(STATS_WINDOW_DAYS - 1);

  const [listingRows, pageRows] = await Promise.all([
    prisma.listingStat.findMany({
      where: { day: { gte: since } },
      select: {
        day: true,
        views: true,
        clicks: true,
        listing: { select: { id: true, name: true } },
      },
    }),
    prisma.pageStat.findMany({
      where: { day: { gte: since } },
      select: { path: true, hits: true },
    }),
  ]);

  // Zero-filled so the chart shows quiet days as gaps in activity rather than
  // silently compressing the timeline.
  const byDay = new Map<string, { views: number; clicks: number }>();
  for (let i = 0; i < STATS_WINDOW_DAYS; i++) {
    byDay.set(isoDay(utcDay(STATS_WINDOW_DAYS - 1 - i)), { views: 0, clicks: 0 });
  }

  const byListing = new Map<string, { id: string; name: string; views: number; clicks: number }>();

  for (const row of listingRows) {
    const bucket = byDay.get(isoDay(row.day));
    if (bucket) {
      bucket.views += row.views;
      bucket.clicks += row.clicks;
    }

    const existing = byListing.get(row.listing.id) ?? {
      id: row.listing.id,
      name: row.listing.name,
      views: 0,
      clicks: 0,
    };
    existing.views += row.views;
    existing.clicks += row.clicks;
    byListing.set(row.listing.id, existing);
  }

  const pageTotals = new Map<string, number>();
  for (const row of pageRows) {
    pageTotals.set(row.path, (pageTotals.get(row.path) ?? 0) + row.hits);
  }

  const downloads =
    (pageTotals.get('download:mrpack') ?? 0) + (pageTotals.get('download:zip') ?? 0);

  const daily = [...byDay.entries()].map(([day, v]) => ({ day, ...v }));

  const topListings = [...byListing.values()]
    .sort((a, b) => b.clicks - a.clicks || b.views - a.views)
    .slice(0, STATS_TOP_LISTINGS)
    .map((l) => ({ ...l, rate: l.views > 0 ? l.clicks / l.views : null }));

  return {
    windowDays: STATS_WINDOW_DAYS,
    since: isoDay(since),
    totals: {
      views: daily.reduce((sum, d) => sum + d.views, 0),
      clicks: daily.reduce((sum, d) => sum + d.clicks, 0),
      downloads,
    },
    daily,
    topListings,
    pages: [...pageTotals.entries()]
      .map(([path, hits]) => ({ path, hits }))
      .sort((a, b) => b.hits - a.hits),
  };
}

