// La munición instalada, igual en el MechLab de MW5 y en el de YAML: cajas, disparos, salvas, segundos de
// fuego y daño potencial de cada tipo.
export interface AmmunitionRow {
  ammoType: string;
  label: string;
  bins: number;
  capacity: number;
  volleys: number | null;
  seconds: number | null;
  potentialDamage: number | null;
}

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
};

export function AmmunitionList({ ammunition }: { ammunition: AmmunitionRow[] }) {
  return (
    <div className="ammunition-list">
      <header className="analysis-heading">
        <div>
          <p className="eyebrow">STORES</p>
          <h2>Installed ammunition</h2>
        </div>
      </header>
      {ammunition.map(({ ammoType, label, capacity, bins, volleys, seconds, potentialDamage }) => (
        <div className="ammunition-row" key={ammoType}>
          <span>{label}<small>{bins} {bins === 1 ? 'bin' : 'bins'}</small></span>
          <span className="ammunition-amount">
            <strong>{capacity} rounds</strong>
            <small>
              {volleys === null
                ? 'no weapon uses it'
                : `${volleys} ${volleys === 1 ? 'volley' : 'volleys'}${seconds !== null ? ` · ${formatDuration(seconds)} of fire` : ''}`}
            </small>
            {potentialDamage !== null && (
              <small className="ammunition-potential" title="Every volley times the volley damage of the weapons that use it">
                {Math.round(potentialDamage)} potential damage
              </small>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
