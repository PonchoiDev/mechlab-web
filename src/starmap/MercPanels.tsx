import { useMemo, useState } from 'react';
import type { GameDate, StarmapData } from '../types/starmap';
import { getCompanyZonesAt, getMercOwnerAt, getMercZonesAt } from '../utils/mercs';
import { formatGameDate } from '../utils/starmap';

const LOGO_PATH = `${import.meta.env.BASE_URL}starmap/logos/`;

const systemNames = (data: StarmapData, ids: number[]) =>
  ids.map(id => data.systems.find(system => system.id === id)?.name ?? '').filter(Boolean);

function CompanyLogo({ data, companyId }: { data: StarmapData; companyId: string }) {
  const logo = data.mercs.companies[companyId]?.logo;
  return logo ? <img className="starmap-merc-logo" src={LOGO_PATH + logo} alt="" /> : null;
}

interface MercDrawerProps {
  data: StarmapData;
  date: GameDate;
  selectedId: string | null;
  onPick: (companyId: string) => void;
}

// Compañías de mercenarios rivales (DLC4), con cuántas zonas ocupan en la fecha del mapa.
export function MercDrawer({ data, date, selectedId, onPick }: MercDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const companies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { owner } of getMercZonesAt(data, date)) {
      if (owner.company) counts.set(owner.company, (counts.get(owner.company) ?? 0) + 1);
    }
    return Object.entries(data.mercs.companies)
      .map(([id, company]) => ({ id, company, zones: counts.get(id) ?? 0 }))
      .sort((a, b) => b.zones - a.zones || a.company.name.localeCompare(b.company.name));
  }, [data, date]);

  return (
    <section className={`starmap-legend starmap-quests starmap-mercs-drawer${isOpen ? ' is-open' : ''}`} aria-label="Rival mercs">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
      >
        Rival mercs <b>{companies.length}</b>
      </button>
      {isOpen && (
        <div className="starmap-quests-body">
          <p className="starmap-market-note">Mercenary companies (DLC 4) and the zones they hold on {formatGameDate(date)}</p>
          <ul>
            {companies.map(({ id, company, zones }) => (
              <li key={id}>
                <button
                  type="button"
                  className="starmap-merc-item"
                  aria-pressed={id === selectedId}
                  onClick={() => {
                    // Se cierra para que no tape lo que el mapa encuadra.
                    setIsOpen(false);
                    onPick(id);
                  }}
                >
                  <CompanyLogo data={data} companyId={id} />
                  <span>{company.name}</span>
                  <small>{zones === 0 ? 'No zones on this date' : zones === 1 ? '1 zone' : `${zones} zones`}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

interface MercCardProps {
  data: StarmapData;
  companyId: string;
  date: GameDate;
  onSystem: (systemId: number) => void;
  onClose: () => void;
}

// Ficha de una compañía: nivel, descripción y las zonas que ocupa en la fecha del mapa.
export function MercCard({ data, companyId, date, onSystem, onClose }: MercCardProps) {
  const company = data.mercs.companies[companyId];
  if (!company) return null;
  const zones = getCompanyZonesAt(data, companyId, date);
  return (
    <section className="starmap-panel is-pinned starmap-merc" aria-label={company.name}>
      <div className="starmap-panel-head">
        <span className="starmap-merc-mark" aria-hidden="true"><CompanyLogo data={data} companyId={companyId} /></span>
        <div>
          <h2>{company.name}</h2>
          <p>Rival mercs · DLC 4{company.skill && ` · ${company.skill} pilots`}</p>
        </div>
        <button type="button" className="starmap-close" onClick={onClose} aria-label="Close company details">✕</button>
      </div>
      <dl className="starmap-tags">
        <div>
          <dt>Zones on {formatGameDate(date)}</dt>
          <dd>
            {zones.length === 0 && <p className="starmap-merc-none">None on this date</p>}
            <ul className="starmap-merc-zones">
              {zones.map(zone => {
                const owner = getMercOwnerAt(zone, date);
                return (
                  <li key={zone.id}>
                    {zone.systems.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ', '}
                        <button type="button" className="starmap-system-link" onClick={() => onSystem(id)}>{systemNames(data, [id])[0]}</button>
                      </span>
                    ))}
                    <small>Since {formatGameDate(owner.from)}{owner.careerOnly && ' · Career only'}</small>
                  </li>
                );
              })}
            </ul>
          </dd>
        </div>
      </dl>
      {company.description && <p className="starmap-zone-description">{company.description}</p>}
    </section>
  );
}
