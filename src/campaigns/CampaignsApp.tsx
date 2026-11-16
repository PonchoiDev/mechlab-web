import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import starmapJson from '../data/starmap.json';
import type { Campaign, CampaignMission, Quest, QuestRequirement, QuestReward, StarmapData } from '../types/starmap';
import {
  filterCampaigns,
  filterQuests,
  getCampaignMapUrl,
  getCampaignMechs,
  getCampaignSources,
  getCampaignTotals,
  getQuestMapUrl,
  getQuestMechs,
  getQuestSource,
  getQuestSources,
  groupQuestsBySource,
  parseGuideQuery,
  toGuideQuery,
  type GuideTab,
  type GuideView
} from '../utils/questGuide';
import { getMechLabUrl } from '../utils/markets';
import { formatGameDate } from '../utils/starmap';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { WhatsNew } from '../components/WhatsNew';

const data = starmapJson as unknown as StarmapData;
const QUEST_SOURCES = getQuestSources(data);
const CAMPAIGN_SOURCES = getCampaignSources(data);
const PILOTS_URL = '/mercs/pilots/';
const MODE_NAMES = { campaign: 'Campaign', career: 'Career' } as const;
const numberFormat = new Intl.NumberFormat('en');
const systemNames = new Map(data.systems.map(system => [system.id, system.name]));
const systemName = (id: number) => systemNames.get(id) ?? '';

const sourceLabel = (source: number) => source === 0 ? 'Base game' : `DLC ${source}`;

// Qué trae cada origen, para la cabecera de su grupo. Lo que dicen sale de starmap.json: las HRQ de
// Heroes of the Inner Sphere dan un 'Mech hero cada una, y las del DLC8 tienen fechas.
const SOURCE_NOTES: Record<number, string> = {
  0: 'Faction and corporate quests. Most can be taken both in the campaign and in career mode, each with its own reputation level and rewards. In the campaign, the faction ones also need their region opened by the story.',
  1: "Heroes of the Inner Sphere: seven chains of four missions, each paying out a hero 'Mech, plus four faction quests that only appear in career mode.",
  2: 'Seven quest chains, offered from a date onwards and visible from anywhere on the map.',
  3: "Those in Need, the Hatchetman chain: five missions in Benfled and two 'Mechs at the end.",
  8: 'The DLC 8 story is told through these quest chains. Each one opens on a date, and some stop being offered after another.'
};

const money = (cbills: number, reputation: number) => [
  cbills > 0 && `${numberFormat.format(cbills)} C-Bills`,
  reputation > 0 && `+${numberFormat.format(reputation)} reputation`
].filter(Boolean).join(' · ');

function MechLink({ id, name }: { id: string; name: string }) {
  return (
    <a className="guide-mech" href={getMechLabUrl(id)} title="Open in the MechLab with its stock build">
      {name} <small>{id}</small>
    </a>
  );
}

function PilotLink({ pilot }: { pilot: { name: string; hero: boolean } }) {
  if (!pilot.hero) return <span className="guide-pilot">{pilot.name} <small>pilot</small></span>;
  return <a className="guide-pilot" href={PILOTS_URL} title="Hero pilot: open the Pilots page">{pilot.name} <small>hero pilot</small></a>;
}

function MapLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="guide-map-link" href={href} title="Show on the star map">{children}</a>;
}

function Items({ weapons, equipment }: { weapons: QuestReward['weapons']; equipment: QuestReward['equipment'] }) {
  if (weapons.length === 0 && equipment.length === 0) return null;
  return (
    <ul className="guide-items">
      {weapons.map(weapon => (
        <li key={`${weapon.name}-${weapon.tier}`}>{weapon.name}{weapon.tier && <small> {weapon.tier}</small>} <b>×{weapon.count}</b></li>
      ))}
      {equipment.map(item => <li key={item.name}>{item.name} <b>×{item.count}</b></li>)}
    </ul>
  );
}

function Requirement({ requirement, showMode, onQuest }: { requirement: QuestRequirement; showMode: boolean; onQuest: (name: string) => void }) {
  const questLink = (name: string) => <button type="button" className="guide-inline-link" onClick={() => onQuest(name)}>{name}</button>;
  const parts: ReactNode[] = [
    requirement.reputation !== null && `Reputation ${requirement.reputation}+`,
    requirement.from && `From ${formatGameDate(requirement.from)}`,
    requirement.until && `Until ${formatGameDate(requirement.until)}`,
    requirement.after && <>After {questLink(requirement.after)}</>,
    ...requirement.excludes.map(name => <>Not with {questLink(name)}</>)
  ].filter(Boolean);
  return (
    <li>
      {showMode && requirement.mode && <b>{MODE_NAMES[requirement.mode]}: </b>}
      {parts.length === 0 ? 'Always offered' : parts.map((part, index) => <Fragment key={index}>{index > 0 && ' · '}{part}</Fragment>)}
    </li>
  );
}

function Reward({ reward, showMode }: { reward: QuestReward; showMode: boolean }) {
  const paid = money(reward.cbills, reward.reputation);
  return (
    <div className="guide-reward">
      {(showMode || paid) && <p className="guide-money">{showMode && reward.mode && <b>{MODE_NAMES[reward.mode]}: </b>}{paid}</p>}
      {(reward.mechs.length > 0 || reward.pilots.length > 0) && (
        <ul className="guide-mechs">
          {reward.mechs.map((mech, index) => <li key={`${mech.id}-${index}`}><MechLink {...mech} /></li>)}
          {reward.pilots.map(pilot => <li key={pilot.id}><PilotLink pilot={pilot} /></li>)}
        </ul>
      )}
      <Items weapons={reward.weapons} equipment={reward.equipment} />
      {reward.debrief && (
        <details className="guide-debrief">
          <summary>Debrief</summary>
          <p>{reward.debrief}</p>
        </details>
      )}
    </div>
  );
}

// Cabecera de una ficha: el nombre despliega la ficha; los enlaces van fuera del botón.
function CardHeader({ id, kind, name, open, onToggle, children }: {
  id: string; kind: ReactNode; name: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <header className="guide-card-header">
      <p className="unit-card-kind">{kind}</p>
      <h2>
        <button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span>{name}</span>
          <span className="guide-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
        </button>
      </h2>
      {children}
    </header>
  );
}

function QuestCard({ quest, open, onToggle, onQuest }: { quest: Quest; open: boolean; onToggle: () => void; onQuest: (name: string) => void }) {
  const mechs = getQuestMechs(quest);
  // Si los modos piden lo mismo, una sola línea sin el modo.
  const sameForAllModes = quest.requirements.every(requirement =>
    JSON.stringify({ ...requirement, mode: null }) === JSON.stringify({ ...quest.requirements[0], mode: null }));
  const requirements = sameForAllModes ? quest.requirements.slice(0, 1) : quest.requirements;
  const id = `quest-${quest.id}`;
  return (
    <article id={id} className={`unit-card guide-card${open ? ' is-open' : ''}`}>
      <CardHeader
        id={id}
        name={quest.name}
        open={open}
        onToggle={onToggle}
        kind={<>
          <span>{sourceLabel(getQuestSource(quest))}</span>
          {quest.modes.length > 0 && <span>{quest.modes.map(mode => MODE_NAMES[mode]).join(' & ')}</span>}
          <span>{quest.missions.length} {quest.missions.length === 1 ? 'mission' : 'missions'}</span>
        </>}
      >
        <p className="guide-card-meta">
          Offered at <MapLink href={getQuestMapUrl(data, quest)}>{systemName(quest.offer)}</MapLink>
          {quest.employer && <> · <span>{quest.employer}</span></>}
        </p>
        {mechs.length > 0 && <ul className="guide-mechs">{mechs.map(mech => <li key={mech.id}><MechLink {...mech} /></li>)}</ul>}
      </CardHeader>
      {open && (
        <div id={`${id}-body`} className="guide-card-body">
          <dl className="guide-facts">
            <div>
              <dt>Requirements</dt>
              <dd>
                <ul className="guide-requirements">
                  {requirements.map(requirement => (
                    <Requirement key={requirement.mode ?? 'all'} requirement={requirement} showMode={!sameForAllModes} onQuest={onQuest} />
                  ))}
                </ul>
                {quest.visibleEverywhere && <p className="guide-note">The offer shows up from anywhere on the star map.</p>}
              </dd>
            </div>
            {quest.missionTypes.length > 0 && (
              <div>
                <dt>Mission types</dt>
                <dd>{quest.missionTypes.join(' · ')}</dd>
              </div>
            )}
          </dl>
          <h3>Missions</h3>
          <ol className="guide-missions">
            {quest.missions.map((mission, index) => (
              <li key={`${mission.title}-${index}`}>
                <span className="guide-step" aria-hidden="true">{index + 1}</span>
                <div>
                  <h4>{mission.title}</h4>
                  {mission.summary && <p>{mission.summary}</p>}
                  <MapLink href={getQuestMapUrl(data, quest, mission.system)}>{systemName(mission.system)}</MapLink>
                </div>
              </li>
            ))}
          </ol>
          {quest.rewards.length > 0 && (
            <>
              <h3>Rewards</h3>
              {quest.rewards.map(reward => <Reward key={reward.mode ?? 'all'} reward={reward} showMode={quest.rewards.length > 1} />)}
            </>
          )}
          <p className="guide-card-footer"><MapLink href={getQuestMapUrl(data, quest)}>Show the route on the star map</MapLink></p>
        </div>
      )}
    </article>
  );
}

function CampaignMissionItem({ campaign, mission, index }: { campaign: Campaign; mission: CampaignMission; index: number }) {
  const paid = money(mission.cbills, mission.reputation);
  return (
    <li>
      <span className="guide-step" aria-hidden="true">{index + 1}</span>
      <div>
        <h4>{mission.title}</h4>
        {mission.summary && <p>{mission.summary}</p>}
        <p className="guide-mission-meta">
          <MapLink href={getCampaignMapUrl(data, campaign, mission.system)}>{systemName(mission.system)}</MapLink>
          {mission.employer && <> · {mission.employer}</>}
        </p>
        {paid && <p className="guide-money">{paid}</p>}
        {(mission.mechs.length > 0 || mission.pilots.length > 0) && (
          <ul className="guide-mechs">
            {mission.mechs.map(mech => <li key={mech.id}><MechLink {...mech} /></li>)}
            {mission.pilots.map(pilot => <li key={pilot.id}><PilotLink pilot={pilot} /></li>)}
          </ul>
        )}
        <Items weapons={mission.weapons} equipment={mission.equipment} />
      </div>
    </li>
  );
}

function CampaignCard({ campaign, open, onToggle }: { campaign: Campaign; open: boolean; onToggle: () => void }) {
  const mechs = getCampaignMechs(campaign);
  const totals = getCampaignTotals(campaign);
  const id = `campaign-${campaign.id}`;
  return (
    <article id={id} className={`unit-card guide-card${open ? ' is-open' : ''}`}>
      <CardHeader
        id={id}
        name={campaign.name}
        open={open}
        onToggle={onToggle}
        kind={<>
          <span>DLC {campaign.dlc}</span>
          <span>Career</span>
          <span>{campaign.missions.length} missions</span>
        </>}
      >
        <p className="guide-card-meta">
          Starts at <MapLink href={getCampaignMapUrl(data, campaign)}>{systemName(campaign.start)}</MapLink>
          {campaign.from && <> · from {formatGameDate(campaign.from)}</>}
        </p>
        <p className="guide-card-meta">Base pay {money(totals.cbills, totals.reputation)}</p>
        {mechs.length > 0 && <ul className="guide-mechs">{mechs.map(mech => <li key={mech.id}><MechLink {...mech} /></li>)}</ul>}
      </CardHeader>
      {open && (
        <div id={`${id}-body`} className="guide-card-body">
          <p className="guide-note">
            Each mission opens when the previous one is done. Pay is the base contract reward, before negotiation and salvage.
          </p>
          <h3>Missions</h3>
          <ol className="guide-missions">
            {campaign.missions.map((mission, index) => (
              <CampaignMissionItem key={`${mission.title}-${index}`} campaign={campaign} mission={mission} index={index} />
            ))}
          </ol>
          {campaign.completion && (
            <>
              <h3>Campaign complete</h3>
              <div className="guide-reward">
                <p className="guide-money">{campaign.completion.title}</p>
                <ul className="guide-mechs">{campaign.completion.mechs.map(mech => <li key={mech.id}><MechLink {...mech} /></li>)}</ul>
              </div>
            </>
          )}
          <p className="guide-card-footer"><MapLink href={getCampaignMapUrl(data, campaign)}>Show the route on the star map</MapLink></p>
        </div>
      )}
    </article>
  );
}

export function CampaignsApp() {
  const [view, setView] = useState<GuideView>(() => parseGuideQuery(window.location.search, data));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const quests = useMemo(() => filterQuests(data, view.query, view.tab === 'quests' ? view.source : 'all'), [view.query, view.source, view.tab]);
  const groups = useMemo(() => groupQuestsBySource(quests), [quests]);
  const campaigns = useMemo(() => filterCampaigns(data, view.query, view.tab === 'campaigns' ? view.source : 'all'), [view.query, view.source, view.tab]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toGuideQuery(view)}`);
  }, [view]);

  // La ficha abierta desde un enlace compartido se lleva a la vista al cargar, solo entonces: al desplegar
  // una ficha a mano ya está a la vista.
  const [initialOpen] = useState(() => view.open && `${view.tab === 'quests' ? 'quest' : 'campaign'}-${view.open}`);
  useEffect(() => {
    if (initialOpen) document.getElementById(initialOpen)?.scrollIntoView({ block: 'start' });
  }, [initialOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<GuideView>) => setView(current => ({ ...current, ...change }));
  const pickTab = (tab: GuideTab) => update({ tab, source: 'all', open: null });
  const toggle = (id: string) => setView(current => ({ ...current, open: current.open === id ? null : id }));
  // Requisito previo o HRQ excluyente: se despliega y se lleva a la vista, aunque la búsqueda la ocultara.
  const openQuest = (name: string) => {
    const found = data.quests.find(quest => quest.name === name);
    if (!found) return;
    setView({ tab: 'quests', query: '', source: 'all', open: found.id });
    window.requestAnimationFrame(() => document.getElementById(`quest-${found.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };
  const sources = view.tab === 'quests' ? QUEST_SOURCES : CAMPAIGN_SOURCES;
  const countFor = (source: number) => view.tab === 'quests'
    ? filterQuests(data, view.query, source).length
    : filterCampaigns(data, view.query, source).length;
  const total = view.tab === 'quests' ? quests.length : campaigns.length;

  return (
    <div className="units guide">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>HRQ &amp; Campaigns</h1>
        <nav className="units-links" aria-label="MW Builder">
          <a href="/mercs/"><small>MW5 Mercenaries</small> MechLab</a>
          <a href="/mercs/starmap/">Star map</a>
          <a href="/mercs/units/">Enemy units</a>
          <a href="/mercs/pilots/">Pilots</a>
          <a href="/mercs/equipment/">Equipment</a>
        </nav>
        <div className="units-actions">
          <WhatsNew />
          <button type="button" className="units-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <main className="units-main">
        <section className="units-intro">
          <p>
            High reward quests (HRQ) are chains of missions offered in one system once your reputation is high enough,
            and sometimes from a date. DLC campaigns are stories played inside career mode, mission after mission, from
            system to system. Open any of them to see where it starts, its missions in order and what it pays; the
            systems open the <a href="/mercs/starmap/">star map</a> with the route drawn, and the 'Mechs open in the
            MechLab with their stock build.
          </p>
        </section>

        <div className="guide-tabs" role="group" aria-label="Section">
          <button type="button" aria-pressed={view.tab === 'quests'} onClick={() => pickTab('quests')}>
            High reward quests <small>{data.quests.length}</small>
          </button>
          <button type="button" aria-pressed={view.tab === 'campaigns'} onClick={() => pickTab('campaigns')}>
            DLC campaigns <small>{data.campaigns.length}</small>
          </button>
        </div>

        <section className="units-controls" aria-label="Filters">
          <div className="units-kinds" role="group" aria-label="Source">
            <button type="button" aria-pressed={view.source === 'all'} onClick={() => update({ source: 'all' })}>
              All <small>{view.tab === 'quests' ? filterQuests(data, view.query, 'all').length : filterCampaigns(data, view.query, 'all').length}</small>
            </button>
            {sources.map(source => (
              <button key={source} type="button" aria-pressed={view.source === source} onClick={() => update({ source })}>
                {source === 0 ? 'Base' : `DLC ${source}`} <small>{countFor(source)}</small>
              </button>
            ))}
          </div>
          <div className="units-search">
            <input
              type="search"
              placeholder={view.tab === 'quests' ? "Name, system, employer or 'Mech" : "Name, system, mission or 'Mech"}
              aria-label={view.tab === 'quests' ? 'Search quests' : 'Search campaigns'}
              value={view.query}
              onChange={event => update({ query: event.target.value })}
            />
          </div>
        </section>

        {total === 0 && <p className="units-empty">Nothing matches this search.</p>}

        {view.tab === 'quests' && groups.map(group => (
          <section key={group.source} className="guide-section" aria-label={sourceLabel(group.source)}>
            <h2>{sourceLabel(group.source)} <small>{group.quests.length}</small></h2>
            {SOURCE_NOTES[group.source] && <p>{SOURCE_NOTES[group.source]}</p>}
            <div className="units-grid guide-grid">
              {group.quests.map(quest => (
                <QuestCard key={quest.id} quest={quest} open={view.open === quest.id} onToggle={() => toggle(quest.id)} onQuest={openQuest} />
              ))}
            </div>
          </section>
        ))}

        {view.tab === 'campaigns' && campaigns.length > 0 && (
          <section className="guide-section" aria-label="DLC campaigns">
            <p>
              Each campaign starts in one system on a date of the career calendar, and its missions are played in order.
              The DLC 3 (Those in Need) and DLC 8 stories are quest chains: they are in the other tab.
            </p>
            <div className="units-grid guide-grid">
              {campaigns.map(campaign => (
                <CampaignCard key={campaign.id} campaign={campaign} open={view.open === campaign.id} onToggle={() => toggle(campaign.id)} />
              ))}
            </div>
          </section>
        )}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toGuideQuery(view)}`}
          attachLabel="Attach a link to this page"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
