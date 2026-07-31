// Counting views, clicks and downloads.
//
// Design rules, in order of importance:
//
// 1. Never break a page. A counter is not worth a 500, so every recorder
//    swallows its errors and logs — the same rule discord-bot.ts follows.
// 2. Never store anything personal. No IP, no session, no user id, no cookie.
//    Only "how many times did this happen today". That keeps the feature out of
//    consent-banner territory entirely, and there is nothing here that would
//    ever have to be handed over or deleted on request.
// 3. Count humans, not crawlers. Discord fetches every listing page it sees a
//    link to, in order to build the embed. Without filtering, posting a link in
//    chat would inflate that listing's views and the numbers would mean nothing.

import { prisma } from '@/lib/prisma';

/**
 * Substrings that mark a request as automated. Matched case-insensitively
 * against the User-Agent.
 *
 * `bot` and `spider` are broad on purpose: a false positive costs one uncounted
 * view, a false negative silently poisons the numbers, and there is no real
 * browser whose UA contains either. `discordbot` is listed separately only for
 * documentation — it is the one that would do the most damage here.
 */
const BOT_MARKERS = [
  'bot', // discordbot, twitterbot, telegrambot, googlebot, bingbot, ...
  'crawler',
  'spider',
  'slurp',
  'facebookexternalhit',
  'whatsapp',
  'preview',
  'headless',
  'curl',
  'wget',
  'python-requests',
  'go-http-client',
  'axios',
  'okhttp',
  'monitoring',
  'uptime',
];

/**
 * A missing User-Agent counts as a bot: every real browser sends one, and
 * scripted requests frequently do not.
 */
export function isAutomatedRequest(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  return BOT_MARKERS.some((marker) => ua.includes(marker));
}

/** Midnight UTC today — the bucket a hit belongs to. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Prisma's code for a unique-constraint violation. */
const UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}

/**
 * Increments one counter on today's row, creating the row if it is the first
 * hit of the day.
 *
 * The retry matters: two requests arriving in the same moment can both find no
 * row and both try to create one, and the loser gets a unique violation. Losing
 * a count to that would be invisible and would happen most often on exactly the
 * listings that are busiest. On conflict we simply do the update the winner's
 * row now allows.
 */
async function bumpListing(listingId: string, field: 'views' | 'clicks'): Promise<void> {
  const day = today();

  try {
    await prisma.listingStat.upsert({
      where: { listingId_day: { listingId, day } },
      create: { listingId, day, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      try {
        await prisma.listingStat.update({
          where: { listingId_day: { listingId, day } },
          data: { [field]: { increment: 1 } },
        });
        return;
      } catch (retryError) {
        console.error(`[stats] retry failed for listing ${field}`, retryError);
        return;
      }
    }
    console.error(`[stats] could not record listing ${field}`, error);
  }
}

export async function recordListingView(listingId: string): Promise<void> {
  await bumpListing(listingId, 'views');
}

export async function recordListingClick(listingId: string): Promise<void> {
  await bumpListing(listingId, 'clicks');
}

/**
 * Records a view unless the request looks automated. Wraps the User-Agent check
 * so callers cannot forget it — this is the one that Discord's link unfurler
 * would otherwise inflate on every posted link.
 */
export async function recordListingViewFor(
  listingId: string,
  userAgent: string | null | undefined
): Promise<void> {
  if (isAutomatedRequest(userAgent)) return;
  await recordListingView(listingId);
}

/**
 * Slugs for the things PageStat counts. A closed set rather than raw request
 * paths: unknown paths would let anyone create rows by requesting nonsense, and
 * query strings would split one page's count across many rows.
 */
export const PAGE_KEYS = {
  home: 'home',
  listings: 'listings',
  modpacks: 'modpacks',
  downloadMrpack: 'download:mrpack',
  downloadZip: 'download:zip',
} as const;

export type PageKey = (typeof PAGE_KEYS)[keyof typeof PAGE_KEYS];

export async function recordPageHit(path: PageKey): Promise<void> {
  const day = today();

  try {
    await prisma.pageStat.upsert({
      where: { path_day: { path, day } },
      create: { path, day, hits: 1 },
      update: { hits: { increment: 1 } },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      try {
        await prisma.pageStat.update({
          where: { path_day: { path, day } },
          data: { hits: { increment: 1 } },
        });
        return;
      } catch (retryError) {
        console.error('[stats] retry failed for page hit', retryError);
        return;
      }
    }
    console.error('[stats] could not record page hit', error);
  }
}

/**
 * Records a page hit unless the request looks automated. Wraps the User-Agent
 * check so callers cannot forget it.
 */
export async function recordPageHitFor(
  path: PageKey,
  userAgent: string | null | undefined
): Promise<void> {
  if (isAutomatedRequest(userAgent)) return;
  await recordPageHit(path);
}
