'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/authz';
import { requestDiscordDm } from '@/lib/discord-bot';
import {
  accountKey,
  checkRateLimit,
  clearRateLimit,
  clientIp,
  ipKey,
  recordAttempt,
  retryAfterMessage,
} from '@/lib/rate-limit';

// Excludes characters that are easy to misread when retyping from a DM.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export type LinkState =
  | { step: 'idle' }
  | { step: 'awaiting-code'; discordUsername: string; message: string }
  | { step: 'error'; message: string }
  | { step: 'linked'; message: string }
  | undefined;

export async function startDiscordLink(
  _prevState: LinkState,
  formData: FormData
): Promise<LinkState> {
  const user = await requireUser();
  const discordUsername = String(formData.get('discordUsername') ?? '').trim().replace(/^@/, '');

  if (!discordUsername) {
    return { step: 'error', message: 'Enter your Discord username.' };
  }
  // Discord's current handle rules: 2-32 chars, lowercase letters, digits,
  // underscore and period.
  if (!/^[a-zA-Z0-9._]{2,32}$/.test(discordUsername)) {
    return { step: 'error', message: 'That does not look like a Discord username.' };
  }

  // Each of these sends a DM to a Discord account that need not be the caller's.
  // Unlimited, that is a way to make our bot message strangers on request, which
  // is a good way to lose the bot. Keyed to the account rather than only the IP,
  // because signing in is what makes it possible at all.
  const ip = await clientIp();
  const buckets = [accountKey(user.id), ipKey(ip)];

  for (const bucket of buckets) {
    const verdict = await checkRateLimit('discordRequest', bucket);
    if (!verdict.allowed) {
      return {
        step: 'error',
        message: `Too many link requests. ${retryAfterMessage(verdict.retryAfterSeconds)}`,
      };
    }
  }
  for (const bucket of buckets) await recordAttempt('discordRequest', bucket);

  const code = generateCode();

  // Ask the bot to DM first. Only persist the pending link if the DM actually
  // went out, so a failed lookup does not leave a dangling code.
  const result = await requestDiscordDm(discordUsername, code, user.name ?? 'a member');
  if (!result.ok) {
    return { step: 'error', message: result.message };
  }

  // The bot resolved the username to a specific account; bind the code to that
  // snowflake so it cannot be redeemed for anyone else.
  const taken = await prisma.user.findUnique({
    where: { discordId: result.discordId },
    select: { id: true },
  });
  if (taken && taken.id !== user.id) {
    return { step: 'error', message: 'That Discord account is already linked to another member.' };
  }

  await prisma.discordLink.upsert({
    where: { userId: user.id },
    update: {
      discordId: result.discordId,
      discordUsername: result.discordTag,
      code,
      attempts: 0,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    },
    create: {
      userId: user.id,
      discordId: result.discordId,
      discordUsername: result.discordTag,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    },
  });

  return {
    step: 'awaiting-code',
    discordUsername: result.discordTag,
    message: `Code sent to ${result.discordTag} on Discord. It expires in ${CODE_TTL_MINUTES} minutes.`,
  };
}

export async function confirmDiscordLink(
  _prevState: LinkState,
  formData: FormData
): Promise<LinkState> {
  const user = await requireUser();
  const entered = String(formData.get('code') ?? '').trim().toUpperCase();

  // Above the per-link attempt counter for the same reason as the reset codes:
  // on its own, that counter is escaped by requesting a new code.
  const ip = await clientIp();
  const buckets = [accountKey(user.id), ipKey(ip)];

  for (const bucket of buckets) {
    const verdict = await checkRateLimit('discordVerify', bucket);
    if (!verdict.allowed) {
      return {
        step: 'error',
        message: `Too many attempts. ${retryAfterMessage(verdict.retryAfterSeconds)}`,
      };
    }
  }

  const pending = await prisma.discordLink.findUnique({ where: { userId: user.id } });
  if (!pending) {
    return { step: 'error', message: 'No pending link. Start again.' };
  }
  if (pending.expiresAt < new Date()) {
    await prisma.discordLink.delete({ where: { userId: user.id } });
    return { step: 'error', message: 'That code expired. Request a new one.' };
  }
  if (pending.attempts >= MAX_ATTEMPTS) {
    await prisma.discordLink.delete({ where: { userId: user.id } });
    return { step: 'error', message: 'Too many wrong attempts. Request a new code.' };
  }

  if (entered !== pending.code) {
    await prisma.discordLink.update({
      where: { userId: user.id },
      data: { attempts: { increment: 1 } },
    });
    for (const bucket of buckets) await recordAttempt('discordVerify', bucket);
    const left = MAX_ATTEMPTS - (pending.attempts + 1);
    return {
      step: 'awaiting-code',
      discordUsername: pending.discordUsername,
      message: `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.`,
    };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          discordId: pending.discordId,
          discordUsername: pending.discordUsername,
          discordLinkedAt: new Date(),
        },
      }),
      prisma.discordLink.delete({ where: { userId: user.id } }),
    ]);
  } catch (error) {
    // Someone else linked this snowflake between the request and the confirm.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { step: 'error', message: 'That Discord account was just linked by someone else.' };
    }
    return { step: 'error', message: 'Could not finish linking. Try again.' };
  }

  for (const bucket of buckets) await clearRateLimit('discordVerify', bucket);

  revalidatePath('/settings');
  return { step: 'linked', message: `Linked to ${pending.discordUsername}.` };
}

export async function unlinkDiscord(): Promise<void> {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { discordId: null, discordUsername: null, discordLinkedAt: null },
  });
  await prisma.discordLink.deleteMany({ where: { userId: user.id } });

  revalidatePath('/settings');
}
