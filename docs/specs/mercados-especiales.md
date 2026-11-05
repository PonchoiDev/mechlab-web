# Especificación: mercados especiales y 'Mechs únicos en el mapa estelar

- **Issue:** [#66](https://github.com/PonchoiDev/mechlab-web/issues/66)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/markets.test.ts` y `src/utils/buildCode.test.ts`) y por último el código, en commits separados.

## Contexto

Las campañas de varios DLC abren mercados en sistemas concretos con un inventario fijo: 'Mechs, armas con su tier, equipo y pilotos. Además, el DLC7 coloca un 'Mech único, el Atlas II (AS7-D-H), en Romulus a partir de una fecha. En el juego solo se descubren al pasar por allí, y es útil saber de antemano dónde comprar un 'Mech concreto.

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Mercados | `*CustomMarket*` de los DLC 2, 4, 5, 7, 8 y 9 | Sistema (`StarSystemId`), 'Mechs (`MechLoadouts`), armas y equipo con su cantidad, pilotos (número y habilidad) y si es un mercado negro |
| 'Mechs únicos | Acciones con `HeroMechToPlace` (`AtlasII_PlaceToi_ArcAction`) | Sistema y variante |
| Fecha del 'Mech único | Arco del mercado en la misma carpeta (`AtlasII_MarketArc`) | Condición de fecha del evento que lo coloca |

`extraer_mapa.py` guarda los mercados en `tools/datos-juego/starmap/mercados.json` y los 'Mechs únicos en `mechs_unicos.json`. `generar_mapa.py` los pasa a `starmap.json` con los nombres de los 'Mechs (de `mechs.json`) y de las armas (de `items.json`), para que el mapa no tenga que cargar los datos del MechLab.

**Decisiones sobre los datos:**

- **Tier de las armas:** el id del arma lleva el tier (`ERMediumLaser_Lvl4`). Se muestra como en el MechLab: `Tier 1` a `Tier 4`, `Lost Tech tier` para el 5 y sin tier si el id no lo lleva.
- **Etapa del mercado:** cada mercado se abre en un momento de su campaña. Se toma del nombre del asset o de su carpeta: `Prologue` y `Act 1` a `Act 3` en el DLC2, `Mission 5` en el DLC4, la misión del DLC8 (`Adam Steiner`, `Guerrero`) y `Black market` en el DLC7. En los demás, `Campaign`.
- **El mercado genérico** (`Campaign/…/CustomMarket_ArcAction`) es la plantilla del juego, sin sistema: no se incluye.

## Requisitos funcionales

- **RF1.** El mapa marca con un icono los sistemas con un mercado especial, y con otro los 'Mechs únicos a partir de su fecha.
- **RF2.** La ficha del sistema muestra cada mercado: su DLC y su etapa, si es un mercado negro, los 'Mechs que vende, sus armas y equipo con la cantidad y los pilotos.
- **RF3.** Cada 'Mech de un mercado o único se abre en el MechLab con su build de serie, con un enlace `/mercs/?mech=AS7-D-H`.
- **RF4.** Un panel **Markets**, junto a Factions y Quests, busca dónde se vende un 'Mech, un arma o qué hay en un sistema. Al elegir un resultado, el mapa se centra en el sistema y abre su ficha.
- **RF5.** El MechLab acepta `?mech=<id>` en la URL y abre esa variante con su build de serie.

## Requisitos no funcionales

- **RNF1.** La lógica (mercados de un sistema, búsqueda, 'Mechs únicos visibles en una fecha y enlace al MechLab) es pura y está en `src/utils/markets.ts`, con sus tests.
- **RNF2.** El mapa no carga `mechs.json` ni `items.json`.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El Atlas II | se consulta | es el AS7-D-H, del DLC 7, en Romulus desde el 10 de mayo de 3043; el 9 de mayo de 3043 no aparece y el 10 sí |
| CA2 | Los mercados del juego | se cargan | son 21, ninguno sin sistema |
| CA3 | El mercado del DLC4 en Rasalhague | se consulta | es de la etapa `Mission 5` y vende 9 'Mechs, entre ellos el TDR-5S y el BLR-1G |
| CA4 | El mercado negro del DLC7 en Alleghe | se consulta | es un mercado negro y vende el STK-3H |
| CA5 | El mercado del DLC9 en Bangor | se consultan sus armas | incluye una Ultra Autocannon 10 con `Lost Tech tier` y cantidad 1 |
| CA6 | Rasalhague | se consultan sus mercados | tiene dos: el del DLC4 y el mercado negro del DLC7 |
| CA7 | La búsqueda «atlas» | se busca | da los mercados que venden algún Atlas y el Atlas II de Romulus |
| CA8 | El AS7-D-H | se pide su enlace al MechLab | es `/mercs/?mech=AS7-D-H` |
| CA9 | `?mech=AS7-D-H` en el MechLab | se abre | carga el Atlas II con su build de serie; con un id que no existe, ninguna build |

## Fuera de alcance

- Los mercados normales de cada sistema, que el juego genera al azar.
- Los precios.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA8):** `src/utils/markets.test.ts`, con `starmap.json` real.
2. **MechLab (CA9):** `src/utils/buildCode.test.ts`.
3. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: iconos, ficha con mercados, panel Markets, Atlas II antes y después de su fecha y enlace al MechLab.
