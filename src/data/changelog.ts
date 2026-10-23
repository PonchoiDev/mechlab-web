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
    id: '2026-10-23-masc',
    date: '2026-10-23',
    title: 'MASC and Superchargers',
    items: [
      'MASC, Clan MASC and Superchargers are in the catalog, so the stock loadouts that carry them are complete',
      'Top speed also shows the boosted speed while MASC or the Supercharger is active'
    ]
  },
  {
    id: '2026-10-23-remove-equipment',
    date: '2026-10-23',
    title: 'Remove equipment',
    items: [
      'Remove equipment in the toolbar clears heat sinks, jump jets and the rest of the equipment in one click, next to Remove weapons and Remove ammo'
    ]
  },
  {
    id: '2026-10-23-game-stats',
    date: '2026-10-23',
    title: 'Stats now match the game',
    items: [
      'New Melee damage stat: melee weapons plus punches from empty hands, lower arms and Battle Fists',
      'Jump jets get their own spot in the stats bar',
      'Max range uses each weapon\'s maximum range (PPC 920 m, ER PPC 1500 m)',
      'Inner Sphere double heat sinks add the extra engine cooling',
      'Ferro-Fibrous armor gives 12% more points per ton, so those \'Mechs weigh what they should',
      'Checked against the stock loadouts of eight \'Mechs in the game',
      'Available by now starts in 3015, when the campaign begins, and Clan \'Mechs show up from the 3050 invasion'
    ]
  },
  {
    id: '2026-10-23-stock-builds',
    date: '2026-10-23',
    title: 'Stock loadouts and intro years',
    items: [
      'Picking a chassis now loads its stock loadout from the game: weapons with their tiers, equipment, ammo and armor',
      'Stock loadout in the toolbar brings it back after you change things',
      'Each variant in the chassis list shows the year it appears and its combat role',
      'New Available by filter: only the \'Mechs that exist in a given year of your campaign'
    ]
  },
  {
    id: '2026-10-23-hardpoint-fixes',
    date: '2026-10-23',
    title: 'Hardpoint fixes',
    items: [
      'Banshee BNC-LM and BNC-SR hero hardpoints are back, in the head and left arm',
      'Loki HBR-A arms now match the game: UAC/5 on the right, ER Large Lasers on the left',
      'Timber Wolf TBR-A gets back its three energy hardpoints in the left torso',
      'Hardpoints that carry a bigger stock weapon now fit it, like the Large Laser of the BSK-6 or the AC/20 of the CN9-YLW',
      'Artillery hardpoints also take regular missiles'
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
      'Artillery hardpoints have their own color and filter'
    ]
  }
];
