import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { StatsData } from './queries';
import StatTile from './StatTile';

/**
 * Traffic over the last window: a daily column chart, the listings that actually
 * send people somewhere, and totals per page.
 *
 * Views and clicks are two measures of the same thing rather than two
 * categories, so they share one hue family — muted purple for views, gold for
 * clicks, gold being the site's "this is the action" colour. Both series are
 * labelled and every table prints its numbers, so nothing depends on telling the
 * two column colours apart.
 */
export default function StatsPanel({ stats }: { stats: StatsData }) {
  const { totals, daily, topListings, pages, windowDays } = stats;
  const nothingYet = totals.views === 0 && totals.clicks === 0 && totals.downloads === 0;

  return (
    <div>
      {nothingYet ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          Nothing recorded yet. Counting started when this was deployed, so the
          first numbers appear as people visit — there is no history from before.
        </p>
      ) : (
        <>
          <div className="stat-row" style={{ marginBottom: '2rem' }}>
            <StatTile label="Listing views" value={totals.views} hint={`over ${windowDays} days`} />
            <StatTile label="Outbound clicks" value={totals.clicks} hint={`over ${windowDays} days`} />
            <StatTile
              label="Pack downloads"
              value={totals.downloads}
              hint=".mrpack and ZIP combined"
            />
          </div>

          <DailyChart daily={daily} windowDays={windowDays} />

          <div className="stats-split">
            <section>
              <h3 className="admin-section-title">Most clicked</h3>
              {topListings.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No listing activity yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Listing</th>
                        <th>Views</th>
                        <th>Clicks</th>
                        <th>Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topListings.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <Link href={`/listings/${l.id}`} className="table-link">
                              {l.name}
                            </Link>
                          </td>
                          <td className="stat-num">{l.views.toLocaleString()}</td>
                          <td className="stat-num">{l.clicks.toLocaleString()}</td>
                          <td className="stat-num">
                            {/* A rate with no views behind it would be a lie, so
                                it stays blank rather than showing 0%. */}
                            {l.rate === null ? (
                              <span className="table-muted">—</span>
                            ) : (
                              `${Math.round(l.rate * 100)}%`
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="chart-footnote">
                Rate is clicks per view: how often looking at a listing led to
                actually opening it.
              </p>
            </section>

            <section className="stats-pages">
              <h3 className="admin-section-title">Pages</h3>
              <ul className="bar-chart">
                {pages.map((p) => (
                  <li key={p.path} className="bar-row">
                    <span className="bar-label">{pageLabel(p.path)}</span>
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={
                          {
                            '--bar-color': 'var(--gold)',
                            width: `${(p.hits / Math.max(...pages.map((x) => x.hits), 1)) * 100}%`,
                          } as CSSProperties
                        }
                      />
                    </span>
                    <span className="bar-value">{p.hits.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

const PAGE_LABELS: Record<string, string> = {
  home: 'Home',
  listings: 'Listings',
  modpacks: 'Modpacks',
  // The Impressum page is gone and nothing records this key any more, but the
  // rows it already wrote are still in PageStat. Kept so past traffic reads as
  // "Impressum" rather than dropping to the raw slug.
  impressum: 'Impressum',
  'download:mrpack': 'Download — .mrpack',
  'download:zip': 'Download — ZIP',
};

function pageLabel(path: string): string {
  return PAGE_LABELS[path] ?? path;
}

function DailyChart({
  daily,
  windowDays,
}: {
  daily: StatsData['daily'];
  windowDays: number;
}) {
  const max = Math.max(...daily.map((d) => Math.max(d.views, d.clicks)), 1);

  return (
    <div className="daily-chart-wrap">
      <div className="chart-legend">
        <span className="legend-item">
          <span className="legend-swatch legend-views" /> Views
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-clicks" /> Clicks
        </span>
      </div>

      <div className="daily-chart" role="img" aria-label={`Views and clicks per day over the last ${windowDays} days`}>
        {daily.map((d) => (
          <div key={d.day} className="day-col" title={`${d.day}: ${d.views} views, ${d.clicks} clicks`}>
            <span
              className="day-bar day-views"
              style={{ height: `${(d.views / max) * 100}%` } as CSSProperties}
            />
            <span
              className="day-bar day-clicks"
              style={{ height: `${(d.clicks / max) * 100}%` } as CSSProperties}
            />
          </div>
        ))}
      </div>

      {/* Only the ends are labelled: 30 dates along an axis this size would be
          unreadable, and the shape is what matters here, not the exact day. */}
      <div className="chart-axis">
        <span>{daily[0]?.day}</span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </div>
  );
}
