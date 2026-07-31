import { auth } from '@/auth';
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
