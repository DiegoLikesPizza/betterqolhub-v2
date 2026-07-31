'use server';

import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { passwordProblem } from '@/lib/account';
import { requestPasswordResetDm } from '@/lib/discord-bot';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export type ForgotState =
  | { step: 'request'; message?: string }
  | { step: 'code'; username: string; message?: string }
  | { step: 'done'; message: string }
  | undefined;

// Deliberately identical whatever happened: whether a username exists, and
// whether it has Discord linked, are both facts worth not leaking. An attacker
// who can enumerate accounts learns who to target.
const NEUTRAL_RESPONSE =
  'If that account exists and has a linked Discord account, a reset code has been sent by DM.';

export async function requestReset(
  _prevState: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const username = String(formData.get('username') ?? '').trim();
  if (!username) {
    return { step: 'request', message: 'Enter your username.' };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, discordId: true },
  });

  // Only actually send when there is somewhere to send it, but always advance
  // to the code step so the two cases are indistinguishable.
  if (user?.discordId) {
    const code = generateCode();
    await prisma.passwordReset.upsert({
      where: { userId: user.id },
      update: {
        code,
        attempts: 0,
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
      },
      create: {
        userId: user.id,
        code,
        expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
      },
    });

    await requestPasswordResetDm(user.discordId, code, user.username);
  }

  return { step: 'code', username, message: NEUTRAL_RESPONSE };
}

export async function completeReset(
  _prevState: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const username = String(formData.get('username') ?? '').trim();
  const entered = String(formData.get('code') ?? '').trim().toUpperCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  const problem = passwordProblem(password, confirm);
  if (problem) {
    return { step: 'code', username, message: problem };
  }

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, passwordReset: true },
  });

  const pending = user?.passwordReset;
  // Same message for "no such user", "no pending reset" and "wrong code" — all
  // three would otherwise confirm whether an account exists.
  const invalid = { step: 'code' as const, username, message: 'That code is not valid.' };

  if (!user || !pending) return invalid;

  if (pending.expiresAt < new Date()) {
    await prisma.passwordReset.delete({ where: { userId: user.id } });
    return { step: 'code', username, message: 'That code expired. Request a new one.' };
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    await prisma.passwordReset.delete({ where: { userId: user.id } });
    return { step: 'code', username, message: 'Too many attempts. Request a new code.' };
  }
  if (entered !== pending.code) {
    await prisma.passwordReset.update({
      where: { userId: user.id },
      data: { attempts: { increment: 1 } },
    });
    return invalid;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    }),
    // Single use: consumed whether or not the sign-in that follows succeeds.
    prisma.passwordReset.delete({ where: { userId: user.id } }),
  ]);

  return { step: 'done', message: 'Password changed. You can sign in now.' };
}
