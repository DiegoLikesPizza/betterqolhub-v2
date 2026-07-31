import type { Role } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

// Teach NextAuth's types about the `id` and `role` we attach in the jwt/session
// callbacks, so `session.user.role` is checked rather than `any`.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
  }
}

// `next-auth/jwt` is only `export * from "@auth/core/jwt"`, so the JWT interface
// has to be augmented where it is actually declared — augmenting the re-export
// silently creates a second, unrelated interface.
declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
