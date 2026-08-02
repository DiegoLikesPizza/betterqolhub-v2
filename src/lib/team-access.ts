// Who may act on a listing, and in what capacity.
//
// Every one of these reads the answer from the database rather than from
// anything the client sent. Server actions are POST endpoints: a form field
// claiming membership proves nothing, and membership can change while someone
// already has a page open.

import { prisma } from '@/lib/prisma';
import { requireUser, type SessionUser } from '@/lib/authz';

export type ListingAccess = {
  /** A member of the listing's team, whatever their role. */
  isMember: boolean;
  /** Lead of the listing's team. Admins count as leads everywhere. */
  isLead: boolean;
  isAdmin: boolean;
  teamId: string | null;
};

export const NO_ACCESS: ListingAccess = {
  isMember: false,
  isLead: false,
  isAdmin: false,
  teamId: null,
};

/**
 * What this user may do on this listing.
 *
 * Admins are treated as leads rather than as a separate case, so callers ask one
 * question ("may they manage this?") instead of remembering to allow admins
 * everywhere by hand — which is exactly the check that gets forgotten.
 */
export async function listingAccessFor(
  user: SessionUser | null,
  listingId: string
): Promise<ListingAccess> {
  if (!user) return NO_ACCESS;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { teamId: true },
  });
  if (!listing) return { ...NO_ACCESS, isAdmin: user.role === 'ADMIN' };

  const isAdmin = user.role === 'ADMIN';
  if (!listing.teamId) {
    return { isMember: false, isLead: isAdmin, isAdmin, teamId: null };
  }

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: listing.teamId, userId: user.id } },
    select: { role: true },
  });

  return {
    isMember: Boolean(membership) || isAdmin,
    isLead: membership?.role === 'LEAD' || isAdmin,
    isAdmin,
    teamId: listing.teamId,
  };
}

/**
 * Throws unless the caller may publish on this listing: a member of its team, or
 * an admin.
 *
 * Per team rather than per role, so developing one client grants nothing
 * anywhere else.
 */
export async function requireListingTeam(listingId: string): Promise<SessionUser> {
  const user = await requireUser();
  const access = await listingAccessFor(user, listingId);
  if (!access.isMember) {
    throw new Error('Forbidden: you are not on that listing’s team.');
  }
  return user;
}

/** Whether this user develops the listing — used to refuse self-reviews. */
export async function isOnListingTeam(
  user: SessionUser | null,
  listingId: string
): Promise<boolean> {
  if (!user) return false;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { teamId: true },
  });
  if (!listing?.teamId) return false;

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId: listing.teamId, userId: user.id } },
    select: { userId: true },
  });
  // Deliberately *not* short-circuited for admins: an admin who does not develop
  // the listing is an ordinary reviewer, and should be able to review it.
  return Boolean(membership);
}

export type TeamAccess = { isMember: boolean; isLead: boolean; isAdmin: boolean };

/** What this user may do inside a team, independent of any listing. */
export async function teamAccessFor(
  user: SessionUser | null,
  teamId: string
): Promise<TeamAccess> {
  if (!user) return { isMember: false, isLead: false, isAdmin: false };
  const isAdmin = user.role === 'ADMIN';

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: user.id } },
    select: { role: true },
  });

  return {
    isMember: Boolean(membership) || isAdmin,
    isLead: membership?.role === 'LEAD' || isAdmin,
    isAdmin,
  };
}

/** Throws unless the caller may change a team's membership: its lead, or an admin. */
export async function requireTeamLead(teamId: string): Promise<SessionUser> {
  const user = await requireUser();
  const access = await teamAccessFor(user, teamId);
  if (!access.isLead) {
    throw new Error('Forbidden: only a team lead or an admin can do that.');
  }
  return user;
}
