import { useMemo, type CSSProperties } from 'react';
import { UpgradedValue } from '../components/UpgradedValue';
import type { YamlBuild, YamlMech } from '../types/yaml-mechlab';
import { getYamlStatsPanel } from '../utils/yaml/combat';
import { getYamlReadouts } from '../utils/yaml/readouts';

// El panel de estadísticas del mechlab del juego con YAML: el peso arriba, como en el juego, con las ranuras
// libres y los rellenos dinámicos, y debajo sus 21 cifras con su barra. En la caja de cifras del MechLab de
// MW5 (readout-strip), para que las dos páginas se lean igual.
export function YamlStatsPanel({ mech, build }: { mech: YamlMech; build: YamlBuild }) {
  const readouts = useMemo(() => getYamlReadouts(mech, build), [mech, build]);
  const panel = useMemo(() => getYamlStatsPanel(mech, build), [mech, build]);
  return (
    <section className="readout-strip yaml-stats" aria-label="Mech statistics">
      <div className="yaml-stats-header">
        {readouts.map(readout => (
          <div key={readout.label} className="readout-cell">
            <span className="readout-label" title={readout.title}>{readout.label}</span>
            <strong className={readout.warn ? 'readout-warning' : ''}>{readout.value}{readout.unit && <> <small>{readout.unit}</small></>}</strong>
          </div>
        ))}
      </div>
      <div className="yaml-stats-grid">
        {panel.flat().map(cell => (
          <div key={cell.key} className="readout-cell yaml-stat" style={{ '--stat-ratio': cell.ratio } as CSSProperties}>
            <span className="readout-label">{cell.label}</span>
            <strong><UpgradedValue value={cell.value} base={cell.base} /></strong>
            <span className="yaml-stat-bar" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}
