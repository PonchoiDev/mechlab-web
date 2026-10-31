import { useMemo, useState } from 'react';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { getStockBuild } from '../utils/buildCode';
import { getBuildSummary, type BuildSummary } from '../utils/calculators';
import { compareBuilds, getDefaultComparison, type ComparedSide, type ComparisonRow } from '../utils/compare';
import { getMechDisplayName } from '../utils/mechs';
import { createEmptyArmor, createEmptyLoadout } from '../utils/zones';
import { HardpointSummary, MechPicker } from './MechPicker';
import { MechSpecs } from './MechSpecs';

interface ComparePanelProps {
  mechs: Mech[];
  catalog: Item[];
  mech: Mech;
  summary: BuildSummary;
  onLoad: (index: number) => void;
  onClose: () => void;
}

// Build de serie del mech comparado; sin ella (no debería pasar), el chasis vacío.
const getStockSummary = (mech: Mech, mechs: Mech[], catalog: Item[]): BuildSummary => {
  const stock = getStockBuild(mech, mechs, catalog);
  return stock
    ? getBuildSummary(mech, stock.loadout, stock.armor)
    : getBuildSummary(mech, createEmptyLoadout(), createEmptyArmor());
};

function CompareValue({ row, side }: { row: ComparisonRow; side: 'a' | 'b' }) {
  const isBetter = row.winner === side;
  return (
    <td className={isBetter ? 'is-better' : undefined}>
      {side === 'a' ? row.a : row.b}
      {row.unit && (side === 'a' ? row.a : row.b) !== '—' && <small> {row.unit}</small>}
      {isBetter && row.difference && <span className="compare-difference">{row.difference}</span>}
    </td>
  );
}

function CompareHeading({ mech, caption }: { mech: Mech; caption: string }) {
  return (
    <div className="compare-heading">
      <p className="eyebrow">{caption}</p>
      <h3>{getMechDisplayName(mech)} <span>{mech.variant}</span></h3>
      <MechSpecs mech={mech} />
      <HardpointSummary mech={mech} />
    </div>
  );
}

// Compara la build del tablero con la build de serie de otro mech, fila a fila, marcando lo mejor.
export function ComparePanel({ mechs, catalog, mech, summary, onLoad, onClose }: ComparePanelProps) {
  const [otherIndex, setOtherIndex] = useState(() => getDefaultComparison(mechs, mech));
  const other = mechs[otherIndex];
  const otherSummary = useMemo(() => getStockSummary(other, mechs, catalog), [other, mechs, catalog]);
  const current: ComparedSide = { mech, summary };
  const groups = compareBuilds(current, { mech: other, summary: otherSummary });

  return (
    <section className="compare-panel" aria-label="Compare 'Mechs">
      <header className="upgrades-header">
        <h2>COMPARE</h2>
        <p className="upgrades-hint">Your current build against the stock loadout of another 'Mech. The better value is in green.</p>
        <button type="button" className="share-dialog-close" aria-label="Close comparison" onClick={onClose}>✕</button>
      </header>

      {/* Fuera de la tabla: su contenedor se desplaza en horizontal y recortaría el desplegable. */}
      <div className="compare-picker">
        <span className="utility-label">COMPARE WITH</span>
        <MechPicker mechs={mechs} selectedIndex={otherIndex} onSelect={setOtherIndex} />
        <button type="button" className="utility-button utility-button-primary" onClick={() => onLoad(otherIndex)}>
          Load this 'Mech
        </button>
      </div>

      <div className="compare-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col" aria-label="Stat" />
              <th scope="col"><CompareHeading mech={mech} caption="CURRENT BUILD" /></th>
              <th scope="col"><CompareHeading mech={other} caption="STOCK LOADOUT" /></th>
            </tr>
          </thead>
          {groups.map(group => (
            <tbody key={group.title}>
              <tr className="compare-group">
                <th scope="rowgroup" colSpan={3}>{group.title}</th>
              </tr>
              {group.rows.map(row => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <CompareValue row={row} side="a" />
                  <CompareValue row={row} side="b" />
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
