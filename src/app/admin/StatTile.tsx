// Per the stat-tile contract: sentence-case label with no trailing colon, a
// semibold sans value in proportional figures (tabular-nums is for columns),
// and an optional hint. No sparkline — there is no history to plot yet.
export default function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  const display = typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div className="stat-tile">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{display}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
