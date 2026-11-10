import { useEffect, useMemo, useState } from 'react';
import pilotsJson from '../data/pilots.json';
import type { HeroPilot, PilotTrait, PilotsData, TrainingProgramEntry, TraitEffect, TraitEffectGroup } from '../types/pilots';
import {
  TRAIT_CATEGORIES, filterTraits, formatProgramLength, getAcademyMapUrl, getTraitEffectColumns, groupPrograms, groupTraits, parsePilotsQuery,
  splitHeroPilots, toPilotsQuery, type PilotsView
} from '../utils/pilots';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { WhatsNew } from '../components/WhatsNew';

const data = pilotsJson as unknown as PilotsData;
const numberFormat = new Intl.NumberFormat('en');
const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const TRAITS_BY_ID = new Map(data.traits.map(trait => [trait.id, trait]));
const HERO_SECTIONS = splitHeroPilots(data.heroes);
const PROGRAM_FAMILIES = groupPrograms(data.programs, data.programFamilies);
// Las estrellas de los programas van de 0 a 5, como en la pantalla de la academia del juego.
const MAX_STARS = 5;
// Las habilidades de los pilotos van del 1 al 10.
const MAX_SKILL = 10;
const HERO_TRAIT_TITLE = 'Rare trait: every DLC 7 hero pilot has one, but hired pilots and academies only roll them sometimes';

type OpenTrait = (trait: PilotTrait) => void;

function EffectGroups({ groups }: { groups: TraitEffectGroup[] }) {
  return (
    <div className="pilot-groups">
      {groups.map(group => (
        <section key={group.scope} className={group.scope === 'Pilot' ? 'is-pilot' : undefined}>
          <h5>{group.scope}{group.note && <small> {group.note}</small>}</h5>
          <ul>
            {group.effects.map((effect, index) => (
              <li key={`${effect.label}-${index}`} className={effect.good ? 'is-good' : 'is-bad'}>
                <b>{effect.value}</b> {effect.label}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EffectList({ effects }: { effects: TraitEffect[] }) {
  return (
    <ul className="pilot-effects">
      {effects.map((effect, index) => (
        <li key={`${effect.label}-${index}`} className={effect.good ? 'is-good' : 'is-bad'}>
          <b>{effect.value}</b> {effect.label}
        </li>
      ))}
    </ul>
  );
}

function TraitRow({ trait }: { trait: PilotTrait }) {
  const { combat, pilot } = getTraitEffectColumns(trait);
  const meta = [
    trait.dlc !== null && `DLC ${trait.dlc}`,
    trait.available && `from ${dateFormat.format(new Date(trait.available))}`
  ].filter(Boolean).join(' · ');
  return (
    <tr className={trait.hero ? 'is-hero' : undefined}>
      <th scope="row">
        <div className="pilot-trait-title">
          <span className="pilot-trait-name" title={trait.description ?? undefined}>{trait.name}</span>
          {trait.hero && <span className="pilot-badge is-hero" title={HERO_TRAIT_TITLE}>Hero</span>}
          {trait.negative && <span className="pilot-badge is-negative">Negative</span>}
          {trait.unique && <span className="pilot-badge" title="Only one pilot can have it">Unique</span>}
          {meta && <span className="pilot-trait-meta">{meta}</span>}
        </div>
      </th>
      <td data-label="Effects" className={combat.length === 0 ? 'is-empty' : undefined}>
        {combat.length > 0 ? combat.map((line, index) => (
          <div key={line.scope ?? index} className="pilot-effect-line">
            {line.scope && <span className="pilot-effect-scope">{line.scope}{line.note && <small> {line.note}</small>}</span>}
            <EffectList effects={line.effects} />
          </div>
        )) : '-'}
      </td>
      <td data-label="As a pilot" className={pilot.length === 0 ? 'is-empty' : undefined}>
        {pilot.length > 0 ? <EffectList effects={pilot} /> : '-'}
      </td>
      <td data-label="Found on" className="pilot-found">
        <span className={trait.hireable ? 'is-on' : undefined} title={trait.hireable ? 'Can appear on pilots for hire' : 'Never on pilots for hire'}>Hired</span>
        <span className={trait.trainable ? 'is-on' : undefined} title={trait.trainable ? 'Can be learned at an academy' : 'Not taught at academies'}>Academies</span>
      </td>
    </tr>
  );
}

function TraitTable({ traits }: { traits: PilotTrait[] }) {
  return (
    <table className="pilot-table pilot-traits">
      <thead>
        <tr>
          <th scope="col">Trait</th>
          <th scope="col">Effects</th>
          <th scope="col">As a pilot</th>
          <th scope="col">Found on</th>
        </tr>
      </thead>
      <tbody>{traits.map(trait => <TraitRow key={trait.id} trait={trait} />)}</tbody>
    </table>
  );
}

function SkillBar({ name, level, cap }: { name: string; level: number; cap: number }) {
  return (
    <li>
      <span>{name}</span>
      <span className="pilot-skill-bar" role="img" aria-label={`${name}: ${level} of ${MAX_SKILL}, cap ${cap}`}>
        {Array.from({ length: MAX_SKILL }, (_, index) => (
          <i key={index} className={index < level ? 'is-level' : index < cap ? 'is-cap' : undefined} />
        ))}
      </span>
      <b>{level}</b>
    </li>
  );
}

function HeroCard({ pilot }: { pilot: HeroPilot }) {
  const kind = [pilot.dlc !== null ? `DLC ${pilot.dlc}` : 'Base game', pilot.rank].filter(Boolean).join(' · ');
  return (
    <article className="unit-card pilot-hero">
      <header className="unit-card-header">
        <p className="unit-card-kind"><span>{pilot.hiringHall ? 'Elite pilot' : 'Reward'}</span> <span>{kind}</span></p>
        <h3 className="unit-card-name">{pilot.name}</h3>
        {pilot.callsign && <p className="pilot-callsign">Callsign {pilot.callsign}</p>}
        {!pilot.hiringHall && (
          <p className="pilot-source">
            {pilot.rewards.map(reward => `${reward.title}${reward.story ? ' (story campaign)' : ''}`).join('; ')}
          </p>
        )}
      </header>
      <dl className="unit-card-stats pilot-hero-stats">
        {pilot.hiringHall && pilot.hiringCost !== null && <div><dt>Hiring cost</dt><dd>{numberFormat.format(pilot.hiringCost)}</dd></div>}
        {pilot.salary !== null && <div><dt>Salary</dt><dd>{numberFormat.format(pilot.salary)}</dd></div>}
      </dl>
      <ul className="pilot-skills" aria-label="Skills">
        {pilot.skills.map(skill => <SkillBar key={skill.name} {...skill} />)}
      </ul>
      <div className="pilot-hero-traits">
        <h4>Traits</h4>
        {pilot.traits.length > 0 ? pilot.traits.map(id => {
          const trait = TRAITS_BY_ID.get(id);
          if (!trait) return null;
          return (
            <details key={id} className={trait.hero ? 'is-hero' : undefined}>
              <summary>
                {trait.name}
                {trait.hero && <span className="pilot-badge is-hero" title={HERO_TRAIT_TITLE}>Hero</span>}
                {trait.negative && <span className="pilot-badge is-negative">Negative</span>}
              </summary>
              {trait.description && <p className="pilot-description">{trait.description}</p>}
              <EffectGroups groups={trait.groups} />
            </details>
          );
        }) : <p className="pilot-description">No fixed traits.</p>}
      </div>
      {pilot.bio.length > 0 && (
        <details className="unit-rarity pilot-bio">
          <summary>Biography</summary>
          {pilot.bio.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </details>
      )}
    </article>
  );
}

function HeroesView() {
  return (
    <>
      <section className="pilot-section" aria-labelledby="heroes-hiring">
        <header className="pilot-section-header">
          <h2 id="heroes-hiring">In hiring halls <small>{HERO_SECTIONS.hiringHall.length}</small></h2>
          <p>
            Hiring halls offer them at random, marked as Elite Pilot on the star map. Each one comes with fixed traits,
            like a hero 'Mech.
          </p>
        </header>
        <div className="units-grid">{HERO_SECTIONS.hiringHall.map(pilot => <HeroCard key={pilot.id} pilot={pilot} />)}</div>
      </section>
      <section className="pilot-section" aria-labelledby="heroes-rewards">
        <header className="pilot-section-header">
          <h2 id="heroes-rewards">Rewards <small>{HERO_SECTIONS.rewards.length}</small></h2>
          <p>They join the company when a mission or an objective is completed. Hiring halls never offer them.</p>
        </header>
        <div className="units-grid">{HERO_SECTIONS.rewards.map(pilot => <HeroCard key={pilot.id} pilot={pilot} />)}</div>
      </section>
    </>
  );
}

function TraitsView({ traits }: { traits: PilotTrait[] }) {
  const sections = groupTraits(traits);
  if (sections.length === 0) return <p className="units-empty">No traits match this search.</p>;
  return (
    <>
      {sections.map(section => (
        <section key={section.category} className="pilot-section" aria-labelledby={`traits-${section.category}`}>
          <h2 id={`traits-${section.category}`}>{section.label} <small>{section.count}</small></h2>
          {section.groups.map(group => (
            <div key={group.label ?? section.category} className="pilot-subsection">
              {group.label && <h3>{group.label} <small>{group.traits.length}</small></h3>}
              <TraitTable traits={group.traits} />
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function Stars({ label, value }: { label: string; value: number }) {
  return (
    <span className="pilot-stars" role="img" aria-label={`${label}: ${value} of ${MAX_STARS} stars`}>
      {'★'.repeat(value)}<i>{'★'.repeat(MAX_STARS - value)}</i>
    </span>
  );
}

function TraitButton({ id, onOpen }: { id: string; onOpen: OpenTrait }) {
  const trait = TRAITS_BY_ID.get(id);
  if (!trait) return null;
  return <button type="button" className="pilot-trait-link" title="Show this trait" onClick={() => onOpen(trait)}>{trait.name}</button>;
}

function ProgramRow({ program, onOpenTrait }: { program: TrainingProgramEntry; onOpenTrait: OpenTrait }) {
  const [minSkill, maxSkill] = program.skill;
  const { academies } = program;
  return (
    <tr>
      <th scope="row">
        {program.label}
        {program.guaranteedTrait && (
          <span className="pilot-program-traits">Always grants <TraitButton id={program.guaranteedTrait} onOpen={onOpenTrait} /></span>
        )}
        {program.favouredTraits.length > 0 && (
          <span className="pilot-program-traits">
            Favours {program.favouredTraits.map((id, index) => (
              <span key={id}>{index > 0 && ', '}<TraitButton id={id} onOpen={onOpenTrait} /></span>
            ))}
          </span>
        )}
      </th>
      <td data-label="Length">{formatProgramLength(program.days)}</td>
      <td data-label="Fee">{numberFormat.format(program.fee)}</td>
      <td data-label="Per quarter">{program.tuition > 0 ? numberFormat.format(program.tuition) : '-'}</td>
      <td data-label="Pilot skill">{minSkill > 0 ? `${minSkill}-${maxSkill}` : `Up to ${maxSkill}`}</td>
      <td data-label="Skills"><Stars label="Skills" value={program.stars.skill} /></td>
      <td data-label="Traits"><Stars label="Traits" value={program.stars.traits} /></td>
      <td data-label="XP"><Stars label="XP" value={program.stars.xp} /></td>
      <td data-label="Offered by" className="pilot-program-academies">
        {academies.length === 1 ? (
          <a href={getAcademyMapUrl(academies[0].id)} title="Open on the star map">{academies[0].system}</a>
        ) : (
          <details>
            <summary>{academies.length} academies</summary>
            <ul className="pilot-academies">
              {academies.map(academy => (
                <li key={academy.id}>
                  <a href={getAcademyMapUrl(academy.id)} title="Open on the star map">{academy.name}</a> <small>{academy.system}</small>
                </li>
              ))}
            </ul>
          </details>
        )}
      </td>
    </tr>
  );
}

function ProgramsView({ onOpenTrait }: { onOpenTrait: OpenTrait }) {
  return (
    <>
      {PROGRAM_FAMILIES.map(({ family, programs }) => (
        <section key={family.id} className="pilot-section" aria-labelledby={`programs-${family.id}`}>
          <header className="pilot-section-header">
            <h2 id={`programs-${family.id}`}>{family.name} <small>{programs.length}</small></h2>
            <p>{family.description}</p>
          </header>
          <table className="pilot-table pilot-programs">
            <thead>
              <tr>
                <th scope="col">{family.id === 'academy' ? 'Academy' : 'Program'}</th>
                <th scope="col">Length</th>
                <th scope="col">Fee</th>
                <th scope="col">Per quarter</th>
                <th scope="col">Pilot skill</th>
                <th scope="col">Skills</th>
                <th scope="col">Traits</th>
                <th scope="col">XP</th>
                <th scope="col">Offered by</th>
              </tr>
            </thead>
            <tbody>{programs.map(program => <ProgramRow key={program.id} program={program} onOpenTrait={onOpenTrait} />)}</tbody>
          </table>
        </section>
      ))}
    </>
  );
}

export function PilotsApp() {
  const [view, setView] = useState<PilotsView>(() => parsePilotsQuery(window.location.search));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const traits = useMemo(() => filterTraits(data.traits, view), [view]);
  const counts = useMemo(() => Object.fromEntries(TRAIT_CATEGORIES.map(category => [
    category.id, filterTraits(data.traits, { ...view, category: category.id }).length
  ])), [view]);
  const total = useMemo(() => filterTraits(data.traits, { ...view, category: 'all' }).length, [view]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toPilotsQuery(view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<PilotsView>) => setView(current => ({ ...current, ...change }));
  const openTrait: OpenTrait = trait => {
    update({ tab: 'traits', category: 'all', heroOnly: false, query: trait.name });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="units pilots">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Pilots</h1>
        <nav className="units-links" aria-label="MW Builder">
          <a href="/mercs/"><small>MW5 Mercenaries</small> MechLab</a>
          <a href="/mercs/starmap/">Star map</a>
          <a href="/mercs/units/">Enemy units</a>
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
            The hero pilots with their fixed traits, every pilot trait with its exact effects, and the training programs of
            the pilot academies (DLC 7). The academies themselves are on the <a href="/mercs/starmap/">star map</a>.
          </p>
        </section>

        <div className="pilot-tabs" role="group" aria-label="Section">
          <button type="button" aria-pressed={view.tab === 'heroes'} onClick={() => update({ tab: 'heroes' })}>
            Hero pilots <small>{data.heroes.length}</small>
          </button>
          <button type="button" aria-pressed={view.tab === 'traits'} onClick={() => update({ tab: 'traits' })}>
            Traits <small>{data.traits.length}</small>
          </button>
          <button type="button" aria-pressed={view.tab === 'programs'} onClick={() => update({ tab: 'programs' })}>
            <span className="pilot-tab-extra">Training </span>programs <small>{data.programs.length}</small>
          </button>
        </div>

        {view.tab === 'heroes' && <HeroesView />}
        {view.tab === 'traits' && (
          <>
            <section className="units-controls" aria-label="Filters">
              <div className="units-kinds" role="group" aria-label="Trait type">
                <button type="button" aria-pressed={view.category === 'all'} onClick={() => update({ category: 'all' })}>
                  All <small>{total}</small>
                </button>
                {TRAIT_CATEGORIES.map(category => (
                  <button key={category.id} type="button" aria-pressed={view.category === category.id} onClick={() => update({ category: category.id })}>
                    {category.label} <small>{counts[category.id]}</small>
                  </button>
                ))}
              </div>
              <div className="units-search">
                <button type="button" className="pilot-hero-toggle" aria-pressed={view.heroOnly} title={HERO_TRAIT_TITLE}
                  onClick={() => update({ heroOnly: !view.heroOnly })}>
                  Hero only
                </button>
                <input
                  type="search"
                  placeholder="Name or effect"
                  aria-label="Search traits by name or effect"
                  value={view.query}
                  onChange={event => update({ query: event.target.value })}
                />
              </div>
            </section>
            <TraitsView traits={traits} />
          </>
        )}
        {view.tab === 'programs' && <ProgramsView onOpenTrait={openTrait} />}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toPilotsQuery(view)}`}
          attachLabel="Attach a link to this list"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
