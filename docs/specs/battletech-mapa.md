# Especificación: mapa estelar de BATTLETECH

- **Issue:** [#103](https://github.com/PonchoiDev/mechlab-web/issues/103)
- **Estado:** implementada
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
| Planetas | `sprites/Planets/*.dds` | Imagen del planeta de la ficha, una por clima (`planet_climate_terran.dds`), en DXT1 de 64 px |
| Calavera | `uixSvgIcon_skullAtlas`, en `sharedassets0.assets` | La calavera de la dificultad (CHALLENGE): un Mesh de Unity (clase 43) que el importador de SVG del juego triangula |

`tools/extraer_mapa_battletech.py` lee esos archivos y guarda en `tools/datos-juego/battletech/` los sistemas, las facciones y las etiquetas, en `battletech/public/starmap/logos/` los logos en PNG, en `battletech/public/starmap/planets/` las imágenes de los planetas en PNG y en `battletech/public/starmap/skull.svg` la calavera, con los triángulos de su Mesh como un trazado SVG. `tools/generar_mapa_battletech.py` genera `src/data/battletech/starmap.json`.

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
- **RF7.** Como en el juego, el logo de cada facción se ve en su territorio, grande y con mucha transparencia, detrás de las estrellas:
  - va en el centro de su grupo de sistemas más grande (las facciones con sistemas sueltos, como Locals, lo llevan en el mayor);
  - su tamaño crece con ese grupo, en años luz, así que acompaña al zoom;
  - los grupos de menos de 4 sistemas no llevan logo, porque taparía a los vecinos.
- **RF8.** Filtros arriba a la derecha, como los del juego (Difficulty Filter, Biome Filter y Store Filter), con «No filter» por defecto y un botón de información que explica cada uno con el texto del juego:
  - **dificultad:** los sistemas con esa dificultad de carrera, en calaveras;
  - **bioma:** los sistemas con ese bioma entre los de sus mapas;
  - **tienda:** los sistemas con mercado negro, con alguna tienda de facción o con la tienda de una facción concreta.

  Los filtros se combinan, y los sistemas que no cumplen alguno se atenúan en el mapa (no desaparecen). Van en la URL (`?difficulty=7&biome=Urban&store=blackmarket`); un valor que no existe se ignora.
- **RF9.** La dificultad se ve como en el juego: CHALLENGE con 5 calaveras y medias calaveras. Cada punto de la dificultad de carrera (de 1 a 10) es media calavera: Yuris, de dificultad 7, tiene 3,5. La calavera es la del juego.
- **RF10.** En escritorio, la ficha del sistema va abajo en el centro, como la del juego:
  - arriba, la imagen del planeta (la de su clima), el nombre y CHALLENGE a la derecha;
  - a la izquierda, SYSTEM OWNER con el logo y el nombre del dueño, y ACTIVE FACTIONS: los logos de las facciones de los contratos, con las que dan o reciben contratos en el sistema resaltadas;
  - en el centro, SYSTEM SUMMARY (la descripción) y lo que el juego no enseña ahí: tiendas, con quién se firman contratos y contra quién, y biomas;
  - a la derecha, ATTRIBUTES: las etiquetas del planeta.

  En el móvil, las partes se apilan.
- **RF11.** El aspecto del mapa se acerca al del juego:
  - cada sistema es un punto del color de su dueño;
  - los territorios llevan un rayado diagonal tenue y un borde fino, sin el brillo ancho del mapa de MW5;
  - con un filtro, los sistemas que no lo cumplen se ven apagados.

  Son opciones del lienzo compartido que solo activa el mapa de BATTLETECH: el de MW5 se ve igual que antes.

## Requisitos no funcionales

- **RNF1.** La lógica (búsqueda, grupos de etiquetas, facciones de la leyenda, filtros, calaveras y URL) es pura y está en `src/utils/battletech/`, con sus tests.
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
| CA8 | Los logos del territorio | se calculan | hay uno por facción con logo y algún grupo de 4 sistemas o más; el sistema más cercano a cada logo es de su facción; el de Liao es más grande que el de la Magistracy of Canopus |
| CA9 | Las calaveras | se calcula la de Yuris (dificultad 7) y las de 1, 2 y 10 | Yuris tiene 3 calaveras enteras, una media y una vacía (3,5, como en el juego); 1 es media calavera, 2 una entera y 10 las cinco |
| CA10 | Las opciones de los filtros | se calculan | dificultades del 1 al 9, de menos a más; los 12 biomas en orden alfabético; tiendas: mercado negro, cualquier tienda de facción y la de cada una de las 7 facciones con tienda |
| CA11 | Los filtros | se combinan | sin filtros no se atenúa nada; con dificultad 7 cumplen los 37 sistemas de esa dificultad, Yuris entre ellos; con bioma Urban, 31; con mercado negro, 40; con la tienda de Liao, 2; con dificultad 7 y bioma Urban, solo los que cumplen los dos |
| CA12 | La URL de los filtros | se abre con `?system=Yuris&difficulty=7&biome=Urban&store=blackmarket` o con valores que no existen | se leen los tres filtros y el sistema; los valores que no existen se ignoran. La vista lleva solo los filtros puestos, después del sistema |
| CA13 | La ficha de Yuris | se consulta | su planeta es el del clima templado (`planet_climate_terran.png`); sus facciones activas son Federated Suns, ComStar, Capellan Confederation y Local pirate organization, resaltadas entre las 11 de los contratos, en el orden del juego |

## Fuera de alcance

- El mapa de la campaña según su progreso, con sus otras fichas por sistema.
- Los Flashpoints de los DLC y sus sistemas.
- El contenido de las tiendas (`itemCollections`).
- Los modpacks (#104).

## Plan de pruebas

1. **Datos y lógica (CA1 a CA13):** `src/utils/battletech/starmap.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - el mapa con sus territorios;
   - el buscador y la marca;
   - la ficha de Addasar;
   - la leyenda;
   - un enlace con `?system=`;
   - la portada con la sección nueva;
   - los filtros, solos y combinados, con el botón de información y la URL;
   - la ficha de Yuris abajo en el centro, con sus 3,5 calaveras, frente a la captura del juego;
   - el mapa de MW5 (`/mercs/starmap/`), que no cambia.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después el build propio, los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 219 sistemas de carrera y 13 facciones (8 con sistemas y 5 que solo salen en los contratos). `starmap.json` pesa unos 390 KB (unos 43 KB comprimido).
- **Tests:** los ocho criterios (CA1 a CA8) están en `src/utils/battletech/starmap.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844, en desarrollo y con el build de producción:
  - el mapa con sus territorios;
  - el buscador y la marca;
  - las fichas de Addasar y Aea;
  - la leyenda;
  - los enlaces con `?system=`;
  - la portada con la carátula nueva.
- **Decisiones durante el desarrollo:**
  - **Comas que faltan:** además de la de `CombatGameConstants.json`, el lector admite la que falta tras una cadena (`mechdef_javelin_JVN-10A`, de Urban Warfare).
  - **Etiquetas repetidas:** el mercado negro y la sede de una facción salen como tiendas, no también entre las etiquetas.
  - **Nombres de facción:** el juego los escribe para usarlos en frases: se quita el artículo y la primera letra va en mayúscula («Local pirate organization»).
  - **Biomas:** el juego no tiene nombre visible para ellos; el script los escribe a partir de su id.
  - **Desarrollo:** el servidor de Vite de BATTLETECH resuelve `/src/` a la carpeta `src/` del repositorio, y cada página carga su script con esa ruta.
  - **Copias de trabajo de `.claude/worktrees/`:** quedan fuera de git, de los tests y del lint.
  - **Logos en el territorio:** el lienzo compartido con MW5 admite logos sobre los territorios (`emblems`), con un 14 % de opacidad; el mapa de MW5 no los usa. Un sistema se une al grupo de su facción si está a 25 años luz o menos de otro: los de la Magistracy of Canopus, en la frontera, están a 20 o 23 unos de otros.
