# Especificación: mapa estelar de BATTLETECH

- **Issue:** [#103](https://github.com/PonchoiDev/mechlab-web/issues/103)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/starmap.test.ts`) y por último el código, en commits separados.

## Contexto

MW Builder tiene herramientas para *MechWarrior 5: Mercenaries* en `/mercs/`. Esta es la primera para *BATTLETECH* (Harebrained Schemes, 2018, versión 1.9.1): un mapa estelar con los sistemas del modo carrera, su dueño y lo que hay en cada uno. Vivirá en su propia ruta, `/battletech/`, donde después irá también su MechLab (#102).

Solo cuenta el juego sin mods, con sus DLC. Los modpacks (BEX, RogueTech, BTA) quedan para más adelante (#104).

## Datos del juego

Todo está en JSON sueltos dentro de `BattleTech_Data/StreamingAssets/` de la instalación.

| Dato | Archivo | Contenido |
|---|---|---|
| Sistemas | `data/starsystem/*.json` | Nombre, descripción, coordenadas (`Position`), dueño (`ownerID`), etiquetas del planeta (`Tags`), dificultad por modo (`DifficultyList` y `DifficultyModes`), con quién se firman contratos (`contractEmployerIDs`, `contractTargetIDs`), biomas de sus mapas, mercado negro (`BlackMarketShopItems`), tienda de facción (`factionShopOwnerID`) y en qué modos existe (`StartingSystemModes`) |
| Facciones | `data/factions/*.json` | Nombre, nombre corto, color del mapa (`factionMapColor`) e icono |
| Logos | `emblems/factions/*.dds` | Logo de cada facción, en DXT5 de 256 px |
| Etiquetas | `MDD/data/tagdata.sql` | Nombre visible y descripción de cada etiqueta (`planet_climate_arctic` es «Arctic World») |

`tools/extraer_mapa_battletech.py` lee esos archivos y guarda en `tools/datos-juego/battletech/` los sistemas, las facciones y las etiquetas, y en `battletech/public/starmap/logos/` los logos en PNG. `tools/generar_mapa_battletech.py` genera `src/data/battletech/starmap.json`.

**Decisiones sobre los datos:**

- **JSON tolerante:** los del juego llevan comas finales, comentarios y alguna coma que falta (`CombatGameConstants.json`). El lector los admite, como hace el juego.
- **Modo carrera:** cada sistema puede tener varias fichas, una por modo y por momento de la campaña. Aea, por ejemplo, es de la Aurigan Directorate al empezar la campaña y de la Arano Restoration en carrera. El mapa usa las fichas cuyo `StartingSystemModes` incluye `CAREER`: 219 sistemas, uno por nombre. El mapa de la campaña según su progreso queda fuera.
- **Dificultad:** la de carrera, en la posición de `CAREER` dentro de `DifficultyModes`.
- **Colores:** el `factionMapColor` de cada facción. Locals y NoFaction no lo traen; el script les da un gris neutro, con un comentario que lo diga.
- **Nombres de facción:** el del juego sin el artículo («the Capellan Confederation» pasa a «Capellan Confederation»).
- **Etiquetas:** solo las que el juego enseña (`PlayerVisible`), agrupadas por su prefijo:
  - clima, tamaño, población, civilización e industria (`planet_climate_*`, `planet_size_*`, `planet_pop_*`, `planet_civ_*`, `planet_industry_*`);
  - otros rasgos (`planet_other_*`, `planet_feature_*`).

  Las de nombre, facción y progreso (`planet_name_*`, `planet_faction_*`, `planet_progress_*`) son internas.
- **Forma de los datos:** `starmap.json` sigue el tipo `StarmapData` del mapa de MW5, con una sola fecha y sin HRQ, mercados, zonas ni el resto, para reutilizar su lienzo (territorios, zoom, buscador y marcas). Lo propio de BATTLETECH va en `details`, por sistema.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/starmap/`, con su propio build y su portada en la página de inicio, en una sección de BATTLETECH.
- **RF2.** El mapa pinta los 219 sistemas del modo carrera con el territorio de cada facción en su color, como el de MW5, con zoom, arrastre y nombres de los sistemas.
- **RF3.** Un buscador de sistemas encuadra el que se elige y lo marca.
- **RF4.** La ficha de un sistema muestra:
  - su dueño, con su logo;
  - su descripción;
  - su dificultad en carrera;
  - las etiquetas del planeta por grupos, con su descripción al pasar el ratón;
  - si tiene mercado negro y tienda de facción;
  - con qué facciones se firman contratos y contra quién;
  - los biomas de sus mapas.
- **RF5.** Una leyenda lista las facciones con cuántos sistemas tiene cada una.
- **RF6.** El sistema elegido va en la URL (`?system=Addasar`).

## Requisitos no funcionales

- **RNF1.** La lógica (búsqueda, grupos de etiquetas, facciones de la leyenda y URL) es pura y está en `src/utils/battletech/`, con sus tests.
- **RNF2.** Interfaz en inglés y sin guiones largos. Mismo aspecto que el mapa de MW5.
- **RNF3.** El build de BATTLETECH (`vite.battletech.config.ts`, base `/battletech/`) no cambia las rutas de MW5. `npm run build` construye los dos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los sistemas | se cargan | son 219, con nombres distintos, y todos tienen dueño, coordenadas y detalles |
| CA2 | Las facciones de la leyenda | se cuentan | Liao 63, Locals 36, Taurian Concordat 31, Marik 24, Arano Restoration 23, Davion 23, NoFaction 11 y Magistracy of Canopus 8, ordenadas de más a menos |
| CA3 | Addasar | se consulta | es de la Magistracy of Canopus, tiene dificultad 6 en carrera, mercado negro, contratos con Liao y la Magistracy, y las etiquetas «Arctic World» (clima), «Medium Gravity Planet» (tamaño) y «Mining» (industria) en sus grupos, sin las internas |
| CA4 | Aea | se consulta | es de la Arano Restoration, la ficha de carrera |
| CA5 | La búsqueda | se busca «addas» y «ur cruinne» | salen Addasar y Úr Cruinne (sin distinguir tildes) |
| CA6 | La URL | se abre con `?system=Addasar` o con un sistema que no existe | elige Addasar; con uno que no existe, ninguno. La vista con Addasar elegido lleva `system=Addasar` |
| CA7 | Los colores | se cargan las facciones | todas tienen color; Locals y NoFaction, el gris neutro |

## Fuera de alcance

- El mapa de la campaña según su progreso, con sus otras fichas por sistema.
- Los Flashpoints de los DLC y sus sistemas.
- El contenido de las tiendas (`itemCollections`).
- Los modpacks (#104).

## Plan de pruebas

1. **Datos y lógica (CA1 a CA7):** `src/utils/battletech/starmap.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - el mapa con sus territorios;
   - el buscador y la marca;
   - la ficha de Addasar;
   - la leyenda;
   - un enlace con `?system=`;
   - la portada con la sección nueva.
