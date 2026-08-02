import { getPrimaryModpack } from '@/lib/modpacks';
import { isFileKind } from '@/lib/modpack';
import { redirectTo } from '@/lib/redirect';

// Legacy download links: /download/mrpack and /download/zip.
//
// Before packs went plural there was exactly one, so the kind alone identified
// the file. Those URLs are in Discord posts and in people's browser history, so
// they keep working by resolving to whichever pack sorts first. Anything else
// goes to the pack list rather than being guessed at.
//
// Counting happens in /download/[slug]/[kind]; this only forwards, so a download
// is recorded once rather than twice.

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const kind = slug.toUpperCase();
  if (!isFileKind(kind)) return redirectTo('/modpacks');

  const pack = await getPrimaryModpack();
  if (!pack) return redirectTo('/modpacks');

  return redirectTo(`/download/${pack.slug}/${kind}`);
}
