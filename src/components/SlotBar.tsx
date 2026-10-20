interface SlotBarProps {
  used: number;
  capacity: number;
  label: string;
  variant?: 'general' | 'special';
}

export function SlotBar({ used, capacity, label, variant = 'general' }: SlotBarProps) {
  if (capacity === 0 && used === 0) return null;

  const cells = Math.max(capacity, used);

  return (
    <span className={`slot-bar slot-bar-${variant}`} title={`${label}: ${used} / ${capacity}`}>
      <span className="slot-bar-label">{label}</span>
      <span className="slot-bar-cells" aria-hidden="true">
        {Array.from({ length: cells }, (_, index) => (
          <span
            key={index}
            className={index >= capacity ? 'slot-cell is-over' : index < used ? 'slot-cell is-used' : 'slot-cell'}
          />
        ))}
      </span>
      <span className="slot-bar-count">{used}/{capacity}</span>
    </span>
  );
}
