import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { BrandMark } from '../components/BrandMark';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SiteNav } from '../components/SiteNav';
import { SupportLink } from '../components/SupportLink';
import type { Zone } from '../types/mech';
import type { YamlBuild, YamlMech } from '../types/yaml-mechlab';
import {
  distributeDynamicFillers, getBuildIssues, getHardpointUsage, getInternalLabel, getInternalOptions, getMountOptions,
  getZoneRows, INTERNAL_SLOT_LABELS, INTERNAL_SLOTS, type MountCategory, removeItemAt, setArmor, setMaxArmor, ZONES
} from '../utils/yaml/board';
import { checkInternal, createStockBuild, mountItem, mountWeapon, removeWeapon, setInternal, stripBuild } from '../utils/yaml/build';
import { decodeYamlBuild, encodeYamlBuild } from '../utils/yaml/buildCode';
import { findYamlMech, getYamlQuirk, yamlMechs } from '../utils/yaml/data';
import {
  getArmorPoints, getBuildTonnage, getDynamicFillers, getHeat, getStructurePoints, getTopSpeed, getTotalFreeGeneralSlots
} from '../utils/yaml/stats';

const DEFAULT_MECH = 'NSR-9J';
const ZONE_LABELS: Record<Zone, string> = {
  head: 'Head', centerTorso: 'Center torso', leftTorso: 'Left torso', rightTorso: 'Right torso',
  leftArm: 'Left arm', rightArm: 'Right arm', leftLeg: 'Left leg', rightLeg: 'Right leg'
};
const HARDPOINT_LABELS: Record<string, string> = {
  ballistic: 'B', energy: 'E', missile: 'M', omni: 'O', ams: 'AMS', artillery: 'ART'
};
const CATEGORIES: { id: MountCategory; label: string }[] = [
  { id: 'weapons', label: 'Weapons' }, { id: 'ammo', label: 'Ammo' }, { id: 'equipment', label: 'Equipment' }
];
// Los actuadores con el nombre del mechlab del juego (Shoulder, Upper arm...), no el del dato.
const ACTUATOR_LABELS: Record<string, string> = {
  Shoulder: 'Shoulder', UpperActuator: 'Upper', LowerActuator: 'Lower', HandActuator: 'Hand',
  Hip: 'Hip', FootActuator: 'Foot'
};
const slotsLabel = (slots: number) => `${slots} ${slots === 1 ? 'slot' : 'slots'}`;
const mechLabel = (mech: YamlMech) => `${mech.chassis} ${mech.variant} (${mech.tonnage} t)`;
const MECH_OPTIONS = [...yamlMechs].sort((a, b) => mechLabel(a).localeCompare(mechLabel(b)));
const formatTons = (tons: number) => (Number.isInteger(tons) ? String(tons) : tons.toFixed(2));

// El estado inicial sale del enlace: una build compartida (?b=) o la de serie de una variante (?mech=).
function initialState(): { mech: YamlMech; build: YamlBuild } {
  const params = new URLSearchParams(window.location.search);
  const shared = params.get('b') ? decodeYamlBuild(params.get('b')!) : null;
  const sharedMech = shared ? findYamlMech(shared.mechId) : undefined;
  if (shared && sharedMech) return { mech: sharedMech, build: shared.build };
  const mech = findYamlMech(params.get('mech') ?? '') ?? findYamlMech(DEFAULT_MECH)!;
  return { mech, build: createStockBuild(mech) };
}

export function YamlApp() {
  const [{ mech, build }, setState] = useState(initialState);
  const [zone, setZone] = useState<Zone>('rightArm');
  const [category, setCategory] = useState<MountCategory>('weapons');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const setBuild = (next: YamlBuild) => setState({ mech, build: next });
  const shareUrl = `${window.location.origin}${window.location.pathname}?b=${encodeYamlBuild(mech.id, build)}`;

  useEffect(() => {
    window.history.replaceState(null, '', `?b=${encodeYamlBuild(mech.id, build)}`);
  }, [mech, build]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const tonnage = getBuildTonnage(mech, build);
  const heat = getHeat(mech, build);
  const armor = getArmorPoints(mech, build);
  const structure = getStructurePoints(mech, build);
  const issues = getBuildIssues(mech, build);
  const fillers = useMemo(() => distributeDynamicFillers(mech, build), [mech, build]);
  const options = useMemo(() => getMountOptions(mech, build, zone, category, query), [mech, build, zone, category, query]);

  const chooseMech = (id: string) => {
    const next = findYamlMech(id);
    if (next) setState({ mech: next, build: createStockBuild(next) });
  };

  const changeInternal = (slotType: string, itemId: string) => {
    const reason = itemId ? checkInternal(mech, build, slotType, itemId) : null;
    if (reason) {
      setNotice(reason);
      return;
    }
    setBuild(setInternal(build, slotType, itemId || null));
  };

  const mount = (itemId: string) => {
    const result = category === 'weapons' ? mountWeapon(mech, build, zone, itemId) : mountItem(mech, build, zone, itemId);
    if (result.build) setBuild(result.build);
    else setNotice(result.error);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice('Link copied');
    } catch {
      setNotice('Could not copy the link');
    }
  };

  return (
    <div className="units yaml-lab">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <BrandMark />
          <span>MW Builder</span>
        </a>
        <h1>YAML MechLab</h1>
        <SiteNav game="mercs" current="mechlab" className="units-links" />
        <div className="units-actions">
          <button type="button" className="units-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <main className="units-main">
        <section className="units-intro">
          <p>
            Builds with the rules of the Yet Another Mechlab mod (0.99.4.3, with Yet Another Weapon, its Clan version and
            Yet Another Equipment Collection): weapons take critical slots, the engine is a core plus a type, and Endo and
            Ferro take filler slots anywhere in the 'Mech. Weights are checked against the game's mechlab.
          </p>
        </section>

        <section className="yaml-toolbar" aria-label="Build">
          <label className="yaml-picker">
            <span>'Mech</span>
            <select value={mech.id} onChange={event => chooseMech(event.target.value)}>
              {MECH_OPTIONS.map(option => <option key={option.id} value={option.id}>{mechLabel(option)}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setBuild(createStockBuild(mech))}>Stock</button>
          <button type="button" onClick={() => setBuild(stripBuild(build))}>Strip 'Mech</button>
          <button type="button" onClick={() => setBuild(setMaxArmor(mech, build))}>Max armor</button>
          <button type="button" onClick={copyLink}>Copy link</button>
        </section>

        <section className="yaml-readout" aria-label="Stats">
          <div className={tonnage > mech.tonnage ? 'is-bad' : ''}><span>Tonnage</span><strong>{formatTons(tonnage)} / {mech.tonnage}</strong></div>
          <div><span>Speed</span><strong>{getTopSpeed(mech, build)} km/h</strong></div>
          <div><span>Armor</span><strong>{armor.installed}{armor.bonus ? ` +${armor.bonus}` : ''}</strong></div>
          <div><span>Structure</span><strong>{structure.total}</strong></div>
          <div><span>Cooling</span><strong>{heat.cooling}</strong></div>
          <div><span>Heat capacity</span><strong>{heat.capacity}</strong></div>
          <div><span>Free slots</span><strong>{getTotalFreeGeneralSlots(mech, build) - getDynamicFillers(build)}</strong></div>
        </section>

        {mech.quirks.length > 0 && (
          <ul className="yaml-quirks" aria-label="Quirks">
            {mech.quirks.map(id => {
              const quirk = getYamlQuirk(id);
              return <li key={id} title={quirk?.description}>{quirk?.name ?? id}</li>;
            })}
          </ul>
        )}

        {issues.length > 0 && (
          <ul className="yaml-issues">
            {issues.map(issue => <li key={issue.message} className={`is-${issue.severity}`}>{issue.message}</li>)}
          </ul>
        )}

        <div className="yaml-layout">
          <div className="yaml-board">
            {ZONES.map(current => (
              <ZoneCard
                key={current}
                mech={mech}
                build={build}
                zone={current}
                fillers={fillers}
                isSelected={current === zone}
                onSelect={() => setZone(current)}
                onBuild={setBuild}
                onInternal={changeInternal}
              />
            ))}
          </div>

          <aside className="yaml-selector" aria-label={`Add to ${ZONE_LABELS[zone]}`}>
            <h2>Add to {ZONE_LABELS[zone]}</h2>
            <div className="yaml-tabs" role="tablist">
              {CATEGORIES.map(tab => (
                <button key={tab.id} type="button" role="tab" aria-selected={tab.id === category} onClick={() => setCategory(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <input type="search" placeholder="Search by name" value={query} onChange={event => setQuery(event.target.value)} />
            <ul className="yaml-options">
              {options.slice(0, 200).map(option => (
                <li key={option.id} className={option.error ? 'is-blocked' : ''}>
                  <button type="button" disabled={!!option.error} title={option.error} onClick={() => mount(option.id)}>
                    <span className="yaml-option-name">{option.item.name}</span>
                    <span>{slotsLabel(option.item.slots)}</span>
                    <span>{formatTons(option.item.tons)} t</span>
                  </button>
                  {option.error && <small>{option.error}</small>}
                </li>
              ))}
              {options.length === 0 && <li className="yaml-empty">Nothing of this kind fits here.</li>}
            </ul>
          </aside>
        </div>
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog buildUrl={shareUrl} onMessage={setNotice} onClose={() => setIsFeedbackOpen(false)} />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}

interface ZoneCardProps {
  mech: YamlMech;
  build: YamlBuild;
  zone: Zone;
  fillers: Record<Zone, number>;
  isSelected: boolean;
  onSelect: () => void;
  onBuild: (build: YamlBuild) => void;
  onInternal: (slotType: string, itemId: string) => void;
}

function ZoneCard({ mech, build, zone, fillers, isSelected, onSelect, onBuild, onInternal }: ZoneCardProps) {
  const data = mech.zones[zone];
  const internals = INTERNAL_SLOTS.filter(slotType => data.special[slotType]);
  const rows = getZoneRows(mech, build, zone, fillers);
  const armor = build.armor[zone];

  return (
    <section className={`yaml-zone yaml-zone-${zone}${isSelected ? ' is-selected' : ''}`} onClick={onSelect}>
      <header>
        <h3>{ZONE_LABELS[zone]}</h3>
        <span className="yaml-hardpoints">
          {getHardpointUsage(mech, build, zone).map(usage => (
            <span key={usage.type}>{HARDPOINT_LABELS[usage.type] ?? usage.type} {usage.used}/{usage.total}</span>
          ))}
        </span>
      </header>
      <div className="yaml-armor" onClick={event => event.stopPropagation()}>
        <label>
          Armor
          <input type="number" min={0} max={data.maxArmor} value={armor.front}
            onChange={event => onBuild(setArmor(mech, build, zone, 'front', Number(event.target.value)))} />
        </label>
        {data.rear && (
          <label>
            Rear
            <input type="number" min={0} max={data.maxArmor} value={armor.rear}
              onChange={event => onBuild(setArmor(mech, build, zone, 'rear', Number(event.target.value)))} />
          </label>
        )}
        <span>/ {data.maxArmor}</span>
        <span className="yaml-structure">Structure {data.structure}</span>
      </div>
      {internals.length > 0 && (
        <div className="yaml-internals" onClick={event => event.stopPropagation()}>
          {internals.map(slotType => (
            <label key={slotType}>
              <span>{INTERNAL_SLOT_LABELS[slotType]}</span>
              <select value={build.internal[slotType] ?? ''} onChange={event => onInternal(slotType, event.target.value)}>
                <option value="">{getInternalLabel({ ...build, internal: {} }, slotType)}</option>
                {getInternalOptions(slotType, build.internal[slotType]).map(option => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
      {data.actuators.length > 0 && <p className="yaml-actuators">{data.actuators.map(actuator => ACTUATOR_LABELS[actuator] ?? actuator).join(' · ')}</p>}
      <ul className="yaml-slots">
        {rows.map((row, index) => (
          <li key={index} className={`is-${row.kind}`} style={{ '--slots': row.slots } as CSSProperties}>
            {row.kind === 'free' ? <span>{row.slots} free</span> : <span>{row.label}</span>}
            {row.kind !== 'free' && <small>{slotsLabel(row.slots)}</small>}
            {row.kind === 'weapon' && (
              <button type="button" aria-label={`Remove ${row.label}`} onClick={event => { event.stopPropagation(); onBuild(removeWeapon(build, row.hardpoint)); }}>×</button>
            )}
            {row.kind === 'item' && (
              <button type="button" aria-label={`Remove ${row.label}`} onClick={event => { event.stopPropagation(); onBuild(removeItemAt(build, row.index)); }}>×</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
