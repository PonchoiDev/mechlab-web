import { useEffect, useState } from 'react';
import type { Mech } from '../types/mech';
import { fetchSarnaAsset, getCachedSarnaAsset, type SarnaMechAsset } from '../services/sarna';

interface LoadedAsset {
  mechId: string;
  asset: SarnaMechAsset;
}

export const useSarnaAsset = (mech: Mech) => {
  const [loaded, setLoaded] = useState<LoadedAsset | null>(null);
  const cachedAsset = getCachedSarnaAsset(mech);
  const asset = loaded?.mechId === mech.id ? loaded.asset : cachedAsset ?? null;

  useEffect(() => {
    if (getCachedSarnaAsset(mech)) return;

    const controller = new AbortController();
    fetchSarnaAsset(mech, controller.signal)
      .then(result => setLoaded({ mechId: mech.id, asset: result }))
      .catch(() => undefined);

    return () => controller.abort();
  }, [mech]);

  const markImageBroken = () => {
    if (asset) setLoaded({ mechId: mech.id, asset: { ...asset, imageUrl: null } });
  };

  return { asset, isLoading: asset === null, markImageBroken };
};
