import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  accountKey,
  checkRateLimit,
  clearRateLimit,
  clientIp,
  ipKey,
  recordAttempt,
} from '@/lib/rate-limit';

export const { handlers, auth, signIn, signOut } = NextAuth({
  /**
   * Behind nginx, the request Next receives is addressed to 127.0.0.1:3003.
   * Without this, Auth.js builds every callback URL from that address, and
   * `https://localhost:3003` ends up in the callback-url cookie and in the
   * public /api/auth/providers response.
   *
   * The proxy sets Host and X-Forwarded-Proto from the real request, so trusting
   * them is what makes the public origin recoverable. Production additionally
   * pins `AUTH_URL`, which takes precedence — this is the floor, so a deployment
   * that forgets that variable degrades to the right host rather than to
   * localhost.
   */
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const username = credentials?.username;
        const password = credentials?.password;
        if (typeof username !== 'string' || typeof password !== 'string') {
          return null;
        }

        // Two buckets. The per-account one stops a single account being ground
        // through a word list; the per-IP one stops the same script spreading
        // itself thinly across many accounts, which the first would never see.
        const ip = await clientIp();
        const buckets = [accountKey(username), ipKey(ip)];

        for (const bucket of buckets) {
          const verdict = await checkRateLimit('login', bucket);
          // Checked before the lookup and the bcrypt compare: a blocked caller
          // must not be able to spend our CPU, and must not learn from timing
          // whether the username exists.
          if (!verdict.allowed) return null;
        }

        const user = await prisma.user.findUnique({ where: { username } });

        // A missing user still counts. Otherwise enumeration is free: guesses at
        // usernames that do not exist would never be limited, and the difference
        // between "limited" and "not limited" is itself the answer.
        if (!user) {
          for (const bucket of buckets) await recordAttempt('login', bucket);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          for (const bucket of buckets) await recordAttempt('login', bucket);
          return null;
        }

        for (const bucket of buckets) await clearRateLimit('login', bucket);
        return { id: user.id, name: user.username, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on the sign-in pass; its `id` is optional in
      // NextAuth's type, though our authorize() always sets it.
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    /**
     * Role is re-read from the database on every session read rather than
     * trusted from the token.
     *
     * The token is stamped at sign-in and lives for 30 days, so a cached role
     * means a promotion does not appear until the user signs out and back in —
     * and, worse, *revoking* an admin would not take effect for up to a month.
     * One indexed lookup per request is a cheap price for role changes applying
     * immediately. It also means a deleted user's surviving token stops
     * resolving to a session.
     */
    async session({ session, token }) {
      if (!session.user) return session;

      const fresh = await prisma.user.findUnique({
        where: { id: token.id },
        select: { id: true, username: true, role: true },
      });

      if (!fresh) {
        // Account deleted while a token was still valid — drop the identity so
        // currentUser() treats it as signed out.
        return { ...session, user: undefined } as unknown as typeof session;
      }

      session.user.id = fresh.id;
      session.user.name = fresh.username;
      session.user.role = fresh.role;
      return session;
    },
  },
});
