import { PublishedBuildsPage, type PublishedBuildSummary } from '../../components/PublishedBuildsPage';
import { BT_BUILD_SORT_KEY } from '../../hooks/useBuildSort';
import { getBtBuildUrl } from '../../utils/battletech/buildCode';
import { findMech, getMechDisplayName } from '../../utils/battletech/mechlabData';
import { BT_BUILD_LIST, summarizeBtSavedBuild } from '../../utils/battletech/savedBuildRows';
import type { SavedBuild } from '../../utils/savedBuildsCore';

// Cada build se reconstruye con los datos actuales del juego, como en My builds.
const summarize = (build: SavedBuild): PublishedBuildSummary => {
  const { decoded, listRow, weaponCounts, tags, meta } = summarizeBtSavedBuild(build);
  return { canOpen: decoded !== null, listRow, weaponCounts, tags, meta };
};

const mechName = (mechId: string) => {
  const mech = findMech(mechId);
  return mech ? getMechDisplayName(mech) : null;
};

export function BtBuildsApp() {
  return (
    <PublishedBuildsPage
      game="battletech"
      navLabel="BATTLETECH"
      nav={<>
        <a href="/battletech/"><small>BATTLETECH</small> MechLab</a>
        <a href="/battletech/chassis/">Chassis</a>
        <a href="/battletech/flashpoints/">Flashpoints</a>
        <a href="/battletech/starmap/">Star map</a>
        <a href="/battletech/units/">Enemy units</a>
        <a href="/battletech/argo/">Argo</a>
        <a href="/battletech/equipment/">Equipment</a>
      </>}
      intro={<p>
        Builds published by other players, rebuilt with the current game data. Filter them like My builds, vote the ones
        you like and open any of them in the MechLab. To publish yours, use Publish in the MechLab toolbar.
      </p>}
      config={BT_BUILD_LIST}
      sortKey={BT_BUILD_SORT_KEY}
      summarize={summarize}
      mechName={mechName}
      buildUrl={getBtBuildUrl}
    />
  );
}
