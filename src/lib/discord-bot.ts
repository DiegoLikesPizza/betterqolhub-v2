// Outbound calls to the QOLHelper Discord bot.
//
// Design rule: mirroring to Discord must never break the website. If the bot is
// down, a listing still saves and a review still posts — the Discord side just
// misses that event. So every dispatch is best-effort, time-boxed, and logs
// rather than throws. The one exception is the link request, whose result the
// user is actively waiting on.

import { SITE_URL } from '@/lib/site';

const BOT_URL = process.env.DISCORD_BOT_URL;
const BOT_SECRET = process.env.DISCORD_BOT_SECRET;

const EVENT_TIMEOUT_MS = 5000;
const LINK_TIMEOUT_MS = 10_000;

export function isBotConfigured(): boolean {
  return Boolean(BOT_URL && BOT_SECRET);
}

async function callBot(
  path: string,
  payload: unknown,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (!BOT_URL || !BOT_SECRET) {
    return { ok: false, status: 0, body: { error: 'Bot not configured' } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BOT_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${BOT_SECRET}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

type ListingLike = {
  id: string;
  name: string;
  description: string;
  category: string;
  developer: string | null;
  url: string;
  secondaryUrl: string | null;
  isTrusted: boolean;
  pricing: string | null;
  price: string | null;
};

/** Fire-and-forget: awaited so errors are caught, but never rethrown. */
export async function notifyListing(
  action: 'created' | 'updated' | 'deleted',
  listing: ListingLike | { id: string }
): Promise<void> {
  if (!isBotConfigured()) return;
  try {
    const result = await callBot('/events/listing', { action, listing }, EVENT_TIMEOUT_MS);
    if (!result.ok) {
      console.error(`[discord-bot] listing ${action} failed (${result.status})`, result.body);
    }
  } catch (error) {
    console.error(`[discord-bot] listing ${action} could not reach the bot:`, error);
  }
}

type ReviewLike = {
  id: string;
  rating: number;
  body: string;
  username: string;
  listingId: string;
  listingName: string;
};

export async function notifyReview(
  action: 'created' | 'deleted',
  review: ReviewLike | { id: string }
): Promise<void> {
  if (!isBotConfigured()) return;
  try {
    const result = await callBot('/events/review', { action, review }, EVENT_TIMEOUT_MS);
    if (!result.ok) {
      console.error(`[discord-bot] review ${action} failed (${result.status})`, result.body);
    }
  } catch (error) {
    console.error(`[discord-bot] review ${action} could not reach the bot:`, error);
  }
}

type AnnouncementLike = {
  id: string;
  listingId: string;
  listingName: string;
  body: string;
  author: string;
};

/**
 * Mirrors an announcement into its listing's Discord forum thread.
 *
 * That thread is the notification mechanism: anyone following it already gets a
 * Discord ping for what lands there, so this needs no opt-in flag, no per-user
 * delivery record, and none of the "DMs are closed" failures the linking flow
 * runs into. The site's notification centre remains the durable record — this is
 * the push on top of it, and failing here must never fail the post itself.
 */
export async function notifyAnnouncement(announcement: AnnouncementLike): Promise<void> {
  if (!isBotConfigured()) return;
  try {
    const result = await callBot(
      '/events/announcement',
      { ...announcement, url: `${SITE_URL}/listings/${announcement.listingId}` },
      EVENT_TIMEOUT_MS
    );
    if (!result.ok) {
      console.error(`[discord-bot] announcement failed (${result.status})`, result.body);
    }
  } catch (error) {
    console.error('[discord-bot] announcement could not reach the bot:', error);
  }
}

type CachedEmoji = { id: string; name: string; animated: boolean };

let emojiCache: { at: number; emojis: CachedEmoji[] } | null = null;
const EMOJI_TTL_MS = 5 * 60_000;

/**
 * The guild's custom emoji, for the review picker. Cached for five minutes:
 * every listing page would otherwise call the bot, and the set changes rarely.
 * Returns [] on any failure — a missing picker is a degraded form, not an error
 * page.
 */
export async function fetchGuildEmojis(): Promise<CachedEmoji[]> {
  if (!BOT_URL || !BOT_SECRET) return [];

  if (emojiCache && Date.now() - emojiCache.at < EMOJI_TTL_MS) {
    return emojiCache.emojis;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EVENT_TIMEOUT_MS);

  try {
    const res = await fetch(`${BOT_URL.replace(/\/$/, '')}/emojis`, {
      headers: { authorization: `Bearer ${BOT_SECRET}` },
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`status ${res.status}`);

    const body = (await res.json()) as { emojis?: CachedEmoji[] };
    const emojis = Array.isArray(body.emojis) ? body.emojis : [];
    emojiCache = { at: Date.now(), emojis };
    return emojis;
  } catch (error) {
    console.error('[discord-bot] could not fetch guild emojis:', error);
    // Serve stale rather than nothing if we have it.
    return emojiCache?.emojis ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks the bot to DM a password-reset code. The caller deliberately ignores
 * whether this succeeded when reporting back to the user — see the action.
 */
export async function requestPasswordResetDm(
  discordId: string,
  code: string,
  siteUsername: string
): Promise<{ ok: boolean }> {
  if (!isBotConfigured()) return { ok: false };

  try {
    const result = await callBot(
      '/password-reset',
      { discordId, code, siteUsername },
      LINK_TIMEOUT_MS
    );
    const body = result.body as { ok?: boolean } | null;
    return { ok: Boolean(result.ok && body?.ok) };
  } catch {
    return { ok: false };
  }
}

export type LinkRequestResult =
  | { ok: true; discordId: string; discordTag: string }
  | { ok: false; message: string };

/**
 * Asks the bot to DM a verification code. Unlike the event dispatches, the
 * caller needs this result, so failures are returned rather than swallowed.
 */
export async function requestDiscordDm(
  discordUsername: string,
  code: string,
  siteUsername: string
): Promise<LinkRequestResult> {
  if (!isBotConfigured()) {
    return { ok: false, message: 'Discord linking is not configured on this site yet.' };
  }

  try {
    const result = await callBot(
      '/link/request',
      { discordUsername, code, siteUsername },
      LINK_TIMEOUT_MS
    );

    if (!result.ok) {
      return { ok: false, message: 'The Discord bot rejected the request. Try again later.' };
    }

    const body = result.body as
      | { ok: true; discordId: string; discordTag: string }
      | { ok: false; message?: string }
      | null;

    if (!body) return { ok: false, message: 'The Discord bot returned nothing. Try again.' };
    if (body.ok) return { ok: true, discordId: body.discordId, discordTag: body.discordTag };

    return { ok: false, message: body.message ?? 'Could not send the verification DM.' };
  } catch {
    return { ok: false, message: 'The Discord bot is unreachable right now. Try again later.' };
  }
}
