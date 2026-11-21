import { useMemo, useState } from 'react';
import type { BtBuild, BtMech } from '../../types/battletech-mechlab';
import type { ComparisonGroup } from '../../utils/compare';
import { EMPTY_VALUE } from '../../utils/format';
import type { SavedBuild } from '../../utils/savedBuildsCore';
import { decodeBtBuild } from '../../utils/battletech/buildCode';
import { BT_BUILD_LIST, summarizeBtSavedBuild } from '../../utils/battletech/savedBuildRows';
import { BT_BUILD_SORT_KEY } from '../../hooks/useBuildSort';
import { useBuildListFilters } from '../../hooks/useBuildListFilters';
import { SavedBuildPicker } from '../../components/SavedBuildPicker';
import { compareBtBuilds, groupBtLoadout } from '../../utils/battletech/compare';
import { createStockBuild } from '../../utils/battletech/fitting';
import { SOURCE_LABELS, WEIGHT_CLASS_LABELS } from '../../utils/battletech/mechlabData';
import { BtMechPicker, HardpointSummary } from './BtMechPicker';
import { MechIcon } from './MechIcon';
import { useDismiss } from './useDismiss';

// La comparación se cierra con su ✕, con Escape o con un clic fuera; la barra de herramientas (que la
// abre y la cierra) y los diálogos no cuentan como fuera.
const KEEPS_COMPARE_OPEN = '.compare-panel, .utility-toolbar, .share-dialog-backdrop, .toast';

interface BtComparePanelProps {
  mechs: BtMech[];
  current: BtBuild;
  savedBuilds: SavedBuild[];
  // Build guardada con la que abrir, desde el botón Compare de la ventana My builds.
  initialSavedId?: string | null;
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

// Las cifras de un lado, con el marcado del CardStats de MW5: el valor mejor, resaltado y con la diferencia.
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

// Tarjeta de un lado, como la CompareCard de MW5: el icono del chasis, su ficha, su loadout por
// ubicación (con el equipo fijo) y sus cifras.
function CompareCard({ build, caption, groups, side }: { build: BtBuild; caption: string; groups: ComparisonGroup[]; side: 'a' | 'b' }) {
  const { mech, loadout } = build;
  const loadoutGroups = groupBtLoadout(mech, loadout);
  return (
    <article className="compare-card">
      <p className="eyebrow">{caption}</p>
      <div className="compare-card-head">
        <div className="compare-card-image bt-compare-icon"><MechIcon mech={mech} size={96} /></div>
        <div className="compare-card-title">
          <h3>{mech.name} <span>{mech.variant}</span></h3>
          <span className="mech-specs">
            <span className="mech-spec">{mech.tonnage} T</span>
            <span className="mech-spec">{WEIGHT_CLASS_LABELS[mech.weightClass].toUpperCase()}</span>
            {mech.source !== 'base' && <span className="mech-spec is-xl">{SOURCE_LABELS[mech.source].toUpperCase()}</span>}
          </span>
          <HardpointSummary mech={mech} />
        </div>
      </div>
      {loadoutGroups.length > 0 ? (
        <dl className="compare-loadout">
          {loadoutGroups.map(group => (
            <div key={group.zone} className="compare-loadout-zone">
              <dt>{group.label}</dt>
              <dd>
                {group.items.map(line => (
                  <span key={`${line.name}-${line.fixed}`} className={`compare-item is-${line.type}`} data-weapon-type={line.weaponType}>
                    {line.name}
                    {line.count > 1 && <small> ×{line.count}</small>}
                    {line.fixed && <small> · built-in</small>}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="compare-empty">No equipment installed.</p>
      )}
      {/* Siempre presente, aunque vacío, como en MW5: las dos tarjetas ocupan las mismas filas. */}
      <p className="compare-upgrades" />
      <CardStats groups={groups} side={side} />
    </article>
  );
}

// Compara la build del tablero con la de serie de otra variante o con una build guardada, con el
// marcado del ComparePanel de MW5.
export function BtComparePanel({ mechs, current, savedBuilds, initialSavedId = null, onLoad, onClose }: BtComparePanelProps) {
  useDismiss(onClose, KEEPS_COMPARE_OPEN);
  const [source, setSource] = useState<Source>(initialSavedId ? 'saved' : 'stock');
  const [stockMech, setStockMech] = useState(() => defaultMech(mechs, current.mech));
  const [savedId, setSavedId] = useState<string | null>(initialSavedId ?? savedBuilds[0]?.id ?? null);
  const savedFilters = useBuildListFilters(BT_BUILD_SORT_KEY);
  const savedEntries = useMemo(() => savedBuilds.map(build => summarizeBtSavedBuild(build)), [savedBuilds]);
  const savedBuild = savedBuilds.find(build => build.id === savedId) ?? null;
  const other = useMemo(() => {
    if (source === 'saved') return savedBuild ? decodeBtBuild(savedBuild.code) : null;
    return createStockBuild(stockMech);
  }, [source, savedBuild, stockMech]);
  const otherLabel = source === 'saved' && savedBuild ? savedBuild.name : other ? `stock ${other.mech.variant}` : '';
  const groups = useMemo(() => other ? compareBtBuilds(current, other) : [], [current, other]);

  return (
    <section className="compare-panel" aria-label="Compare 'Mechs">
      <div className="compare-cards">
        <header className="compare-title">
          <h2>COMPARE</h2>
          <p>Your current build next to another 'Mech. The better value of each stat is highlighted.</p>
        </header>
        <div className="compare-source">
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
            <SavedBuildPicker
              entries={savedEntries}
              selectedId={savedId}
              onSelect={setSavedId}
              config={BT_BUILD_LIST}
              filters={savedFilters}
            />
          ) : (
            <p className="compare-empty">No saved builds yet. Use Save build in the toolbar to keep one and compare it here.</p>
          )}
          {other && (
            <button type="button" className="utility-button utility-button-primary" onClick={() => onLoad(other, otherLabel, source === 'saved' ? savedId : null)}>
              Load this build
            </button>
          )}
          <button type="button" className="share-dialog-close compare-close" aria-label="Close comparison" onClick={onClose}>✕</button>
        </div>
        <CompareCard build={current} caption="CURRENT BUILD" groups={groups} side="a" />
        {other
          ? <CompareCard build={other} caption={source === 'saved' ? 'SAVED BUILD' : 'STOCK LOADOUT'} groups={groups} side="b" />
          : (
            <article className="compare-card">
              <p className="compare-empty">
                {source === 'saved' && savedBuild ? 'This saved build can no longer be loaded.' : 'Pick a build to compare with.'}
              </p>
            </article>
          )}
      </div>
    </section>
  );
}
