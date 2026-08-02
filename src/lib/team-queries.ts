// Reading teams and the change requests they raise.

import { prisma } from '@/lib/prisma';
import { diffChange, type ChangeSnapshot, type FieldDiff } from '@/lib/change-requests';
import type { PricingKey } from '@/lib/pricing';

export type TeamMemberRow = {
  userId: string;
  username: string;
  role: string;
  discordUsername: string | null;
  joinedAt: string;
};

export type TeamRow = {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMemberRow[];
  listings: { id: string; name: string }[];
};

export async function getTeams(): Promise<TeamRow[]> {
  const teams = await prisma.team.findMany({
    orderBy: { name: 'asc' },
    include: {
      members: {
        // Leads first, then alphabetical: the person to talk to should be at the
        // top of the list rather than wherever they happened to join.
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        include: { user: { select: { id: true, username: true, discordUsername: true } } },
      },
      listings: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
    },
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    createdAt: team.createdAt.toISOString(),
    members: team.members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      role: m.role,
      discordUsername: m.user.discordUsername,
      joinedAt: m.createdAt.toISOString(),
    })),
    listings: team.listings,
  }));
}

/** Teams a user belongs to, with the listings each one speaks for. */
export async function getTeamsForUser(userId: string): Promise<TeamRow[]> {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  if (memberships.length === 0) return [];

  const ids = new Set(memberships.map((m) => m.teamId));
  return (await getTeams()).filter((t) => ids.has(t.id));
}

export type ChangeRequestRow = {
  id: string;
  listingId: string;
  listingName: string;
  authorUsername: string;
  note: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  decisionNote: string | null;
  /** Compared against the listing as it stands now — see diffChange. */
  diffs: FieldDiff[];
};

const SNAPSHOT_FIELDS = {
  name: true,
  developer: true,
  description: true,
  url: true,
  secondaryUrl: true,
  pricing: true,
  price: true,
} as const;

function toSnapshot(row: {
  name: string;
  developer: string | null;
  description: string;
  url: string;
  secondaryUrl: string | null;
  pricing: PricingKey | null;
  price: string | null;
}): ChangeSnapshot {
  return {
    name: row.name,
    developer: row.developer,
    description: row.description,
    url: row.url,
    secondaryUrl: row.secondaryUrl,
    pricing: row.pricing,
    price: row.price,
  };
}

type ChangeRequestFilter = {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  listingId?: string;
  /** Every listing a team speaks for, so its own page can show all its proposals. */
  listingIds?: string[];
};

export async function getChangeRequests(
  filter: ChangeRequestFilter = {}
): Promise<ChangeRequestRow[]> {
  const rows = await prisma.listingChangeRequest.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.listingId ? { listingId: filter.listingId } : {}),
      ...(filter.listingIds ? { listingId: { in: filter.listingIds } } : {}),
    },
    // Oldest pending first: a queue that shows the newest first quietly starves
    // whatever has been waiting longest.
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: {
      author: { select: { username: true } },
      reviewedBy: { select: { username: true } },
      listing: { select: { id: true, ...SNAPSHOT_FIELDS } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    listingId: r.listing.id,
    listingName: r.listing.name,
    authorUsername: r.author.username,
    note: r.note,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewedBy: r.reviewedBy?.username ?? null,
    decisionNote: r.decisionNote,
    diffs: diffChange(toSnapshot(r.listing), toSnapshot(r)),
  }));
}

export async function countPendingChangeRequests(): Promise<number> {
  return prisma.listingChangeRequest.count({ where: { status: 'PENDING' } });
}
