import { useMemo, useState, type ReactNode } from 'react';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { useSarnaAsset } from '../hooks/useSarnaAsset';
import { getStockBuild, type SharedBuild } from '../utils/buildCode';
import {
  compareBuilds,
  getBarShares,
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
function CompareCard({ build, caption, children }: { build: SharedBuild; caption: string; children?: ReactNode }) {
  const { mech, loadout, upgrades } = build;
  const sarna = useSarnaAsset(mech);
  const groups = groupLoadout(loadout);
  const upgradeNames = getUpgrades(upgrades).map(upgrade => upgrade.name);

  return (
    <article className="compare-card">
      <p className="eyebrow">{caption}</p>
      {children}
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

// Una fila en espejo: valor y barra de cada lado, con la etiqueta en el centro.
function VersusRow({ row }: { row: ComparisonRow }) {
  const [shareA, shareB] = getBarShares(row.valueA, row.valueB);
  const side = (value: string, share: number, isWinner: boolean, align: 'left' | 'right') => (
    <div className={['versus-side', `is-${align}`, isWinner ? 'is-better' : ''].filter(Boolean).join(' ')}>
      <span className="versus-value">
        {/* La diferencia va hacia el centro: delante del valor en la columna izquierda. */}
        {isWinner && row.difference && align === 'right' && <span className="compare-difference">{row.difference}</span>}
        {value}
        {row.unit && value !== '—' && <small> {row.unit}</small>}
        {isWinner && row.difference && align === 'left' && <span className="compare-difference">{row.difference}</span>}
      </span>
      <span className="versus-bar" aria-hidden="true"><span style={{ width: `${Math.round(share * 100)}%` }} /></span>
    </div>
  );
  return (
    <div className="versus-row">
      {side(row.a, shareA, row.winner === 'a', 'right')}
      <span className="versus-label">{row.label}</span>
      {side(row.b, shareB, row.winner === 'b', 'left')}
    </div>
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

      <div className="compare-cards">
        <CompareCard build={current} caption="CURRENT BUILD" />
        <div className="compare-other">
          <div className="compare-source">
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
          {other
            ? <CompareCard build={other} caption={source === 'saved' ? 'SAVED BUILD' : 'STOCK LOADOUT'} />
            : source === 'saved' && savedBuild && <p className="compare-empty">This saved build can no longer be loaded.</p>}
        </div>
      </div>

      {groups.length > 0 && (
        <div className="versus">
          {groups.map(group => (
            <section key={group.title} className="versus-group" aria-label={group.title}>
              <h3>{group.title}</h3>
              {group.rows.map(row => <VersusRow key={row.key} row={row} />)}
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
