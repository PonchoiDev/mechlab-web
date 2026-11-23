import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBuildListFilters } from '../hooks/useBuildListFilters';
import { copyText } from '../services/clipboard';
import {
  BUILD_AUTHOR_MAX,
  BUILD_DESCRIPTION_MAX,
  BUILD_NAME_MAX,
  deletePublishedBuild,
  fetchPublishedBuilds,
  forgetOwnedKey,
  readOwnedKeys,
  readVotedIds,
  reportBuild,
  saveVotedIds,
  sortByVotes,
  toSavedBuild,
  updatePublishedBuild,
  voteBuild,
  type BuildGame,
  type BuildTextsInput,
  type PublishedBuild
} from '../utils/publishedBuilds';
import type { SavedBuild } from '../utils/savedBuildsCore';
import { showBuildEntries, type BuildListConfig, type BuildListRow, type BuildTag } from '../utils/savedBuildsList';
import { BuildTagList } from './BuildTagList';
import { BuildsListControls } from './BuildsListControls';
import { FeedbackDialog } from './FeedbackDialog';
import { SupportLink } from './SupportLink';
import { Toast } from './Toast';
import { WeaponTypeCounts } from './WeaponTypeCounts';
import { WhatsNew } from './WhatsNew';

// Una build publicada resumida con los datos del juego, como las de My builds.
export interface PublishedBuildSummary {
  canOpen: boolean;
  listRow: BuildListRow;
  weaponCounts: { type: string; count: number }[];
  tags: BuildTag[];
  meta: string;
}

interface PublishedBuildsPageProps {
  game: BuildGame;
  navLabel: string;
  nav: ReactNode;
  intro: ReactNode;
  config: BuildListConfig;
  sortKey: string;
  summarize: (build: SavedBuild) => PublishedBuildSummary;
  // El nombre de la variante de un mechId, para el filtro ?mech= que pone la lista de chasis.
  mechName: (mechId: string) => string | null;
  buildUrl: (code: string) => string;
}

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' });

type Confirming = { id: string; action: 'delete' | 'report' };

// La página de builds publicadas de un juego (/mercs/builds/ y /battletech/builds/): las de todos los
// jugadores, con los filtros y el orden de My builds, votos, denuncias y las propias editables.
export function PublishedBuildsPage({ game, navLabel, nav, intro, config, sortKey, summarize, mechName, buildUrl }: PublishedBuildsPageProps) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [mechFilter, setMechFilter] = useState(params.get('mech'));
  const highlighted = params.get('build');
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; builds: PublishedBuild[]; message: string }>(
    { status: 'loading', builds: [], message: '' }
  );
  const [owned, setOwned] = useState(() => readOwnedKeys(game));
  const [voted, setVoted] = useState(() => new Set(readVotedIds(game)));
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [byVotes, setByVotes] = useState(false);
  const [editing, setEditing] = useState<({ id: string } & BuildTextsInput) | null>(null);
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const filters = useBuildListFilters(sortKey);
  const showToast = useCallback((message: string) => setToast({ id: Date.now(), message }), []);

  useEffect(() => {
    let cancelled = false;
    fetchPublishedBuilds(game).then(result => {
      if (cancelled) return;
      setState(result.ok
        ? { status: 'ready', builds: result.data.builds, message: '' }
        : { status: 'error', builds: [], message: result.message });
    });
    return () => { cancelled = true; };
  }, [game]);

  useEffect(() => {
    if (state.status === 'ready' && highlighted) {
      document.querySelector(`[data-build-id="${CSS.escape(highlighted)}"]`)?.scrollIntoView({ block: 'center' });
    }
  }, [state.status, highlighted]);

  const entries = useMemo(
    () => state.builds
      .filter(build => !reported.has(build.id) && (!mechFilter || build.mechId === mechFilter))
      .map(build => ({ published: build, ...summarize(toSavedBuild(build)) })),
    [state.builds, reported, mechFilter, summarize]
  );
  const listRows = useMemo(() => entries.map(entry => entry.listRow), [entries]);
  const shown = useMemo(() => {
    const filtered = showBuildEntries(entries, filters.filter, filters.sort, highlighted);
    return byVotes
      ? sortByVotes(filtered.map(entry => ({ ...entry, votes: entry.published.votes, createdAt: entry.published.createdAt })))
      : filtered;
  }, [entries, filters.filter, filters.sort, byVotes, highlighted]);

  const replaceBuild = (id: string, change: (build: PublishedBuild) => PublishedBuild | null) =>
    setState(current => ({
      ...current,
      builds: current.builds.flatMap(build => {
        if (build.id !== id) return [build];
        const next = change(build);
        return next ? [next] : [];
      })
    }));

  const toggleVote = async (build: PublishedBuild) => {
    const voting = !voted.has(build.id);
    setBusy(build.id);
    const result = await voteBuild(game, build.id, voting);
    setBusy(null);
    // 409: ya había un voto desde esta conexión (por ejemplo, desde otro navegador): cuenta como votada.
    if (!result.ok && result.status !== 409) {
      showToast(result.message);
      return;
    }
    const next = new Set(voted);
    if (voting) next.add(build.id);
    else next.delete(build.id);
    setVoted(next);
    saveVotedIds(game, [...next]);
    if (result.ok) replaceBuild(build.id, current => ({ ...current, votes: result.data.votes }));
  };

  const report = async (build: PublishedBuild) => {
    setConfirming(null);
    const result = await reportBuild(game, build.id);
    if (!result.ok && result.status !== 409) {
      showToast(result.message);
      return;
    }
    setReported(current => new Set(current).add(build.id));
    showToast('Thanks. The build is hidden for you and will be reviewed.');
  };

  const remove = async (build: PublishedBuild) => {
    setConfirming(null);
    const editKey = owned[build.id];
    if (!editKey) return;
    const result = await deletePublishedBuild(game, build.id, editKey);
    if (!result.ok && result.status !== 404) {
      showToast(result.message);
      return;
    }
    forgetOwnedKey(game, build.id);
    setOwned(readOwnedKeys(game));
    replaceBuild(build.id, () => null);
    showToast(`Deleted “${build.name}”`);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const editKey = owned[editing.id];
    if (!editKey) return;
    setBusy(editing.id);
    const { id, ...texts } = editing;
    const result = await updatePublishedBuild(game, id, editKey, texts);
    setBusy(null);
    if (!result.ok) {
      showToast(result.message);
      return;
    }
    replaceBuild(id, current => ({ ...current, ...result.data.build }));
    setEditing(null);
    showToast('Build updated');
  };

  const copyLink = async (code: string) => {
    showToast(await copyText(buildUrl(code)) ? 'Build link copied' : 'Could not copy the link');
  };

  const filteredMech = mechFilter ? mechName(mechFilter) ?? mechFilter : null;
  const total = entries.length;

  return (
    <div className="units published-builds">
      <header className="units-topbar">
        <a className="units-brand" href="/">
          <span aria-hidden="true">M</span>
          <span>MW Builder</span>
        </a>
        <h1>Builds</h1>
        <nav className="units-links" aria-label={navLabel}>{nav}</nav>
        <div className="units-actions">
          <WhatsNew />
          <button type="button" className="units-feedback" aria-haspopup="dialog" onClick={() => setIsFeedbackOpen(true)}>Feedback</button>
          <SupportLink compact />
        </div>
      </header>

      <main className="units-main published-main">
        <section className="units-intro">{intro}</section>

        {filteredMech && (
          <p className="published-filter">
            Builds of the <strong>{filteredMech}</strong>
            <button type="button" className="utility-button" onClick={() => {
              setMechFilter(null);
              const url = new URL(window.location.href);
              url.searchParams.delete('mech');
              window.history.replaceState(null, '', url);
            }}>Show all</button>
          </p>
        )}

        {state.status === 'ready' && total > 0 && (
          <div className="builds-list-header">
            <span>{shown.length === total ? total : `${shown.length} of ${total}`} PUBLISHED</span>
          </div>
        )}
        {state.status === 'ready' && total > 0 && (
          <BuildsListControls
            state={filters}
            config={config}
            rows={listRows}
            byVotes={{ active: byVotes, onChange: setByVotes }}
          />
        )}

        <ul className="builds-list published-list">
          {state.status === 'loading' && <li className="builds-empty">Loading builds…</li>}
          {state.status === 'error' && <li className="builds-empty">{state.message}</li>}
          {state.status === 'ready' && total === 0 && (
            <li className="builds-empty">
              {filteredMech ? 'No builds of this variant yet.' : 'No builds published yet.'} Publish yours from the MechLab with Publish in the toolbar.
            </li>
          )}
          {state.status === 'ready' && total > 0 && shown.length === 0 && (
            <li className="builds-empty">
              No builds match these filters.
              <br />
              <button type="button" className="utility-button" onClick={filters.clear}>Clear filters</button>
            </li>
          )}
          {shown.map(({ published, canOpen, meta, weaponCounts, tags }) => {
            const isOwn = Boolean(owned[published.id]);
            const isEditing = editing?.id === published.id;
            const isConfirming = confirming?.id === published.id;
            const hasVoted = voted.has(published.id);
            return (
              <li
                key={published.id}
                className={['builds-item', published.id === highlighted ? 'is-new' : ''].filter(Boolean).join(' ')}
                data-build-id={published.id}
              >
                <button
                  type="button"
                  className={hasVoted ? 'published-vote is-voted' : 'published-vote'}
                  aria-pressed={hasVoted}
                  aria-label={`${hasVoted ? 'Remove your vote' : 'Vote'} (${published.votes} ${published.votes === 1 ? 'vote' : 'votes'})`}
                  title={hasVoted ? 'Remove your vote' : 'Vote for this build'}
                  disabled={busy === published.id}
                  onClick={() => toggleVote(published)}
                >
                  <span aria-hidden="true">▲</span>
                  <strong>{published.votes}</strong>
                </button>

                <div className="builds-item-info">
                  {isEditing ? (
                    <form className="publish-form published-edit" onSubmit={(event) => { event.preventDefault(); saveEdit(); }}>
                      <input
                        type="text"
                        value={editing.name}
                        maxLength={BUILD_NAME_MAX}
                        aria-label="Build name"
                        autoFocus
                        onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                      />
                      <textarea
                        value={editing.description}
                        maxLength={BUILD_DESCRIPTION_MAX}
                        rows={3}
                        aria-label="Description"
                        placeholder="Description"
                        onChange={(event) => setEditing({ ...editing, description: event.target.value })}
                      />
                      <input
                        type="text"
                        value={editing.author}
                        maxLength={BUILD_AUTHOR_MAX}
                        aria-label="Author"
                        placeholder="Author"
                        onChange={(event) => setEditing({ ...editing, author: event.target.value })}
                      />
                      <div className="publish-actions">
                        <button type="button" className="utility-button" onClick={() => setEditing(null)}>Cancel</button>
                        <button type="submit" className="utility-button utility-button-primary" disabled={busy === published.id}>Save</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <strong>
                        {published.name}
                        {isOwn && <span className="published-own">YOURS</span>}
                      </strong>
                      <span className="builds-item-meta">{meta}</span>
                      {canOpen && (
                        <span className="builds-item-loadout">
                          <WeaponTypeCounts counts={weaponCounts} short={config.weaponShort} labels={config.weaponLabels} />
                          <BuildTagList tags={tags} />
                        </span>
                      )}
                      {published.description && <p className="published-description">{published.description}</p>}
                      <span className="builds-item-date">
                        {published.author ? `By ${published.author} · ` : ''}Published {dateFormat.format(new Date(published.createdAt))}
                        {!canOpen && ' · This build no longer opens with the current game data'}
                      </span>
                    </>
                  )}
                </div>

                {isConfirming ? (
                  <div className="builds-item-actions">
                    <span className="builds-confirm">
                      {confirming.action === 'delete' ? 'Delete this build for everyone?' : 'Report this build as spam or offensive?'}
                    </span>
                    <button type="button" className="utility-button" onClick={() => setConfirming(null)}>Cancel</button>
                    <button
                      type="button"
                      className="utility-button is-danger"
                      onClick={() => confirming.action === 'delete' ? remove(published) : report(published)}
                    >
                      {confirming.action === 'delete' ? 'Delete' : 'Report'}
                    </button>
                  </div>
                ) : !isEditing && (
                  <div className="builds-item-actions">
                    {canOpen
                      ? <a className="utility-button utility-button-primary" href={buildUrl(published.code)}>Open</a>
                      : <span className="utility-button utility-button-primary is-disabled" aria-disabled="true">Open</span>}
                    <button type="button" className="utility-button" disabled={!canOpen} onClick={() => copyLink(published.code)}>Copy link</button>
                    {isOwn ? (
                      <>
                        <button
                          type="button"
                          className="utility-button"
                          onClick={() => setEditing({ id: published.id, name: published.name, description: published.description, author: published.author })}
                        >
                          Edit
                        </button>
                        <button type="button" className="utility-button" onClick={() => setConfirming({ id: published.id, action: 'delete' })}>Delete</button>
                      </>
                    ) : (
                      <button type="button" className="utility-button" onClick={() => setConfirming({ id: published.id, action: 'report' })}>Report</button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>

      {toast && <Toast key={toast.id} message={toast.message} onDismiss={() => setToast(null)} />}
      {isFeedbackOpen && <FeedbackDialog buildUrl={null} onMessage={showToast} onClose={() => setIsFeedbackOpen(false)} />}
    </div>
  );
}
