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
    id: '2026-10-31-compare',
    date: '2026-10-31',
    title: 'Compare \'Mechs',
    items: [
      'Compare in the toolbar shows your build next to another \'Mech, each with its image, specs and loadout by component',
      'Compare with the stock loadout of any \'Mech or with one of your saved builds, upgrades included',
      'Each stat is shown side by side with a bar, and the better value is in green with the difference',
      'Load this build switches to the one you are comparing with'
    ]
  },
  {
    id: '2026-10-31-xl-engines',
    date: '2026-10-31',
    title: 'XL engine fix',
    items: [
      '29 variants now show their XL engine, as in the game, like the King Crab KGC-A (340 XL), the Black Knight BL-9-KNT and the Bushwackers',
      'Only the engine label changes: tonnage and stats were already right'
    ]
  },
  {
    id: '2026-10-29-dhs-cooling',
    date: '2026-10-29',
    title: 'Double heat sink cooling fix',
    items: [
      '\'Mechs with double heat sinks now show the same cooling as the game: the engine heat sinks cool 0.2 each, one per full 25 engine rating up to 10',
      'Fixes 75 variants, like the Catapult CTF-3L and the King Crab KGC-A, which showed 3.0 instead of 2.0, the Javelin JVN-11A, which showed 2.4 instead of 1.4, or the Puma (Adder), which showed 1.4 instead of 1.6'
    ]
  },
  {
    id: '2026-10-29-hero-dlc-filters',
    date: '2026-10-29',
    title: 'Hero, DLC and role filters',
    items: [
      'New Hero filter in the chassis list: only the 109 hero variants',
      'New DLC filter: pick the base game and the DLC you own to see only the \'Mechs you can get. Your choice is remembered in this browser',
      'Hero variants show a HERO tag next to their code, and DLC variants show the DLC they come with',
      'New Role filter: pick one or more combat roles, like Sniper or Missile Boat',
      'Search shortcuts: type hero, base or dlc1 to dlc9, for example hero dlc7'
    ]
  },
  {
    id: '2026-10-28-game-patch',
    date: '2026-10-28',
    title: 'Latest game patch',
    items: [
      'Base heat dissipation updated for 48 \'Mechs, including the ones the patch notes did not list, like every Bullshark',
      'Base heat capacity raised to 50 on 25 \'Mechs, as in the game',
      'Arm slots updated on 97 variants, mostly Clan OmniMechs',
      'Lower arm and hand melee hardpoints now come from each \'Mech model, which fixes the Blood Asp, Supernova, Hunchback IIC and others',
      'Chassis names come from the game texts: Clan \'Mechs show their Inner Sphere name, like Puma (Adder) or Behemoth (Stone Rhino)'
    ]
  },
  {
    id: '2026-10-25-cantina-upgrades',
    date: '2026-10-25',
    title: 'Cantina upgrades',
    items: [
      'Upgrades in the toolbar opens the cantina upgrades: install them in the \'Mech upgrade slots, like the in-game Upgrades screen',
      'Stats show the base value and, in green, the upgraded one: armor, volley and melee damage, cooling, top speed and range',
      'Bonuses add up as in the game: Enhanced Energy Output I and II give +15% energy damage',
      'Refined Armor also raises the armor of each component, as in the game',
      'Upgrades are saved in build links, My builds and the build image'
    ]
  },
  {
    id: '2026-10-25-stats-tabs',
    date: '2026-10-25',
    title: 'Weapon and \'Mech stats',
    items: [
      'The weapon table now shows max range, projectile velocity and totals for DPS and heat while firing',
      'New \'Mech tab with the chassis stats of the in-game Upgrades screen: structure, heat capacity, turn and torso twist speed, sensor range and target lock',
      'Every stat a cantina upgrade changes shows its base and upgraded value'
    ]
  },
  {
    id: '2026-10-24-hardpoint-sizes',
    date: '2026-10-24',
    title: 'Hardpoint sizes from the game',
    items: [
      'Hardpoint sizes now come from each \'Mech model in the game files instead of being guessed from the stock weapon',
      'Nearly 200 variants change, like the Nightstar NSR-WP, whose four torso missile hardpoints are all large',
      'Extra small hardpoints, like the Adder ADR-S torso ballistics, count as small'
    ]
  },
  {
    id: '2026-10-23-view-options',
    date: '2026-10-23',
    title: 'View options',
    items: [
      'Show slot cells displays every slot as a cell, like the Details view of the in-game mechlab, so you can see the free space while you build',
      'Compact board hides the \'Mech image and lays the components out in five columns',
      'The component panel can open on the left or on the right, from the View bar or the ⇄ button in the panel',
      'Your view choices are remembered in this browser'
    ]
  },
  {
    id: '2026-10-23-chassis-specs',
    date: '2026-10-23',
    title: 'Chassis specs',
    items: [
      'The chassis list and the \'Mech panel show the engine, heat sinks, structure and armor like the in-game mechlab: 325 C-XL DHS C-ENDO C-FERRO AP',
      'Hardpoints in the chassis list now show their size too: 2E·L 1E·M',
      'Engine ratings match the game, even for OmniMechs whose files list the wrong one'
    ]
  },
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
