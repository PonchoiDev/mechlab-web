import { isYamlBuildCode } from './publishedBuilds';

// La página de builds de MW5 enseña las del juego sin mods o las de YAML, nunca las dos: se juegan con otras
// reglas y tienen otros filtros (docs/specs/origen-builds-publicadas.md).
export type BuildSource = 'vanilla' | 'yaml';

export const BUILD_SOURCE_KEY = 'mw-builder:mercs:builds-source';

export const getBuildSource = (code: string): BuildSource => isYamlBuildCode(code) ? 'yaml' : 'vanilla';

// Lo guardado en el navegador; la primera vez, o con algo que no se reconoce, Vanilla.
export const parseBuildSource = (stored: string | null): BuildSource => stored === 'yaml' ? 'yaml' : 'vanilla';

// El enlace que da publicar (?build=) tiene que enseñar la build aunque sea del otro origen.
export const sourceForHighlighted = (
  builds: { id: string; code: string }[],
  highlighted: string | null,
  current: BuildSource
): BuildSource => {
  const build = highlighted ? builds.find(candidate => candidate.id === highlighted) : undefined;
  return build ? getBuildSource(build.code) : current;
};

export const filterBySource = <T extends { code: string }>(builds: T[], source: BuildSource): T[] =>
  builds.filter(build => getBuildSource(build.code) === source);
