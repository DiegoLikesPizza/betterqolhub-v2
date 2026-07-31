import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
