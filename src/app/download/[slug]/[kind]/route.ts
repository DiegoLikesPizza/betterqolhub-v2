import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { isFileKind } from '@/lib/modpack';
import { downloadHref } from '@/lib/modpack-storage';
import { recordPageHitFor, downloadKey } from '@/lib/stats';
import { redirectTo } from '@/lib/redirect';

// Counts a download, then hands off to nginx, which serves the file from
// /downloads/ directly. Next never streams the 91 MB ZIP itself — this route
// only ever emits a redirect.
//
// The filename comes out of the database row, never from the URL. That is what
// keeps this from being a way to probe the filesystem: the slug and kind are
// only ever used to *look up* a record, and a request that matches none
// redirects to the pack list.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; kind: string }> }
) {
  const { slug, kind: rawKind } = await params;

  const kind = rawKind.toUpperCase();
  if (!isFileKind(kind)) return redirectTo('/modpacks');

  const pack = await prisma.modpack.findUnique({
    where: { slug },
    select: {
      isPublished: true,
      files: { where: { kind }, select: { filename: true } },
    },
  });

  const file = pack?.files[0];
  // An unpublished pack is not downloadable even by direct link: its files may
  // be mid-upload or superseded.
  if (!pack?.isPublished || !file) return redirectTo('/modpacks');

  const userAgent = (await headers()).get('user-agent');
  await recordPageHitFor(downloadKey(slug, kind), userAgent);

  return redirectTo(downloadHref(file.filename));
}
