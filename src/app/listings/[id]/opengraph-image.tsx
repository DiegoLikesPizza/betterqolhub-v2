import { ImageResponse } from 'next/og';
import { prisma } from '@/lib/prisma';
import { categoryColor, categoryLabel } from '@/lib/categories';
import { summarise } from '@/lib/reviews';
import { pricingShort, pricingColor } from '@/lib/pricing';

export const alt = 'Listing on Better QOLHub';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Renders the listing as its own Minecraft-style item tooltip, so a link posted
// in Discord shows what it points at rather than a generic banner.
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      name: true,
      description: true,
      category: true,
      developer: true,
      isTrusted: true,
      pricing: true,
      price: true,
      reviews: { select: { rating: true } },
    },
  });

  const rarity = listing ? categoryColor(listing.category) : '#ffaa00';
  const summary = summarise(listing?.reviews.map((r) => r.rating) ?? []);
  // The badge stays the pricing *state* only, and the concrete price gets its
  // own line below. Putting both in the badge overflows the panel: the row it
  // sits in is a fixed 1200px shared with the category and the rating, and
  // flex-wrap is not an option — Satori rejects a wrapping container here.
  const pricing = pricingShort(listing?.pricing ?? null);
  const price = listing?.price ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: '#0d0b14',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          padding: 64,
        }}
      >
        {/* The tooltip panel, bordered in the category's rarity colour. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#100c1a',
            border: `6px solid ${rarity}`,
            padding: '44px 52px',
            boxShadow: '14px 14px 0 rgba(0,0,0,0.55)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                fontSize: 22,
                letterSpacing: 5,
                textTransform: 'uppercase',
                color: '#9c92b8',
              }}
            >
              Better QOLHub
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                color: listing?.isTrusted ? '#55ff55' : '#ffaa00',
                border: `3px solid ${listing?.isTrusted ? '#55ff5555' : '#ffaa0055'}`,
                padding: '6px 14px',
              }}
            >
              {listing?.isTrusted ? 'TRUSTED' : 'UNVERIFIED'}
            </div>
          </div>

          <div
            style={{
              fontSize: listing && listing.name.length > 22 ? 68 : 92,
              fontWeight: 700,
              color: rarity,
              lineHeight: 1.05,
              marginTop: 20,
            }}
          >
            {listing?.name ?? 'Listing not found'}
          </div>

          {listing?.developer && (
            // One interpolated string, not `by {developer}`: that is two child
            // nodes, and Satori rejects a div with more than one child unless it
            // declares a display mode. It rendered fine for listings with no
            // developer, which is why this went unnoticed.
            <div style={{ fontSize: 28, color: '#9c92b8', marginTop: 10 }}>
              {`by ${listing.developer}`}
            </div>
          )}

          <div
            style={{
              fontSize: 30,
              color: '#b9b0d4',
              marginTop: 24,
              lineHeight: 1.4,
              // Two lines is all the room there is; longer descriptions clip.
              maxHeight: 92,
              overflow: 'hidden',
            }}
          >
            {listing?.description ?? ''}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 32 }}>
            <div style={{ display: 'flex', fontSize: 24, color: rarity, letterSpacing: 2 }}>
              {listing ? categoryLabel(listing.category).toUpperCase() : ''}
            </div>

            {pricing && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  color: pricingColor(listing?.pricing ?? null),
                  border: `3px solid ${pricingColor(listing?.pricing ?? null)}55`,
                  padding: '4px 12px',
                }}
              >
                {pricing}
              </div>
            )}

            <div style={{ display: 'flex', marginLeft: 'auto', alignItems: 'center', gap: 12 }}>
              {/* Rating drawn as blocks, not ★ glyphs: the font available to
                  ImageResponse has no star characters and renders them as tofu.
                  Squares also suit the pixel aesthetic better. */}
              <div style={{ display: 'flex', gap: 5 }}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const filled = summary.average !== null && i < Math.round(summary.average);
                  return (
                    <div
                      key={i}
                      style={{
                        width: 22,
                        height: 22,
                        backgroundColor: filled ? '#ffaa00' : 'transparent',
                        border: `3px solid ${filled ? '#ffaa00' : '#34235c'}`,
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: 24, color: '#9c92b8' }}>
                {summary.average === null
                  ? 'No reviews yet'
                  : `${summary.average.toFixed(1)} · ${summary.count} ${
                      summary.count === 1 ? 'review' : 'reviews'
                    }`}
              </div>
            </div>
          </div>

          {/* Its own line, so a long price cannot squeeze the row above. */}
          {price && (
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                color: pricingColor(listing?.pricing ?? null),
                marginTop: 18,
              }}
            >
              {price}
            </div>
          )}
        </div>
      </div>
    ),
    size
  );
}
