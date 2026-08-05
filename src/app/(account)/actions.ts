'use server';

import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN } from '@/lib/account';
import {
  checkRateLimit,
  clientIp,
  ipKey,
  recordAttempt,
  retryAfterMessage,
  sweepRateLimits,
} from '@/lib/rate-limit';

export type AuthFormState = {
  ok?: boolean;
  message?: string;
} | undefined;

export async function register(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  // Per IP only: there is no account yet to attach a bucket to, and the thing
  // worth slowing is one source creating accounts in bulk.
  const bucket = ipKey(await clientIp());
  const limit = await checkRateLimit('register', bucket);
  if (!limit.allowed) {
    return { ok: false, message: `Too many signups from here. ${retryAfterMessage(limit.retryAfterSeconds)}` };
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      message: 'Username must be 3-20 characters, letters, numbers or underscores only.',
    };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password !== confirm) {
    return { ok: false, message: 'Passwords do not match.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    // Role is deliberately not read from the form — everyone who signs up is a
    // USER, and admins are promoted from the admin dashboard or the seed.
    await prisma.user.create({
      data: { username, passwordHash },
    });
  } catch (error) {
    // P2002 = unique constraint violation. Racing signups land here rather than
    // in a pre-check, which would have a TOCTOU gap.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, message: 'That username is taken.' };
    }
    return { ok: false, message: 'Could not create the account. Try again.' };
  }

  // Counted on success, not on failure: the thing being limited here is accounts
  // created, and a bulk signup script's requests all succeed.
  await recordAttempt('register', bucket);

  // Somewhere has to tidy the table, and signups are rare enough to be a good
  // place to do it without a scheduler.
  await sweepRateLimits();

  return { ok: true, message: 'Account created. You can sign in now.' };
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}

/**
 * Marks the notification centre as read up to now.
 *
 * Read state is a single timestamp rather than a flag per notification, because
 * notifications are derived rather than stored — see src/lib/notifications.ts.
 * Opening the panel is the only thing that moves it.
 */
export async function markNotificationsRead() {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { notificationsReadAt: new Date() },
  });

  // The badge lives in the root layout, so the whole tree needs re-rendering
  // for it to clear.
  revalidatePath('/', 'layout');
}
