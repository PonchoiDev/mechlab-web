import { useMemo, useState } from 'react';
import type { BtBuild, BtMech } from '../../types/battletech-mechlab';
import type { SavedBuild } from '../../utils/savedBuildsCore';
import { decodeBtBuild } from '../../utils/battletech/buildCode';
import { compareBtBuilds } from '../../utils/battletech/compare';
import { createStockBuild } from '../../utils/battletech/fitting';
import { getMechDisplayName } from '../../utils/battletech/mechlabData';
import { BtMechPicker } from './BtMechPicker';
import { MechIcon } from './MechIcon';

interface BtComparePanelProps {
  mechs: BtMech[];
  current: BtBuild;
  savedBuilds: SavedBuild[];
  onLoad: (build: BtBuild, label: string, savedId: string | null) => void;
  onClose: () => void;
}

type Source = 'stock' | 'saved';

// Al abrir se propone otra variante del mismo chasis, que es lo que más se compara; si no la hay, el
// 'Mech de tonelaje más cercano.
const defaultMech = (mechs: BtMech[], current: BtMech) => {
  const others = mechs.filter(mech => mech.id !== current.id);
  return others.find(mech => mech.name === current.name)
    ?? [...others].sort((a, b) => Math.abs(a.tonnage - current.tonnage) - Math.abs(b.tonnage - current.tonnage))[0]
    ?? current;
};

// Compara la build del tablero con la de serie de otra variante o con una build guardada.
export function BtComparePanel({ mechs, current, savedBuilds, onLoad, onClose }: BtComparePanelProps) {
  const [source, setSource] = useState<Source>('stock');
  const [stockMech, setStockMech] = useState(() => defaultMech(mechs, current.mech));
  const [savedId, setSavedId] = useState<string | null>(savedBuilds[0]?.id ?? null);
  const savedBuild = savedBuilds.find(build => build.id === savedId) ?? null;
  const other = useMemo(() => {
    if (source === 'saved') return savedBuild ? decodeBtBuild(savedBuild.code) : null;
    return createStockBuild(stockMech);
  }, [source, savedBuild, stockMech]);
  const otherLabel = source === 'saved' && savedBuild ? savedBuild.name : other ? `stock ${other.mech.variant}` : '';
  const groups = useMemo(() => other ? compareBtBuilds(current, other) : [], [current, other]);

  return (
    <section className="compare-panel bt-compare" aria-label="Compare 'Mechs">
      <header className="bt-compare-header">
        <div>
          <h2>COMPARE</h2>
          <p>Your current build next to another one. The better value of each stat is highlighted.</p>
        </div>
        <button type="button" className="share-dialog-close" aria-label="Close comparison" onClick={onClose}>✕</button>
      </header>
      <div className="compare-source bt-compare-source">
        <span className="utility-label">COMPARE WITH</span>
        <div className="compare-source-tabs" role="group" aria-label="Compare with">
          <button type="button" className="mech-filter-chip" aria-pressed={source === 'stock'} onClick={() => setSource('stock')}>Stock 'Mech</button>
          <button type="button" className="mech-filter-chip" aria-pressed={source === 'saved'} onClick={() => setSource('saved')}>
            My builds{savedBuilds.length > 0 && <span className="utility-count">{savedBuilds.length}</span>}
          </button>
        </div>
        {source === 'stock' ? (
          <BtMechPicker mechs={mechs} current={stockMech} onSelect={setStockMech} />
        ) : savedBuilds.length > 0 ? (
          <select className="mech-filter-year" aria-label="Saved build" value={savedId ?? ''} onChange={event => setSavedId(event.target.value)}>
            {savedBuilds.map(build => <option key={build.id} value={build.id}>{build.name}</option>)}
          </select>
        ) : (
          <p className="compare-empty">No saved builds yet. Use Save build in the toolbar to keep one and compare it here.</p>
        )}
        {other && (
          <button type="button" className="utility-button utility-button-primary" onClick={() => onLoad(other, otherLabel, source === 'saved' ? savedId : null)}>
            Load this build
          </button>
        )}
      </div>

      {other ? (
        <table className="bt-compare-table">
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">Stat</span></th>
              <th scope="col"><MechIcon mech={current.mech} size={40} /><span>Current<br /><b>{getMechDisplayName(current.mech)}</b></span></th>
              <th scope="col"><MechIcon mech={other.mech} size={40} /><span>{source === 'saved' ? 'Saved' : 'Stock'}<br /><b>{source === 'saved' ? otherLabel : getMechDisplayName(other.mech)}</b></span></th>
            </tr>
          </thead>
          {groups.map(group => (
            <tbody key={group.title}>
              <tr className="bt-compare-group"><th colSpan={3} scope="colgroup">{group.title}</th></tr>
              {group.rows.map(row => (
                <tr key={row.key}>
                  <th scope="row">{row.label}{row.unit && <small> {row.unit}</small>}{row.lowerIsBetter && <small> (lower is better)</small>}</th>
                  <td className={row.winner === 'a' ? 'is-winner' : ''}>{row.a}{row.winner === 'a' && row.difference && <small> {row.difference}</small>}</td>
                  <td className={row.winner === 'b' ? 'is-winner' : ''}>{row.b}{row.winner === 'b' && row.difference && <small> {row.difference}</small>}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      ) : (
        <p className="compare-empty">{source === 'saved' && savedBuild ? 'This saved build can no longer be loaded.' : 'Pick a build to compare with.'}</p>
      )}
    </section>
  );
}
