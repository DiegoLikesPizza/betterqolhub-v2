// Site-level constants shared by metadata across routes.

/**
 * Absolute base URL. Needed by `metadataBase` and by any hand-built canonical
 * or OG url — without it Next emits relative image paths, which Discord and
 * other crawlers cannot resolve.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://newqolhub.xyz';

export const SITE_NAME = 'Better QOLHub';

export const SITE_DESCRIPTION =
  'The community-vetted hub for Hypixel Skyblock cheat clients, macros, legit mods and shops. Every listing checked before it lands.';
