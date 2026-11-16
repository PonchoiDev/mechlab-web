import type { BtFlashpoint, BtFlashpointSource } from '../../types/battletech-flashpoints';

// Página de flashpoints de BATTLETECH (docs/specs/battletech-flashpoints.md): grupos por DLC, búsqueda,
// enlaces y vista en la URL.

export const FLASHPOINT_SOURCES: { id: BtFlashpointSource; label: string; note: string }[] = [
  { id: 'flashpoint', label: 'Flashpoint', note: 'The DLC that brought flashpoints: short stories for the Great Houses and the mercenary units of the Inner Sphere, and the alliances with each House.' },
  { id: 'heavymetal', label: 'Heavy Metal', note: "Darius and the hunt for the Star League: flashpoints with Farah, the Baumann Group and a rare 'Mech at the end." },
  { id: 'urbanwarfare', label: 'Urban Warfare', note: 'City fights in Liao and Kurita space, a tournament and the scramble for a prototype.' }
];

export const FLASHPOINT_LENGTHS: Record<BtFlashpoint['length'], string> = { short: 'Short', medium: 'Medium', long: 'Long' };

export const groupFlashpoints = (flashpoints: BtFlashpoint[]): { source: BtFlashpointSource; flashpoints: BtFlashpoint[] }[] =>
  FLASHPOINT_SOURCES
    .map(source => ({ source: source.id, flashpoints: flashpoints.filter(flashpoint => flashpoint.source === source.id) }))
    .filter(group => group.flashpoints.length > 0);

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Lo que se busca: nombre, sistema, quien lo encarga, contratos y 'Mechs de la recompensa.
const searchText = (flashpoint: BtFlashpoint) => normalize([
  flashpoint.name,
  flashpoint.system,
  flashpoint.employer ?? '',
  ...[...flashpoint.contracts, ...flashpoint.paths.flatMap(path => path.contracts)].map(contract => contract.name),
  ...(flashpoint.reward?.mechs.map(mech => mech.name) ?? [])
].join(' '));

export type FlashpointSourceFilter = BtFlashpointSource | 'all';

export const filterFlashpoints = (flashpoints: BtFlashpoint[], query: string, source: FlashpointSourceFilter): BtFlashpoint[] => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  return flashpoints.filter(flashpoint => (source === 'all' || flashpoint.source === source) &&
    words.every(word => searchText(flashpoint).includes(word)));
};

export const getFlashpointMapUrl = (flashpoint: BtFlashpoint): string =>
  `/battletech/starmap/?system=${encodeURIComponent(flashpoint.system)}`;

export const getBtMechLabUrl = (mechId: string): string => `/battletech/?mech=${encodeURIComponent(mechId)}`;

export interface FlashpointsView {
  query: string;
  source: FlashpointSourceFilter;
  // Id del flashpoint desplegado.
  open: string | null;
}

export const DEFAULT_FLASHPOINTS_VIEW: FlashpointsView = { query: '', source: 'all', open: null };

// ?dlc=heavymetal&q=hour, ?fp=morganKell. Lo que no existe se ignora.
export const parseFlashpointsQuery = (search: string, flashpoints: BtFlashpoint[]): FlashpointsView => {
  const params = new URLSearchParams(search);
  const dlc = params.get('dlc');
  const open = params.get('fp');
  return {
    query: params.get('q') ?? '',
    source: FLASHPOINT_SOURCES.some(source => source.id === dlc) ? dlc as BtFlashpointSource : 'all',
    open: open && flashpoints.some(flashpoint => flashpoint.id === open) ? open : null
  };
};

export const toFlashpointsQuery = ({ query, source, open }: FlashpointsView): string => {
  const params = new URLSearchParams();
  if (source !== 'all') params.set('dlc', source);
  if (query.trim()) params.set('q', query.trim());
  if (open) params.set('fp', open);
  const text = params.toString();
  return text ? `?${text}` : '';
};
