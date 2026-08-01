import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Role } from '@prisma/client';

export type SessionUser = {
  id: string;
  name?: string | null;
  role: Role;
};

/**
 * The authoritative session read. `src/proxy.ts` only checks that *a* session
 * cookie exists — it cannot tell a member from an admin, because the JWT is
 * encrypted and Proxy must not hit the database. So every protected page and
 * every server action calls one of these instead of trusting the redirect.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  return user?.role === 'ADMIN';
}

/** Throws unless an admin is signed in. For use inside server actions. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user || user.role !== 'ADMIN') {
    throw new Error('Forbidden: admin access required.');
  }
  return user;
}

/** Throws unless any signed-in member. For use inside server actions. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) {
    throw new Error('Unauthorized: sign in required.');
  }
  return user;
}

/**
 * Throws unless the caller may publish on this listing: its assigned owner, or
 * an admin.
 *
 * Per listing rather than per role, so being the developer of one client grants
 * nothing anywhere else. The owner is read from the database rather than from
 * anything the client sent, so a forged form field cannot grant it.
 */
export async function requireListingOwner(listingId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === 'ADMIN') return user;

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { ownerId: true },
  });
  if (!listing || listing.ownerId !== user.id) {
    throw new Error('Forbidden: you are not the developer of that listing.');
  }
  return user;
}
