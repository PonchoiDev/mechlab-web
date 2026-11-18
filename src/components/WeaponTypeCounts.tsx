// Armas montadas de cada tipo en una build guardada («2E 1B 1M»), con el color de su tipo de anclaje.
export function WeaponTypeCounts({ counts, short, labels }: {
  counts: { type: string; count: number }[];
  short: Record<string, string>;
  labels: Record<string, string>;
}) {
  if (counts.length === 0) return <span className="builds-item-weapons is-empty">No weapons</span>;
  return (
    <span className="builds-item-weapons" aria-label={counts.map(({ type, count }) => `${count} ${labels[type] ?? type}`).join(', ')}>
      {counts.map(({ type, count }) => (
        <span key={type} data-weapon-type={type} title={`${count} ${labels[type] ?? type}`}>{count}{short[type] ?? type}</span>
      ))}
    </span>
  );
}
