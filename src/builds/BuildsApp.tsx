import { useCallback, useState } from 'react';
import itemsData from '../data/items.json';
import mechsData from '../data/mechs.json';
import { PublishedBuildsPage, type PublishedBuildSummary } from '../components/PublishedBuildsPage';
import { MERCS_BUILD_SORT_KEY } from '../hooks/useBuildSort';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { getMechDisplayName } from '../utils/mechs';
import { getPublishedBuildUrl, isYamlBuildCode, type PublishedBuild } from '../utils/publishedBuilds';
import { MERCS_BUILD_LIST, summarizeSavedBuild } from '../utils/savedBuildRows';
import type { SavedBuild } from '../utils/savedBuildsCore';
import type { BuildListConfig } from '../utils/savedBuildsList';

const mechs = mechsData as unknown as Mech[];
const items = Object.values(itemsData) as Item[];
const mechsById = new Map(mechs.map(mech => [mech.id, mech]));

// Las builds del MechLab de YAML se publican aquí con las de MW5 (docs/specs/publicar-builds-yaml.md). Dos
// interruptores, con el icono de MW5 (tools/extraer_logos.py) y el de Yet Another Mechlab, enseñan u ocultan
// cada origen; en My builds de esta página todas son de MW5, así que no salen.
const PUBLISHED_BUILD_LIST: BuildListConfig = {
  ...MERCS_BUILD_LIST,
  partGroups: [{
    id: 'source',
    label: 'Source',
    title: 'MechLab the build was made in: the game without mods or YAML',
    toggles: [
      { value: 'Vanilla', label: 'Vanilla', icon: `${import.meta.env.BASE_URL}mechlab/mw5-icon.png` },
      { value: 'YAML', label: 'YAML', icon: `${import.meta.env.BASE_URL}mechlab/yaml/mods/yet-another-mechlab-color.png` }
    ]
  }],
  partGroupsLabel: null
};

type YamlRows = typeof import('../utils/yaml/savedBuildRows');

// Cada build se reconstruye con los datos actuales del juego, como en My builds.
const summarizeMercs = (build: SavedBuild): PublishedBuildSummary => {
  const { shared, listRow, weaponCounts, tags, meta } = summarizeSavedBuild(build, mechs, items);
  return { canOpen: shared !== null, listRow: { ...listRow, parts: { source: 'Vanilla' } }, weaponCounts, tags, meta };
};

// Las de YAML, con los datos de YAML, que se descargan aparte; mientras llegan, sin cifras ni Open.
const summarizeYaml = (build: SavedBuild, yamlRows: YamlRows | null): PublishedBuildSummary => {
  if (!yamlRows) {
    return {
      canOpen: false,
      listRow: {
        id: build.id, name: build.name, savedAt: build.savedAt, chassis: null, variant: null, weightClass: null, tonnage: null,
        firepower: null, hardpoints: null, weapons: null, techBase: null, roles: [], features: [], parts: { source: 'YAML' }
      },
      weaponCounts: [],
      tags: [{ kind: 'yaml', label: 'YAML', title: 'Built in the YAML MechLab' }],
      meta: 'Loading YAML data…'
    };
  }
  const { decoded, listRow, weaponCounts, tags, meta } = yamlRows.summarizeYamlSavedBuild(build);
  return {
    canOpen: decoded !== null,
    listRow: { ...listRow, parts: { ...listRow.parts, source: 'YAML' } },
    weaponCounts,
    tags: [{ kind: 'yaml', label: 'YAML', title: 'Built in the YAML MechLab' }, ...tags],
    meta
  };
};

const mechName = (mechId: string) => {
  const mech = mechsById.get(mechId);
  return mech ? `${getMechDisplayName(mech)} ${mech.variant}` : null;
};

export function BuildsApp() {
  const [yamlRows, setYamlRows] = useState<YamlRows | null>(null);
  const summarize = useCallback(
    (build: SavedBuild) => isYamlBuildCode(build.code) ? summarizeYaml(build, yamlRows) : summarizeMercs(build),
    [yamlRows]
  );
  // Los datos de YAML pesan más que los de MW5: solo se descargan si la lista trae alguna build de YAML.
  const loadYamlIfNeeded = useCallback((builds: PublishedBuild[]) => {
    if (yamlRows || !builds.some(build => isYamlBuildCode(build.code))) return;
    import('../utils/yaml/savedBuildRows').then(setYamlRows, () => undefined);
  }, [yamlRows]);

  return (
    <PublishedBuildsPage
      game="mercs"
      intro={<p>
        Builds published by other players, rebuilt with the current game data. Filter them like My builds, vote the ones
        you like and open any of them in the MechLab. Builds tagged YAML were made in the YAML MechLab and open there.
        To publish yours, use My builds below or Publish in the MechLab toolbar.
      </p>}
      config={PUBLISHED_BUILD_LIST}
      savedConfig={MERCS_BUILD_LIST}
      sortKey={MERCS_BUILD_SORT_KEY}
      summarize={summarize}
      mechName={mechName}
      buildUrl={code => getPublishedBuildUrl(code)}
      mechlabUrl="/mercs/"
      onBuildsChange={loadYamlIfNeeded}
    />
  );
}
