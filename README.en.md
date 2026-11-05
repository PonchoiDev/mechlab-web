# MechLab MW5

[🇪🇸 Español](README.md) · 🇬🇧 English

A web 'Mech configurator for *MechWarrior 5: Mercenaries*. Pick any of the 639 playable variants, fit it following the rules of the in-game mechlab, install cantina upgrades and see right away how tonnage, damage, heat, speed and the rest of the stats change. Builds can be saved, shared with a link or exported as an image.

| | |
|---|---|
| **Live site** | **https://mw-builder.com/mercs/** |
| Star map | https://mw-builder.com/mercs/starmap/ |
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
| Tests | Vitest 5 (351 tests, V8 coverage) |
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
- Builds saved in the browser: save, update, load, duplicate, rename, delete, and export or import as JSON.
- A link that opens the build as it is (`/mercs/?b=…`).
- A PNG image of the build with the 'Mech, its equipment, its upgrades and its stats, ready to copy or download.

**Star map**
- Its own page with a map of the Inner Sphere that looks like the game's: each faction's territory in its color, clusters and industrial hubs.
- Borders on any date from 3015 to 3060, with a slider and jumps to the 19 game events that move them.
- A card for each system with its faction, cluster and owner history, the recommended reputation and difficulty of its cluster or industrial hub in campaign and career, a search by name and a link with the date and the system.
- The game's 64 high reward quests (HRQ): where each one is offered, its route through its mission systems, its requirements (reputation, dates, previous or opposing quest), its reward (C-Bills, reputation, 'Mechs, weapons and equipment) and a search by name, system or employer.
- The 22 fixed markets of the DLC campaigns and the Atlas II on Romulus, with a search for where to buy each 'Mech or weapon. Every 'Mech opens in the MechLab with its stock build (`/mercs/?mech=AS7-D-H`).
- Find a 'Mech: the map is colored by how rare a variant is in each faction's market on the chosen date, with its fixed sources (HRQ, special markets) and a shareable link (`?mech=AS7-D`). Hero 'Mechs lists the hero 'Mechs you can only get in one place.

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
| `npm test` | Unit tests with Vitest |
| `npm run coverage` | Tests with a coverage report in `coverage/` |
| `npm run lint` | Static analysis with oxlint |
| `npm run build` | Type check and production build in `dist/` |
| `npm run preview` | Serves the production build |

In development, the Vite server proxies the Sarna images, and the feedback form prints the message in the terminal instead of sending it.

## Project structure

```
src/
  App.tsx               Main component: build state and page layout
  components/           UI components (board, picker, upgrades panel, dialogs…)
  starmap/              Star map page: canvas, system card, date and search
  hooks/                Build state, saved builds, view preferences and Sarna image
  utils/                Configurator logic: calculations, fitting rules, upgrades, build codes
  services/             Sarna API, clipboard and PNG build image (canvas)
  types/                TypeScript types
  data/                 Generated mechs.json, items.json, traits.json and starmap.json, plus the changelog
  test/                 Shared test fixtures
worker/                 Cloudflare Worker: Sarna image proxy and feedback form
starmap/index.html      Entry of the star map page (/mercs/starmap/)
site/                   Landing page at the domain root (mw-builder.com)
docs/                   Analysis, architecture, UML diagrams and development with AI
tools/
  generar_mechs.py      Generates src/data/mechs.json
  generar_items.py      Generates src/data/items.json
  generar_traits.py     Generates src/data/traits.json (cantina upgrades)
  extraer_mapa.py       Extracts the star map data from the game's .pak
  generar_mapa.py       Generates src/data/starmap.json
  ue4.py                Reads the .pak and the Unreal Engine 4 assets
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
| `items/` | Weapons, equipment and ammo | Stats per tier, ammo, heat sinks |
| `traits/` | Upgrades | Cantina upgrades and their effects |
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
| `zonas.json` | `*_ClusterAsset` of campaign, career and the DLC campaigns | Systems, name, recommended reputation and difficulty of each zone |
| `alianzas.json` | `Allegiance` of the `Factions/*` assets | The faction each one answers to, for the rarity table of minor factions |
| `public/starmap/logos/` | `LogoLarge` texture of each faction | Faction logos as 128 px PNG, decoded from DXT5 |

## Quality and checks against the game

- **351 tests** with Vitest on the logic: calculations, fitting rules, build codes, saved builds, upgrades and the Worker (including the security restrictions of the image proxy).
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
