# Especificación: ficha de las zonas de conflicto y arenas en el mapa estelar

- **Issue:** [#80](https://github.com/PonchoiDev/mechlab-web/issues/80)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/zones.test.ts`) y por último el código, en commits separados.

## Contexto

El mapa dibuja las zonas de conflicto ([mapa-estelar.md](mapa-estelar.md)) y la ficha de cada sistema muestra la reputación recomendada y la dificultad de su zona ([reputacion-zonas.md](reputacion-zonas.md)). Pero al pasar el ratón por una zona solo se ve la facción, y para saber qué pide hay que buscar uno de sus sistemas. Además, el juego trae de cada zona su descripción, su capital, cuánto cuestan y tardan las reparaciones y sus contratos de varias misiones, que no se muestran. Tampoco se ve qué sistemas tienen arena (DLC6) ni qué da subir de rango en ellas.

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Zona | `ClusterToiDataFragment` de cada `ClusterAsset` (ya se lee para la reputación) | `ClusterDescription` (clave de `Faction_StringTable`), `ClusterCapitalStarSystemId`, `RepairCBillMarkup` y `RepairTimeMarkup` (multiplicadores de coste y tiempo de reparación), `MMO_MinNumberOfMissions`, `MMO_MaxNumberOfMissions` y `MMO_PlacementOdds` (contratos de varias misiones) |
| Arenas | DataTable `DLC6/LevelGenerators/ArenaStarSystemTable` | Los 9 sistemas con arena (la fila es el id del sistema), si tienen mercado negro (`HasBlackMarket`), encuentros con mercenarios (`HasMercEncounters`) y su variante especial (`MissionVariant.Arena.Special.Solaris`, `…Hardcore`) |
| Rangos de fama | DataTable `DLC6/ArenaFameProgressionTable` | Los 11 rangos: nivel, nombre, descripción, puntos de fama necesarios (`PointsRequired`) y recompensa (C-Bills, 'Mechs, armas y equipo) |

`extraer_mapa.py` añade estos campos a `zonas.json` y guarda las arenas en `arenas.json`. `generar_mapa.py` los pasa a `starmap.json`.

**Decisiones sobre los datos:**

- **Por modo:** la reparación y los contratos de varias misiones cambian entre campaña y carrera (Liao/Davion Border: reparaciones ×0,6 en campaña y ×0,35 en carrera), así que van en cada nivel de la zona, junto a la reputación y la dificultad. Si todos los modos coinciden, se muestra una sola línea, como hasta ahora.
- **Niveles distintos:** dos fichas del mismo modo con la misma reputación pero distinta reparación o distintos contratos ya no se funden en una línea (Davion Borderlands tiene dos en carrera que solo difieren en la probabilidad de los contratos). Los criterios de [reputacion-zonas.md](reputacion-zonas.md) siguen comparando solo el modo, la reputación y la dificultad.
- **Descripción y capital:** son las de la zona de campaña; si no la hay, las de la primera que las traiga.
- **Centros industriales:** también son `ClusterAsset` y traen su reparación; la ficha del centro la muestra igual.
- **Recompensas de los rangos:** con los nombres del MechLab, como las de las HRQ; las armas con su tier.

## Requisitos funcionales

- **RF1.** Al pasar el ratón por una zona de conflicto, sin una estrella debajo, la etiqueta muestra su nombre, su reputación recomendada y su dificultad.
- **RF2.** Al pulsar dentro de una zona, sin una estrella debajo, se abre su ficha: nombre, descripción, capital (con enlace), número de sistemas y, por modo, reputación, dificultad, coste y tiempo de reparación y contratos de varias misiones.
- **RF3.** La ficha del centro industrial y la de la zona de un sistema muestran también la reparación.
- **RF4.** Los sistemas con arena llevan un icono en el mapa. Su ficha muestra la arena: si tiene mercado negro, encuentros con mercenarios y su variante especial, y los rangos de fama con los puntos que piden y lo que dan, desplegables.

## Requisitos no funcionales

- **RNF1.** La lógica (zona bajo un punto, niveles con reparación y contratos, arenas de un sistema) es pura y está en `src/utils/`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Liao/Davion Border | se consulta | tiene descripción, su capital es la del juego (id 650) y en campaña repara a ×0,6 de coste y ×1 de tiempo, y en carrera a ×0,35 y ×0,6; los contratos de varias misiones son de 2 a 3 misiones, con un 30 % de probabilidad |
| CA2 | Un punto junto a una estrella de Liao/Davion Border y otro lejos de toda zona | se busca la zona bajo el punto | el primero es Liao/Davion Border y el segundo ninguna |
| CA3 | El centro industrial de Diboll | se consultan sus niveles | traen el coste de reparación de cada modo |
| CA4 | Las arenas | se cargan | son 9, en Northwind, Outreach, Solaris, Galatea, Westerhand, Numenor, Torrence, Hardcore y Herotitus; Solaris tiene mercado negro, encuentros con mercenarios y variante especial |
| CA5 | Los rangos de fama | se cargan | son 11, de «Nobody From Nowhere» (0 puntos) a «Champion»; Rudiarius pide 975 puntos y da 2.400.000 C-Bills, el Autocannon/20 rapid-fire y el Heavy Rifle Burst Fire de tier 4 y el Arena Supercharger MK IV |
| CA6 | La descripción de un nivel con reparación | se describe | «Repairs ×0.6 cost · ×1 time» y, para los contratos, «Multi-mission contracts: 2 to 3 missions (30%)» |

## Fuera de alcance

- Los grupos de mercenarios rivales y sus zonas de influencia, que van en su propia issue.
- Los combates de cada arena y sus recompensas por misión.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA6):** `src/utils/zones.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: pasar el ratón por Liao/Davion Border y pulsar dentro, la ficha de Diboll, el icono de arena y la ficha de Solaris con sus rangos.
