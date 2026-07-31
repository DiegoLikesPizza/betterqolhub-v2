'use server';

import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { isValidUsername, passwordProblem, usernameAvailableAt } from '@/lib/account';
import { notifyReview } from '@/lib/discord-bot';

export type AccountActionState = {
  ok?: boolean;
  message?: string;
} | undefined;

export async function changePassword(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const user = await requireUser();

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!record) {
    return { ok: false, message: 'Account not found.' };
  }

  // Require the current password: a hijacked session should not be able to
  // lock the real owner out by changing their credentials.
  if (!(await bcrypt.compare(current, record.passwordHash))) {
    return { ok: false, message: 'Your current password is not correct.' };
  }

  const problem = passwordProblem(next, confirm);
  if (problem) {
    return { ok: false, message: problem };
  }
  if (next === current) {
    return { ok: false, message: 'That is already your password.' };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });

  // Note: sessions are stateless JWTs, so any *other* device stays signed in
  // until its token expires. Changing the password cannot revoke them.
  return { ok: true, message: 'Password changed.' };
}

export async function changeUsername(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const user = await requireUser();
  const next = String(formData.get('username') ?? '').trim();

  if (!isValidUsername(next)) {
    return {
      ok: false,
      message: 'Username must be 3-20 characters, letters, numbers or underscores only.',
    };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { username: true, usernameChangedAt: true },
  });
  if (!record) return { ok: false, message: 'Account not found.' };

  if (next === record.username) {
    return { ok: false, message: 'That is already your username.' };
  }

  // Case-only changes are still a change, but must not collide with yourself.
  const blockedUntil = usernameAvailableAt(record.usernameChangedAt);
  if (blockedUntil) {
    return {
      ok: false,
      message: `You can change your username again on ${blockedUntil.toLocaleDateString()}.`,
    };
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { username: next, usernameChangedAt: new Date() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, message: 'That username is taken.' };
    }
    console.error('[account] failed to change username', error);
    return { ok: false, message: 'Could not change your username. Try again.' };
  }

  // The session reads name from the database each request, so the nav updates
  // without signing out. Reviews reference the user by id, so old reviews now
  // show the new name — which is the behaviour people expect.
  revalidatePath('/settings');
  revalidatePath('/listings');
  revalidatePath('/admin', 'layout');

  return { ok: true, message: `Username changed to ${next}.` };
}

export async function deleteAccount(
  _prevState: AccountActionState,
  formData: FormData
): Promise<AccountActionState> {
  const user = await requireUser();

  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '').trim();

  if (confirmation !== user.name) {
    return { ok: false, message: `Type your username exactly (${user.name}) to confirm.` };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, role: true },
  });
  if (!record) {
    return { ok: false, message: 'Account not found.' };
  }
  if (!(await bcrypt.compare(password, record.passwordHash))) {
    return { ok: false, message: 'That password is not correct.' };
  }

  // Same reasoning as refusing self-demotion on the dashboard: the last admin
  // deleting themselves would leave nobody able to administer the site.
  if (record.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (admins <= 1) {
      return {
        ok: false,
        message: 'You are the only admin. Promote someone else before deleting your account.',
      };
    }
  }

  // Reviews cascade in the database, but Discord does not know that — collect
  // the ids first so their messages can be removed from the reviews channel.
  const reviews = await prisma.review.findMany({
    where: { userId: user.id },
    select: { id: true },
  });

  await prisma.user.delete({ where: { id: user.id } });

  for (const review of reviews) {
    await notifyReview('deleted', { id: review.id });
  }

  revalidatePath('/listings');
  revalidatePath('/admin', 'layout');

  // Throws a redirect, so it must be the last thing and must not be caught.
  await signOut({ redirectTo: '/' });
  return { ok: true };
}
