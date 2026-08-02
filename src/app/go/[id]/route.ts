import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { recordListingClick, isAutomatedRequest } from '@/lib/stats';
import { redirectTo } from '@/lib/redirect';
import { withUtm } from '@/lib/outbound';

// Counting outbound clicks by bouncing them through here rather than firing a
// beacon from the browser: this works with JavaScript disabled, is not blocked
// by the ad blockers a lot of this audience runs, and the user still ends up on
// the same page they would have.

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: { url: true, secondaryUrl: true },
  });

  if (!listing) {
    return redirectTo('/listings');
  }

  // The detail page has two buttons; both count as a click, since what we want
  // to know is whether the listing sent anyone anywhere.
  const wantsSecondary = new URL(request.url).searchParams.get('to') === 'secondary';
  const target = wantsSecondary ? (listing.secondaryUrl ?? listing.url) : listing.url;

  const userAgent = (await headers()).get('user-agent');
  if (!isAutomatedRequest(userAgent)) {
    await recordListingClick(id);
  }

  // Absolute and off-site. Tagged so the developer can see the visit came from
  // here — see withUtm for what it refuses to touch.
  return redirectTo(withUtm(target));
}
