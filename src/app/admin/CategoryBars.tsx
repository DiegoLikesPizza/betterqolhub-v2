import type { CSSProperties } from 'react';

type Row = { key: string; label: string; color: string; count: number };

/**
 * Horizontal magnitude bars, one per category.
 *
 * Colour comes from src/lib/categories.ts — the Minecraft rarity palette is
 * brand-locked and identifies the entity, not its rank, so bars keep their hue
 * as counts move. That palette's gold/green pair sits at ΔE 7.5 under deuteranopia,
 * inside the 6-8 band that requires a secondary channel, so every bar is
 * directly labelled with its name and count and the figure never relies on hue.
 * Labels and values wear text tokens; only the bar carries the colour. No hover
 * layer: every value is already printed, so a tooltip would just repeat it.
 */
export default function CategoryBars({
  data,
  totalListings,
  unreviewed,
}: {
  data: Row[];
  totalListings: number;
  unreviewed: number;
}) {
  if (totalListings === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>No listings yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div>
      <ul className="bar-chart">
        {data.map((row) => (
          <li key={row.key} className="bar-row">
            <span className="bar-label">{row.label}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{ '--bar-color': row.color, width: `${(row.count / max) * 100}%` } as CSSProperties}
              />
            </span>
            <span className="bar-value">{row.count}</span>
          </li>
        ))}
      </ul>

      {unreviewed > 0 && (
        <p className="chart-footnote">
          {/* The noun agrees with the total, the verb with the unreviewed count. */}
          {unreviewed} of {totalListings} {totalListings === 1 ? 'listing' : 'listings'}{' '}
          {unreviewed === 1 ? 'has' : 'have'} no reviews yet.
        </p>
      )}
    </div>
  );
}
