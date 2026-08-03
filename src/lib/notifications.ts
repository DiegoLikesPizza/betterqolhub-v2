// Notifications for followed listings.
//
// There is no Notification table. A notification here is not a thing that gets
// created — it is the answer to "which announcements from listings I follow have
// appeared since I last looked", which the database can already answer from
// Follow and Announcement.
//
// Writing one row per follower per announcement would mean rows that drift from
// that answer: orphans when an announcement is deleted, stale entries for
// listings someone has since unfollowed, and a fan-out write on every post. The
// derived form cannot go out of date because there is nothing to keep in sync.

import { prisma } from '@/lib/prisma';

/** How many the panel shows. Older ones are on the listings themselves. */
export const NOTIFICATION_LIMIT = 15;

/** Badge cap, so a long absence renders as "9+" rather than a three-digit pill. */
export const NOTIFICATION_BADGE_MAX = 9;

export type Notification = {
  id: string;
  listingId: string;
  listingName: string;
  /** Distinguishes a release from a piece of news, so the panel can label it. */
  kind: 'announcement' | 'release';
  body: string;
  createdAt: string;
  unread: boolean;
};

/**
 * A one-line summary of a release, for the panel.
 *
 * Release notes are Markdown, so the raw body would arrive in the panel as
 * "### Added" or "- Fixes the…". Rather than rendering the Markdown — the panel
 * is a column of one-liners, and a heading or a bullet drawn inside it would
 * fight the layout — this strips the markers down to the text.
 *
 * Headings are skipped rather than used. A changelog that opens with "### Added"
 * would otherwise summarise as "Added", which tells a reader nothing they could
 * not guess; the line under it is the actual change. Falls back to the first
 * line when a body is nothing but headings.
 */
function summariseRelease(version: string, body: string): string {
  const lines = body.split('\n').map((line) => line.trim()).filter(Boolean);

  const plain = (line: string) =>
    line
      // Leading bullet, number or heading marker.
      .replace(/^(?:[-*+]|\d+[.)]|#{1,6})\s*/, '')
      // Inline emphasis and code, which read as noise once unrendered.
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/[*_`]/g, '')
      // Links down to their label.
      .replace(/\[([^\]]+)\]\([^)\s]*\)/g, '$1')
      .trim();

  const first = lines.find((line) => !/^#{1,6}\s/.test(line)) ?? lines[0];
  const summary = first ? plain(first) : '';

  return summary ? `${version} — ${summary}` : version;
}

export type NotificationFeed = {
  items: Notification[];
  unread: number;
};

export const EMPTY_FEED: NotificationFeed = { items: [], unread: 0 };

/**
 * Announcements and releases from listings this user follows, newest first.
 *
 * Two different cut-offs apply, and they do different jobs:
 *
 *   Follow.createdAt      — you are not notified about what was posted before
 *                           you followed. Old news should not arrive as new.
 *   notificationsReadAt   — what counts as still unread.
 *
 * The first is per listing, so it goes in the query as one OR arm per follow
 * rather than a single global floor. That keeps the result exact instead of
 * fetching extra rows and discarding them afterwards.
 *
 * Releases are cut off and sorted by `createdAt`, never `releasedAt`. The two
 * differ whenever a team backfills its history: an entry dated last March was
 * published here today, and ordering by the release date would either bury it
 * below things nobody has read yet or — for a follow made since — hide it
 * entirely. What the feed answers is "what has appeared since I looked".
 */
export async function getNotifications(userId: string): Promise<NotificationFeed> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notificationsReadAt: true,
      follows: { select: { listingId: true, createdAt: true } },
    },
  });

  if (!user || user.follows.length === 0) return EMPTY_FEED;

  const since = user.follows.map((f) => ({
    listingId: f.listingId,
    createdAt: { gt: f.createdAt },
  }));

  // Each source is capped at the panel's own limit before they are merged: the
  // newest NOTIFICATION_LIMIT overall cannot contain more than that many of
  // either, so nothing that would have made the cut is left behind.
  const [announcements, releases] = await Promise.all([
    prisma.announcement.findMany({
      where: { OR: since },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATION_LIMIT,
      select: {
        id: true,
        body: true,
        createdAt: true,
        listing: { select: { id: true, name: true } },
      },
    }),
    prisma.changelogEntry.findMany({
      where: { OR: since },
      orderBy: { createdAt: 'desc' },
      take: NOTIFICATION_LIMIT,
      select: {
        id: true,
        version: true,
        body: true,
        createdAt: true,
        listing: { select: { id: true, name: true } },
      },
    }),
  ]);

  const readAt = user.notificationsReadAt;

  const items: Notification[] = [
    ...announcements.map((a) => ({
      id: a.id,
      listingId: a.listing.id,
      listingName: a.listing.name,
      kind: 'announcement' as const,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
      unread: !readAt || a.createdAt > readAt,
    })),
    ...releases.map((r) => ({
      id: r.id,
      listingId: r.listing.id,
      listingName: r.listing.name,
      kind: 'release' as const,
      body: summariseRelease(r.version, r.body),
      createdAt: r.createdAt.toISOString(),
      unread: !readAt || r.createdAt > readAt,
    })),
  ]
    // ISO-8601 in UTC sorts correctly as a string, and both sides are produced
    // by toISOString above.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, NOTIFICATION_LIMIT);

  return { items, unread: items.filter((i) => i.unread).length };
}
