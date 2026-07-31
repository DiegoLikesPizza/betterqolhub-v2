import { getStatsData } from '../../queries';
import StatsPanel from '../../StatsPanel';

export const revalidate = 0;

export default async function AdminTrafficPage() {
  const stats = await getStatsData();

  return (
    <section className="admin-section">
      <h2 className="admin-section-title">Traffic</h2>
      <p className="admin-section-sub">
        Last {stats.windowDays} days, since {stats.since}. Counted per day with no
        IPs, cookies or user ids — only how often something happened. Requests that
        look automated are skipped, so Discord fetching a page to build a link
        preview does not show up as a visit.
      </p>
      <StatsPanel stats={stats} />
    </section>
  );
}
