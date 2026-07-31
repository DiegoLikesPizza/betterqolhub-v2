'use server';

import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { signOut } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MIN_PASSWORD_LENGTH, USERNAME_PATTERN } from '@/lib/account';

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

  return { ok: true, message: 'Account created. You can sign in now.' };
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}
