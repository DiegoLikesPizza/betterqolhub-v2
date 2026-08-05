// Deciding where a sign-in is allowed to send someone next.
//
// `?callbackUrl=` is attacker-supplied by definition: it survives in a link
// anyone can post, and the login page follows it after the credentials are
// accepted. That is the classic open-redirect shape — a phishing link that
// genuinely starts on this site, shows the real login form, and only then hands
// the freshly-signed-in visitor to another host.
//
// The check used to be `startsWith('/')`, which lets through `//evil.example`:
// two slashes is a protocol-relative URL, and a browser reads it as a different
// origin. `/\evil.example` is the same trick — the URL parser treats a backslash
// after a slash as a second slash for http(s).

import { SITE_URL } from '@/lib/site';

/**
 * Whether the value carries a C0 control character or DEL.
 *
 * Written as a code-point scan rather than a regex character class: the range is
 * the kind of thing that survives a copy-paste as literal control bytes, and a
 * regex whose escapes were mangled fails open here.
 */
function hasControlChars(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0)!;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Reduces a `?callbackUrl=` to a path on this site, or to the fallback.
 *
 * Returns only the pathname, query and fragment: never an absolute URL, so the
 * result cannot carry an origin even if one somehow survived the checks. The
 * value is parsed against the site's own origin and the result must still be
 * that origin — a positive test, rather than a list of the tricks known today.
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = '/'): string {
  if (!raw) return fallback;

  // Rejected before parsing rather than after: the URL parser normalises some
  // of these away, and a value that needed normalising is not one to follow.
  if (!raw.startsWith('/')) return fallback;
  if (raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  if (hasControlChars(raw)) return fallback;

  let base: URL;
  let resolved: URL;
  try {
    base = new URL(SITE_URL);
    resolved = new URL(raw, base);
  } catch {
    return fallback;
  }

  if (resolved.origin !== base.origin) return fallback;

  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
