// Mirroring a listing's releases into the developer's own Discord server.
//
// Unlike src/lib/discord-bot.ts, nothing here goes through our bot: the target
// is a server we have no presence in, and a webhook URL the team created is
// exactly the credential that makes that possible without one.
//
// Two properties this file exists to guarantee:
//
//   1. The server only ever fetches a real Discord webhook endpoint. This URL
//      comes from a form, and a server that POSTs wherever a form field says
//      would be an open door to everything the box can reach that the internet
//      cannot — the metadata service, the database, localhost. parseWebhookUrl
//      is that door being shut, by allowlist rather than by blocklist.
//   2. Delivery never affects publishing. The release is on the site whether or
//      not Discord accepts it, so every failure here is logged and returned,
//      never thrown.

import { SITE_URL } from '@/lib/site';

/**
 * Hosts that serve Discord webhooks.
 *
 * An explicit list rather than "ends with discord.com": a blocklist or a suffix
 * test is the classic way this check gets bypassed, and Discord has exactly
 * these four endpoints. `discordapp.com` is the legacy domain, still handed out
 * by old clients and still working.
 */
const WEBHOOK_HOSTS = [
  'discord.com',
  'canary.discord.com',
  'ptb.discord.com',
  'discordapp.com',
];

/** `/api/webhooks/<id>/<token>`, optionally with an API version segment. */
const WEBHOOK_PATH = /^\/api(?:\/v\d+)?\/webhooks\/(\d{5,25})\/([A-Za-z0-9_-]{20,120})$/;

export type ParsedWebhook = { url: string; id: string };

/**
 * Validates a Discord webhook URL, returning it normalised.
 *
 * Rejects anything that is not https, not one of the four Discord hosts, or not
 * shaped like a webhook path. Query strings and fragments are dropped rather
 * than rejected — Discord's own "Copy Webhook URL" never adds one, but a URL
 * pasted out of a browser bar sometimes carries tracking junk, and that is a
 * bad reason to refuse a valid webhook.
 */
export function parseWebhookUrl(raw: string): ParsedWebhook | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  // http would send the token over the wire in the clear, and Discord does not
  // serve it anyway.
  if (url.protocol !== 'https:') return null;
  if (!WEBHOOK_HOSTS.includes(url.hostname.toLowerCase())) return null;

  const match = WEBHOOK_PATH.exec(url.pathname);
  if (!match) return null;

  return { url: `https://${url.hostname.toLowerCase()}${url.pathname}`, id: match[1]! };
}

/**
 * A webhook URL with its token removed, safe to show in a browser.
 *
 * The token is the whole of the credential: anyone holding it can post into
 * that channel until it is regenerated. So the stored URL never leaves the
 * server, and the settings dialog shows this instead — enough for a team to
 * recognise which webhook is configured, useless to anyone who reads it over a
 * shoulder or out of a page source.
 */
export function maskWebhookUrl(raw: string): string {
  const parsed = parseWebhookUrl(raw);
  if (!parsed) return 'Not set';
  return `discord.com/api/webhooks/${parsed.id}/••••••••`;
}

/** Discord's cap on an embed description. Ours is lower, but not by contract. */
const MAX_DESCRIPTION = 4096;
const MAX_TITLE = 256;
const WEBHOOK_TIMEOUT_MS = 5000;

/** The site gold, as the integer Discord wants. Matches --gold in globals.css. */
const EMBED_COLOUR = 0xffaa00;

/**
 * The release date, written out rather than sent as an embed `timestamp`.
 *
 * Discord renders a timestamp as a date *and* a time in the reader's zone, and a
 * release only ever has a date behind it — the time shown would be whatever hour
 * the row was written, or midnight for a backdated entry. UTC and a fixed locale
 * so the text does not depend on the server's zone.
 */
function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function clamp(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}

export type WebhookResult = { ok: true } | { ok: false; reason: string };

/**
 * Posts a release into the team's own Discord channel.
 *
 * Mentions are suppressed wholesale. The body is written by any member of the
 * team, and the destination is a channel belonging to whoever configured the
 * webhook — usually the lead. Without this, `@everyone` in a release note would
 * ping a server nobody here can moderate.
 */
export async function sendChangelogWebhook(
  webhookUrl: string,
  entry: {
    listingId: string;
    listingName: string;
    version: string;
    body: string;
    author: string;
    releasedAt: Date;
  }
): Promise<WebhookResult> {
  // Re-validated at send time, not only at save time: this value has been
  // sitting in a database column since, and the check is cheap.
  const parsed = parseWebhookUrl(webhookUrl);
  if (!parsed) return { ok: false, reason: 'That webhook URL is no longer valid.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
      body: JSON.stringify({
        username: 'Better QOLHub',
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: clamp(`${entry.listingName} ${entry.version}`, MAX_TITLE),
            url: `${SITE_URL}/listings/${entry.listingId}`,
            description: clamp(entry.body, MAX_DESCRIPTION),
            color: EMBED_COLOUR,
            footer: { text: `Published by ${entry.author} on Better QOLHub · ${formatReleaseDate(entry.releasedAt)}` },
          },
        ],
      }),
    });

    if (res.ok) return { ok: true };

    // 404 is worth naming separately: it is what a deleted webhook returns, and
    // the fix ("create a new one and paste it in") is different from the fix for
    // everything else ("try again").
    if (res.status === 404 || res.status === 401) {
      return { ok: false, reason: 'Discord no longer knows that webhook — it was probably deleted.' };
    }
    if (res.status === 429) {
      return { ok: false, reason: 'Discord is rate-limiting that webhook. The release is published here regardless.' };
    }

    console.error(`[changelog-webhook] rejected (${res.status}) for listing ${entry.listingId}`);
    return { ok: false, reason: `Discord rejected the post (${res.status}).` };
  } catch (error) {
    console.error(`[changelog-webhook] could not reach Discord for listing ${entry.listingId}:`, error);
    return { ok: false, reason: 'Could not reach Discord.' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Posts a fixed test message. Used by the "Send test" button, so a team can find
 * out the webhook is wrong before a release rather than during one.
 */
export async function sendWebhookTest(
  webhookUrl: string,
  listingName: string
): Promise<WebhookResult> {
  const parsed = parseWebhookUrl(webhookUrl);
  if (!parsed) return { ok: false, reason: 'That does not look like a Discord webhook URL.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
      body: JSON.stringify({
        username: 'Better QOLHub',
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `${listingName} — webhook connected`,
            description:
              'Releases published on Better QOLHub will appear in this channel from now on.',
            color: EMBED_COLOUR,
          },
        ],
      }),
    });

    if (res.ok) return { ok: true };
    if (res.status === 404 || res.status === 401) {
      return { ok: false, reason: 'Discord does not know that webhook. Copy it again from the channel settings.' };
    }
    return { ok: false, reason: `Discord rejected the test (${res.status}).` };
  } catch {
    return { ok: false, reason: 'Could not reach Discord.' };
  } finally {
    clearTimeout(timer);
  }
}
