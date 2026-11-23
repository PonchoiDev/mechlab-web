import itemsData from '../data/items.json';
import mechsData from '../data/mechs.json';
import { PublishedBuildsPage, type PublishedBuildSummary } from '../components/PublishedBuildsPage';
import { MERCS_BUILD_SORT_KEY } from '../hooks/useBuildSort';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { getBuildUrl } from '../utils/buildCode';
import { getMechDisplayName } from '../utils/mechs';
import { MERCS_BUILD_LIST, summarizeSavedBuild } from '../utils/savedBuildRows';
import type { SavedBuild } from '../utils/savedBuildsCore';

const mechs = mechsData as unknown as Mech[];
const items = Object.values(itemsData) as Item[];
const mechsById = new Map(mechs.map(mech => [mech.id, mech]));

// Cada build se reconstruye con los datos actuales del juego, como en My builds.
const summarize = (build: SavedBuild): PublishedBuildSummary => {
  const { shared, listRow, weaponCounts, tags, meta } = summarizeSavedBuild(build, mechs, items);
  return { canOpen: shared !== null, listRow, weaponCounts, tags, meta };
};

const mechName = (mechId: string) => {
  const mech = mechsById.get(mechId);
  return mech ? `${getMechDisplayName(mech)} ${mech.variant}` : null;
};

export function BuildsApp() {
  return (
    <PublishedBuildsPage
      game="mercs"
      navLabel="MW Builder"
      nav={<>
        <a href="/mercs/"><small>MW5 Mercenaries</small> MechLab</a>
        <a href="/mercs/chassis/">Chassis</a>
        <a href="/mercs/campaigns/">HRQ &amp; Campaigns</a>
        <a href="/mercs/starmap/">Star map</a>
        <a href="/mercs/units/">Enemy units</a>
        <a href="/mercs/pilots/">Pilots</a>
        <a href="/mercs/equipment/">Equipment</a>
      </>}
      intro={<p>
        Builds published by other players, rebuilt with the current game data. Filter them like My builds, vote the ones
        you like and open any of them in the MechLab. To publish yours, use Publish in the MechLab toolbar.
      </p>}
      config={MERCS_BUILD_LIST}
      sortKey={MERCS_BUILD_SORT_KEY}
      summarize={summarize}
      mechName={mechName}
      buildUrl={getBuildUrl}
    />
  );
}
