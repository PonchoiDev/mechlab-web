import { useMemo, useState } from 'react';
import type { Zone } from '../../types/mech';
import type { BtBuild, BtItem } from '../../types/battletech-mechlab';
import { CheckboxDropdown } from '../../components/CheckboxDropdown';
import { ZONE_LABELS, ZONES } from '../../utils/zones';
import {
  DEFAULT_ITEM_FILTERS,
  filterBtItems,
  getPreferredTab,
  getWeaponDamage,
  ITEM_SORTS,
  ITEM_TABS,
  RARITY_GROUPS,
  type BtItemFilters
} from '../../utils/battletech/filters';
import { describeMountProblem, findMountZone, getMountProblem } from '../../utils/battletech/fitting';
import { BT_ITEMS, SOURCE_LABELS, SOURCES } from '../../utils/battletech/mechlabData';

interface BtItemPickerProps {
  build: BtBuild;
  zone: Zone;
  onZoneChange: (zone: Zone) => void;
  onMount: (zone: Zone, item: BtItem) => void;
}

const VERSIONS = [0, 1, 2, 3];
// Flashpoint no trae objetos propios: solo salen las fuentes que tienen alguno.
const ITEM_SOURCES = SOURCES.filter(source => BT_ITEMS.some(item => item.source === source));
const versionLabel = (plus: number) => plus === 0 ? 'Stock' : '+'.repeat(plus);
const toggle = <T,>(list: T[], value: T) => list.includes(value) ? list.filter(entry => entry !== value) : [...list, value];
const summarize = (labels: string[]) => labels.length === 0 ? 'All' : labels.length <= 2 ? labels.join(', ') : `${labels.length} selected`;
const formatNumber = (value: number) => String(Number(value.toFixed(2)));
const formatCost = (value: number) => value >= 1000 ? `${formatNumber(value / 1000)}k` : String(value);

// Las cifras que importan de cada objeto, como en las fichas del mechlab del juego.
function ItemStats({ item }: { item: BtItem }) {
  const stats: [string, string][] = [];
  if (item.weapon) {
    const { minRange, maxRange, instability, shots, heat, heatDamage } = item.weapon;
    stats.push(['Dmg', `${formatNumber(getWeaponDamage(item))}${shots > 1 ? ` (${shots}×${formatNumber(item.weapon.damage)})` : ''}`]);
    stats.push(['Heat', formatNumber(heat)]);
    if (instability > 0) stats.push(['Stab', formatNumber(instability * shots)]);
    if (heatDamage > 0) stats.push(['Heat dmg', formatNumber(heatDamage * shots)]);
    stats.push(['Range', `${minRange > 0 ? `${minRange}-` : ''}${maxRange} m`]);
  }
  if (item.ammo) stats.push(['Shots', String(item.ammo.capacity)]);
  if (item.heatSink) {
    if (item.heatSink.dissipation > 0) stats.push(['Sinks', String(item.heatSink.dissipation)]);
    if (item.heatSink.maxHeat > 0) stats.push(['Max heat', `+${item.heatSink.maxHeat}`]);
    if (item.heatSink.weaponHeatMultiplier !== 1) stats.push(['Weapon heat', `×${item.heatSink.weaponHeatMultiplier}`]);
  }
  if (item.jumpJet) stats.push(['For', `${item.jumpJet.minTonnage}-${item.jumpJet.maxTonnage} t`]);
  stats.push(['Weight', `${formatNumber(item.tonnage)} t`], ['Slots', String(item.slots)]);
  return (
    <dl className="bt-item-stats">
      {stats.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

// Selector de objetos de la ubicación elegida: pestañas por categoría, filtros de versión, fuente y
// rareza, búsqueda y orden. Cada objeto dice si cabe y, si no, por qué.
export function BtItemPicker({ build, zone, onZoneChange, onMount }: BtItemPickerProps) {
  const [filters, setFilters] = useState<BtItemFilters>(() =>
    ({ ...DEFAULT_ITEM_FILTERS, tab: getPreferredTab(build.mech, build.loadout, zone, DEFAULT_ITEM_FILTERS.tab) }));
  const [fitsOnly, setFitsOnly] = useState(false);
  // Al cambiar de ubicación (o de 'Mech) se abre la pestaña de un anclaje que tenga sitio allí.
  const [shown, setShown] = useState({ zone, mechId: build.mech.id });
  if (shown.zone !== zone || shown.mechId !== build.mech.id) {
    setShown({ zone, mechId: build.mech.id });
    setFilters(current => ({ ...current, tab: getPreferredTab(build.mech, build.loadout, zone, current.tab) }));
  }
  const matching = useMemo(() => filterBtItems(BT_ITEMS, filters), [filters]);
  const items = fitsOnly ? matching.filter(item => !getMountProblem(build.mech, build.loadout, zone, item)) : matching;
  const update = (changes: Partial<BtItemFilters>) => setFilters(current => ({ ...current, ...changes }));
  const isWeaponTab = items.some(item => item.weapon) || ['energy', 'ballistic', 'missile', 'support'].includes(filters.tab);

  return (
    <section className="bt-item-picker" aria-label="Equipment">
      <header className="bt-item-picker-header">
        <h2>Equipment</h2>
        <label className="bt-zone-select">
          <span>MOUNT IN</span>
          <select value={zone} onChange={(event) => onZoneChange(event.target.value as Zone)}>
            {ZONES.map(({ zone: option, label }) => <option key={option} value={option}>{label}</option>)}
          </select>
        </label>
      </header>

      <div className="editor-tabs bt-item-tabs" role="tablist" aria-label="Category">
        {ITEM_TABS.map(({ tab, label }) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={filters.tab === tab}
            className={filters.tab === tab ? 'editor-tab is-active' : 'editor-tab'}
            data-category={tab}
            onClick={() => update({ tab, sort: !['energy', 'ballistic', 'missile', 'support'].includes(tab) && ITEM_SORTS.find(sort => sort.sort === filters.sort)?.weaponsOnly ? 'name' : filters.sort })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bt-item-filters">
        <input
          type="search"
          className="editor-search"
          placeholder="Search name or manufacturer"
          aria-label="Search equipment"
          value={filters.query}
          onChange={(event) => update({ query: event.target.value })}
        />
        <div className="mech-filter-row">
          <button
            type="button"
            className="mech-filter-chip"
            aria-pressed={fitsOnly}
            title={`Only what fits in the ${ZONE_LABELS[zone].toLowerCase()} right now`}
            onClick={() => setFitsOnly(current => !current)}
          >
            Fits here
          </button>
          <span className="mech-filter-label">VERSION</span>
          {VERSIONS.map(plus => (
            <button
              key={plus}
              type="button"
              className="mech-filter-chip"
              aria-pressed={filters.plus.includes(plus)}
              title={plus === 0 ? 'Stock version' : `Manufacturer variant with ${plus} plus`}
              onClick={() => update({ plus: toggle(filters.plus, plus) })}
            >
              {versionLabel(plus)}
            </button>
          ))}
        </div>
        <div className="mech-filter-row">
          <span className="mech-filter-label">SOURCE</span>
          <CheckboxDropdown
            label="Source"
            title="Base game or the DLC that adds the item"
            options={ITEM_SOURCES.map(source => ({ value: source, label: SOURCE_LABELS[source] }))}
            selected={filters.sources}
            summary={summarize(filters.sources.map(source => SOURCE_LABELS[source]))}
            onToggle={(source) => update({ sources: toggle(filters.sources, source) })}
            onClear={() => update({ sources: [] })}
          />
          <span className="mech-filter-label">RARITY</span>
          <CheckboxDropdown
            label="Rarity"
            title="How often stores sell it, from the game data"
            options={RARITY_GROUPS.map(({ group, label }) => ({ value: group, label }))}
            selected={filters.rarities}
            summary={summarize(filters.rarities.map(group => RARITY_GROUPS.find(entry => entry.group === group)!.label))}
            onToggle={(group) => update({ rarities: toggle(filters.rarities, group) })}
            onClear={() => update({ rarities: [] })}
          />
        </div>
        <div className="mech-filter-row">
          <label className="mech-filter-label" htmlFor="bt-item-sort">SORT</label>
          <select id="bt-item-sort" className="mech-filter-year" value={filters.sort} onChange={(event) => update({ sort: event.target.value as BtItemFilters['sort'] })}>
            {ITEM_SORTS.filter(sort => isWeaponTab || !sort.weaponsOnly).map(({ sort, label }) => <option key={sort} value={sort}>{label}</option>)}
          </select>
          <span className="bt-item-count">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
        </div>
      </div>

      <ul className="bt-item-list">
        {items.length === 0 && <li className="mech-no-results">Nothing matches these filters</li>}
        {items.map(item => {
          const problem = getMountProblem(build.mech, build.loadout, zone, item);
          const elsewhere = problem && problem !== 'builtIn' && problem !== 'jumpJetTonnage' && problem !== 'jumpJetLimit'
            ? findMountZone(build.mech, build.loadout, item)
            : null;
          return (
            <li key={item.id} className={problem ? 'bt-item-option is-blocked' : 'bt-item-option'} data-weapon-type={item.hardpoint ?? undefined} data-category={item.kind === "weapon" ? item.hardpoint : item.kind}>
              <div className="bt-item-option-main">
                <strong>{item.name}</strong>
                <span className="bt-item-option-meta">
                  {[item.manufacturer, item.source !== 'base' ? SOURCE_LABELS[item.source] : null, item.lostech ? 'Lostech' : null, `${formatCost(item.cost)} C-Bills`].filter(Boolean).join(' · ')}
                </span>
                <ItemStats item={item} />
                {item.bonuses.length > 0 && <p className="bt-item-bonuses">{item.bonuses.join(' · ')}</p>}
                {problem && <p className="bt-item-problem">{describeMountProblem(problem, build.mech, zone, item)}</p>}
              </div>
              <div className="bt-item-option-actions">
                <button
                  type="button"
                  className="utility-button utility-button-primary"
                  disabled={problem !== null}
                  aria-label={`Add ${item.name} to the ${ZONE_LABELS[zone].toLowerCase()}`}
                  onClick={() => onMount(zone, item)}
                >
                  Add
                </button>
                {elsewhere && (
                  <button type="button" className="utility-button" onClick={() => onMount(elsewhere, item)} title={`Add to the ${ZONE_LABELS[elsewhere].toLowerCase()}`}>
                    To {ZONE_LABELS[elsewhere]}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
