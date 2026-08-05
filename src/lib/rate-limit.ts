// Slowing down the endpoints where guessing pays.
//
// Every path here answers a question an attacker would like to ask repeatedly:
// is this password right, does this account exist, is this reset code the one.
// None of them can be made un-guessable — a six-digit code is a million tries —
// so the defence is arithmetic: make the tries cost time.
//
// Two deliberate choices:
//
//   1. Cooldowns lengthen, and nothing locks permanently. A permanent lockout is
//      itself an attack: anyone who knows a username could keep its owner out
//      forever. A doubling cooldown makes a script useless within a few tries
//      while costing a real person who fat-fingered a password about a minute.
//   2. Failures count, successes clear. Someone who signs in correctly on the
//      third try starts fresh, so ordinary forgetfulness never accumulates into
//      a block over a day of use.

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

/** How a limited path behaves. Times in seconds. */
export type RateLimitRule = {
  /** Failures allowed inside the window before a cooldown starts. */
  limit: number;
  /** How long failures are remembered. */
  windowSeconds: number;
  /** The first cooldown, doubling with each further failure. */
  baseBlockSeconds: number;
  /** The longest a cooldown may grow to. */
  maxBlockSeconds: number;
};

/**
 * The limited paths.
 *
 * Password entry is tightest: it is the one place where a correct guess is worth
 * the most and where bcrypt makes each attempt expensive for us as well as for
 * the attacker. Code verification is close behind. Requests that send something
 * — a reset email, a Discord DM — are limited more for the recipient's sake than
 * ours: the cost of getting it wrong is somebody else's inbox.
 */
export const LIMITS = {
  // Capped at 15 minutes rather than an hour: this scope includes a bucket keyed
  // to the account alone, so the cap is also the longest someone can keep a user
  // they can name out of their own account.
  login: { limit: 5, windowSeconds: 900, baseBlockSeconds: 30, maxBlockSeconds: 900 },
  register: { limit: 5, windowSeconds: 3600, baseBlockSeconds: 60, maxBlockSeconds: 3600 },
  resetRequest: { limit: 3, windowSeconds: 3600, baseBlockSeconds: 300, maxBlockSeconds: 3600 },
  resetVerify: { limit: 5, windowSeconds: 900, baseBlockSeconds: 60, maxBlockSeconds: 3600 },
  discordRequest: { limit: 5, windowSeconds: 3600, baseBlockSeconds: 120, maxBlockSeconds: 3600 },
  discordVerify: { limit: 5, windowSeconds: 900, baseBlockSeconds: 60, maxBlockSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitScope = keyof typeof LIMITS;

export type RateLimitVerdict =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * The caller's IP, as far as it can be trusted — which is not very far.
 *
 * This site is behind Cloudflare, so the connection nginx accepts comes from a
 * Cloudflare edge node, and `X-Real-IP` — which nginx sets from that peer — is
 * the edge, not the visitor. Cloudflare rotates edges freely: eight requests
 * from one machine arrived from seven different addresses, which fragmented the
 * buckets into uselessness before this was fixed. `CF-Connecting-IP` is the
 * visitor, and is the only header here that identifies one.
 *
 * It is still not proof of anything. Anyone who learns the origin's address can
 * reach nginx directly, set `CF-Connecting-IP` to whatever they please, and get
 * a fresh bucket per request. That is why the IP buckets are the *secondary*
 * defence: the account buckets carry no IP at all (see accountKey) and cannot be
 * escaped this way. Locking the origin down to Cloudflare's ranges would make
 * this header trustworthy, and is worth doing — but it is nginx-level work, not
 * something this module can assert.
 *
 * Returns null when nothing identifies the caller, which locally means a direct
 * connection. Callers treat that as one shared bucket rather than as no limit.
 */
export async function clientIp(): Promise<string | null> {
  const head = await headers();

  const cloudflare = head.get('cf-connecting-ip')?.trim();
  if (cloudflare) return cloudflare;

  const real = head.get('x-real-ip')?.trim();
  if (real) return real;

  // Last rather than first: nginx appends the peer to whatever arrived, so the
  // leading entries are written by the client and only the final one is ours.
  const forwarded = head.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }

  return null;
}

/**
 * Hashes a bucket subject.
 *
 * A rate-limit table keyed by plain usernames and IPs is a record of who tried
 * to sign in and from where — something the app has no reason to keep and every
 * reason not to leak. The limiter only ever compares keys for equality, so a
 * digest does the job exactly as well.
 */
function bucketKey(parts: (string | null)[]): string {
  // JSON rather than a joined string: it delimits unambiguously, so no value
  // containing the separator can be made to collide with a different subject,
  // and unlike a NUL delimiter it stays visible in the source.
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/**
 * A bucket for where the request came from. Best-effort — see clientIp.
 *
 * Its job is breadth: one source trying many accounts, which a per-account limit
 * would never notice because no single account sees enough attempts.
 */
export function ipKey(ip: string | null): string {
  return bucketKey(['ip', ip]);
}

/**
 * A bucket for the account being attempted, carrying no IP.
 *
 * This is the limit that actually holds. Keyed with the source address it would
 * be trivially escaped — rotate the IP, get a fresh allowance, and a distributed
 * attempt on one account would never trip anything. Without the address, a
 * hundred sources guessing at one account share one budget.
 *
 * The cost is that someone who knows a username can push that account into a
 * cooldown on purpose. That is why login cooldowns are capped in minutes rather
 * than hours and why a success clears them: an annoyance, deliberately, rather
 * than the lockout the review warned against.
 */
export function accountKey(identifier: string): string {
  return bucketKey(['account', identifier.toLowerCase()]);
}

function cooldownFor(rule: RateLimitRule, attempts: number): number {
  const over = Math.max(0, attempts - rule.limit);
  const grown = rule.baseBlockSeconds * 2 ** Math.max(0, over - 1);
  return Math.min(grown, rule.maxBlockSeconds);
}

/**
 * Whether this subject may attempt the action, without counting a failure.
 *
 * Called before doing the expensive part — the bcrypt compare, the email, the
 * DM — so a blocked caller costs a single indexed read.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  key: string
): Promise<RateLimitVerdict> {
  const bucket = await prisma.rateLimit.findUnique({ where: { scope_key: { scope, key } } });
  if (!bucket?.blockedUntil) return { allowed: true };

  const remaining = bucket.blockedUntil.getTime() - Date.now();
  if (remaining <= 0) return { allowed: true };

  return { allowed: false, retryAfterSeconds: Math.ceil(remaining / 1000) };
}

/**
 * Counts a failed attempt and returns whether the subject is now blocked.
 *
 * A window that has fully elapsed starts over rather than being extended, so
 * yesterday's typos do not add to today's.
 */
export async function recordAttempt(
  scope: RateLimitScope,
  key: string
): Promise<RateLimitVerdict> {
  const rule = LIMITS[scope];
  const now = new Date();
  const windowFloor = new Date(now.getTime() - rule.windowSeconds * 1000);

  const existing = await prisma.rateLimit.findUnique({ where: { scope_key: { scope, key } } });
  const stale = !existing || existing.windowStart < windowFloor;

  const attempts = stale ? 1 : existing.attempts + 1;
  const blockedUntil =
    attempts > rule.limit
      ? new Date(now.getTime() + cooldownFor(rule, attempts) * 1000)
      : null;

  await prisma.rateLimit.upsert({
    where: { scope_key: { scope, key } },
    create: { scope, key, attempts, windowStart: now, blockedUntil },
    update: {
      attempts,
      // Only moved when the old window had already lapsed — otherwise every
      // failure would push the window forward and it would never expire.
      ...(stale ? { windowStart: now } : {}),
      blockedUntil,
    },
  });

  if (!blockedUntil) return { allowed: true };
  return { allowed: false, retryAfterSeconds: cooldownFor(rule, attempts) };
}

/** Forgets a subject's failures. Called on success. */
export async function clearRateLimit(scope: RateLimitScope, key: string): Promise<void> {
  await prisma.rateLimit
    .delete({ where: { scope_key: { scope, key } } })
    .catch(() => {
      // Nothing to forget. Never a reason to fail the sign-in that just worked.
    });
}

/**
 * Drops buckets nothing will read again.
 *
 * Not scheduled: called opportunistically, so the table cannot grow without
 * bound on a site with no cron. A bucket is disposable once its window has
 * lapsed and any cooldown it carried has expired.
 */
export async function sweepRateLimits(): Promise<void> {
  const longestWindow = Math.max(...Object.values(LIMITS).map((r) => r.windowSeconds));
  const cutoff = new Date(Date.now() - longestWindow * 1000);

  await prisma.rateLimit
    .deleteMany({
      where: {
        windowStart: { lt: cutoff },
        OR: [{ blockedUntil: null }, { blockedUntil: { lt: new Date() } }],
      },
    })
    .catch((error: unknown) => {
      // Tidying is not worth failing a signup over.
      console.error('[rate-limit] sweep failed', error);
    });
}

/** How long to wait, in words a person can act on. */
export function retryAfterMessage(seconds: number): string {
  if (seconds < 60) return `Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`;
  const minutes = Math.ceil(seconds / 60);
  return `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
