import type { ReactNode } from 'react';
import type { ArmorState, EquippedItem, EquippedLoadout, Mech } from '../types/mech';
import { ZONES } from '../utils/zones';

interface BuildPreviewProps {
  mech: Mech;
  loadout: EquippedLoadout;
  armor: ArmorState;
  reference: ReactNode;
}

const getArmorWidth = (points: number, maxArmor: number) =>
  `${maxArmor > 0 ? points / maxArmor * 100 : 0}%`;

function PreviewItemGroup({ title, items }: { title: string; items: EquippedItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="preview-item-group">
      <h4>{title}</h4>
      {items.map(item => (
        <span key={item.instanceId} className="preview-equipped-item">{item.name}</span>
      ))}
    </section>
  );
}

export function BuildPreview({ mech, loadout, armor, reference }: BuildPreviewProps) {
  const fittedItemCount = Object.values(loadout).flat().length;

  return (
    <section className="build-preview" aria-label="Final build preview">
      <header className="preview-heading">
        <div>
          <p className="eyebrow">04 / FINAL CONFIGURATION</p>
          <h2>{mech.name} <span>{mech.variant}</span></h2>
        </div>
        <p className="preview-hint">COMPONENT LOADOUT / {fittedItemCount} ITEMS FITTED</p>
      </header>
      <div className="preview-board">
        <div className="preview-mech">
          {reference}
        </div>
        {ZONES.map(({ zone, label, position }) => {
          const items = loadout[zone];
          const partArmor = armor[zone];
          const { maxArmor, hasRearArmor } = mech.components[zone];

          return (
            <article key={zone} className={`preview-component preview-${position}`}>
              <header>
                <h3>{label}</h3>
                <span>{items.length.toString().padStart(2, '0')}</span>
              </header>
              <div className="preview-armor" aria-label={`Armor: ${partArmor.front} front${hasRearArmor ? `, ${partArmor.rear} rear` : ''}, ${maxArmor} maximum`}>
                <div className="preview-armor-values">
                  <span className="preview-armor-front-label">FRONT {partArmor.front}</span>
                  {hasRearArmor && (
                    <span className="preview-armor-rear-label">REAR {partArmor.rear}</span>
                  )}
                  <strong>{partArmor.front + partArmor.rear}/{maxArmor}</strong>
                </div>
                <div className="preview-armor-track" aria-hidden="true">
                  <span className="preview-armor-front" style={{ width: getArmorWidth(partArmor.front, maxArmor) }} />
                  {hasRearArmor && (
                    <span className="preview-armor-rear" style={{ width: getArmorWidth(partArmor.rear, maxArmor) }} />
                  )}
                </div>
              </div>
              <div className="preview-component-items">
                <PreviewItemGroup title="WEAPONS" items={items.filter(item => item.type === 'weapon')} />
                <PreviewItemGroup title="EQUIPMENT / AMMO" items={items.filter(item => item.type !== 'weapon')} />
                {items.length === 0 && <span className="preview-empty">No equipment</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
