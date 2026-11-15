import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import argoJson from '../../data/battletech/argo.json';
import type { ArgoData, ArgoUpgrade } from '../../types/battletech-argo';
import {
  addToPlan, formatEffect, getAllPlan, getAncestors, getCrewPortraitUrl, getDescendants, getIconUrl, getImageUrl, getPathCost,
  getPlanEffects, getPlanTotals, getStartingPlan, getStatus, getTreeLayout, getUnlocks, getUpgrade, groupByCategory, groupBySection,
  parseArgoQuery, removeFromPlan, toArgoQuery, type ArgoStatus, type ArgoView
} from '../../utils/battletech/argo';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { SupportLink } from '../../components/SupportLink';
import { WhatsNew } from '../../components/WhatsNew';

const data = argoJson as unknown as ArgoData;
const numberFormat = new Intl.NumberFormat('en');
const TREE = getTreeLayout(data);
const GROUPS = groupByCategory(data);
const SECTIONS = groupBySection(data);
const CATEGORY_NAMES = new Map(data.categories.map(category => [category.id, category.name]));
const CREW = new Map(data.crew.map(member => [member.id, member]));
const FULL_TOTALS = getPlanTotals(data, getAllPlan(data));
const STARTING = data.upgrades.filter(upgrade => upgrade.starting);
// La nave al completo pasa por seis niveles: «Tier 1» es lo que no pide nada.
const tierLabel = (tier: number) => `Tier ${tier + 1}`;
const STATUS_LABEL: Record<ArgoStatus, string> = {
  starting: 'Comes with the ship',
  owned: 'In your plan',
  available: 'Can be bought now',
  locked: 'Needs other upgrades first'
};
const cbills = (value: number) => `¢${numberFormat.format(value)}`;

type Select = (id: string) => void;

// Requisitos y mejoras que abre, como enlaces a su ficha, con el estado de cada una en el plan.
function UpgradeLinks({ ids, owned, onSelect }: { ids: string[]; owned: ReadonlySet<string>; onSelect: Select }) {
  return (
    <ul className="argo-links">
      {ids.map(id => (
        <li key={id}>
          <button type="button" className={owned.has(id) ? 'is-owned' : undefined} onClick={() => onSelect(id)}>
            {getUpgrade(data, id).name}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface CardProps {
  upgrade: ArgoUpgrade;
  owned: ReadonlySet<string>;
  onToggle: Select;
  onSelect: Select;
  isFocused?: boolean;
}

function UpgradeCard({ upgrade, owned, onToggle, onSelect, isFocused = false }: CardProps) {
  const status = getStatus(data, owned, upgrade.id);
  const path = getPathCost(data, owned, upgrade.id);
  const unlocks = getUnlocks(data, upgrade.id);
  const crew = upgrade.crew ? CREW.get(upgrade.crew) : undefined;
  return (
    <article id={`upgrade-${upgrade.id}`} className={`unit-card argo-card is-${status}${isFocused ? ' is-focused' : ''}`}>
      <header className="argo-card-header">
        <img src={getImageUrl(upgrade.image)} alt="" width={375} height={150} loading="lazy" decoding="async" />
        <div>
          <p className="unit-card-kind">
            <span className="argo-icon" style={{ '--icon': `url(${getIconUrl(upgrade.icon)})` } as CSSProperties} aria-hidden="true" />
            <span>{CATEGORY_NAMES.get(upgrade.category)}</span> <span>{tierLabel(upgrade.tier)}</span>
          </p>
          <h3>{upgrade.name}</h3>
        </div>
      </header>
      <dl className="unit-card-stats argo-card-stats">
        <div><dt>Cost</dt><dd>{upgrade.starting ? 'Included' : cbills(upgrade.cost)}</dd></div>
        <div><dt>Upkeep</dt><dd>{cbills(upgrade.upkeep)}<small>/mo</small></dd></div>
        {path.upgrades.length > 1 && (
          <div className="argo-card-path">
            <dt title="What it costs from your plan, with the requirements you are missing">With {path.upgrades.length - 1} missing</dt>
            <dd>{cbills(path.cost)}</dd>
          </div>
        )}
      </dl>
      <div className="argo-card-body">
        {upgrade.effects.length > 0 ? (
          <ul className="argo-effects">
            {upgrade.effects.map(effect => <li key={effect.stat}>{formatEffect(data, effect.stat, effect.value, effect.set)}</li>)}
          </ul>
        ) : <p className="argo-no-effects">No direct effect: it opens other upgrades.</p>}
        {upgrade.requires.length > 0 && (
          <div className="argo-relation"><h4>Requires</h4><UpgradeLinks ids={upgrade.requires} owned={owned} onSelect={onSelect} /></div>
        )}
        {unlocks.length > 0 && (
          <div className="argo-relation"><h4>Unlocks</h4><UpgradeLinks ids={unlocks} owned={owned} onSelect={onSelect} /></div>
        )}
        <p className="argo-details">{upgrade.details}</p>
      </div>
      {crew && upgrade.pitch && (
        <details className="unit-rarity argo-pitch">
          <summary>
            <img src={getCrewPortraitUrl(crew.id)} alt="" width={28} height={28} loading="lazy" decoding="async" />
            {crew.name} <small>{crew.rank}</small>
          </summary>
          <p>{upgrade.pitch}</p>
        </details>
      )}
      <footer className="argo-card-footer">
        {status === 'starting' ? (
          <span className="argo-included">Comes with the ship</span>
        ) : (
          <button type="button" className="argo-toggle" aria-pressed={status === 'owned'} onClick={() => onToggle(upgrade.id)}>
            {status === 'owned' ? 'In your plan' : status === 'available' ? 'Add to plan' : `Add with ${path.upgrades.length - 1} required`}
          </button>
        )}
      </footer>
    </article>
  );
}

// Requisitos (todo lo que hace falta antes) y lo que abre (todo lo que viene después) de la mejora
// resaltada: se marcan igual, en el color de la página, y el resto se apaga.
const useChain = (highlighted: string | null) => useMemo(() => highlighted
  ? { required: new Set(getAncestors(data, highlighted)), unlocked: new Set(getDescendants(data, highlighted)) }
  : null, [highlighted]);

// La pantalla Ship Upgrades del juego: tres secciones, cada una con sus cajas por categoría y un icono por
// mejora. Naranja lo que viene con la nave o está en el plan (lo instalado, en el juego), gris lo que se
// puede comprar y apagado lo que aún pide otras.
function ShipView({ owned, onOpen }: { owned: ReadonlySet<string>; onOpen: Select }) {
  const [hover, setHover] = useState<string | null>(null);
  const chain = useChain(hover);
  const tileClass = (id: string) => {
    const classes = ['argo-tile', `is-${getStatus(data, owned, id)}`];
    if (chain) classes.push(id === hover ? 'is-focus' : chain.required.has(id) || chain.unlocked.has(id) ? 'is-linked' : 'is-dim');
    return classes.join(' ');
  };
  return (
    <>
      <p className="argo-hint">
        Point at an upgrade to light up what it requires and what it unlocks. Click it to see its details and add it to your plan.
      </p>
      <div className="argo-ship" onMouseLeave={() => setHover(null)}>
        <img className="argo-blueprint" src={`${import.meta.env.BASE_URL}argo/blueprint.png`} alt="" width={288} height={288} />
        {SECTIONS.map(({ section, categories }) => (
          <section key={section.id} className={`argo-ship-section is-${section.id.toLowerCase().replace('_', '-')}`} aria-labelledby={`section-${section.id}`}>
            <h2 id={`section-${section.id}`}>
              <span className="argo-icon" style={{ '--icon': `url(${getIconUrl(section.icon)})` } as CSSProperties} aria-hidden="true" />
              {section.name}
            </h2>
            <div className="argo-boxes">
              {categories.map(({ category, upgrades }) => (
                <div key={category.id} className="argo-box" role="group" aria-label={category.label}>
                  <h3>{category.label}</h3>
                  <div className="argo-tiles">
                    {upgrades.map(upgrade => {
                      const status = getStatus(data, owned, upgrade.id);
                      return (
                        <button
                          key={upgrade.id}
                          type="button"
                          className={tileClass(upgrade.id)}
                          title={`${upgrade.name} · ${STATUS_LABEL[status]}`}
                          aria-label={`${upgrade.name}, ${STATUS_LABEL[status].toLowerCase()}`}
                          onMouseEnter={() => setHover(upgrade.id)}
                          onFocus={() => setHover(upgrade.id)}
                          onBlur={() => setHover(null)}
                          onClick={() => onOpen(upgrade.id)}
                        >
                          <span className="argo-icon" style={{ '--icon': `url(${getIconUrl(upgrade.icon)})` } as CSSProperties} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <ul className="argo-legend argo-ship-legend" aria-label="Legend">
        <li><i className="is-starting" /> Comes with the ship or in your plan</li>
        <li><i className="is-available" /> Can be bought now</li>
        <li><i className="is-locked" /> Needs other upgrades first</li>
      </ul>
    </>
  );
}

// La ficha de una mejora, como la ventana que abre el juego: se cierra con Close, con Escape o pulsando fuera.
function UpgradeDialog({ id, owned, onToggle, onSelect, onClose }: {
  id: string;
  owned: ReadonlySet<string>;
  onToggle: Select;
  onSelect: Select;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const upgrade = getUpgrade(data, id);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="argo-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="argo-dialog" role="dialog" aria-modal="true" aria-label={`${upgrade.name} details`}>
        <p className={`argo-dialog-status is-${getStatus(data, owned, id)}`}>{STATUS_LABEL[getStatus(data, owned, id)]}</p>
        <UpgradeCard upgrade={upgrade} owned={owned} onToggle={onToggle} onSelect={onSelect} />
        <button ref={closeRef} type="button" className="utility-button argo-dialog-close" onClick={onClose}>Close</button>
      </section>
    </div>
  );
}

function TreeView({ owned, focus, onToggle, onFocus, onSelect }: {
  owned: ReadonlySet<string>;
  focus: string | null;
  onToggle: Select;
  onFocus: (id: string | null) => void;
  onSelect: Select;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const highlighted = hover ?? focus;
  const chain = useChain(highlighted);
  // Lo que una mejora pide y lo que abre se resalta igual, en el color de la página; la diferencia
  // solo la dice una etiqueta pequeña, para no llenar el árbol de colores.
  const linkOf = (id: string) => chain?.required.has(id) ? 'Required' : chain?.unlocked.has(id) ? 'Unlocks' : null;
  const nodeClass = (id: string) => {
    const classes = ['argo-node', `is-${getStatus(data, owned, id)}`];
    if (chain) classes.push(id === highlighted ? 'is-focus' : linkOf(id) ? 'is-linked' : 'is-dim');
    return classes.join(' ');
  };
  const focused = focus ? getUpgrade(data, focus) : null;

  return (
    <>
      <p className="argo-hint">
        Point at an upgrade to light up the upgrades it requires and the ones it unlocks; the rest fade out.
        Click to add it to your plan with its requirements, or to remove it and everything that depends on it.
      </p>
      <div className="argo-tree-scroll" onMouseLeave={() => setHover(null)}>
        <div className="argo-tree" style={{ gridTemplateColumns: `minmax(96px, 112px) repeat(${TREE.tiers}, minmax(120px, 1fr))` }}>
          <div className="argo-tree-corner" />
          {Array.from({ length: TREE.tiers }, (_, tier) => <div key={tier} className="argo-tree-tier">{tierLabel(tier)}</div>)}
          {TREE.rows.map(row => (
            <div key={row.category.id} className="argo-tree-row" role="group" aria-label={row.category.name}>
              <div className="argo-tree-category">{row.category.name}</div>
              {row.cells.map((cell, tier) => (
                <div key={tier} className="argo-tree-cell">
                  {cell.map(upgrade => {
                    const status = getStatus(data, owned, upgrade.id);
                    const link = upgrade.id === highlighted ? null : linkOf(upgrade.id);
                    return (
                      <button
                        key={upgrade.id}
                        type="button"
                        className={nodeClass(upgrade.id)}
                        aria-pressed={status === 'starting' || status === 'owned'}
                        aria-describedby={focus === upgrade.id ? 'argo-focus-card' : undefined}
                        title={upgrade.requires.length > 0 ? `Requires ${upgrade.requires.map(id => getUpgrade(data, id).name).join(', ')}` : 'No requirements'}
                        onMouseEnter={() => setHover(upgrade.id)}
                        onFocus={() => onFocus(upgrade.id)}
                        onClick={() => {
                          onFocus(upgrade.id);
                          if (status !== 'starting') onToggle(upgrade.id);
                        }}
                      >
                        <span className="argo-node-name">{upgrade.name}</span>
                        <span className="argo-node-cost">{upgrade.starting ? 'Included' : cbills(upgrade.cost)}</span>
                        {link && <span className="argo-node-link">{link}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <ul className="argo-legend" aria-label="Legend">
        <li><i className="is-starting" /> Comes with the ship</li>
        <li><i className="is-owned" /> In your plan</li>
        <li><i className="is-available" /> Can be bought now</li>
        <li><i className="is-locked" /> Needs other upgrades first</li>
      </ul>
      {focused && (
        <section id="argo-focus-card" className="argo-focus" aria-label={`${focused.name} details`}>
          <UpgradeCard upgrade={focused} owned={owned} onToggle={onToggle} onSelect={onSelect} />
        </section>
      )}
    </>
  );
}

function ListView({ owned, focus, onToggle, onSelect }: {
  owned: ReadonlySet<string>;
  focus: string | null;
  onToggle: Select;
  onSelect: Select;
}) {
  return (
    <>
      {GROUPS.map(({ category, upgrades }) => (
        <section key={category.id} className="argo-section" aria-labelledby={`category-${category.id}`}>
          <h2 id={`category-${category.id}`}>{category.name} <small>{upgrades.length}</small></h2>
          <div className="units-grid">
            {upgrades.map(upgrade => (
              <UpgradeCard key={upgrade.id} upgrade={upgrade} owned={owned} onToggle={onToggle} onSelect={onSelect} isFocused={focus === upgrade.id} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function PlanPanel({ owned, onReset, onAll }: { owned: ReadonlySet<string>; onReset: () => void; onAll: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const totals = getPlanTotals(data, owned);
  const effects = getPlanEffects(data, owned);
  return (
    <aside className={`argo-plan${isOpen ? ' is-open' : ''}`} aria-label="Your plan">
      <button type="button" className="argo-plan-bar" aria-expanded={isOpen} onClick={() => setIsOpen(open => !open)}>
        <span>Plan <b>{totals.bought}/{FULL_TOTALS.bought}</b></span>
        <span><b>{cbills(totals.cost)}</b></span>
        <span><b>{cbills(totals.monthly)}</b>/mo</span>
      </button>
      <div className="argo-plan-body">
        <h2>Your plan</h2>
        <dl className="argo-plan-totals">
          <div><dt>Upgrades bought</dt><dd>{totals.bought} <small>of {FULL_TOTALS.bought}</small></dd></div>
          <div><dt>Total cost</dt><dd>{cbills(totals.cost)}</dd></div>
          <div>
            <dt title={`Paid every ${data.monthLength} days: the ship's base upkeep plus each upgrade`}>Argo upkeep</dt>
            <dd>{cbills(totals.monthly)}<small>/mo</small></dd>
          </div>
        </dl>
        <p className="argo-plan-split">{cbills(data.baseUpkeep)} base + {cbills(totals.upgradesUpkeep)} from upgrades</p>
        <h3>Ship effects</h3>
        <ul className="argo-effects">
          {effects.map(effect => <li key={effect.stat} title={effect.details}>{effect.text}</li>)}
        </ul>
        <div className="argo-plan-actions">
          <button type="button" className="utility-button" onClick={onReset} disabled={totals.bought === 0}>Reset</button>
          <button type="button" className="utility-button utility-button-primary" onClick={onAll} disabled={totals.bought === FULL_TOTALS.bought}>
            Buy everything
          </button>
        </div>
      </div>
    </aside>
  );
}

export function ArgoApp() {
  const [view, setView] = useState<ArgoView>(() => parseArgoQuery(data, window.location.search));
  const [focus, setFocus] = useState<string | null>(null);
  const [dialog, setDialog] = useState<string | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${toArgoQuery(data, view)}`);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const setOwned = (owned: Set<string>) => setView(current => ({ ...current, owned }));
  const toggle: Select = id => setView(current => ({
    ...current,
    owned: current.owned.has(id) ? removeFromPlan(data, current.owned, id) : addToPlan(data, current.owned, id)
  }));
  // Un requisito o una mejora que se abre: en la lista se va a su ficha; en el árbol pasa a ser la elegida.
  const select: Select = id => {
    setFocus(id);
    if (view.view === 'ship') setDialog(id);
    if (view.view === 'list') document.getElementById(`upgrade-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const closeDialog = useCallback(() => setDialog(null), []);

  return (
    <div className="units argo">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Argo</h1>
        <nav className="units-links" aria-label="BATTLETECH">
          <a href="/battletech/"><small>BATTLETECH</small> MechLab</a>
          <a href="/battletech/starmap/">Star map</a>
          <a href="/battletech/argo/" aria-current="page">Argo</a>
        </nav>
        <div className="units-actions">
          <WhatsNew />
          <button type="button" className="units-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <main className="units-main argo-main">
        <div className="argo-content">
          <section className="argo-hero" aria-label="The Argo">
            <img src={getImageUrl('ArgoTravel')} alt="The Argo in orbit" width={375} height={150} />
            <div>
              <p>
                Your mercenary company lives aboard the <i>Argo</i>, an old Star League ship that arrives barely working.
                Its {data.upgrades.length} upgrades repair and expand it: more 'Mechs ready for battle, more MechWarriors,
                faster healing and repairs, morale, training and shorter trips. Each one costs C-Bills once and adds to the
                monthly upkeep, and most need others first.
              </p>
              <p className="argo-modes">
                Career and campaign use the same prices and upkeep, except with the career option Reduced Argo Upgrade Costs,
                which halves both. In career mode upgrades are open from day one; in the campaign, once the story hands you the ship.
              </p>
            </div>
            <dl className="unit-card-stats argo-hero-stats">
              <div><dt>Upgrades</dt><dd>{data.upgrades.length}</dd></div>
              <div><dt title={STARTING.map(upgrade => upgrade.name).join(', ')}>Included</dt><dd>{STARTING.length}</dd></div>
              <div><dt>Base upkeep</dt><dd>{cbills(data.baseUpkeep)}<small>/mo</small></dd></div>
              <div><dt>Buying them all</dt><dd>{cbills(FULL_TOTALS.cost)}</dd></div>
              <div><dt>Fully upgraded</dt><dd>{cbills(FULL_TOTALS.monthly)}<small>/mo</small></dd></div>
            </dl>
          </section>

          <div className="argo-tabs" role="group" aria-label="View">
            <button type="button" aria-pressed={view.view === 'ship'} onClick={() => setView(current => ({ ...current, view: 'ship' }))}>
              Ship upgrades
            </button>
            <button type="button" aria-pressed={view.view === 'tree'} onClick={() => setView(current => ({ ...current, view: 'tree' }))}>
              Upgrade tree
            </button>
            <button type="button" aria-pressed={view.view === 'list'} onClick={() => setView(current => ({ ...current, view: 'list' }))}>
              All upgrades <small>{data.upgrades.length}</small>
            </button>
          </div>

          {view.view === 'ship' && <ShipView owned={view.owned} onOpen={setDialog} />}
          {view.view === 'tree' && <TreeView owned={view.owned} focus={focus} onToggle={toggle} onFocus={setFocus} onSelect={select} />}
          {view.view === 'list' && <ListView owned={view.owned} focus={focus} onToggle={toggle} onSelect={select} />}
        </div>

        <PlanPanel owned={view.owned} onReset={() => setOwned(getStartingPlan(data))} onAll={() => setOwned(getAllPlan(data))} />
      </main>

      {dialog && view.view === 'ship' && (
        <UpgradeDialog id={dialog} owned={view.owned} onToggle={toggle} onSelect={select} onClose={closeDialog} />
      )}
      {isFeedbackOpen && (
        <FeedbackDialog
          buildUrl={`${window.location.origin}${window.location.pathname}${toArgoQuery(data, view)}`}
          attachLabel="Attach a link to this plan"
          onMessage={setNotice}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}
      {notice && <p className="units-notice" role="status">{notice}</p>}
    </div>
  );
}
