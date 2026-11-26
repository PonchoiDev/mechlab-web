import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import itemsData from '../data/items.json';
import mechsData from '../data/mechs.json';
import { PublishedBuildsPage, type PublishedBuildSummary } from '../components/PublishedBuildsPage';
import { MERCS_BUILD_SORT_KEY } from '../hooks/useBuildSort';
import type { Item } from '../types/item';
import type { Mech } from '../types/mech';
import { getMechDisplayName } from '../utils/mechs';
import { BUILD_SOURCE_KEY, getBuildSource, parseBuildSource, sourceForHighlighted, type BuildSource } from '../utils/buildSource';
import { getPublishedBuildUrl, isYamlBuildCode, type PublishedBuild } from '../utils/publishedBuilds';
import { MERCS_BUILD_LIST, summarizeSavedBuild } from '../utils/savedBuildRows';
import { YAML_SAVED_BUILDS_KEY, type SavedBuild } from '../utils/savedBuildsCore';
import type { BuildListConfig } from '../utils/savedBuildsList';

const mechs = mechsData as unknown as Mech[];
const items = Object.values(itemsData) as Item[];
const mechsById = new Map(mechs.map(mech => [mech.id, mech]));

// Las builds del MechLab de YAML se publican aquí con las de MW5 (docs/specs/publicar-builds-yaml.md), pero la
// página enseña las de un origen cada vez (docs/specs/origen-builds-publicadas.md), con los filtros y My builds
// de ese origen. Cada botón lleva el icono de MW5 (tools/extraer_logos.py) o el de Yet Another Mechlab.
const SOURCES: { id: BuildSource; label: string; title: string; icon: string }[] = [
  { id: 'vanilla', label: 'Vanilla', title: 'Builds made in the MechLab of the game without mods', icon: `${import.meta.env.BASE_URL}mechlab/mw5-icon.png` },
  { id: 'yaml', label: 'YAML', title: 'Builds made in the YAML MechLab', icon: `${import.meta.env.BASE_URL}mechlab/yaml/mods/yet-another-mechlab-color.png` }
];

const readStoredSource = (): BuildSource => {
  try {
    return parseBuildSource(window.localStorage.getItem(BUILD_SOURCE_KEY));
  } catch {
    return parseBuildSource(null);
  }
};

const storeSource = (source: BuildSource) => {
  try {
    window.localStorage.setItem(BUILD_SOURCE_KEY, source);
  } catch {
    // Sin almacenamiento, el origen elegido dura lo que la página abierta.
  }
};

// Los filtros de YAML vienen con sus datos; mientras llegan, los de MW5 sin piezas (sus builds aún no tienen cifras).
const LOADING_YAML_LIST: BuildListConfig = { ...MERCS_BUILD_LIST, partGroups: undefined };

const includeVanilla = (build: PublishedBuild) => getBuildSource(build.code) === 'vanilla';
const includeYaml = (build: PublishedBuild) => getBuildSource(build.code) === 'yaml';

type YamlRows = typeof import('../utils/yaml/savedBuildRows');

// Cada build se reconstruye con los datos actuales del juego, como en My builds.
const summarizeMercs = (build: SavedBuild): PublishedBuildSummary => {
  const { shared, listRow, weaponCounts, tags, meta } = summarizeSavedBuild(build, mechs, items);
  return { canOpen: shared !== null, listRow, weaponCounts, tags, meta };
};

// Las de YAML, con los datos de YAML, que se descargan aparte; mientras llegan, sin cifras ni Open.
const summarizeYaml = (build: SavedBuild, yamlRows: YamlRows | null): PublishedBuildSummary => {
  if (!yamlRows) {
    return {
      canOpen: false,
      listRow: {
        id: build.id, name: build.name, savedAt: build.savedAt, chassis: null, variant: null, weightClass: null, tonnage: null,
        firepower: null, hardpoints: null, weapons: null, techBase: null, roles: [], features: [], parts: {}
      },
      weaponCounts: [],
      tags: [{ kind: 'yaml', label: 'YAML', title: 'Built in the YAML MechLab' }],
      meta: 'Loading YAML data…'
    };
  }
  const { decoded, listRow, weaponCounts, tags, meta } = yamlRows.summarizeYamlSavedBuild(build);
  return {
    canOpen: decoded !== null,
    listRow,
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
  const [source, setSource] = useState(readStoredSource);
  const [yamlRows, setYamlRows] = useState<YamlRows | null>(null);
  const highlighted = useMemo(() => new URLSearchParams(window.location.search).get('build'), []);
  const linkChecked = useRef(!highlighted);
  const summarize = useCallback(
    (build: SavedBuild) => isYamlBuildCode(build.code) ? summarizeYaml(build, yamlRows) : summarizeMercs(build),
    [yamlRows]
  );

  // Los datos de YAML pesan más que los de MW5: solo se descargan al elegir YAML.
  useEffect(() => {
    if (source === 'yaml' && !yamlRows) import('../utils/yaml/savedBuildRows').then(setYamlRows, () => undefined);
  }, [source, yamlRows]);

  // El enlace que da publicar enseña la build aunque sea del otro origen, sin cambiar el que se recuerda.
  const followLink = useCallback((builds: PublishedBuild[]) => {
    if (linkChecked.current || builds.length === 0) return;
    linkChecked.current = true;
    setSource(current => sourceForHighlighted(builds, highlighted, current));
  }, [highlighted]);

  const choose = (next: BuildSource) => {
    setSource(next);
    storeSource(next);
  };

  const isYaml = source === 'yaml';
  return (
    <PublishedBuildsPage
      game="mercs"
      intro={<p>
        Builds published by other players, rebuilt with the current game data. Choose Vanilla for the game without
        mods or YAML for the YAML MechLab, filter them like My builds, vote the ones you like and open any of them in
        its MechLab. To publish yours, use My builds below or Publish in the MechLab toolbar.
      </p>}
      config={isYaml ? yamlRows?.YAML_BUILD_LIST ?? LOADING_YAML_LIST : MERCS_BUILD_LIST}
      sortKey={MERCS_BUILD_SORT_KEY}
      summarize={summarize}
      mechName={mechName}
      buildUrl={code => getPublishedBuildUrl(code)}
      savedBuildsKey={isYaml ? YAML_SAVED_BUILDS_KEY : undefined}
      mechlabUrl={isYaml ? '/mercs/yaml/' : '/mercs/'}
      onBuildsChange={followLink}
      include={isYaml ? includeYaml : includeVanilla}
      controls={
        <div className="published-source" role="radiogroup" aria-label="Builds made in">
          <span className="builds-filter-label">Source</span>
          {SOURCES.map(option => (
            <button
              key={option.id}
              type="button"
              role="radio"
              className="mech-filter-chip published-source-option"
              aria-checked={source === option.id}
              title={option.title}
              onClick={() => choose(option.id)}
            >
              <img src={option.icon} alt="" />
              {option.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
