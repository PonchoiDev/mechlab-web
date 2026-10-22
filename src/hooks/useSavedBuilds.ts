import { useCallback, useEffect, useState } from 'react';
import { mergeBuilds, parseStoredBuilds, type BuildEntry, type SavedBuild } from '../utils/savedBuilds';

const STORAGE_KEY = 'mw-builder:mercs:saved-builds';

const readStorage = (): SavedBuild[] => {
  try {
    return parseStoredBuilds(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
};

// randomUUID solo existe en contextos seguros; fuera de ellos basta con un id único en este navegador.
const createId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// Builds guardadas en este navegador (localStorage), sincronizadas entre pestañas abiertas.
export const useSavedBuilds = () => {
  const [builds, setBuilds] = useState<SavedBuild[]>(readStorage);
  const [storageFailed, setStorageFailed] = useState(false);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setBuilds(parseStoredBuilds(event.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const commit = useCallback((next: SavedBuild[]) => {
    setBuilds(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }, []);

  const saveBuild = (name: string, code: string): SavedBuild => {
    const build = { id: createId(), name, code, savedAt: new Date().toISOString() };
    commit([build, ...builds]);
    return build;
  };

  const updateBuild = (id: string, changes: Partial<Pick<SavedBuild, 'name' | 'code'>>) => {
    commit(builds.map(build => build.id === id
      ? { ...build, ...changes, ...(changes.code ? { savedAt: new Date().toISOString() } : {}) }
      : build));
  };

  // La copia se coloca justo encima de la original y queda como una build nueva.
  const duplicateBuild = (id: string): SavedBuild | null => {
    const index = builds.findIndex(build => build.id === id);
    if (index === -1) return null;
    const copy = { ...builds[index], id: createId(), name: `${builds[index].name} (copy)`, savedAt: new Date().toISOString() };
    commit([...builds.slice(0, index), copy, ...builds.slice(index)]);
    return copy;
  };

  const deleteBuild = (id: string) => commit(builds.filter(build => build.id !== id));

  const importBuilds = (entries: BuildEntry[]) => {
    const result = mergeBuilds(builds, entries, createId);
    commit(result.builds);
    return result;
  };

  return { builds, storageFailed, saveBuild, updateBuild, duplicateBuild, deleteBuild, importBuilds };
};
