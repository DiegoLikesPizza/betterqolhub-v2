// Tagging outbound links so developers can see the traffic we send them.
//
// Requested by a listing owner: without it, our referrals land in their
// analytics as whatever the browser felt like sending, and a fair share arrive
// with no referrer at all.

/** What we call ourselves in someone else's analytics. */
export const UTM_SOURCE = 'newqolhub';
/** The standard companion. Without a medium, most tools bucket the visit oddly. */
export const UTM_MEDIUM = 'referral';

/**
 * Hosts where a tracking parameter would be pure noise.
 *
 * Discord does not read query strings on an invite and shows nobody analytics
 * for one, so tagging those only makes the URL uglier in the address bar of
 * anyone who looks.
 */
const UNTAGGED_HOSTS = ['discord.gg', 'discord.com'];

function isUntaggedHost(host: string): boolean {
  return UNTAGGED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Adds `utm_source` and `utm_medium` to an outbound URL.
 *
 * Deliberately conservative, in this order:
 *
 * - Anything that is not http(s) is returned untouched. This runs on values an
 *   admin typed, and a redirect is the wrong place to be creative about them.
 * - A URL that already carries a `utm_source` is left alone: the developer set
 *   their own campaign tagging and overwriting it would destroy their data.
 * - Existing query parameters are preserved — appended to, never replaced.
 */
export function withUtm(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return rawUrl;
  if (isUntaggedHost(url.hostname.toLowerCase())) return rawUrl;
  if (url.searchParams.has('utm_source')) return rawUrl;

  url.searchParams.set('utm_source', UTM_SOURCE);
  if (!url.searchParams.has('utm_medium')) {
    url.searchParams.set('utm_medium', UTM_MEDIUM);
  }

  return url.toString();
}
