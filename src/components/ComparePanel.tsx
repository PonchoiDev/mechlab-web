import { useMemo, useState } from 'react';
import { EMPTY_VALUE } from '../utils/format';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { getStockBuild, type SharedBuild } from '../utils/buildCode';
import {
  compareBuilds,
  getDefaultComparison,
  resolveSavedBuild,
  toComparedSide,
  type ComparisonGroup
} from '../utils/compare';
import { getMechDisplayName } from '../utils/mechs';
import type { SavedBuild } from '../utils/savedBuilds';
import { getUpgrades } from '../utils/upgrades';
import { getArmorScale } from '../utils/calculators';
import { HardpointSummary, MechPicker } from './MechPicker';
import { MechBoard } from './MechBoard';
import { MechSpecs } from './MechSpecs';

type Source = 'stock' | 'saved';

interface ComparePanelProps {
  mechs: Mech[];
  catalog: Item[];
  current: SharedBuild;
  savedBuilds: SavedBuild[];
  // La vista de ranuras del tablero (Show slot cells), para que las tarjetas se lean igual que él.
  expandedSlots: boolean;
  onLoad: (build: SharedBuild, label: string, savedId: string | null) => void;
  onClose: () => void;
}

// Cifras de un lado. Las dos tarjetas pintan las mismas filas en el mismo orden, así que quedan a
// la misma altura y se comparan de un vistazo; el valor mejor va en verde.
function CardStats({ groups, side }: { groups: ComparisonGroup[]; side: 'a' | 'b' }) {
  return (
    <div className="compare-card-stats">
      {groups.map(group => (
        <section key={group.title} aria-label={group.title}>
          <h4>{group.title}</h4>
          <dl>
            {group.rows.map(row => {
              const value = side === 'a' ? row.a : row.b;
              const state = row.winner === side ? 'is-better' : row.winner === null ? 'is-tie' : 'is-worse';
              return (
                <div key={row.key} className={`compare-stat ${state}`}>
                  <dt>{row.label}</dt>
                  <dd>
                    {row.winner === side && row.difference && (
                      <span className="compare-difference">{row.lowerIsBetter ? '▼' : '▲'} {row.difference}</span>
                    )}
                    {value}
                    {row.unit && value !== EMPTY_VALUE && <small> {row.unit}</small>}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

const ignore = () => {};

// Un lado de la comparación en dos partes, que la rejilla del panel coloca por separado: el tablero, a todo el
// ancho y con el tamaño del tablero compacto del MechLab, con el nombre, la ficha y los anclajes del 'Mech en su
// rótulo; y las cifras, lado a lado con las del otro 'Mech.
function CompareCard({ build, caption, groups, side, expandedSlots }: { build: SharedBuild; caption: string; groups: ComparisonGroup[]; side: 'a' | 'b'; expandedSlots: boolean }) {
  const { mech, loadout, upgrades } = build;
  const upgradeNames = getUpgrades(upgrades).map(upgrade => upgrade.name);
  const title = <p className="eyebrow">{caption} · {getMechDisplayName(mech)} {mech.variant}</p>;

  return (
    <article className="compare-card" data-side={side} aria-label={caption}>
      <div className="compare-part compare-part-board">
        <div className="compare-board-caption">
          {title}
          <MechSpecs mech={mech} />
          <HardpointSummary mech={mech} />
          {upgradeNames.length > 0 && <p className="compare-upgrades"><b>Upgrades:</b> {upgradeNames.join(', ')}</p>}
        </div>
        {/* Solo se mira: inert le quita los clics, el foco, los menús y el arrastre. */}
        <div className="compare-board" inert>
          <MechBoard
            mech={mech}
            loadout={loadout}
            armor={build.armor}
            activeZone={null}
            selectedHardpoint={null}
            reference={null}
            onSelectZone={ignore}
            onArmorChange={ignore}
            onHardpointMenu={ignore}
            onEquipmentMenu={ignore}
            expandedSlots={expandedSlots}
            compact
            armorScale={getArmorScale(getUpgrades(upgrades))}
          />
        </div>
      </div>
      <div className="compare-part compare-part-stats">
        {title}
        <CardStats groups={groups} side={side} />
      </div>
    </article>
  );
}

// Compara la build del tablero con la build de serie de otro 'Mech o con una build guardada.
export function ComparePanel({ mechs, catalog, current, savedBuilds, expandedSlots, onLoad, onClose }: ComparePanelProps) {
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

      {/* Rejilla de dos columnas: el título va encima de la build actual y los controles encima de
          la comparada, en la misma fila, y las dos tarjetas empiezan a la misma altura. */}
      <div className="compare-cards">
        <header className="compare-title">
          <h2>COMPARE</h2>
          <p>Your current build next to another 'Mech. The better value of each stat is in green.</p>
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
              <select aria-label="Saved build" value={savedId ?? ''} onChange={event => setSavedId(event.target.value)}>
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
          <button type="button" className="share-dialog-close compare-close" aria-label="Close comparison" onClick={onClose}>✕</button>
        </div>
        <CompareCard build={current} caption="CURRENT BUILD" groups={groups} side="a" expandedSlots={expandedSlots} />
        {other
          ? <CompareCard build={other} caption={source === 'saved' ? 'SAVED BUILD' : 'STOCK LOADOUT'} groups={groups} side="b" expandedSlots={expandedSlots} />
          : (
            <article className="compare-card" data-side="b">
              <div className="compare-part compare-part-board">
                <p className="compare-empty">
                  {source === 'saved' && savedBuild ? 'This saved build can no longer be loaded.' : 'Pick a build to compare with.'}
                </p>
              </div>
            </article>
          )}
      </div>

    </section>
  );
}
