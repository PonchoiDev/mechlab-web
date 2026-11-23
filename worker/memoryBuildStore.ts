import type { BuildStore, PublishedBuild, StoredBuild } from './builds.ts';

// Almacén de builds publicadas en memoria, con el mismo comportamiento que el de D1 (buildStore.ts): para los
// tests y para el servidor de desarrollo, que no tiene base de datos. Se pierde al reiniciar.
export const createMemoryBuildStore = (): BuildStore => {
  const builds = new Map<string, StoredBuild & { hidden: boolean }>();
  const votes = new Map<string, Set<string>>();
  const reports = new Map<string, Set<string>>();
  const setOf = (map: Map<string, Set<string>>, id: string) => map.get(id) ?? map.set(id, new Set()).get(id)!;
  const visible = (id: string) => {
    const build = builds.get(id);
    return build && !build.hidden ? build : null;
  };
  const toPublic = ({ editKeyHash: _key, ipHash: _ip, hidden: _hidden, ...build }: StoredBuild & { hidden: boolean }): PublishedBuild => build;

  return {
    list: async (game, limit) => [...builds.values()]
      .filter(build => build.game === game && !build.hidden)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(toPublic),
    get: async id => {
      const build = visible(id);
      if (!build) return null;
      const { hidden: _hidden, ...stored } = build;
      return stored;
    },
    countPublishedSince: async (ipHash, since) =>
      [...builds.values()].filter(build => build.ipHash === ipHash && build.createdAt >= since).length,
    insert: async build => {
      builds.set(build.id, { ...build, hidden: false });
    },
    update: async (id, texts, updatedAt) => {
      const build = builds.get(id);
      if (build) builds.set(id, { ...build, ...texts, updatedAt });
    },
    remove: async id => {
      builds.delete(id);
      votes.delete(id);
      reports.delete(id);
    },
    addVote: async (id, ipHash) => {
      const voters = setOf(votes, id);
      if (voters.has(ipHash)) return null;
      voters.add(ipHash);
      builds.get(id)!.votes = voters.size;
      return voters.size;
    },
    removeVote: async (id, ipHash) => {
      const voters = setOf(votes, id);
      if (!voters.delete(ipHash)) return null;
      builds.get(id)!.votes = voters.size;
      return voters.size;
    },
    addReport: async (id, ipHash) => {
      const reporters = setOf(reports, id);
      if (reporters.has(ipHash)) return null;
      reporters.add(ipHash);
      return reporters.size;
    },
    hide: async id => {
      const build = builds.get(id);
      if (build) build.hidden = true;
    }
  };
};
