import { useEffect, useMemo, useState } from 'react';
import pilotsJson from '../data/pilots.json';
import type { PilotTrait, PilotsData, TrainingProgramEntry } from '../types/pilots';
import { TRAIT_CATEGORIES, filterTraits, getAcademyMapUrl, parsePilotsQuery, toPilotsQuery, type PilotsView } from '../utils/pilots';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { SupportLink } from '../components/SupportLink';
import { WhatsNew } from '../components/WhatsNew';

const data = pilotsJson as unknown as PilotsData;
const numberFormat = new Intl.NumberFormat('en');
const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const CATEGORY_LABELS = Object.fromEntries(TRAIT_CATEGORIES.map(category => [category.id, category.label]));
const HERO_COUNT = data.traits.filter(trait => trait.hero).length;
// Las estrellas de los programas van de 0 a 5, como en la pantalla de la academia del juego.
const MAX_STARS = 5;

function TraitCard({ trait }: { trait: PilotTrait }) {
  const tags = [
    trait.hero && { label: 'Hero', className: 'is-hero', title: 'Only elite pilots have it' },
    trait.hireable && { label: 'Hired pilots', title: 'Can appear on pilots for hire' },
    trait.trainable && { label: 'Academies', title: 'Can be learned at an academy' },
    trait.negative && { label: 'Negative', className: 'is-negative' },
    trait.unique && { label: 'Unique' },
    trait.dlc !== null && { label: `DLC ${trait.dlc}` },
    trait.available && { label: `From ${dateFormat.format(new Date(trait.available))}` }
  ].filter((tag): tag is { label: string; className?: string; title?: string } => Boolean(tag));

  return (
    <article className={`unit-card pilot-trait${trait.hero ? ' is-hero' : ''}`}>
      <header className="unit-card-header">
        <p className="unit-card-kind"><span>{CATEGORY_LABELS[trait.category]}</span></p>
        <h2>{trait.name}</h2>
        {tags.length > 0 && (
          <ul className="pilot-tags">
            {tags.map(tag => <li key={tag.label} className={tag.className} title={tag.title}>{tag.label}</li>)}
          </ul>
        )}
      </header>
      {trait.description && <p className="pilot-description">{trait.description}</p>}
      <div className="pilot-groups">
        {trait.groups.map(group => (
          <section key={group.scope} className={group.scope === 'Pilot' ? 'is-pilot' : undefined}>
            <h3>{group.scope}{group.note && <small> {group.note}</small>}</h3>
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
    </article>
  );
}

function Stars({ label, value }: { label: string; value: number }) {
  return (
    <span className="pilot-stars" aria-label={`${label}: ${value} of ${MAX_STARS} stars`}>
      <small aria-hidden="true">{label}</small>
      <b aria-hidden="true">{'★'.repeat(value)}<i>{'★'.repeat(MAX_STARS - value)}</i></b>
    </span>
  );
}

function ProgramCard({ program }: { program: TrainingProgramEntry }) {
  const [minSkill, maxSkill] = program.skill;
  return (
    <article className="unit-card pilot-program">
      <header className="unit-card-header">
        <p className="unit-card-kind"><span>{program.level ? `Level ${program.level}` : 'Academy program'}</span></p>
        <h2>{program.name}</h2>
      </header>
      <p className="pilot-description">{program.description.replaceAll('{AcademyName}', 'the academy')}</p>
      <dl className="unit-card-stats pilot-program-stats">
        <div><dt>Length</dt><dd>{program.days} <small>days</small></dd></div>
        <div><dt>Fee</dt><dd>{numberFormat.format(program.fee)}</dd></div>
        <div><dt>Per quarter</dt><dd>{program.tuition > 0 ? numberFormat.format(program.tuition) : '-'}</dd></div>
        <div><dt>Pilot skill</dt><dd>{minSkill > 0 ? `${minSkill}-${maxSkill}` : `≤ ${maxSkill}`}</dd></div>
      </dl>
      <div className="pilot-ratings">
        <Stars label="Skills" value={program.stars.skill} />
        <Stars label="Traits" value={program.stars.traits} />
        <Stars label="XP" value={program.stars.xp} />
      </div>
      <details className="unit-rarity">
        <summary>Offered by {program.academies.length} {program.academies.length === 1 ? 'academy' : 'academies'}</summary>
        <ul className="pilot-academies">
          {program.academies.map(academy => (
            <li key={academy.id}>
              <a href={getAcademyMapUrl(academy.id)} title="Open on the star map">{academy.name}</a> <small>{academy.system}</small>
            </li>
          ))}
        </ul>
      </details>
    </article>
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
            Every pilot trait with its exact effects, and the training programs of the pilot academies (DLC 7).
            The academies themselves are on the <a href="/mercs/starmap/">star map</a>.
          </p>
          <aside className="pilot-elite">
            <h2>Elite pilots</h2>
            <p>
              The game has no fixed list of hero pilots: it generates elite pilots with hero traits and offers them at random in
              hiring halls, marked as Elite Pilot on the star map. These are the {HERO_COUNT} traits they can bring.
            </p>
            <button type="button" onClick={() => update({ tab: 'traits', category: 'all', heroOnly: true, query: '' })}>Show hero traits</button>
          </aside>
        </section>

        <div className="pilot-tabs" role="group" aria-label="Section">
          <button type="button" aria-pressed={view.tab === 'traits'} onClick={() => update({ tab: 'traits' })}>
            Traits <small>{data.traits.length}</small>
          </button>
          <button type="button" aria-pressed={view.tab === 'programs'} onClick={() => update({ tab: 'programs' })}>
            Training programs <small>{data.programs.length}</small>
          </button>
        </div>

        {view.tab === 'traits' ? (
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
                <button type="button" className="pilot-hero-toggle" aria-pressed={view.heroOnly} onClick={() => update({ heroOnly: !view.heroOnly })}>
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
            {traits.length > 0
              ? <div className="units-grid">{traits.map(trait => <TraitCard key={trait.id} trait={trait} />)}</div>
              : <p className="units-empty">No traits match this search.</p>}
          </>
        ) : (
          <div className="units-grid">{data.programs.map(program => <ProgramCard key={program.id} program={program} />)}</div>
        )}
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
