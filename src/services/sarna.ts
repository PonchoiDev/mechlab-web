import type { Mech } from '../types/mech';

export interface SarnaMechAsset {
  imageUrl: string | null;
  pageUrl: string;
}

interface SarnaPage {
  title: string;
  thumbnail?: { source: string };
  images?: { title: string }[];
  links?: { title: string }[];
  imageinfo?: { thumburl?: string; url?: string }[];
}

interface SarnaApiResponse {
  query?: {
    pages?: Record<string, SarnaPage>;
  };
}

const SARNA_API_URL = 'https://www.sarna.net/wiki/api.php';
const SARNA_WIKI_URL = 'https://www.sarna.net/wiki/';
const SARNA_TITLE_ALIASES: Record<string, string> = {
  loaderking: 'Loader King'
};

const assetCache = new Map<string, SarnaMechAsset>();

export const getSarnaTitle = (mech: Mech): string => {
  const canonicalName = mech.sarnaName ?? mech.name;
  return SARNA_TITLE_ALIASES[canonicalName.toLowerCase()] ?? canonicalName;
};

const getSarnaPageUrl = (title: string): string =>
  `${SARNA_WIKI_URL}${encodeURIComponent(title.replace(/ /g, '_'))}`;

const querySarna = async (params: Record<string, string>, signal: AbortSignal): Promise<SarnaPage[]> => {
  const query = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params });
  const response = await fetch(`${SARNA_API_URL}?${query}`, { signal });
  if (!response.ok) throw new Error('No se pudo consultar Sarna');
  const data = await response.json() as SarnaApiResponse;
  return Object.values(data.query?.pages ?? {});
};

const fetchSarnaPages = (titles: string, prop: string, signal: AbortSignal) =>
  querySarna({
    prop,
    piprop: 'thumbnail',
    pithumbsize: '900',
    imlimit: 'max',
    pllimit: 'max',
    redirects: '1',
    titles
  }, signal);

const fetchImageUrl = async (title: string, signal: AbortSignal): Promise<string | null> => {
  const [imagePage] = await querySarna({ prop: 'imageinfo', iiprop: 'url', iiurlwidth: '900', titles: title }, signal);
  return imagePage?.imageinfo?.[0]?.thumburl ?? imagePage?.imageinfo?.[0]?.url ?? null;
};

const normalizeImageTitle = (title: string) => title
  .replace(/^File:/i, '')
  .toLocaleLowerCase()
  .replace(/[^a-z0-9]/g, '');

export const getCachedSarnaAsset = (mech: Mech): SarnaMechAsset | undefined => assetCache.get(mech.id);

export const fetchSarnaAsset = async (mech: Mech, signal: AbortSignal): Promise<SarnaMechAsset> => {
  const sarnaTitle = getSarnaTitle(mech);
  const isClanRefit = /\(C\)$/i.test(mech.variant);
  const variantImageTerms = isClanRefit ? [...new Set([`${sarnaTitle} C`, mech.variant])] : [];

  try {
    let [page] = await fetchSarnaPages(sarnaTitle, 'pageimages|images|links', signal);
    let imageUrl = page?.thumbnail?.source ?? null;

    if (!imageUrl && page?.links) {
      const mechLink = page.links.find(link => /\(BattleMech\)$/i.test(link.title)) ??
        page.links.find(link => /\(OmniMech\)$/i.test(link.title));
      if (mechLink) {
        const [mechPage] = await fetchSarnaPages(mechLink.title, 'pageimages|images', signal);
        page = mechPage ?? page;
        imageUrl = page.thumbnail?.source ?? null;
      }
    }

    const variantImage = variantImageTerms
      .map(term => page?.images?.find(image => normalizeImageTitle(image.title).includes(normalizeImageTitle(term))))
      .find((image): image is { title: string } => image !== undefined);
    const galleryImage = variantImage ?? (!imageUrl
      ? page?.images?.find(image => !/(disambig|logo|publisher)/i.test(image.title))
      : undefined);

    if (galleryImage) {
      try {
        imageUrl = await fetchImageUrl(galleryImage.title, signal) ?? imageUrl;
      } catch (error) {
        if (signal.aborted) throw error;
      }
    }

    const asset = { imageUrl, pageUrl: getSarnaPageUrl(page?.title ?? sarnaTitle) };
    assetCache.set(mech.id, asset);
    return asset;
  } catch (error) {
    if (signal.aborted) throw error;
    return { imageUrl: null, pageUrl: getSarnaPageUrl(sarnaTitle) };
  }
};
