import { useMemo, useState } from 'react';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { useSarnaAsset } from '../hooks/useSarnaAsset';
import { getStockBuild, type SharedBuild } from '../utils/buildCode';
import {
  compareBuilds,
  getDefaultComparison,
  groupLoadout,
  resolveSavedBuild,
  toComparedSide,
  type ComparisonRow
} from '../utils/compare';
import { getMechDisplayName } from '../utils/mechs';
import type { SavedBuild } from '../utils/savedBuilds';
import { getUpgrades } from '../utils/upgrades';
import { HardpointSummary, MechPicker } from './MechPicker';
import { MechSpecs } from './MechSpecs';

type Source = 'stock' | 'saved';

interface ComparePanelProps {
  mechs: Mech[];
  catalog: Item[];
  current: SharedBuild;
  savedBuilds: SavedBuild[];
  onLoad: (build: SharedBuild, label: string, savedId: string | null) => void;
  onClose: () => void;
}

// Tarjeta de un lado: el 'Mech con su imagen, su ficha y su loadout por componente.
function CompareCard({ build, caption }: { build: SharedBuild; caption: string }) {
  const { mech, loadout, upgrades } = build;
  const sarna = useSarnaAsset(mech);
  const groups = groupLoadout(loadout);
  const upgradeNames = getUpgrades(upgrades).map(upgrade => upgrade.name);

  return (
    <article className="compare-card">
      <p className="eyebrow">{caption}</p>
      <div className="compare-card-head">
        <div className="compare-card-image">
          {sarna.asset?.imageUrl
            ? <img src={sarna.asset.imageUrl} alt={`${mech.name} ${mech.variant}`} onError={sarna.markImageBroken} />
            : <span>{sarna.isLoading ? 'Loading…' : mech.variant}</span>}
        </div>
        <div className="compare-card-title">
          <h3>{getMechDisplayName(mech)} <span>{mech.variant}</span></h3>
          <MechSpecs mech={mech} />
          <HardpointSummary mech={mech} />
        </div>
      </div>
      {groups.length > 0 ? (
        <dl className="compare-loadout">
          {groups.map(group => (
            <div key={group.zone} className="compare-loadout-zone">
              <dt>{group.label}</dt>
              <dd>
                {group.items.map(line => (
                  <span
                    key={`${line.name}-${line.tier}`}
                    className={`compare-item is-${line.type}`}
                    data-weapon-type={line.type === 'weapon' ? line.weaponType ?? undefined : undefined}
                  >
                    {line.name}
                    {line.count > 1 && <small> ×{line.count}</small>}
                    {line.tier && <small> · {line.tier}</small>}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="compare-empty">No equipment installed.</p>
      )}
      {upgradeNames.length > 0 && <p className="compare-upgrades"><b>Upgrades:</b> {upgradeNames.join(', ')}</p>}
    </article>
  );
}

// Una celda de la tabla: el valor y, si gana, la diferencia con el otro.
function CompareValue({ row, side }: { row: ComparisonRow; side: 'a' | 'b' }) {
  const value = side === 'a' ? row.a : row.b;
  const state = row.winner === side ? 'is-better' : row.winner === null ? 'is-tie' : undefined;
  return (
    <td className={state}>
      {value}
      {row.unit && value !== '—' && <small> {row.unit}</small>}
      {row.winner === side && row.difference && <span className="compare-difference">{row.lowerIsBetter ? '▼' : '▲'} {row.difference}</span>}
    </td>
  );
}

// Compara la build del tablero con la build de serie de otro 'Mech o con una build guardada.
export function ComparePanel({ mechs, catalog, current, savedBuilds, onLoad, onClose }: ComparePanelProps) {
  const [source, setSource] = useState<Source>('stock');
  const [stockIndex, setStockIndex] = useState(() => getDefaultComparison(mechs, current.mech));
  const [savedId, setSavedId] = useState<string | null>(savedBuilds[0]?.id ?? null);

  const savedBuild = savedBuilds.find(build => build.id === savedId) ?? null;
  const other = useMemo(() => {
    if (source === 'saved') return savedBuild ? resolveSavedBuild(savedBuild, mechs, catalog) : null;
    return getStockBuild(mechs[stockIndex], mechs, catalog);
  }, [source, savedBuild, stockIndex, mechs, catalog]);
  const otherLabel = source === 'saved' && savedBuild ? savedBuild.name : other ? `stock ${other.mech.variant}` : '';
  const groups = useMemo(
    () => other ? compareBuilds(toComparedSide(current), toComparedSide(other)) : [],
    [current, other]
  );

  return (
    <section className="compare-panel" aria-label="Compare 'Mechs">
      <header className="upgrades-header">
        <h2>COMPARE</h2>
        <p className="upgrades-hint">Your current build next to another 'Mech. The better value of each row is in green.</p>
        <button type="button" className="share-dialog-close" aria-label="Close comparison" onClick={onClose}>✕</button>
      </header>

      <div className="compare-source">
        <span className="utility-label">COMPARE WITH</span>
        <div className="compare-source-tabs" role="group" aria-label="Compare with">
          <button type="button" className="mech-filter-chip" aria-pressed={source === 'stock'} onClick={() => setSource('stock')}>
            Stock 'Mech
          </button>
          <button type="button" className="mech-filter-chip" aria-pressed={source === 'saved'} onClick={() => setSource('saved')}>
            My builds{savedBuilds.length > 0 && <span className="utility-count">{savedBuilds.length}</span>}
          </button>
        </div>
        {source === 'stock' ? (
          <MechPicker mechs={mechs} selectedIndex={stockIndex} onSelect={setStockIndex} />
        ) : savedBuilds.length > 0 ? (
          <label className="compare-saved">
            <span>SAVED BUILD</span>
            <select value={savedId ?? ''} onChange={event => setSavedId(event.target.value)}>
              {savedBuilds.map(build => <option key={build.id} value={build.id}>{build.name}</option>)}
            </select>
          </label>
        ) : (
          <p className="compare-empty">No saved builds yet. Use Save build in the toolbar to keep one and compare it here.</p>
        )}
        {other && (
          <button
            type="button"
            className="utility-button utility-button-primary"
            onClick={() => onLoad(other, otherLabel, source === 'saved' ? savedId : null)}
          >
            Load this build
          </button>
        )}
      </div>

      {/* Los controles van encima de las dos tarjetas, para que empiecen a la misma altura. */}
      <div className="compare-cards">
        <CompareCard build={current} caption="CURRENT BUILD" />
        {other
          ? <CompareCard build={other} caption={source === 'saved' ? 'SAVED BUILD' : 'STOCK LOADOUT'} />
          : (
            <article className="compare-card">
              <p className="compare-empty">
                {source === 'saved' && savedBuild ? 'This saved build can no longer be loaded.' : 'Pick a build to compare with.'}
              </p>
            </article>
          )}
      </div>

      {groups.length > 0 && other && (
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Stat</th>
              <th scope="col">{current.mech.variant} <small>current</small></th>
              <th scope="col">{other.mech.variant} <small>{source === 'saved' ? 'saved' : 'stock'}</small></th>
            </tr>
          </thead>
          {groups.map(group => (
            <tbody key={group.title}>
              <tr className="compare-group">
                <th scope="rowgroup" colSpan={3}>{group.title}</th>
              </tr>
              {group.rows.map(row => (
                <tr key={row.key}>
                  <th scope="row">
                    {row.label}
                    {row.lowerIsBetter && <small> lower is better</small>}
                  </th>
                  <CompareValue row={row} side="a" />
                  <CompareValue row={row} side="b" />
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
    </section>
  );
}
