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
    id: '2026-11-14-battletech-starmap',
    date: '2026-11-14',
    title: 'BATTLETECH star map',
    items: [
      'MW Builder now covers BATTLETECH too, starting with an interactive star map of the Aurigan Reach in career mode',
      'Each of the 219 systems shows its owner, career difficulty, planet traits, black market and faction stores, who offers contracts there and its battlefields',
      'Search any system and share it with a link'
    ]
  },
  {
    id: '2026-11-14-map-marks',
    date: '2026-11-14',
    title: 'Clearer selections on the star map',
    items: [
      'Whatever you pick is marked with a ring, sight brackets and the system name, in the color of its panel: yellow for a system, blue for an academy, amber for a quest, magenta for a campaign and cyan for where a \'Mech is found',
      'Shared links on phones now frame the picked system below its card'
    ]
  },
  {
    id: '2026-11-10-dlc-campaigns',
    date: '2026-11-10',
    title: 'DLC campaigns on the star map',
    items: [
      'A new Campaigns panel lists the story campaigns of DLC 2, 4, 5, 6, 7 and 9, searchable by name, system, mission or reward',
      'Pick one to see its route on the map, numbered in order, like the quest chains, and a magenta flag marks where each campaign starts',
      'Each mission shows its system, employer, base pay and rewards: \'Mechs, hero pilots, weapons and equipment, plus what finishing the campaign gives',
      'System cards list the campaigns that start or play there',
      'Quest rewards now show the pilots that join your company too, like Valten Ryder for finishing the Adam Steiner chain'
    ]
  },
  {
    id: '2026-11-10-hero-portraits',
    date: '2026-11-10',
    title: 'Hero pilot portraits',
    items: [
      'Every hero pilot on the Pilots page now shows their portrait from the game, as in the hiring hall and the barracks'
    ]
  },
  {
    id: '2026-11-10-pilots',
    date: '2026-11-10',
    title: 'Pilots',
    items: [
      'A new Pilots page lists the 18 hero pilots like hero \'Mechs: the 8 that hiring halls offer as Elite Pilot and the 10 that join as mission rewards, with their skills, salary, fixed traits and biography',
      'All 184 pilot traits from DLC 7 with their exact effects, in compact tables by \'Mech weight class, weapon type, faction or career: effects, pilot costs and whether hired pilots or academies can have each one, good effects in green and bad ones in red',
      'Filter traits by type or hero only and search by name or effect, for example jam or atlas',
      'Training programs come in one table per kind, to compare levels side by side, with the traits each academy program always grants and links to every academy on the star map'
    ]
  },
  {
    id: '2026-11-10-mobile-map',
    date: '2026-11-10',
    title: 'More map on mobile',
    items: [
      'On phones, the star map timeline is much shorter: the date and the era share one line',
      'Cards take at most half the screen and scroll inside, and the map frames what you pick in the space left below them'
    ]
  },
  {
    id: '2026-11-10-pilot-academies',
    date: '2026-11-10',
    title: 'Pilot academies on the star map',
    items: [
      'The new Academies panel lists the DLC 7 pilot academies open on the chosen date, and the map marks their systems with a blue cap',
      'Picking an academy frames its system and marks it with a blue ring and its name',
      'Each academy card shows its training programs with length, cost, the pilot skill they accept and their skill, trait and XP stars',
      'Academies founded later or destroyed by the Clans open and close with the date, and the system card links its academies'
    ]
  },
  {
    id: '2026-11-10-review-fixes',
    date: '2026-11-10',
    title: 'Small fixes',
    items: [
      'A damaged entry in the builds saved in your browser no longer hides all the others',
      'On touch screens, the long press menu cancels when your finger moves, even slowly',
      'Screen readers now announce how many slots each cantina upgrade takes',
      'Empty values in the MechLab tables show a short dash'
    ]
  },
  {
    id: '2026-11-09-enemy-units',
    date: '2026-11-09',
    title: 'Enemy units',
    items: [
      'A new Enemy units page lists the 115 tanks, hovercraft, VTOLs, turrets and battle armor squads you face in contracts',
      'Each card shows base hit points, speed, alpha damage and DPS, every weapon with its damage, DPS and range, and which factions field it',
      'Cards show the chassis artwork from Sarna.net and link to its page',
      'Filter by type, search by name and sort by battle value, DPS, hit points, speed or intro year',
      'Open it from its new cover on the home page or from the MechLab and star map headers',
      'The What\'s new bell now sits before Feedback on every page, as on the home page and in the MechLab'
    ]
  },
  {
    id: '2026-11-09-weapon-dps',
    date: '2026-11-09',
    title: 'DPS in the weapon list',
    items: [
      'The MechLab weapon list shows each weapon\'s nominal DPS next to its damage, so fast firing weapons like the X Pulse lasers are easier to compare'
    ]
  },
  {
    id: '2026-11-09-mobile-fixes',
    date: '2026-11-09',
    title: 'Better on mobile',
    items: [
      'The What\'s new panel now fits the screen on the home page and in the MechLab',
      'On the star map, opening a panel hides the date controls so more of the map stays visible',
      'The star map has its own What\'s new bell too, shared with the home page and the MechLab'
    ]
  },
  {
    id: '2026-11-09-rival-mercs',
    date: '2026-11-09',
    title: 'Rival mercs on the star map',
    items: [
      'The new Rival mercs panel lists the DLC 4 mercenary companies and draws the zones each one holds on the chosen date, with its logo',
      'Hover a zone to see who holds it and whether it only happens in career mode, and click it to open the company card with its zones, pilot skill and history',
      'After 3050 most zones rotate between companies at random, marked with a question mark',
      'The star map is much smoother: dragging, zooming and event animations no longer slow down'
    ]
  },
  {
    id: '2026-11-09-conflict-zones-arenas',
    date: '2026-11-09',
    title: 'Conflict zones and arenas',
    items: [
      'Hovering a conflict zone shows its recommended reputation and difficulty, and clicking inside it opens its card with the description, capital, repair markup and multi-mission contracts',
      'Systems with an arena have their own icon, and their card lists the arena features and the fame ranks with their rewards'
    ]
  },
  {
    id: '2026-11-05-find-a-mech',
    date: '2026-11-05',
    title: 'Find a \'Mech on the star map',
    items: [
      'Pick any variant and the map shows how rare it is in each faction\'s market on the chosen date, from very common to very rare',
      'The card lists who sells it, when it enters production and where you can always get it: quest rewards and special markets',
      'Special \'Mech locations lists the hero \'Mechs and special variants you can only get in one place, like the Atlas II on Romulus, the Bounty Hunter\'s Marauder or the Razer Wolverine',
      'Cards say how to get each \'Mech outside the quests: DLC campaign missions, finishing a campaign, Bounty Hunter intel or promotions like the Razer Wolverine, and when a hero can come up for sale',
      'Only variants already in production on the map date are listed, with a button to jump to the date they enter production, and the map zooms to small places, like a quest route or the only system of the faction that sells it',
      'Clan \'Mechs can also be found by their Inner Sphere name, like Adder for the Puma',
      'Links keep the chosen variant, so you can share where to find it'
    ]
  },
  {
    id: '2026-11-05-territory-gaps',
    date: '2026-11-05',
    title: 'Star map: no more empty gaps',
    items: [
      'Areas with no star systems surrounded by a faction no longer show up as empty space with a border, like the one inside the Draconis Combine near Shimonoseki'
    ]
  },
  {
    id: '2026-11-05-zone-levels',
    date: '2026-11-05',
    title: 'Recommended reputation on the star map',
    items: [
      'The system card shows the recommended reputation and difficulty of its cluster and industrial hub, as in the game',
      'Campaign and career ask for different levels, so each mode shows its own',
      'Taurian Corridor now shows its own name instead of Outworlds Border'
    ]
  },
  {
    id: '2026-11-05-quest-rewards',
    date: '2026-11-05',
    title: 'Quest rewards',
    items: [
      'Each high reward quest shows what it pays: C-Bills, reputation, \'Mechs, weapons by tier, equipment and the final debrief',
      'Campaign and career pay differently, so each mode shows its own reward',
      'Reward \'Mechs open in the MechLab with their stock build, and the Quests list finds quests by reward, like Gauss or ARC-AGC'
    ]
  },
  {
    id: '2026-11-05-quest-requirements',
    date: '2026-11-05',
    title: 'Quest requirements',
    items: [
      'Each high reward quest shows when the game offers it: minimum reputation, the date it is offered from and, for some DLC 8 quests, until when',
      'Quests that follow another one, or that rule out the opposite side, say so and link to it',
      'At the map date, quests that are not offered yet or any more are dimmed, with the date on the card and in the list'
    ]
  },
  {
    id: '2026-11-05-markets',
    date: '2026-11-05',
    title: 'Special markets and unique \'Mechs',
    items: [
      'The star map shows the 22 special markets of the DLC campaigns, with a fixed stock of \'Mechs, weapons by tier, equipment and pilots',
      'The Atlas II appears in Romulus from 10 May 3043, as in the game',
      'The Special markets list shows them all and finds where to buy a \'Mech or a weapon',
      'Every \'Mech opens in the MechLab with its stock build, and a mech link like /mercs/?mech=AS7-D-H opens any variant'
    ]
  },
  {
    id: '2026-11-05-quests',
    date: '2026-11-05',
    title: 'High reward quests on the star map',
    items: [
      '64 high reward quests from the game files: faction quests, Heroes of the Inner Sphere and the DLC 2, 3 and 8 quests',
      'Systems that offer a quest have a marker, and the Quests list finds them by name, system or employer',
      'Pick a quest to see its route on the map and every mission with its system',
      'The system card lists the quests offered or played there'
    ]
  },
  {
    id: '2026-11-05-faction-logos',
    date: '2026-11-05',
    title: 'Faction logos on the star map',
    items: [
      'The system card shows the faction logo from the game inside its colored ring, as in the game',
      'The faction legend lists each faction with its logo'
    ]
  },
  {
    id: '2026-11-05-starmap',
    date: '2026-11-05',
    title: 'Star map',
    items: [
      'New Star Map page at mw-builder.com/mercs/starmap/, with its own cover on the MW Builder home page',
      'Faction borders of the Inner Sphere on any date from 3015 to 3060, taken from the game files, with the events that move them',
      'Jumping to an event fades the borders into the new ones and flashes every system that changed hands',
      'Clusters and industrial hubs, drawn as in the game, and a card with the owner history of each system',
      'Search a system by name and share the view: the date and the system go in the link',
      'Feedback and Support buttons on the map too, and feedback can attach a link to the map view',
      'The MW Builder home page now has the What\'s new bell too, and the MechLab header links to the star map'
    ]
  },
  {
    id: '2026-10-31-compare',
    date: '2026-10-31',
    title: 'Compare \'Mechs',
    items: [
      'Compare in the toolbar shows your build next to another \'Mech, each with its image, specs and loadout by component',
      'Compare with the stock loadout of any \'Mech or with one of your saved builds, upgrades included',
      'Each card lists its stats in line with the other one, and the better value is highlighted in green with the difference',
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
