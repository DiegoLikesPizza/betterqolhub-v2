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
  body: string;
  createdAt: string;
  unread: boolean;
};

export type NotificationFeed = {
  items: Notification[];
  unread: number;
};

export const EMPTY_FEED: NotificationFeed = { items: [], unread: 0 };

/**
 * Announcements posted to listings this user follows, newest first.
 *
 * Two different cut-offs apply, and they do different jobs:
 *
 *   Follow.createdAt      — you are not notified about what was announced before
 *                           you followed. Old news should not arrive as new.
 *   notificationsReadAt   — what counts as still unread.
 *
 * The first is per listing, so it goes in the query as one OR arm per follow
 * rather than a single global floor. That keeps the result exact instead of
 * fetching extra rows and discarding them afterwards.
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

  const announcements = await prisma.announcement.findMany({
    where: {
      OR: user.follows.map((f) => ({
        listingId: f.listingId,
        createdAt: { gt: f.createdAt },
      })),
    },
    orderBy: { createdAt: 'desc' },
    take: NOTIFICATION_LIMIT,
    select: {
      id: true,
      body: true,
      createdAt: true,
      listing: { select: { id: true, name: true } },
    },
  });

  const readAt = user.notificationsReadAt;

  const items = announcements.map((a) => ({
    id: a.id,
    listingId: a.listing.id,
    listingName: a.listing.name,
    body: a.body,
    createdAt: a.createdAt.toISOString(),
    unread: !readAt || a.createdAt > readAt,
  }));

  return { items, unread: items.filter((i) => i.unread).length };
}
