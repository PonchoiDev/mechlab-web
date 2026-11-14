import type { Zone } from '../../types/mech';
import type { BtArmorSide, BtBuild, BtItem } from '../../types/battletech-mechlab';
import { SlotBar } from '../../components/SlotBar';
import { ZONE_LABELS } from '../../utils/zones';
import { getArmorLimit } from '../../utils/battletech/armor';
import { getFixedItems, getHardpointViews, getLocationUsage } from '../../utils/battletech/fitting';
import { getItem, getItemWeaponType, HARDPOINT_LABELS } from '../../utils/battletech/mechlabData';
import { BtArmorControl } from './BtArmorControl';
import { BtItemPicker } from './BtItemPicker';
import { useDismiss } from './useDismiss';

// Lo que no cierra el panel al pulsarlo, como en el ComponentEditor de MW5: el panel, las tarjetas, el
// selector de 'Mech y cualquier control.
const KEEPS_EDITOR_OPEN = ['.component-editor', '.component-card', '.mech-picker', 'button', 'a', 'input', 'select', 'textarea', 'label'].join(', ');

interface BtComponentEditorProps {
  build: BtBuild;
  zone: Zone;
  selectedHardpoint: number | null;
  onSelectHardpoint: (index: number | null) => void;
  onMount: (zone: Zone, item: BtItem) => void;
  onRemove: (zone: Zone, index: number) => void;
  onArmorChange: (zone: Zone, side: BtArmorSide, value: number) => void;
  onArmorStep: (zone: Zone, side: BtArmorSide, steps: number) => void;
  onClose: () => void;
}

const formatTonnage = (value: number) => String(Number(value.toFixed(2)));

// Panel de la ubicación elegida, con el marcado del ComponentEditor de MW5: anclajes, lo instalado
// (que se quita con ✕, salvo el equipo fijo del chasis), el equipo que se puede añadir y el blindaje.
export function BtComponentEditor({ build, zone, selectedHardpoint, onSelectHardpoint, onMount, onRemove, onArmorChange, onArmorStep, onClose }: BtComponentEditorProps) {
  useDismiss(onClose, KEEPS_EDITOR_OPEN);
  const { mech, loadout, armor } = build;
  const label = ZONE_LABELS[zone];
  const location = mech.locations[zone];
  const usage = getLocationUsage(mech, loadout, zone);
  const hardpoints = getHardpointViews(mech, loadout, zone);
  const fixed = getFixedItems(mech, zone);
  const selected = selectedHardpoint === null ? null : hardpoints[selectedHardpoint] ?? null;
  const installed = loadout[zone].map((id, index) => ({ item: getItem(id), index }))
    .filter((entry): entry is { item: BtItem; index: number } => entry.item !== undefined);
  const frontMax = getArmorLimit(mech, zone, 'front');
  const rearMax = location.maxRearArmor;

  return (
    <aside className="component-editor bt-component-editor" aria-label={`${label} editor`}>
      <header className="editor-header">
        <div>
          <p className="eyebrow">COMPONENT</p>
          <h2>{label}</h2>
        </div>
        <span className="editor-header-actions">
          <button type="button" className="editor-close" aria-label="Close editor" onClick={onClose}>✕</button>
        </span>
      </header>

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Hardpoints</h3>
          {selectedHardpoint !== null && (
            <button type="button" className="editor-link" onClick={() => onSelectHardpoint(null)}>Show all</button>
          )}
        </div>
        {hardpoints.length > 0 ? (
          <>
          <div className="editor-hardpoints">
            {hardpoints.map((view, index) => (
              <button
                key={index}
                type="button"
                className={['hardpoint-chip', view.item ? 'is-occupied' : 'is-free', selectedHardpoint === index ? 'is-selected' : ''].filter(Boolean).join(' ')}
                data-weapon-type={view.type}
                aria-pressed={selectedHardpoint === index}
                onClick={() => onSelectHardpoint(selectedHardpoint === index ? null : index)}
              >
                <span className="hardpoint-chip-label">{HARDPOINT_LABELS[view.type]}</span>
                <span className="hardpoint-chip-content">
                  <span className="hardpoint-chip-name">{view.item?.name ?? 'Free'}</span>
                </span>
              </button>
            ))}
          </div>
          {selected?.item && selected.index !== null && (
            <div className="editor-occupied">
              <p className="editor-empty">{selected.item.name} is mounted in this hardpoint.</p>
              <button type="button" className="editor-link" onClick={() => { onRemove(zone, selected.index!); onSelectHardpoint(null); }}>
                Remove it
              </button>
            </div>
          )}
          </>
        ) : (
          <p className="editor-empty">This location has no weapon hardpoints.</p>
        )}
      </section>

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Installed <span>{fixed.length + installed.length}</span></h3>
        </div>
        <div className="editor-slots">
          <SlotBar used={usage.slots.used} capacity={usage.slots.capacity} label="Slots" />
        </div>
        {fixed.length + installed.length === 0 ? (
          <p className="editor-empty">Nothing installed yet.</p>
        ) : (
          <div className="installed-list">
            {fixed.map((item, index) => (
              <div key={`fixed-${index}`} className="installed-item is-built-in" data-weapon-type={getItemWeaponType(item)} title={item.bonuses.join(' · ')}>
                <span className="installed-item-name">{item.name} <small>{item.slots} sl · {formatTonnage(item.tonnage)} t</small></span>
                <span className="built-in-tag">BUILT-IN</span>
              </div>
            ))}
            {installed.map(({ item, index }) => (
              <div key={`${item.id}-${index}`} className="installed-item" data-weapon-type={getItemWeaponType(item)}>
                <span className="installed-item-name">{item.name} <small>{item.slots} sl · {formatTonnage(item.tonnage)} t</small></span>
                <button type="button" className="remove-item" aria-label={`Remove ${item.name}`} onClick={() => onRemove(zone, index)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <BtItemPicker build={build} zone={zone} onMount={onMount} />

      <section className="editor-section">
        <div className="editor-section-heading">
          <h3>Armor <span>{armor[zone].front + armor[zone].rear} / {frontMax + (rearMax ?? 0)}</span></h3>
          <span className="editor-note">Structure {location.structure}</span>
        </div>
        <BtArmorControl
          label={`${label} front armor`}
          shortLabel="F"
          value={armor[zone].front}
          max={frontMax}
          onChange={(value) => onArmorChange(zone, 'front', value)}
          onStep={(steps) => onArmorStep(zone, 'front', steps)}
        />
        {rearMax !== null && (
          <BtArmorControl
            label={`${label} rear armor`}
            shortLabel="R"
            value={armor[zone].rear}
            max={rearMax}
            onChange={(value) => onArmorChange(zone, 'rear', value)}
            onStep={(steps) => onArmorStep(zone, 'rear', steps)}
          />
        )}
      </section>
    </aside>
  );
}
