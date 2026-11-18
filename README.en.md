# MechLab MW5

[🇪🇸 Español](README.md) · 🇬🇧 English

A web 'Mech configurator for *MechWarrior 5: Mercenaries*. Pick any of the 639 playable variants, fit it following the rules of the in-game mechlab, install cantina upgrades and see right away how tonnage, damage, heat, speed and the rest of the stats change. Builds can be saved, shared with a link or exported as an image.

| | |
|---|---|
| **Live site** | **https://mw-builder.com/mercs/** |
| Star map | https://mw-builder.com/mercs/starmap/ |
| Enemy units | https://mw-builder.com/mercs/units/ |
| Pilots | https://mw-builder.com/mercs/pilots/ |
| Weapons and equipment | https://mw-builder.com/mercs/equipment/ |
| HRQ and campaigns | https://mw-builder.com/mercs/campaigns/ |
| BATTLETECH MechLab | https://mw-builder.com/battletech/ |
| BATTLETECH star map | https://mw-builder.com/battletech/starmap/ |
| BATTLETECH flashpoints | https://mw-builder.com/battletech/flashpoints/ |
| BATTLETECH enemy units | https://mw-builder.com/battletech/units/ |
| BATTLETECH weapons and equipment | https://mw-builder.com/battletech/equipment/ |
| Slides | [View on Google Slides](https://docs.google.com/presentation/d/12EF1CgE-6KTWpWKrRVYCNxMUtrFIe35g/edit?usp=drive_link) (in Spanish) |
| Video walkthrough | [Watch on Google Drive](https://drive.google.com/file/d/1FbnRwwYDHOZMuEQ71Wt3I6yfammuBIkp/view?usp=drive_link) (in Spanish) |
| Login | None: the site works without an account and builds are saved in the browser |

## Overview

*MechWarrior 5: Mercenaries* has its own mechlab, but you can only use it inside a campaign and with the 'Mechs in your hangar. MechLab lets you plan builds for any chassis from the browser, with nothing to install and no sign-up, and share them with other players.

The data was not typed in by hand. Python scripts extract it from the game files (exported with the official mod editor) and generate the JSON files the site uses, so there are 639 variants and 342 items with their real stats, and the scripts only need to run again when the game is updated. Automated tests check the site's numbers against screenshots of the in-game mechlab.

The project started as a master's final project and was posted on Reddit (r/Mechwarrior5), where player feedback shaped several features: chassis filters, stock loadouts, intro years and cantina upgrades.

## Documentation

The design documents are in Spanish, the author's language.

| Document | Contents |
|---|---|
| [Analysis](docs/analisis.md) | Problem, users, scope, requirements and how player feedback changed them |
| [Architecture](docs/arquitectura.md) | Data flow, layers, design decisions, principles (SOLID, DRY, KISS, YAGNI) and how it maps to Clean Architecture |
| [UML diagrams](docs/uml.md) | Use cases, domain classes and the sequences for sharing a build and sending feedback |
| [Specs](docs/specs/) | Spec Driven Development: requirements and acceptance criteria written before the code |
| [Development with AI](docs/desarrollo-con-ia.md) | How the project was built with Claude Code and the practices that keep it reliable |
| [CLAUDE.md](CLAUDE.md) | Project conventions and rules the AI assistant reads every session |

## Tech stack

| Area | Technology |
|---|---|
| UI | React 19, TypeScript 7, hand-written CSS (no styling framework) |
| Build and dev server | Vite 8 |
| Tests | Vitest 5 (604 tests, V8 coverage) |
| Static analysis | oxlint |
| Hosting | Cloudflare Workers (static assets plus a Worker for the API) |
| Feedback form email | Cloudflare Email Routing |
| 'Mech images | [Sarna.net](https://www.sarna.net) API, through a proxy in the Worker |
| Game data extraction | Python 3 (no external dependencies) |
| Continuous integration | GitHub Actions (lint, tests with coverage and build on every push and pull request) |

There is no database or custom backend: saved builds live in the browser's `localStorage`, and a shared build travels whole inside its link.

## Main features

**Chassis picker**
- Search by name, variant or ID across 639 playable variants.
- Hardpoint summary for each variant by type and size (`2E·L 1E·M`), and chassis specs as in the game (`325 C-XL DHS C-ENDO C-FERRO AP`).
- Filters by weight class, tech base, jump jets, ECM, AMS, hero variants, combat role, DLC (base game and DLC 1 to 9), minimum hardpoints per type and campaign year. Search shortcuts such as `3e 2m jj ecm` or `hero dlc7`.
- Intro year and combat role of each variant.

**Fitting**
- Board with the 'Mech in the middle and its components around it. Clicking a component opens a panel to fit it, with filters by text, tech base and weapon type.
- In-game mechlab rules: type and size of each hardpoint (taken from the game's models), omni and artillery hardpoints, general and special slots (engine, jump jets, superchargers).
- Weapon tiers (0 to 5) with their stats.
- Front and rear armor per component, with buttons to clear it or max it out within the free tonnage.
- Stock loadout of each variant, loaded when you pick the chassis and restorable with one click.
- Build warnings: free hardpoints, weapons without ammo, missing armor and overweight.
- View options: slots as cells, compact board and the component panel on the left or the right.

**Cantina upgrades**
- All 50 'Mech upgrades from the game, grouped by category, with the upgrade slot limit of each chassis.
- Game rules: each upgrade installs once, levels I and II can be combined, and their percentages add up.
- Every affected stat shows its base and upgraded value (`52.9 ▲ 57.7`), like the game.

**Stats**
- Strip with tonnage, armor, speed, jump jets, volley damage, melee damage, heat spike, cooling and max range.
- **Weapons** tab: damage, heat, RPM, DPS, range, max range and projectile velocity of each weapon, with totals and ammo duration.
- **'Mech** tab: structure, heat capacity, turn and torso twist speed, sensor range and target lock, like the summary on the in-game Upgrades screen.
- **Compare:** the current build next to another 'Mech, each with its image and loadout. Compare with the stock loadout of any 'Mech or with a saved build; each card lists its stats (firepower, defense, heat and mobility) in line with the other one, with the better value highlighted in green.

**Save and share**
- Builds saved in the browser: save, update, load, duplicate, rename, delete, and export or import as JSON. The list can be searched by name, chassis or variant, sorted by date, name, chassis, tonnage or firepower and filtered by weight class, tech, role, equipment carried (jump jets, ECM, AMS), hero variants and minimum hardpoints of the 'Mech or minimum weapons carried, like the 'Mech picker, in BATTLETECH too. Each build shows how many weapons of each type it carries and its tech and special equipment (XL, DHS, Endo, Ferro, jump jets, ECM, probe, MASC, Supercharger or targeting computer; jump jets and upgrades in BATTLETECH).
- A link that opens the build as it is (`/mercs/?b=…`).
- A PNG image of the build with the 'Mech, its equipment, its upgrades and its stats, ready to copy or download.

**Star map**
- Its own page with a map of the Inner Sphere that looks like the game's: each faction's territory in its color, clusters and industrial hubs.
- Borders on any date from 3015 to 3060, with a slider and jumps to the 19 game events that move them.
- A card for each system with its faction, cluster and owner history, the recommended reputation and difficulty of its cluster or industrial hub in campaign and career, a search by name and a link with the date and the system.
- A card for each conflict zone when clicking inside it (description, capital, reputation, difficulty, repair markup and multi-mission contracts), and the DLC6 arenas with their fame ranks.
- The DLC4 rival mercs: the zones each company holds on the chosen date, with its logo, and a card for each one.
- The game's 64 high reward quests (HRQ): where each one is offered, its route through its mission systems, its requirements (reputation, dates, previous or opposing quest), its reward (C-Bills, reputation, 'Mechs, weapons and equipment) and a search by name, system or employer.
- The 22 fixed markets of the DLC campaigns and the Atlas II on Romulus, with a search for where to buy each 'Mech or weapon. Every 'Mech opens in the MechLab with its stock build (`/mercs/?mech=AS7-D-H`).
- Find a 'Mech: the map is colored by how rare a variant is in each faction's market on the chosen date, with its fixed sources (HRQ, special markets) and a shareable link (`?mech=AS7-D`). Special 'Mech locations lists the hero 'Mechs and special variants you can only get in one place, like the Razer Wolverine.

**Weapons and equipment**
- Its own page (`/mercs/equipment/`) with all 190 weapons in one table: hardpoint, tons, damage, heat, cooldown, RPM, DPS, damage per ton, range, projectile speed, ammo per ton, manufacturer, tech base and DLC.
- One tier for the whole list (from 0 to Lost Tech; Clan weapons keep their own), sorting by any column and filters by type, hardpoint size, Inner Sphere or Clan, DLC and a search by name or manufacturer.
- An equipment tab with heat sinks, jump jets, MASC and Superchargers, ECM, active probes and targeting computers with their effects, and every ammo bin with the weapons that use it. The view goes in the link.

**HRQ and campaigns**
- Its own page (`/mercs/campaigns/`) with the 64 HRQ, grouped by base game and DLC, and the 6 DLC campaigns (with their pauses), plus Call to Arms and Chaos Reign, which tell their story through quest chains, with a search by name, system, employer, mission or reward.
- Each one opens to show where and when it is offered (reputation, dates, previous or opposing quest), its missions in order and its reward in each mode. Systems open the star map with the route drawn, and 'Mechs open in the MechLab with their stock build. The view goes in the link (`?quest=bow-and-arrow`, `?campaign=dlc7`).

**BATTLETECH MechLab**
- Its own page (`/battletech/`) with the 96 'Mechs you can own in *BATTLETECH* (2018), from the base game, Heavy Metal, Flashpoint and Urban Warfare, with their stock builds and in-game icons.
- Every weapon, ammo box, heat sink, jump jet and upgrade, with the manufacturer versions (+ to + + +), filters by category, version, source and rarity, search and sorting.
- The in-game mechlab rules: everything takes slots, weapons need a free hardpoint of their type, each component goes only where the game allows it, jump jets have their limit and tonnage bracket, and built-in gear cannot be removed.
- Armor in steps of 5 with front and rear limits, and a button that spreads the free tonnage like the in-game one.
- The same board, location panel and toolbar as the MW5 MechLab, with the right-click menu (duplicate, fill hardpoints, add ammo, move and remove).
- Alpha damage, stability damage, heat against sinking, damage by range, ammo per weapon type, walk and sprint, and value in C-Bills.
- 'Mech picker with filters by weight class, source, role, minimum hardpoints and jump jets; share links (`?b=` and `?mech=HBK-4G`), builds saved in the browser and comparison.

**BATTLETECH Argo**
- Its own page (`/battletech/argo/`) with all 35 upgrades of the *Argo*, your company's ship in *BATTLETECH* (2018): cost, monthly upkeep, effects in the game's own words, requirements, what each one unlocks and what the crew member who pitches it says.
- A tree by category and tier that lights up everything an upgrade requires and unlocks when you point at it.
- Planner: tick upgrades, their requirements come along, and the total cost, monthly upkeep (¢80,000 base plus each upgrade) and combined effects add up. The plan goes in the link (`?own=mechBay3,trainingModule1`).

**BATTLETECH flashpoints**
- Its own page (`/battletech/flashpoints/`) with the 32 flashpoints of Flashpoint, Heavy Metal and Urban Warfare, like HRQ & Campaigns for MW5: where each one is offered, who offers it, its difficulty and length, its contracts in order, every path with what it pays (C-Bills, morale and reputation) and the final reward with its 'Mechs.
- DLC filter and a search by name, system, employer, contract or 'Mech. The system opens the star map and the view goes in the link.

**BATTLETECH enemy units**
- Its own page (`/battletech/units/`) with the 37 vehicles and turrets of contracts, from the base game, Heavy Metal and Urban Warfare: armor and structure by location, walk and sprint distance, the damage of one attack with every weapon, stability damage and the weapons and equipment each one carries, with its chassis drawing from Sarna.
- Filters by type (tracked, wheeled, turret) and name, and sort by damage, armor, tonnage or speed. The view goes in the link.

**BATTLETECH weapons and equipment**
- Its own page (`/battletech/equipment/`) with all 210 weapons and every manufacturer version (+ to + + +) in one table: hardpoint, tons, slots, damage (with its shots), stability damage, heat, heat damage, accuracy, crit, min and max range with the range brackets, ammo per ton, damage per ton, rarity and source, with the manufacturer bonuses.
- Sorting by any column and filters by hardpoint, version, source, rarity and a search by name or manufacturer.
- An equipment tab with heat sinks, jump jets, upgrades by group (with where they mount) and every ammo box with the weapons that use it. The view goes in the link.

**Other**
- What's new bell with the changes the user has not seen yet.
- Feedback form delivered by email without exposing the developer's address.
- Mobile-friendly layout.

## Installation and running

Requirements: **Node.js 24** or later. Python 3 is only needed to regenerate the game data.

```sh
git clone https://github.com/PonchoiDev/mechlab-web.git
cd mechlab-web
npm install
npm run dev
```

The site runs at http://localhost:5173/mercs/. With `npm run dev -- --host 0.0.0.0` it can be opened from other devices on the network.

| Script | Description |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run dev:battletech` | Dev server for the BATTLETECH pages (http://localhost:5174/battletech/) |
| `npm test` | Unit tests with Vitest |
| `npm run coverage` | Tests with a coverage report in `coverage/` |
| `npm run lint` | Static analysis with oxlint |
| `npm run build` | Type check and production build in `dist/`, for MW5 and BATTLETECH |
| `npm run preview` | Serves the production build |

In development, the Vite server proxies the Sarna images, and the feedback form prints the message in the terminal instead of sending it.

## Project structure

```
src/
  App.tsx               Main component: build state and page layout
  components/           UI components (board, picker, upgrades panel, dialogs…)
  starmap/              Star map page: canvas, system card, date and search
  units/                Enemy units page: filters and a card for each unit
  pilots/               Pilots page: hero pilots, traits and academy training programs
  equipment/            Weapons and equipment page: weapon table by tier, equipment cards and ammo
  campaigns/            HRQ and campaigns page: expandable lists with missions, requirements and rewards
  battletech/           BATTLETECH pages (star map), with their logic in utils/battletech/
  battletech/argo/      BATTLETECH Argo page: upgrade tree, cards and plan
  battletech/equipment/ BATTLETECH weapons and equipment page: weapon table, equipment cards and ammo
  battletech/flashpoints/ BATTLETECH flashpoints page: expandable lists with contracts, paths and rewards
  battletech/units/     BATTLETECH enemy units page: filters and a card for each vehicle or turret
  battletech/mechlab/   BATTLETECH MechLab: 'Mech picker, board, equipment picker and analysis
  hooks/                Build state, saved builds, view preferences and Sarna image
  utils/                Configurator logic: calculations, fitting rules, upgrades, build codes
  services/             Sarna API, clipboard and PNG build image (canvas)
  types/                TypeScript types
  data/                 Generated mechs.json, items.json, traits.json, starmap.json and units.json, plus the changelog
  test/                 Shared test fixtures
worker/                 Cloudflare Worker: Sarna image proxy and feedback form
starmap/index.html      Entry of the star map page (/mercs/starmap/)
units/index.html        Entry of the enemy units page (/mercs/units/)
pilots/index.html       Entry of the pilots page (/mercs/pilots/)
equipment/index.html    Entry of the weapons and equipment page (/mercs/equipment/)
campaigns/index.html    Entry of the HRQ and campaigns page (/mercs/campaigns/)
battletech/             Entries of the BATTLETECH pages (/battletech/) and their images
battletech/argo/        Entry of the Argo page (/battletech/argo/) and its images in public/argo/
battletech/equipment/   Entry of the weapons and equipment page (/battletech/equipment/)
battletech/flashpoints/ Entry of the flashpoints page (/battletech/flashpoints/)
battletech/units/       Entry of the enemy units page (/battletech/units/)
battletech/index.html   Entry of the BATTLETECH MechLab (/battletech/), with the chassis icons in public/mechlab/
site/                   Landing page at the domain root (mw-builder.com)
docs/                   Analysis, architecture, UML diagrams and development with AI
tools/
  generar_mechs.py      Generates src/data/mechs.json
  generar_items.py      Generates src/data/items.json
  generar_traits.py     Generates src/data/traits.json (cantina upgrades)
  extraer_mapa.py       Extracts the star map data from the game's .pak
  generar_mapa.py       Generates src/data/starmap.json
  extraer_unidades.py   Extracts the hit points, speed and weapons of enemy units from the game .pak
  imagenes_sarna.py     Looks up the Sarna page and artwork of each enemy unit chassis
  generar_unidades.py   Generates src/data/units.json
  extraer_pilotos.py    Extracts hero pilots and pilot traits with their effects from the game .pak
  generar_pilotos.py    Generates src/data/pilots.json
  extraer_argo_battletech.py  Copies the Argo upgrades, their texts and images from BATTLETECH
  generar_argo_battletech.py  Generates src/data/battletech/argo.json
  extraer_mechlab_battletech.py  Extracts chassis, variants, components and icons from BATTLETECH and its DLC
  generar_mechlab_battletech.py  Generates src/data/battletech/mechs.json, items.json and constants.json
  unityfs.py            Reads the Unity bundles of the BATTLETECH DLC
  ue4.py                Reads the .pak and the Unreal Engine 4 assets
  battletech.py         Reads the BATTLETECH data (lenient JSON and tags)
  extraer_mapa_battletech.py   Extracts systems, factions, tags and logos from BATTLETECH
  generar_mapa_battletech.py   Generates src/data/battletech/starmap.json
  datos-juego/          Files exported from the game
.github/                Continuous integration, CodeQL and Dependabot
.coderabbit.yaml        CodeRabbit code review settings
CLAUDE.md               Project conventions for the AI assistant
```

Logic is kept apart from the UI: `src/utils/` holds pure functions with their tests, and the components only call them. For example, `calculators.ts` builds the stats summary from the 'Mech, its equipment, armor and upgrades, and `buildCode.ts` turns a build into its link code and validates it when the link is opened.

The scripts and the code comments are in Spanish, the author's language; the site itself is in English.

## Game data

The JSON files in `src/data/` are generated from the game files, exported with the *MechWarrior 5: Mercenaries* mod editor into `tools/datos-juego/`:

| Folder | Contents | Used for |
|---|---|---|
| `mda/` | Data of each variant | Tonnage, armor, structure, slots, engine, speed, turn rate |
| `mdl/` and `hps/` | Model and hardpoints of each chassis | Actual size of each hardpoint |
| `loadout/` | Stock loadouts | Factory build of each variant |
| `unitcard/` | Unit cards | Intro year and role |
| `items/` | Weapons, equipment and ammo | Stats and manufacturer per tier, ammo, heat sinks, DLC and equipment effects |
| `traits/` | Upgrades | Cantina upgrades and their effects, and those of the targeting computers (read by `generar_items.py`) |
| `mech_string_table/` | `Mech_StringTable` text table exported as CSV | Chassis names |

```sh
python3 tools/generar_items.py
python3 tools/generar_mechs.py
python3 tools/generar_traits.py
```

`generar_mechs.py` also reads `items.json` to validate the stock loadouts, so it runs after `generar_items.py`. The scripts skip non-playable variants (campaign, tutorial, bosses and cinematics) and, when they finish, report what they could not reconcile: stock parts that do not fit, variants without a unit card, or hardpoints whose size had to be inferred.

### Star map

The map data is not exported with the mod editor: `extraer_mapa.py` reads it straight from the `.pak` file of the installation, which is neither encrypted nor compressed, with a small Unreal Engine 4 reader (`ue4.py`). It only reads the index and the assets it needs (about 7 MB out of 106 GB), in under a second, and saves them as JSON in `tools/datos-juego/starmap/`. It only has to run again when a patch changes the map.

```sh
python3 tools/extraer_mapa.py "/path/to/MechWarrior 5 Mercenaries"
python3 tools/generar_mapa.py
```

`generar_mapa.py` also reads the names of the hero pilots that some campaign missions grant (`tools/datos-juego/pilotos/hero.json`, from `extraer_pilotos.py`).

| File | Game asset | Contents |
|---|---|---|
| `sistemas.json` | `InnerSphereData/MW5_InnerSphereData` | 2174 systems with coordinates, cluster and the date of each change of owner |
| `facciones.json` | `Factions/*` | Name and map stencil of each faction |
| `colores.json` | `Faction_Colours_MPC` | Color of each stencil, of the Clans, of clusters and of industrial hubs |
| `eventos.json` | `BorderChanges/*/Borders*` | The 19 border changes, from 3025 to 3060 |
| `centros_industriales.json` | `SafeZone_*_ClusterAsset` and its mesh | The 35 industrial hubs with their capital, systems and the lines joining them |
| `clusteres.json` and `textos.json` | Cluster assets and `Faction_StringTable` | Cluster names |
| `misiones.json` | HRQ `Show…`, `Place…` and `Generate…` actions and their objectives | Offer and mission systems, titles, summaries and employer |
| `recompensas_misiones.json` | HRQ objectives with `bHasRewards` | C-Bills, reputation, 'Mechs, weapons, equipment and debrief of each reward |
| `mercados.json` and `mechs_unicos.json` | `CustomMarket` assets and actions with `HeroMechToPlace` | Markets with their inventory and unique 'Mechs with their date |
| `zonas.json` | `*_ClusterAsset` of campaign, career and the DLC campaigns | Systems, name, description, capital, recommended reputation, difficulty, repair markup and multi-mission contracts of each zone |
| `rivales.json` | `RivalMercs/StarMapRadialInfluences` and `RivalMercs/Companies` (DLC4) | The 18 rival mercenary companies and their 76 influence zones with their owner over time |
| `arenas.json` | `ArenaStarSystemTable` and `ArenaFameProgressionTable` (DLC6) | Systems with an arena and fame ranks with their rewards |
| `campanas.json` and `nombres_campanas.json` | Arc scripts of each part of the DLC campaigns (`DLCn/CampaignData`), their `Place` actions and scenarios, and each DLC header | The parts of each campaign with their system and date, and their missions in order with system, texts and pay; the name of each campaign |
| `academias.json` and `programas.json` | `PilotTraining/AcademyDataAssets` and `TrainingAssets` (DLC7) | The 93 pilot academies with their system, founding date and programs, and the figures and own traits of each program |
| `alianzas.json` | `Allegiance` of the `Factions/*` assets | The faction each one answers to, for the rarity table of minor factions |
| `recompensas_campana.json` | Objectives with `bHasRewards` and `MechLoadouts` outside the HRQ, and the action that places them | 'Mechs from the DLC campaigns, the Bounty Hunter or promotions, with their system |
| `heroes_en_venta.json` | `HeroMechsForPurchase` | The 95 hero 'Mechs the game can put up for sale |
| `public/starmap/logos/` | `LogoLarge` texture of each faction | Faction logos as 128 px PNG, decoded from DXT5 |

### Enemy units

The unit cards of tanks, VTOLs, turrets and battle armor are in `unitcard/`, but they don't include hit points, speed or weapons. `extraer_unidades.py` reads them from the blueprints in the `.pak`, following inheritance, mounted turrets and the construction script bytecode that sets their guns, and saves them to `tools/datos-juego/unidades/`. `generar_unidades.py` joins them with the unit cards into `src/data/units.json`.

```sh
python3 tools/extraer_unidades.py "/path/to/MechWarrior 5 Mercenaries"
python3 tools/imagenes_sarna.py
python3 tools/generar_unidades.py
```

| File | Game asset | Contents |
|---|---|---|
| `unidades.json` | Blueprint of each unit (`UnitClass`) and its turrets | Base hit points, speed, weapons and squad size of battle armor |
| `armas.json` | `WeaponDataAsset` of each weapon | Name, stats and quirks, including vehicle weapons missing from `items/` |
| `facciones.json` | `Factions/*` and their StringTables | Names of the factions in the rarity lists, including mercenary companies and arena sponsors |
| `sarna.json` | Sarna API (`imagenes_sarna.py`), not the game | Page and main artwork of each chassis, from the title table in `generar_unidades.py` |

### Pilots

DLC 7 pilot traits and hero pilots are not exported with the mod editor: `extraer_pilotos.py` reads them from the `.pak`. For each trait it follows the component tree ('Mech affinity, weapon quirks, armor, sensors, pilot costs…); for each hero pilot it takes the skills, the fixed traits and the missions that grant it. `generar_pilotos.py` fills in the texts, turns the figures into effects, sorts the traits into subgroups and adds the academy training programs from `tools/datos-juego/starmap/`, grouped by kind.

```sh
python3 tools/extraer_pilotos.py "/path/to/MechWarrior 5 Mercenaries"
python3 tools/generar_pilotos.py
```

| File | Game asset | Contents |
|---|---|---|
| `rasgos.json` | `DLC7/TOIs/PilotTraining/PilotTraits/**` | The 184 traits with their name, descriptions, tags (hero, hireable, academies, DLC) and the figures of each component |
| `hero.json` | `MWPilotPersonaAsset` with `PilotPersona.Use.Hero`, its `MWPersonaAsset` and the `PilotRewards` that grant them | The hero pilots with their name, biography, skills, salary, fixed traits, portrait and the missions that grant them |
| `public/pilots/portraits/` | Texture of the `MWPortraitAsset` of each hero pilot | Portraits as 160 px PNG, decoded from DXT5 |
| `niveles.json` | `Campaign/Pilots/_common/PilotSkillLevelCurve` | The XP each skill level needs |

### BATTLETECH star map

*BATTLETECH* (Harebrained Schemes, 2018) keeps its data as loose JSON files in `BattleTech_Data/StreamingAssets/` of the install. `tools/battletech.py` reads them even with trailing commas, comments or a missing comma, as the game accepts them, and takes the tag names from `MDD/data/tagdata.sql`. Only the base game counts: the `Mods/` folder of a modded install is never read.

```sh
python3 tools/extraer_mapa_battletech.py "/path/to/BATTLETECH"
python3 tools/generar_mapa_battletech.py
```

| File | From the game | Contents |
|---|---|---|
| `battletech/starmap/sistemas.json` | `data/starsystem/` | The 256 system records (one per mode and campaign stage) with coordinates, owner, tags, difficulty per mode, contracts, biomes and stores |
| `battletech/starmap/facciones.json` | `data/factions/` | Name, map color and icon of each faction |
| `battletech/starmap/etiquetas.json` | `MDD/data/tagdata.sql` | Display name and description of the planet tags |
| `battletech/public/starmap/logos/` | `emblems/factions/*.dds` | Faction logos as 128 px PNG, decoded from DXT5 |

### BATTLETECH Argo

*BATTLETECH* keeps its data as loose JSON files in `BattleTech_Data/StreamingAssets/`. `extraer_argo_battletech.py` copies what the Argo page needs to `tools/datos-juego/battletech/argo/` and saves the illustrations and portraits as PNG in `battletech/public/argo/`. `generar_argo_battletech.py` generates `src/data/battletech/argo.json`. The DLC add no ship upgrades.

```sh
python3 tools/extraer_argo_battletech.py "/path/to/BATTLETECH"
python3 tools/generar_argo_battletech.py
```

| File | Source in the game | Contents |
|---|---|---|
| `shipUpgrades/` | `data/shipUpgrades/*.json` | The 35 upgrades with their category, cost, upkeep, requirements, stats, illustration and crew member |
| `estadisticas.json` | `data/simGameStatDesc/` | The sentence the game uses to explain each stat an upgrade changes |
| `categorias.json` | `data/enums/ShipUpgradeCategory.json` | The 9 categories with their display name |
| `tripulacion.json` | `data/cast/castDef_*Default.json` | Name, rank and portrait of Farah, Yang, Darius and Sumire |
| `constantes.json` | `data/simGameConstants/SimGameConstants.json` | Base upkeep, starting upgrades in campaign and career, career multipliers and starting values |
| `battletech/public/argo/` | `sprites/Illustrations/*.dds` and `sprites/Portraits/*.png` | Upgrade illustrations (from DXT1 and DXT5, at 375 × 150) and 96 px portraits |

### BATTLETECH MechLab

The base game keeps its data as loose JSON files, and the DLC (Heavy Metal, Flashpoint and Urban Warfare) inside Unity 2018 bundles in `data/assetbundles/`. `tools/unityfs.py` reads those bundles in pure Python: only their block table is LZ4 compressed, and each JSON file is a TextAsset. `extraer_mechlab_battletech.py` saves what the MechLab needs to `tools/datos-juego/battletech/mechlab/`, with the source of each entry, and the icons to `battletech/public/mechlab/icons/`. `generar_mechlab_battletech.py` generates `src/data/battletech/mechs.json`, `items.json` and `constants.json`.

```sh
python3 tools/extraer_mechlab_battletech.py "/path/to/BATTLETECH"
python3 tools/generar_mechlab_battletech.py
```

| File | Source in the game | Contents |
|---|---|---|
| `battletech/mechlab/chasis.json` | `data/chassis/` and the DLC bundles | The 122 chassis with their locations (hardpoints, slots, max armor and structure), fixed equipment, tonnage, jump jets, role and icon |
| `battletech/mechlab/mechs.json` | `data/mech/` and the bundles | The 140 variants with their stock inventory and armor, cost and tags |
| `battletech/mechlab/componentes.json` | `data/weapon/`, `ammunitionBox/`, `heatsinks/`, `jumpjets/`, `upgrades/` and the bundles | Weapons, ammo boxes, heat sinks, jump jets and upgrades with their effects |
| `battletech/mechlab/municiones.json` | `data/ammunition/` and the bundles | The ammo category of each box |
| `battletech/mechlab/movimiento.json` | `data/movement/` and the bundles | Walk and sprint distance of each chassis |
| `battletech/mechlab/constantes.json` | `data/constants/` | Heat (`CombatGameConstants`) and armor and cost (`MechStatisticsConstants`) |
| `battletech/public/mechlab/icons/` | `sprites/MechPortraits/uixTxrIcon_*.dds` | Chassis icons as 128 px PNG, decoded from DXT5 |

## Quality and checks against the game

- **604 tests** with Vitest on the logic: calculations, fitting rules, build codes, saved builds, upgrades and the Worker (including the security restrictions of the image proxy).
- **Coverage:** 95% of the lines in the logic (`src/utils`) are covered by tests. `npm run coverage` builds the report, and CI publishes the summary on every run. The UI (React components) has no tests yet.
- `gameReference.test.ts` and `upgrades.test.ts` reproduce screenshots of the in-game mechlab (for example the Grand Dragon DRG-1G-S or the Battlemaster BLR-1P) and check that the site gives the same numbers: damage, armor, cooling, turn rate, heat capacity and upgrade effects.
- `stockBuilds.test.ts` checks that the stock loadouts of all 639 variants load without losing any part.
- GitHub Actions runs lint, tests with coverage and build on every push to `main` and on every pull request.
- **CodeQL** scans the code (TypeScript, Python and the workflows) for security issues on every pull request and every week.
- **AI code review:** CodeRabbit (set up in `.coderabbit.yaml`) and GitHub Copilot review every pull request.
- The backlog lives in the [GitHub issues](https://github.com/PonchoiDev/mechlab-web/issues).
- TypeScript in strict mode and static analysis with oxlint.
- Dependabot proposes dependency updates every week and flags known vulnerabilities (`npm audit` reports none).

## Deployment

The site is live at **https://mw-builder.com/mercs/** on Cloudflare Workers (`wrangler.jsonc`). The domain root is a landing page with one cover per game, and each game has its own path; for now only `/mercs/` exists.

- `npm run build` generates the site in `dist/mercs/` and copies `site/` into the root of `dist/`.
- Static assets are served directly. The Worker only runs code on `/mercs/api/*`:
  - `/mercs/api/sarna-image`: proxy for the Sarna images, which do not send CORS headers and so could not be drawn into the build image. Each image is stored in the Cloudflare cache.
  - `/mercs/api/feedback`: receives the form messages and sends them with Cloudflare Email Routing. The destination address is the Worker secret `FEEDBACK_TO`, so it never appears in the code.
- Every merge into `main` is published automatically, and every pull request gets a preview URL.

The feedback form needs **Email Routing** enabled on the domain zone, the destination address verified, and the `FEEDBACK_TO` secret added under the Worker's **Settings → Variables and secrets**. Without that setup, the route answers 503 and the form shows an error.

## Disclaimer

Fan-made tool, not affiliated with or endorsed by Piranha Games, Microsoft or the MechWarrior and BattleTech trademark holders. Game data belongs to its respective owners. 'Mech images come from [Sarna.net](https://www.sarna.net).
