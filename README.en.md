# MechLab MW5

[🇪🇸 Español](README.md) · 🇬🇧 English

A web 'Mech configurator for *MechWarrior 5: Mercenaries*. Pick any of the 639 playable variants, fit it following the rules of the in-game mechlab, install cantina upgrades and see right away how tonnage, damage, heat, speed and the rest of the stats change. Builds can be saved, shared with a link or exported as an image.

| | |
|---|---|
| **Live site** | **https://mw-builder.com/mercs/** |
| Slides | _coming soon_ |
| Video walkthrough | _coming soon_ |
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
| [Architecture](docs/arquitectura.md) | Data flow, app layers and design decisions, with diagrams |
| [Development with AI](docs/desarrollo-con-ia.md) | How the project was built with Claude Code and the practices that keep it reliable |
| [CLAUDE.md](CLAUDE.md) | Project conventions and rules the AI assistant reads every session |

## Tech stack

| Area | Technology |
|---|---|
| UI | React 19, TypeScript 7, hand-written CSS (no styling framework) |
| Build and dev server | Vite 8 |
| Tests | Vitest 5 (235 tests, V8 coverage) |
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
- Filters by weight class, tech base, jump jets, ECM, AMS, minimum hardpoints per type and campaign year. Search shortcuts such as `3e 2m jj ecm`.
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

**Save and share**
- Builds saved in the browser: save, update, load, duplicate, rename, delete, and export or import as JSON.
- A link that opens the build as it is (`/mercs/?b=…`).
- A PNG image of the build with the 'Mech, its equipment, its upgrades and its stats, ready to copy or download.

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
  hooks/                Build state, saved builds, view preferences and Sarna image
  utils/                Configurator logic: calculations, fitting rules, upgrades, build codes
  services/             Sarna API, clipboard and PNG build image (canvas)
  types/                TypeScript types
  data/                 Generated mechs.json, items.json and traits.json, plus the changelog
  test/                 Shared test fixtures
worker/                 Cloudflare Worker: Sarna image proxy and feedback form
site/                   Landing page at the domain root (mw-builder.com)
docs/                   Analysis, architecture and development with AI
tools/
  generar_mechs.py      Generates src/data/mechs.json
  generar_items.py      Generates src/data/items.json
  generar_traits.py     Generates src/data/traits.json (cantina upgrades)
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

## Quality and checks against the game

- **235 tests** with Vitest on the logic: calculations, fitting rules, build codes, saved builds, upgrades and the Worker (including the security restrictions of the image proxy).
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
