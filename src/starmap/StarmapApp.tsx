import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import starmapData from '../data/starmap.json';
import type { AvailabilityData, Campaign, GameDate, Quest, StarSystem, StarmapData } from '../types/starmap';
import {
  clampDate,
  countSystemsByOwner,
  dateToDays,
  daysToDate,
  formatGameDate,
  getCurrentEvent,
  getClusterLevels,
  getDistanceToTerra,
  getHubLevels,
  getNextEvent,
  getOwnerAt,
  getOwnerChanges,
  getPreviousEvent,
  parseMapQuery,
  searchSystems,
  toMapQuery
} from '../utils/starmap';
import { getQuestRoute, parseQuestQuery } from '../utils/quests';
import { getCampaignRoute, parseCampaignQuery } from '../utils/campaigns';
import { getFixedSources, getMarketRarity, getMechFocus, isProduced, parseMechQuery } from '../utils/availability';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { WhatsNew } from '../components/WhatsNew';
import { MarketDrawer, SystemMarkets } from './MarketPanels';
import { AcademyCard, AcademyDrawer, SystemAcademies } from './AcademyPanels';
import { parseAcademyQuery } from '../utils/academies';
import { SystemArena, ZoneCard, ZoneLevels } from './ZonePanels';
import { MercCard, MercDrawer } from './MercPanels';
import { getCompanyZonesAt, getMercOwnerAt, getMercZonesAt } from '../utils/mercs';
import { HeroDrawer, MechCard, MechDrawer } from './MechPanels';
import { NOT_SOLD_COLOR, RARITY_COLORS } from './rarityColors';
import { QuestCard, QuestDrawer, SystemQuests } from './QuestPanels';
import { CampaignCard, CampaignDrawer, SystemCampaigns } from './CampaignPanels';
import { StarmapCanvas, type FocusRequest } from './StarmapCanvas';
import { CAMPAIGN_COLOR, type MercZoneLayer, type TerritoryColors } from './renderer';

const data = starmapData as unknown as StarmapData;
const LEGEND_MIN_SYSTEMS = 5;
const URL_DELAY = 250;
const NOTICE_DELAY = 4000;

const LOGO_PATH = `${import.meta.env.BASE_URL}starmap/logos/`;

// Logo del juego dentro de un aro del color de la facción, como en la ficha del juego; sin logo,
// las siglas.
function FactionEmblem({ factionId }: { factionId: string | null }) {
  const faction = factionId ? data.factions[factionId] : null;
  return (
    <span className="starmap-emblem" style={{ '--faction': faction?.color ?? '#5d6470' } as CSSProperties} aria-hidden="true">
      {faction?.logo ? <img src={LOGO_PATH + faction.logo} alt="" /> : faction?.short ?? ''}
    </span>
  );
}

interface SystemPanelProps {
  system: StarSystem;
  date: GameDate;
  pinned: boolean;
  onClose: () => void;
  onQuest: (quest: Quest) => void;
  onCampaign: (campaign: Campaign) => void;
  onAcademy: (academyId: string) => void;
}

function SystemPanel({ system, date, pinned, onClose, onQuest, onCampaign, onAcademy }: SystemPanelProps) {
  const owner = getOwnerAt(system, date);
  const currentIndex = system.owners.findLastIndex(([changedOn]) => changedOn <= date);
  const cluster = system.cluster ? data.clusters[system.cluster]?.name : null;
  const isCapital = system.hub ? data.hubs[system.hub]?.capital === system.id : false;

  return (
    <section className={`starmap-panel${pinned ? ' is-pinned' : ''}`} aria-label={`${system.name} system`}>
      <div className="starmap-panel-head">
        <FactionEmblem factionId={owner} />
        <div>
          <h2>{system.name}</h2>
          <p>{owner ? data.factions[owner].name : 'Unclaimed'}</p>
        </div>
        {pinned && <button type="button" className="starmap-close" onClick={onClose} aria-label="Close system details">✕</button>}
      </div>
      {(system.hub || cluster) && (
        <dl className="starmap-tags">
          {system.hub && (
            <div className="is-hub">
              <dt>Industrial hub</dt>
              <dd>
                {isCapital ? 'Hub capital' : 'Repairs and refits'}
                <ZoneLevels levels={getHubLevels(data, system.hub)} />
              </dd>
            </div>
          )}
          {cluster && (
            <div>
              <dt>Cluster</dt>
              <dd>
                {cluster}
                <ZoneLevels levels={getClusterLevels(data, system.cluster ?? '')} />
              </dd>
            </div>
          )}
        </dl>
      )}
      <SystemQuests data={data} systemId={system.id} onPick={onQuest} />
      <SystemCampaigns data={data} systemId={system.id} onPick={onCampaign} />
      <SystemMarkets data={data} systemId={system.id} date={date} />
      <SystemArena data={data} systemId={system.id} />
      <SystemAcademies data={data} systemId={system.id} date={date} onPick={onAcademy} />
      {system.owners.length > 0 && (
        <ol className="starmap-history" aria-label="Owners over time">
          {system.owners.map(([changedOn, faction], index) => (
            <li key={changedOn} className={index === currentIndex ? 'is-current' : undefined}>
              <time dateTime={changedOn}>{formatGameDate(changedOn)}</time>
              <span style={{ '--faction': faction ? data.factions[faction].color : '#5d6470' } as CSSProperties}>
                {faction ? data.factions[faction].name : 'Unclaimed'}
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="starmap-coordinates">{getDistanceToTerra(system) === 0 ? 'Center of the Inner Sphere' : `${getDistanceToTerra(system)} ly from Terra`}</p>
    </section>
  );
}

interface DateControlProps {
  date: GameDate;
  // Sistemas que cambiaron de dueño en el último salto entre eventos, o null si se movió el control.
  changedCount: number | null;
  onChange: (date: GameDate, isJump: boolean) => void;
}

function DateControl({ date, changedCount, onChange }: DateControlProps) {
  const current = getCurrentEvent(data.events, date);
  const previous = getPreviousEvent(data.events, date);
  const next = getNextEvent(data.events, date);

  return (
    <section className="starmap-date" aria-label="Date">
      <p className="starmap-date-era">{current ? current.name : 'Campaign start'}</p>
      <p className="starmap-date-value">{formatGameDate(date)}</p>
      <p className="starmap-date-changes" aria-live="polite">
        {changedCount !== null && (changedCount === 1 ? '1 system changed hands' : `${changedCount} systems changed hands`)}
      </p>
      <input
        type="range"
        aria-label="Date"
        aria-valuetext={formatGameDate(date)}
        min={dateToDays(data.range.start)}
        max={dateToDays(data.range.end)}
        value={dateToDays(date)}
        onChange={event => onChange(daysToDate(Number(event.target.value)), false)}
      />
      <div className="starmap-date-ticks" aria-hidden="true">
        {data.events.map(event => {
          const span = dateToDays(data.range.end) - dateToDays(data.range.start);
          const left = ((dateToDays(event.date) - dateToDays(data.range.start)) / span) * 100;
          return <span key={event.id} style={{ left: `${left}%` }} />;
        })}
      </div>
      <div className="starmap-date-actions">
        <button type="button" disabled={!previous} onClick={() => previous && onChange(previous.date, true)} aria-label="Previous event">◀</button>
        <select
          aria-label="Jump to event"
          value={current && current.date === date ? current.id : ''}
          onChange={event => {
            const target = data.events.find(candidate => candidate.id === event.target.value);
            if (target) onChange(target.date, true);
          }}
        >
          <option value="">Jump to event…</option>
          {data.events.map(event => <option key={event.id} value={event.id}>{event.date.slice(0, 4)} · {event.name}</option>)}
        </select>
        <button type="button" disabled={!next} onClick={() => next && onChange(next.date, true)} aria-label="Next event">▶</button>
      </div>
    </section>
  );
}

function SystemSearch({ onPick }: { onPick: (system: StarSystem) => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchSystems(data.systems, query), [query]);

  const pick = (system: StarSystem) => {
    onPick(system);
    setQuery('');
    setActive(0);
  };

  return (
    <div className="starmap-search" role="search">
      <input
        type="search"
        placeholder="Search system"
        aria-label="Search system"
        aria-controls="starmap-search-results"
        aria-expanded={results.length > 0}
        value={query}
        onChange={event => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') setActive(index => Math.min(results.length - 1, index + 1));
          else if (event.key === 'ArrowUp') setActive(index => Math.max(0, index - 1));
          else if (event.key === 'Enter' && results[active]) pick(results[active]);
          else if (event.key === 'Escape') setQuery('');
          else return;
          event.preventDefault();
        }}
      />
      {results.length > 0 && (
        <ul id="starmap-search-results" role="listbox" aria-label="Systems">
          {results.map((system, index) => (
            <li key={system.id} role="option" aria-selected={index === active}>
              <button type="button" onClick={() => pick(system)} onMouseEnter={() => setActive(index)}>{system.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FactionLegend({ date }: { date: GameDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const factions = countSystemsByOwner(data.systems, date).filter(([, count]) => count >= LEGEND_MIN_SYSTEMS);
  return (
    <section className={`starmap-legend${isOpen ? ' is-open' : ''}`} aria-label="Factions">
      <button type="button" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>Factions</button>
      {isOpen && (
        <ul>
          {factions.map(([faction, count]) => (
            <li key={faction} className={data.factions[faction].logo ? 'has-logo' : undefined} style={{ '--faction': data.factions[faction].color } as CSSProperties}>
              {data.factions[faction].logo && <img src={LOGO_PATH + data.factions[faction].logo} alt="" />}
              <span>{data.factions[faction].name}</span>
              <b>{count}</b>
            </li>
          ))}
          <li className="is-cluster" style={{ '--faction': data.colors.cluster } as CSSProperties}><span>Cluster</span></li>
          <li className="is-cluster" style={{ '--faction': data.colors.hub } as CSSProperties}><span>Industrial hub</span></li>
        </ul>
      )}
    </section>
  );
}

export function StarmapApp() {
  const initial = useMemo(() => parseMapQuery(window.location.search, data), []);
  const [date, setDate] = useState<GameDate>(initial.date);
  const [jump, setJump] = useState<{ changedCount: number } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initial.systemId);
  const [questId, setQuestId] = useState<string | null>(() => parseQuestQuery(window.location.search, data));
  const quest = data.quests.find(candidate => candidate.id === questId) ?? null;
  // Campaña de un DLC elegida en su panel, en la ficha de un sistema o con ?campaign= en la URL.
  const [campaignId, setCampaignId] = useState<string | null>(() => parseCampaignQuery(window.location.search, data));
  const campaign = data.campaigns.find(candidate => candidate.id === campaignId) ?? null;
  // HRQ de la que la variante elegida es recompensa: su ruta se marca sin abrir su ficha.
  const [mechQuestId, setMechQuestId] = useState<string | null>(null);
  // Sistema de la recompensa (fuera de las HRQ) donde se consigue la variante: se marca como una ruta.
  const [mechMissionSystem, setMechMissionSystem] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  // Zona de conflicto pulsada en el mapa: su ficha se ve si no hay otra encima.
  const [zoneId, setZoneId] = useState<string | null>(null);
  // Mercenarios rivales: sus zonas se dibujan siempre; con una compañía elegida, solo las suyas.
  const [companyId, setCompanyId] = useState<string | null>(null);
  // Academia de pilotos elegida en su panel, en la ficha de un sistema o con ?academy= en la URL.
  const [academyId, setAcademyId] = useState<string | null>(() => parseAcademyQuery(window.location.search, data));
  const academy = data.academies.find(candidate => candidate.id === academyId) ?? null;
  const mercZones = useMemo<MercZoneLayer>(() => {
    return getMercZonesAt(data, date)
      .filter(({ owner }) => !companyId || owner.company === companyId)
      .map(({ zone, owner }) => {
        const company = owner.company ? data.mercs.companies[owner.company] : null;
        return {
          zone,
          logo: company?.logo ? LOGO_PATH + company.logo : null,
          highlighted: owner.company !== null && owner.company === companyId,
          title: company?.name ?? 'Random rotation',
          note: owner.rotating ? 'Mercenary companies take turns here at random' : owner.careerOnly ? 'Career only' : null
        };
      });
  }, [companyId, date]);
  // La rareza de los 'Mechs va en su propio archivo: se descarga al abrir Find a 'Mech o Special 'Mech locations, o
  // al entrar con ?mech= en la URL.
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityFailed, setAvailabilityFailed] = useState(false);
  const [mechId, setMechId] = useState<string | null>(null);
  // La variante de ?mech= se guarda al abrir la página: la URL se reescribe antes de que termine la
  // carga. Se descarta si se elige otra cosa antes de que llegue la rareza.
  const pendingMechRef = useRef(new URLSearchParams(window.location.search).get('mech') ? window.location.search : null);
  const loadingRef = useRef(false);
  const loadAvailability = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setAvailabilityFailed(false);
    import('../data/availability.json').then(module => {
      setAvailability(module.default as unknown as AvailabilityData);
    }).catch(() => {
      loadingRef.current = false;
      setAvailabilityFailed(true);
    });
  }, []);
  const [focus, setFocus] = useState<FocusRequest | null>(() => {
    if (initial.systemId === null && !quest && campaign) return { systemIds: getCampaignRoute(campaign), sequence: 0 };
    const target = initial.systemId ?? quest?.offer ?? academy?.system ?? null;
    return target === null ? null : { systemIds: [target], sequence: 0 };
  });
  const focusOn = useCallback(
    (...systemIds: number[]) => setFocus(previous => ({ systemIds, sequence: (previous?.sequence ?? 0) + 1 })),
    []
  );
  // Encuadra dónde se consigue la variante si es un sitio pequeño, y marca la ruta de su HRQ.
  const focusMech = useCallback((id: string, loaded: AvailabilityData, onDate: GameDate) => {
    const picked = loaded.mechs.find(candidate => candidate.id === id);
    const target = picked ? getMechFocus(data, loaded, picked, onDate) : null;
    setMechQuestId(target?.questId ?? null);
    // Si lo que se encuadra es el sistema de una recompensa (una misión o el de Razer), se marca.
    const mission = target && !target.questId
      ? getFixedSources(data, id).rewards.find(reward => reward.system !== undefined && target.systemIds.includes(reward.system))
      : undefined;
    setMechMissionSystem(mission?.system ?? null);
    if (target && target.systemIds.length > 0) focusOn(...target.systemIds);
  }, [focusOn]);
  useEffect(() => {
    if (pendingMechRef.current) loadAvailability();
  }, [loadAvailability]);
  // Al llegar la rareza se aplica la variante de la URL, con la fecha que haya entonces en el mapa.
  useEffect(() => {
    const search = pendingMechRef.current;
    if (!availability || !search) return;
    pendingMechRef.current = null;
    const id = parseMechQuery(search, availability);
    if (!id) return;
    setMechId(id);
    focusMech(id, availability, date);
  }, [availability, date, focusMech]);
  const mech = availability?.mechs.find(candidate => candidate.id === mechId) ?? null;
  const routeQuest = quest ?? (mechId ? data.quests.find(candidate => candidate.id === mechQuestId) : null) ?? null;
  const markedSystem = !quest && mechId ? mechMissionSystem : null;
  // Una campaña elegida dibuja su ruta en su color; si no, la de la HRQ o el sistema de la recompensa.
  const routeCampaign = !routeQuest && !mechId ? campaign : null;
  const questRoute = useMemo(
    () => (routeCampaign ? getCampaignRoute(routeCampaign) : routeQuest ? getQuestRoute(routeQuest) : markedSystem !== null ? [markedSystem] : null),
    [routeCampaign, routeQuest, markedSystem]
  );
  const mechProduced = mech ? isProduced(mech, date) : false;
  // Con una variante elegida, cada facción se pinta con el color de su rareza. Solo depende de la
  // fecha a través de si la variante ya existe, para no cortar la animación al saltar de evento.
  const territoryColors = useMemo<TerritoryColors>(() => {
    if (!mech || !availability) return null;
    return faction => {
      const rarity = mechProduced ? getMarketRarity(availability, mech, faction) : null;
      return rarity ? RARITY_COLORS[rarity] : NOT_SOLD_COLOR;
    };
  }, [mech, availability, mechProduced]);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_DELAY);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // La URL guarda la fecha y el sistema elegido, para compartir la vista. Se espera a que el
  // control deslizante se pare para no llenar el historial.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.history.replaceState(null, '', toMapQuery({ date, systemId: selectedId, questId, mechId, academyId, campaignId }, data));
    }, URL_DELAY);
    return () => window.clearTimeout(timer);
  }, [date, selectedId, questId, mechId, academyId, campaignId]);

  const shown = data.systems.find(system => system.id === (hoveredId ?? selectedId)) ?? null;
  // La ficha del sistema elegido sigue fijada (con su botón de cerrar) aunque el ratón pase por encima.
  const isPinned = shown !== null && shown.id === selectedId;


  // Elegir otra cosa cierra la zona y la compañía, para que no reaparezcan al cerrar la ficha nueva.
  // Solo los sistemas abiertos desde sus propias fichas las conservan.
  const pickSystem = (system: StarSystem) => {
    setSelectedId(system.id);
    setZoneId(null);
    setCompanyId(null);
    setAcademyId(null);
    focusOn(system.id);
  };

  // Al elegir una HRQ se cierra la ficha del sistema para que se vea la de la misión.
  const pickQuest = (picked: Quest) => {
    pendingMechRef.current = null;
    setQuestId(picked.id);
    setCampaignId(null);
    setZoneId(null);
    setCompanyId(null);
    setAcademyId(null);
    setMechId(null);
    setSelectedId(null);
    setHoveredId(null);
    focusOn(picked.offer);
  };

  // Al elegir una campaña se cierran las demás fichas y el mapa encuadra todo su recorrido.
  const pickCampaign = (picked: Campaign) => {
    pendingMechRef.current = null;
    setCampaignId(picked.id);
    setQuestId(null);
    setZoneId(null);
    setCompanyId(null);
    setAcademyId(null);
    setMechId(null);
    setSelectedId(null);
    setHoveredId(null);
    focusOn(...getCampaignRoute(picked));
  };

  const changeDate = (next: GameDate, isJump: boolean) => {
    const target = clampDate(next, data.range);
    setJump(isJump ? { changedCount: getOwnerChanges(data.systems, date, target).length } : null);
    setDate(target);
  };

  // Al elegir una compañía se cierran las demás fichas y el mapa encuadra sus zonas.
  const pickCompany = (id: string) => {
    setCompanyId(id);
    setCampaignId(null);
    setAcademyId(null);
    setZoneId(null);
    setSelectedId(null);
    setQuestId(null);
    setMechId(null);
    pendingMechRef.current = null;
    const systems = getCompanyZonesAt(data, id, date).flatMap(zone => zone.systems);
    if (systems.length > 0) focusOn(...systems);
  };

  // Al pulsar una zona de mercenarios se abre la ficha de quien la ocupa; si rota al azar, la etiqueta
  // ya lo explica.
  const pickMercZone = (zoneId: string) => {
    const zone = data.mercs.zones.find(candidate => candidate.id === zoneId);
    const owner = zone ? getMercOwnerAt(zone, date) : null;
    if (owner?.company) pickCompany(owner.company);
  };

  // Al pulsar dentro de una zona se cierran las demás fichas para que se vea la suya.
  const pickZone = (id: string) => {
    setZoneId(id);
    setCampaignId(null);
    setCompanyId(null);
    setAcademyId(null);
    setSelectedId(null);
    setQuestId(null);
    setMechId(null);
    pendingMechRef.current = null;
  };

  // Al elegir una academia se cierran las demás fichas y el mapa encuadra su sistema.
  const pickAcademy = (id: string) => {
    const picked = data.academies.find(candidate => candidate.id === id);
    setAcademyId(id);
    setCampaignId(null);
    setZoneId(null);
    setCompanyId(null);
    setQuestId(null);
    setMechId(null);
    setSelectedId(null);
    setHoveredId(null);
    pendingMechRef.current = null;
    if (picked) focusOn(picked.system);
  };

  // Al elegir una variante se cierran la ficha del sistema y la de la HRQ para que se vea la suya.
  const pickMech = (id: string) => {
    pendingMechRef.current = null;
    setMechId(id);
    setCampaignId(null);
    setZoneId(null);
    setCompanyId(null);
    setAcademyId(null);
    setQuestId(null);
    setSelectedId(null);
    setHoveredId(null);
    if (availability) focusMech(id, availability, date);
  };

  return (
    <div className="starmap">
      <StarmapCanvas
        data={data}
        date={date}
        animateDate={jump !== null}
        hoveredId={hoveredId}
        selectedId={selectedId}
        questRoute={questRoute}
        routeColor={routeCampaign ? CAMPAIGN_COLOR : undefined}
        markedId={academy && !quest && !campaign && !mech && !companyId && !zoneId ? academy.system : null}
        territoryColors={territoryColors}
        focus={focus}
        onHover={setHoveredId}
        onSelect={systemId => {
          setSelectedId(systemId);
          setZoneId(null);
          setCompanyId(null);
          setAcademyId(null);
        }}
        onZone={pickZone}
        mercZones={mercZones}
        onMercZone={pickMercZone}
      />

      <header className="starmap-topbar">
        <a className="starmap-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Star map</h1>
        <nav className="starmap-links" aria-label="MW Builder">
          <a href="/mercs/"><small>MW5 Mercenaries</small> MechLab</a>
          <a href="/mercs/units/">Enemy units</a>
          <a href="/mercs/pilots/">Pilots</a>
        </nav>
        <div className="starmap-actions">
          <WhatsNew />
          <button type="button" className="starmap-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
        <SystemSearch onPick={pickSystem} />
      </header>

      {shown
        ? <SystemPanel system={shown} date={date} pinned={isPinned} onClose={() => setSelectedId(null)} onQuest={pickQuest} onCampaign={pickCampaign} onAcademy={pickAcademy} />
        : quest && (
          <QuestCard
            data={data}
            quest={quest}
            date={date}
            onQuest={pickQuest}
            onSystem={systemId => {
              setSelectedId(systemId);
              focusOn(systemId);
            }}
            onClose={() => setQuestId(null)}
          />
        )}
      {!shown && !quest && campaign && (
        <CampaignCard
          data={data}
          campaign={campaign}
          date={date}
          onSystem={systemId => {
            setSelectedId(systemId);
            focusOn(systemId);
          }}
          onClose={() => setCampaignId(null)}
        />
      )}
      {!shown && !quest && !campaign && !mech && companyId && (
        <MercCard
          data={data}
          companyId={companyId}
          date={date}
          onSystem={systemId => {
            setSelectedId(systemId);
            focusOn(systemId);
          }}
          onClose={() => setCompanyId(null)}
        />
      )}
      {!shown && !quest && !campaign && !mech && !companyId && zoneId && (
        <ZoneCard
          data={data}
          clusterId={zoneId}
          onSystem={systemId => {
            setSelectedId(systemId);
            focusOn(systemId);
          }}
          onClose={() => setZoneId(null)}
        />
      )}
      {!shown && !quest && !campaign && !mech && !companyId && !zoneId && academy && (
        <AcademyCard
          data={data}
          academy={academy}
          date={date}
          onSystem={systemId => {
            setSelectedId(systemId);
            focusOn(systemId);
          }}
          onClose={() => setAcademyId(null)}
        />
      )}
      {!shown && !quest && !campaign && mech && availability && (
        <MechCard
          data={data}
          availability={availability}
          mech={mech}
          date={date}
          onQuest={pickQuest}
          onSystem={systemId => {
            setSelectedId(systemId);
            focusOn(systemId);
          }}
          onMission={systemId => {
            setMechQuestId(null);
            setMechMissionSystem(systemId);
            focusOn(systemId);
          }}
          onClose={() => setMechId(null)}
        />
      )}

      <div className="starmap-drawers">
        <FactionLegend date={date} />
        <QuestDrawer data={data} date={date} selectedId={questId} onPick={pickQuest} />
        <CampaignDrawer data={data} date={date} selectedId={campaignId} onPick={pickCampaign} />
        <MarketDrawer
          data={data}
          onPick={systemId => {
            setSelectedId(systemId);
            setZoneId(null);
            setCompanyId(null);
            setAcademyId(null);
            setHoveredId(null);
            focusOn(systemId);
          }}
        />
        <MechDrawer
          availability={availability}
          failed={availabilityFailed}
          date={date}
          lastDate={data.range.end}
          onDate={next => changeDate(next, true)}
          selectedId={mechId}
          onOpen={() => loadAvailability()}
          onPick={pickMech}
        />
        <HeroDrawer data={data} availability={availability} failed={availabilityFailed} selectedId={mechId} onOpen={() => loadAvailability()} onPick={pickMech} />
        <MercDrawer data={data} date={date} selectedId={companyId} onPick={pickCompany} />
        <AcademyDrawer data={data} date={date} selectedId={academyId} onPick={pickAcademy} />
      </div>
      {isFeedbackOpen && (
        <FeedbackDialog
          // Se calcula con el estado, no con window.location: la URL se actualiza con retraso.
          buildUrl={`${window.location.origin}${window.location.pathname}${toMapQuery({ date, systemId: selectedId, questId, mechId, academyId, campaignId }, data)}`}
          attachLabel="Attach a link to this map view"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="starmap-notice" role="status">{notice}</p>}

      <DateControl
        date={date}
        changedCount={jump?.changedCount ?? null}
        onChange={changeDate}
      />
    </div>
  );
}
