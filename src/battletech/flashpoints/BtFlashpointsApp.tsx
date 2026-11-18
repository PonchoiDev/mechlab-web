import { useEffect, useMemo, useState, type ReactNode } from 'react';
import flashpointsJson from '../../data/battletech/flashpoints.json';
import type { BtFlashpoint, BtFlashpointContract, BtFlashpointPath, BtFlashpointReward } from '../../types/battletech-flashpoints';
import {
  FLASHPOINT_LENGTHS,
  FLASHPOINT_SOURCES,
  filterFlashpoints,
  getBtMechLabUrl,
  getFlashpointMechs,
  getFlashpointMapUrl,
  groupFlashpoints,
  parseFlashpointsQuery,
  toFlashpointsQuery,
  type FlashpointsView
} from '../../utils/battletech/flashpoints';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SupportLink } from '../../components/SupportLink';
import { WhatsNew } from '../../components/WhatsNew';

const flashpoints = (flashpointsJson as unknown as { flashpoints: BtFlashpoint[] }).flashpoints;
const numberFormat = new Intl.NumberFormat('en');
const sourceLabel = (source: BtFlashpoint['source']) => FLASHPOINT_SOURCES.find(candidate => candidate.id === source)?.label ?? source;
// «CaptureBase» pasa a «Capture Base», como lo escribe el juego en la lista de contratos.
const contractTypeLabel = (type: string) => type.replace(/(?<=[a-z])(?=[A-Z0-9])/g, ' ').replace(/^3way/i, 'Three-Way ');
const signed = (value: number) => `${value > 0 ? '+' : ''}${numberFormat.format(value)}`;

function MapLink({ flashpoint }: { flashpoint: BtFlashpoint }) {
  return <a className="guide-map-link" href={getFlashpointMapUrl(flashpoint)} title="Show on the star map">{flashpoint.system}</a>;
}

// Los 'Mechs que están en el MechLab se abren en él; las variantes especiales, solo con su nombre.
function MechChips({ mechs }: { mechs: BtFlashpointReward['mechs'] }) {
  if (mechs.length === 0) return null;
  return (
    <ul className="guide-mechs">
      {mechs.map(mech => (
        <li key={mech.id}>
          {mech.inMechLab
            ? <a className="guide-mech" href={getBtMechLabUrl(mech.id)} title="Open in the MechLab with its stock build">{mech.name}</a>
            : <span className="guide-mech is-static" title="A special variant: it is not in the MechLab">{mech.name}</span>}
        </li>
      ))}
    </ul>
  );
}

// Pago de un camino: C-Bills, moral y reputación con cada facción.
function PathPay({ path }: { path: BtFlashpointPath }) {
  const parts = [
    path.funds > 0 && `${numberFormat.format(path.funds)} C-Bills`,
    path.morale !== 0 && `${signed(path.morale)} morale`
  ].filter(Boolean);
  if (parts.length === 0 && path.reputation.length === 0) return <div className="bt-fp-pay"><p className="guide-note">No pay beyond the reward.</p></div>;
  return (
    <div className="bt-fp-pay">
      {parts.length > 0 && <p className="guide-money">{parts.join(' · ')}</p>}
      {path.reputation.length > 0 && (
        <ul className="bt-fp-reputation">
          {path.reputation.map(item => (
            <li key={item.faction} className={item.value < 0 ? 'is-negative' : undefined}>{signed(item.value)} <span>{item.faction}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RewardBlock({ reward }: { reward: BtFlashpointReward }) {
  return (
    <div className="bt-fp-reward">
      <p className="guide-plain">{reward.title}</p>
      <p className="guide-note">{reward.choice ? "Pick one of these 'Mechs at the end." : reward.description}</p>
      <MechChips mechs={reward.mechs} />
    </div>
  );
}

function ContractStep({ contract, step }: { contract: BtFlashpointContract; step: number }) {
  return (
    <li>
      <span className="guide-step" aria-hidden="true">{step}</span>
      <div>
        <h4>{contract.name} {contract.type && <small className="bt-fp-type">{contractTypeLabel(contract.type)}</small>}</h4>
        {contract.objective && <p>{contract.objective}</p>}
        {contract.description && (
          <details className="guide-debrief guide-mission-briefing">
            <summary>Briefing</summary>
            <p>{contract.description}</p>
          </details>
        )}
      </div>
    </li>
  );
}

function Row({ flashpoint, open, onToggle }: { flashpoint: BtFlashpoint; open: boolean; onToggle: () => void }) {
  const id = `fp-${flashpoint.id}`;
  const contractCount = flashpoint.contracts.length + Math.max(0, ...flashpoint.paths.map(path => path.contracts.length));
  const bestPay = Math.max(0, ...flashpoint.paths.map(path => path.funds));
  const single = flashpoint.paths.length === 1;
  const { ally, reputation } = flashpoint.requirements;
  const mechs = getFlashpointMechs(flashpoint);
  return (
    <li id={id} className={`guide-row${open ? ' is-open' : ''}`}>
      <div className="guide-row-head">
        <div className="guide-row-name">
          <button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
            <span className="guide-chevron" aria-hidden="true">{open ? '−' : '+'}</span>
            <span>{flashpoint.name}</span>
          </button>
          <p className="guide-row-meta">
            <span title="Difficulty from 1 to 10; the game shows half as many skulls">Difficulty {flashpoint.difficulty}</span>
            <span>{FLASHPOINT_LENGTHS[flashpoint.length]}</span>
            <span>{contractCount} {contractCount === 1 ? 'contract' : 'contracts'}</span>
            {flashpoint.paths.length > 1 && <span>{flashpoint.paths.length} paths</span>}
          </p>
        </div>
        <div className="guide-row-cell" data-label="Offered at">
          <MapLink flashpoint={flashpoint} />
          {flashpoint.employer && <small>{flashpoint.employer}</small>}
        </div>
        <div className="guide-row-cell" data-label="Reward">
          {bestPay > 0 && <p className="guide-money">{single ? '' : 'Up to '}{numberFormat.format(bestPay)} C-Bills</p>}
          {mechs.length > 0 ? <MechChips mechs={mechs} /> : flashpoint.reward && <small>{flashpoint.reward.title}</small>}
        </div>
      </div>
      {open && (
        <div id={`${id}-body`} className="guide-row-body">
          <div className="guide-detail">
            <div className="guide-detail-main">
              {flashpoint.description && (
                <>
                  <h3>Briefing</h3>
                  <p className="guide-briefing">{flashpoint.description}</p>
                </>
              )}
              <h3>Contracts</h3>
              <ol className="guide-missions">
                {flashpoint.contracts.map((contract, index) => <ContractStep key={contract.id} contract={contract} step={index + 1} />)}
              </ol>
              {single
                ? (
                  <>
                    {flashpoint.paths[0].contracts.length > 0 && (
                      <ol className="guide-missions">
                        {flashpoint.paths[0].contracts.map((contract, index) => (
                          <ContractStep key={contract.id} contract={contract} step={flashpoint.contracts.length + index + 1} />
                        ))}
                      </ol>
                    )}
                    <h3>On completion</h3>
                    <PathPay path={flashpoint.paths[0]} />
                  </>
                )
                : flashpoint.paths.map(path => (
                  <section key={path.label} className="bt-fp-path" aria-label={`Path ${path.label}`}>
                    <h3>Path {path.label}{path.name && <> · {path.name}</>}</h3>
                    {path.contracts.length > 0 && (
                      <ol className="guide-missions">
                        {path.contracts.map((contract, index) => (
                          <ContractStep key={contract.id} contract={contract} step={flashpoint.contracts.length + index + 1} />
                        ))}
                      </ol>
                    )}
                    <PathPay path={path} />
                    {path.reward && <RewardBlock reward={path.reward} />}
                  </section>
                ))}
              <p className="guide-detail-footer"><a className="guide-map-link" href={getFlashpointMapUrl(flashpoint)}>Show {flashpoint.system} on the star map</a></p>
            </div>
            <aside className="guide-detail-side">
              <h3>Requirements</h3>
              <ul className="guide-requirements">
                {ally && <li>Allied with {ally}</li>}
                {reputation.map(item => <li key={item.faction}>Reputation above {item.min} with {item.faction}</li>)}
                {!ally && reputation.length === 0 && <li>None</li>}
              </ul>
              {flashpoint.target && <p className="guide-note">Against {flashpoint.target}.</p>}
              {flashpoint.paths.length > 1 && (
                <p className="guide-note">
                  A conversation decides the path.
                  {flashpoint.paths.some(path => !path.name) && ' The game does not name the options in its data, so they go by letter.'}
                </p>
              )}
              {flashpoint.cancelable && <p className="guide-note">It can be abandoned at that conversation, with no pay.</p>}
              {flashpoint.repeatable && <p className="guide-note">It can be played again.</p>}
              {flashpoint.reward && (
                <>
                  <h3>Reward</h3>
                  <RewardBlock reward={flashpoint.reward} />
                </>
              )}
              {!flashpoint.reward && flashpoint.paths.some(path => path.reward) && (
                <p className="guide-note">Each path has its own reward.</p>
              )}
            </aside>
          </div>
        </div>
      )}
    </li>
  );
}

function ListHeader() {
  return (
    <div className="guide-list-header" aria-hidden="true">
      <span>Name</span>
      <span>Offered at</span>
      <span>Reward</span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="guide-section" aria-label={title}>
      <h2>{title} <small>{count}</small></h2>
      {children}
    </section>
  );
}

export function BtFlashpointsApp() {
  const [view, setView] = useState<FlashpointsView>(() => parseFlashpointsQuery(window.location.search, flashpoints));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const shown = useMemo(() => filterFlashpoints(flashpoints, view.query, view.source), [view.query, view.source]);
  const groups = useMemo(() => groupFlashpoints(shown), [shown]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toFlashpointsQuery(view)}`);
  }, [view]);

  // El flashpoint abierto desde un enlace compartido se lleva a la vista al cargar, solo entonces.
  const [initialOpen] = useState(() => view.open && `fp-${view.open}`);
  useEffect(() => {
    if (initialOpen) document.getElementById(initialOpen)?.scrollIntoView({ block: 'start' });
  }, [initialOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const update = (change: Partial<FlashpointsView>) => setView(current => ({ ...current, ...change }));
  const toggle = (id: string) => setView(current => ({ ...current, open: current.open === id ? null : id }));

  return (
    <div className="units guide">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Flashpoints</h1>
        <nav className="units-links" aria-label="BATTLETECH">
          <a href="/battletech/"><small>BATTLETECH</small> MechLab</a>
          <a href="/battletech/chassis/">Chassis</a>
          <a href="/battletech/starmap/">Star map</a>
          <a href="/battletech/flashpoints/" aria-current="page">Flashpoints</a>
          <a href="/battletech/units/">Enemy units</a>
          <a href="/battletech/argo/">Argo</a>
          <a href="/battletech/equipment/">Equipment</a>
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
            Flashpoints are short story arcs offered in one system: a chain of contracts with conversations in between and,
            in most of them, a decision that leads to one ending or another. Open any of them to see where it is offered,
            its contracts in order, what each path pays and the reward at the end; the system opens
            the <a href="/battletech/starmap/">star map</a> and the 'Mechs open in the MechLab.
          </p>
        </section>

        <section className="units-controls" aria-label="Filters">
          <div className="units-kinds" role="group" aria-label="DLC">
            <button type="button" aria-pressed={view.source === 'all'} onClick={() => update({ source: 'all' })}>
              All <small>{filterFlashpoints(flashpoints, view.query, 'all').length}</small>
            </button>
            {FLASHPOINT_SOURCES.map(source => (
              <button key={source.id} type="button" aria-pressed={view.source === source.id} onClick={() => update({ source: source.id })}>
                {source.label} <small>{filterFlashpoints(flashpoints, view.query, source.id).length}</small>
              </button>
            ))}
          </div>
          <div className="units-search">
            <input
              type="search"
              placeholder="Name, system, employer, contract or 'Mech"
              aria-label="Search flashpoints"
              value={view.query}
              onChange={event => update({ query: event.target.value })}
            />
          </div>
        </section>

        {shown.length === 0 && <p className="units-empty">Nothing matches this search.</p>}

        {groups.map(group => (
          <Section key={group.source} title={sourceLabel(group.source)} count={group.flashpoints.length}>
            <p>{FLASHPOINT_SOURCES.find(source => source.id === group.source)?.note}</p>
            <ListHeader />
            <ul className="guide-list">
              {group.flashpoints.map(flashpoint => (
                <Row key={flashpoint.id} flashpoint={flashpoint} open={view.open === flashpoint.id} onToggle={() => toggle(flashpoint.id)} />
              ))}
            </ul>
          </Section>
        ))}
      </main>

      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toFlashpointsQuery(view)}`}
          attachLabel="Attach a link to this page"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
