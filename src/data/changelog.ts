// Novedades que muestra la campana de la cabecera, de la más reciente a la más antigua.
// Para anunciar algo nuevo basta con añadir una entrada al principio con un id que no se repita.
export interface ChangelogEntry {
  id: string;
  date: string;
  title: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: '2026-10-24-stock-builds',
    date: '2026-10-24',
    title: 'Stock loadouts and intro years',
    items: [
      'Picking a chassis now loads its stock loadout from the game: weapons with their tiers, equipment, ammo and armor',
      'Stock loadout in the toolbar brings it back after you change things',
      'Each variant in the chassis list shows the year it appears and its combat role',
      'New Available by filter: only the \'Mechs that exist in a given year of your campaign'
    ]
  },
  {
    id: '2026-10-23-chassis-filters',
    date: '2026-10-23',
    title: 'Chassis filters',
    items: [
      'Every variant in the chassis list shows its hardpoints (3E 2B 1M 2 Omni), and whether it has jump jets or ECM',
      'Filter by weight class, tech base, jump jets, ECM, AMS and minimum hardpoints. Omni hardpoints count as energy, ballistic or missile',
      'Shortcuts in the search box: try "3e 2m jj" or "ecm"',
      'This bell, to keep track of what\'s new'
    ]
  },
  {
    id: '2026-10-23-artillery',
    date: '2026-10-23',
    title: 'Arrow IV fix',
    items: [
      'Arrow IV now fits artillery hardpoints only, as in the game, instead of regular missile hardpoints',
      'Artillery hardpoints also take regular missiles',
      'Artillery hardpoints have their own color and filter'
    ]
  }
];
