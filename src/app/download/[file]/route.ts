import { headers } from 'next/headers';
import { PACK } from '@/lib/modpack';
import { recordPageHitFor, PAGE_KEYS } from '@/lib/stats';
import { redirectTo } from '@/lib/redirect';

// Counts a download, then hands off to nginx, which serves the file from
// /downloads/ directly. Next never streams the 90 MB ZIP itself — this route
// only ever emits a redirect.

// A closed map, so the route cannot be turned into a way to probe the
// filesystem: anything not listed here is simply not a download.
const FILES = {
  mrpack: { href: PACK.files.mrpack.href, key: PAGE_KEYS.downloadMrpack },
  zip: { href: PACK.files.zip.href, key: PAGE_KEYS.downloadZip },
} as const;

function isKnownFile(value: string): value is keyof typeof FILES {
  return Object.hasOwn(FILES, value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  if (!isKnownFile(file)) {
    return redirectTo('/modpacks');
  }

  const { href, key } = FILES[file];

  const userAgent = (await headers()).get('user-agent');
  await recordPageHitFor(key, userAgent);

  return redirectTo(href);
}
