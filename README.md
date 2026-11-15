# MechLab MW5

🇪🇸 Español · [🇬🇧 English](README.en.md)

Configurador web de 'Mechs para *MechWarrior 5: Mercenaries*. Permite elegir uno de los 639 chasis jugables, equiparlo respetando las reglas del mechlab del juego, aplicarle las mejoras de la cantina y ver al momento cómo cambian el peso, el daño, el calor, la velocidad y el resto de estadísticas. Las builds se pueden guardar, compartir con un enlace o exportar como imagen.

| | |
|---|---|
| **Web en producción** | **https://mw-builder.com/mercs/** |
| Mapa estelar | https://mw-builder.com/mercs/starmap/ |
| Unidades enemigas | https://mw-builder.com/mercs/units/ |
| Pilotos | https://mw-builder.com/mercs/pilots/ |
| MechLab de BATTLETECH | https://mw-builder.com/battletech/ |
| Mapa estelar de BATTLETECH | https://mw-builder.com/battletech/starmap/ |
| Presentación (slides) | [Ver en Google Slides](https://docs.google.com/presentation/d/12EF1CgE-6KTWpWKrRVYCNxMUtrFIe35g/edit?usp=drive_link) |
| Vídeo explicativo | [Ver en Google Drive](https://drive.google.com/file/d/1FbnRwwYDHOZMuEQ71Wt3I6yfammuBIkp/view?usp=drive_link) |
| Login | No tiene: la web se usa sin registro y las builds se guardan en el navegador |

## Descripción general

*MechWarrior 5: Mercenaries* tiene un mechlab propio, pero solo se puede usar dentro de una partida y con los 'Mechs que tengas en el hangar. MechLab permite planificar builds de cualquier chasis desde el navegador, sin instalar nada ni registrarse, y compartirlas con otros jugadores.

Los datos no se han copiado a mano: se extraen de los archivos del juego (exportados con el editor de mods oficial) con unos scripts de Python que generan los JSON que usa la web. Así hay 639 variantes y 342 objetos con sus estadísticas reales, y basta con volver a ejecutar los scripts cuando el juego se actualiza. Las cifras de la web están comprobadas contra capturas del mechlab del juego en tests automáticos.

El proyecto nació como trabajo de fin de máster y se publicó en Reddit (r/Mechwarrior5), donde los comentarios de los jugadores guiaron varias de las funcionalidades: filtros de chasis, builds de fábrica, año de aparición y mejoras de la cantina.

## Documentación

| Documento | Contenido |
|---|---|
| [Análisis](docs/analisis.md) | Problema, usuarios, alcance, requisitos y cómo evolucionaron con el feedback |
| [Arquitectura](docs/arquitectura.md) | Flujo de datos, capas, decisiones de diseño, principios (SOLID, DRY, KISS, YAGNI) y relación con Clean Architecture |
| [Diagramas UML](docs/uml.md) | Casos de uso, clases del dominio y secuencias de compartir una build y del feedback |
| [Especificaciones](docs/specs/) | Spec Driven Development: requisitos y criterios de aceptación escritos antes del código |
| [Desarrollo con IA](docs/desarrollo-con-ia.md) | Cómo se ha construido el proyecto con Claude Code y qué prácticas lo hacen fiable |
| [CLAUDE.md](CLAUDE.md) | Convenciones y reglas del proyecto que lee el asistente de IA en cada sesión |

## Stack tecnológico

| Área | Tecnología |
|---|---|
| Interfaz | React 19, TypeScript 7, CSS propio (sin framework de estilos) |
| Build y desarrollo | Vite 8 |
| Tests | Vitest 5 (496 tests, cobertura con V8) |
| Análisis estático | oxlint |
| Despliegue | Cloudflare Workers (assets estáticos y un Worker para la API) |
| Correo del formulario de feedback | Cloudflare Email Routing |
| Imágenes de los 'Mechs | API de [Sarna.net](https://www.sarna.net), a través de un proxy en el Worker |
| Extracción de datos del juego | Python 3 (sin dependencias externas) |
| Integración continua | GitHub Actions (lint, tests con cobertura y build en cada push y pull request) |

No usa base de datos ni backend propio: las builds guardadas viven en el `localStorage` del navegador y una build compartida viaja entera dentro de su enlace.

## Funcionalidades principales

**Selector de chasis**
- Búsqueda por nombre, variante o ID entre 639 variantes jugables.
- Resumen de anclajes de cada variante por tipo y tamaño (`2E·L 1E·M`), y especificaciones del chasis como en el juego (`325 C-XL DHS C-ENDO C-FERRO AP`).
- Filtros por clase de peso, tecnología, jump jets, ECM, AMS, variantes hero, rol de combate, DLC (juego base y DLC 1 a 9), mínimo de anclajes por tipo y año de la campaña. Atajos en el buscador, como `3e 2m jj ecm` o `hero dlc7`.
- Año de aparición y rol de cada variante.

**Configuración**
- Tablero con el 'Mech en el centro y sus componentes alrededor. Al pulsar un componente se abre un panel para equiparlo, con filtros por texto, tecnología y tipo de arma.
- Reglas del mechlab del juego: tipo y tamaño de cada anclaje (sacados de los modelos del juego), anclajes omni y de artillería, ranuras generales y especiales (motor, jump jets, supercargadores).
- Tiers de armas (0 a 5) con sus estadísticas.
- Armadura delantera y trasera por componente, con botones para vaciarla o maximizarla según el tonelaje libre.
- Build de fábrica de cada variante, cargada al elegir el chasis y recuperable con un botón.
- Avisos de la build: anclajes libres, armas sin munición, armadura incompleta y sobrepeso.
- Opciones de vista: ranuras como celdas, tablero compacto y panel a la izquierda o a la derecha.

**Mejoras de la cantina**
- Las 50 mejoras de 'Mech del juego, agrupadas por categoría, con el límite de ranuras de cada chasis.
- Reglas del juego: cada mejora se instala una vez, la I y la II se pueden combinar y sus porcentajes se suman.
- Cada estadística afectada muestra el valor base y el mejorado (`52.9 ▲ 57.7`), como el juego.

**Estadísticas**
- Franja con tonelaje, armadura, velocidad, jump jets, daño por salva, daño cuerpo a cuerpo, pico de calor, refrigeración y alcance máximo.
- Pestaña **Weapons**: daño, calor, RPM, DPS, alcance, alcance máximo y velocidad del proyectil de cada arma, con totales y duración de la munición.
- Pestaña **'Mech**: estructura, capacidad de calor, giro de pie y del torso, sensor y fijación de blanco, como el resumen de la pantalla de mejoras del juego.
- **Comparar:** la build actual junto a otro 'Mech, con la imagen y el loadout de cada uno. Se compara con la build de serie de cualquier 'Mech o con una build guardada, y cada tarjeta lleva sus cifras (potencia de fuego, defensa, calor y movilidad) alineadas con las de la otra, con el valor mejor resaltado en verde.

**Guardar y compartir**
- Builds guardadas en el navegador: guardar, actualizar, cargar, duplicar, renombrar, borrar, y exportar o importar en JSON.
- Enlace que abre la build tal cual (`/mercs/?b=…`).
- Imagen PNG de la build con el 'Mech, su equipo, sus mejoras y sus estadísticas, lista para copiar o descargar.

**Mapa estelar**
- Página propia con el mapa de la Esfera Interior, parecido al del juego: territorio de cada facción con su color, clústeres y centros industriales.
- Fronteras en cualquier fecha de 3015 a 3060, con un control deslizante y saltos a los 19 eventos del juego que las mueven.
- Ficha de cada sistema con su facción, su clúster y su historial de propietarios, la reputación recomendada y la dificultad de su clúster o su centro industrial en campaña y en carrera, buscador por nombre y enlace con la fecha y el sistema.
- Ficha de cada zona de conflicto al pulsar dentro de ella (descripción, capital, reputación, dificultad, recargo de reparación y contratos de varias misiones), y las arenas del DLC6 con sus rangos de fama.
- Los mercenarios rivales del DLC4: las zonas que ocupa cada compañía en la fecha elegida, con su logo, y la ficha de cada una.
- Las 64 misiones de alta recompensa (HRQ) del juego: dónde se ofrece cada una, su ruta por los sistemas de sus misiones, sus condiciones (reputación, fechas, misión previa o excluyente), su recompensa (C-Bills, reputación, 'Mechs, armas y equipo) y un buscador por nombre, sistema o quien la encarga.
- Los 22 mercados fijos de las campañas de los DLC y el Atlas II de Romulus, con un buscador de dónde comprar cada 'Mech o arma. Cada 'Mech se abre en el MechLab con su build de serie (`/mercs/?mech=AS7-D-H`).
- Find a 'Mech: el mapa se colorea según la rareza de una variante en el mercado de cada facción, en la fecha elegida, con sus fuentes fijas (HRQ, mercados especiales) y el enlace se comparte (`?mech=AS7-D`). Special 'Mech locations lista los 'Mechs hero y las variantes especiales que solo se consiguen en un sitio, como el Wolverine de Razer.

**MechLab de BATTLETECH**
- Página propia (`/battletech/`) con los 96 'Mechs que se pueden tener en *BATTLETECH* (2018), del juego base y de Heavy Metal, Flashpoint y Urban Warfare, con su build de serie y su icono del juego.
- Todas las armas, munición, disipadores, retrorreactores y mejoras, con sus versiones de fabricante (+ a + + +), filtros por categoría, versión, fuente y rareza, búsqueda y orden.
- Las reglas del mechlab del juego: todo ocupa ranuras, las armas necesitan un anclaje libre de su tipo, cada componente va donde lo permite el juego, los retrorreactores tienen su máximo y su tramo de tonelaje, y el equipo fijo no se quita.
- Blindaje en pasos de 5 con sus máximos delantero y trasero, y un botón que reparte el tonelaje libre como el del juego.
- El mismo tablero, panel de ubicación y barra de herramientas que el MechLab de MW5, con el menú del clic derecho (duplicar, llenar anclajes, añadir munición, mover y quitar).
- Daño de la salva, inestabilidad, calor frente a disipación, daño por distancia, munición por tipo de arma, andar y correr, y valor en C-Bills.
- Selector con filtros por clase, fuente, rol, anclajes mínimos y retrorreactores; enlace para compartir (`?b=` y `?mech=HBK-4G`), builds guardadas en el navegador y comparación.

**Argo de BATTLETECH**
- Página propia (`/battletech/argo/`) con las 35 mejoras de la *Argo*, la nave de la compañía en *BATTLETECH* (2018): precio, mantenimiento mensual, efectos con la frase del juego, requisitos, lo que abre cada una y lo que dice el tripulante que la presenta.
- Árbol por categoría y nivel que resalta, al pasar por una mejora, todo lo que pide y todo lo que abre.
- Planificador: se marcan las mejoras, se añaden solas sus requisitos y se suman el coste, el mantenimiento mensual (¢80.000 de base más cada mejora) y el efecto conjunto. El plan va en el enlace (`?own=mechBay3,trainingModule1`).

**Otros**
- Campana de novedades con los cambios que el usuario aún no ha visto.
- Formulario de feedback que llega por correo sin mostrar la dirección del desarrollador.
- Diseño adaptado a móvil.

## Instalación y ejecución

Requisitos: **Node.js 24** o superior. Python 3 solo hace falta para regenerar los datos del juego.

```sh
git clone https://github.com/PonchoiDev/mechlab-web.git
cd mechlab-web
npm install
npm run dev
```

La web queda en http://localhost:5173/mercs/. Con `npm run dev -- --host 0.0.0.0` se puede abrir desde otros dispositivos de la red.

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run dev:battletech` | Servidor de desarrollo de las páginas de BATTLETECH (http://localhost:5174/battletech/) |
| `npm test` | Tests unitarios con Vitest |
| `npm run coverage` | Tests con informe de cobertura en `coverage/` |
| `npm run lint` | Análisis estático con oxlint |
| `npm run build` | Comprobación de tipos y build de producción en `dist/`, de MW5 y de BATTLETECH |
| `npm run preview` | Sirve el build de producción |

En desarrollo, el servidor de Vite hace de proxy de las imágenes de Sarna, y el formulario de feedback escribe el mensaje en la terminal en vez de enviarlo.

## Estructura del proyecto

```
src/
  App.tsx               Componente principal: estado de la build y composición de la página
  components/           Componentes de la interfaz (tablero, selector, panel de mejoras, diálogos…)
  starmap/              Página del mapa estelar: canvas, ficha del sistema, fecha y buscador
  units/                Página de las unidades enemigas: filtros y ficha de cada unidad
  pilots/               Página de los pilotos: pilotos hero, rasgos y programas de las academias
  battletech/           Páginas de BATTLETECH (mapa estelar), con su lógica en utils/battletech/
  battletech/argo/      Página de la Argo de BATTLETECH: árbol de mejoras, fichas y plan
  battletech/mechlab/   MechLab de BATTLETECH: selector de 'Mech, tablero, selector de equipo y análisis
  hooks/                Estado de la build, builds guardadas, preferencias de vista e imagen de Sarna
  utils/                Lógica del configurador: cálculos, reglas de equipo, mejoras, código de las builds
  services/             API de Sarna, portapapeles e imagen PNG de la build (canvas)
  types/                Tipos de TypeScript
  data/                 mechs.json, items.json, traits.json, starmap.json y units.json generados, y las novedades
  test/                 Datos de prueba compartidos
worker/                 Worker de Cloudflare: proxy de imágenes de Sarna y formulario de feedback
starmap/index.html      Entrada de la página del mapa estelar (/mercs/starmap/)
units/index.html        Entrada de la página de las unidades enemigas (/mercs/units/)
pilots/index.html       Entrada de la página de los pilotos (/mercs/pilots/)
battletech/             Entradas de las páginas de BATTLETECH (/battletech/) y sus imágenes
battletech/argo/        Entrada de la página de la Argo (/battletech/argo/) y sus imágenes en public/argo/
battletech/index.html   Entrada del MechLab de BATTLETECH (/battletech/), con los iconos de los chasis en public/mechlab/
site/                   Portada de la raíz del dominio (mw-builder.com)
docs/                   Análisis, arquitectura, diagramas UML y desarrollo con IA
tools/
  generar_mechs.py      Genera src/data/mechs.json
  generar_items.py      Genera src/data/items.json
  generar_traits.py     Genera src/data/traits.json (mejoras de la cantina)
  extraer_mapa.py       Extrae del .pak del juego los datos del mapa estelar
  generar_mapa.py       Genera src/data/starmap.json
  extraer_unidades.py   Extrae del .pak del juego la vida, la velocidad y las armas de las unidades enemigas
  imagenes_sarna.py     Busca en Sarna la página y el dibujo de cada chasis de las unidades enemigas
  generar_unidades.py   Genera src/data/units.json
  extraer_pilotos.py    Extrae del .pak del juego los pilotos hero y los rasgos de piloto con sus efectos
  generar_pilotos.py    Genera src/data/pilots.json
  extraer_argo_battletech.py  Copia de BATTLETECH las mejoras de la Argo, sus textos e imágenes
  generar_argo_battletech.py  Genera src/data/battletech/argo.json
  extraer_mechlab_battletech.py  Extrae de BATTLETECH y de sus DLC los chasis, las variantes, los componentes y los iconos
  generar_mechlab_battletech.py  Genera src/data/battletech/mechs.json, items.json y constants.json
  unityfs.py            Lectura de los bundles de Unity de los DLC de BATTLETECH
  ue4.py                Lectura del .pak y de los assets de Unreal Engine 4
  battletech.py         Lectura de los datos de BATTLETECH (JSON tolerante y etiquetas)
  extraer_mapa_battletech.py   Extrae de BATTLETECH los sistemas, las facciones, las etiquetas y los logos
  generar_mapa_battletech.py   Genera src/data/battletech/starmap.json
  datos-juego/          Archivos exportados del juego
.github/                Integración continua, CodeQL y Dependabot
.coderabbit.yaml        Configuración de la revisión de código con CodeRabbit
CLAUDE.md               Convenciones del proyecto para el asistente de IA
```

La lógica está separada de la interfaz: `src/utils/` son funciones puras con sus tests, y los componentes solo la usan. Por ejemplo, `calculators.ts` calcula el resumen de la build a partir del 'Mech, el equipo, la armadura y las mejoras, y `buildCode.ts` convierte una build en el código de su enlace y lo valida al abrirlo.

## Datos del juego

Los JSON de `src/data/` se generan a partir de los archivos del juego, exportados con el editor de mods de *MechWarrior 5: Mercenaries* a `tools/datos-juego/`:

| Carpeta | Contenido | Se usa para |
|---|---|---|
| `mda/` | Datos de cada variante | Tonelaje, armadura, estructura, ranuras, motor, velocidad, giro |
| `mdl/` y `hps/` | Modelo y anclajes de cada chasis | Tamaño real de cada anclaje |
| `loadout/` | Builds de fábrica | Build de serie de cada variante |
| `unitcard/` | Fichas de unidad | Año de aparición y rol |
| `items/` | Armas, equipo y munición | Estadísticas por tier, munición, disipadores |
| `traits/` | Mejoras | Mejoras de la cantina y sus efectos |
| `mech_string_table/` | Tabla de textos `Mech_StringTable` exportada a CSV | Nombres de los chasis |

```sh
python3 tools/generar_items.py
python3 tools/generar_mechs.py
python3 tools/generar_traits.py
```

`generar_mechs.py` lee también `items.json` para validar las builds de fábrica, así que se ejecuta después de `generar_items.py`. Los scripts descartan las variantes no jugables (campaña, tutorial, jefes y cinemáticas) y, al terminar, avisan de lo que no han podido cuadrar: piezas de las builds de fábrica que no caben, variantes sin ficha de unidad o anclajes cuyo tamaño se ha tenido que deducir.

### Mapa estelar

Los datos del mapa no se exportan con el editor de mods: `extraer_mapa.py` los lee directamente del archivo `.pak` de la instalación, que está sin cifrar ni comprimir, con un lector propio de Unreal Engine 4 (`ue4.py`). Solo lee el índice y los assets necesarios (unos 7 MB de los 106 GB), en menos de un segundo, y los guarda como JSON en `tools/datos-juego/starmap/`. Solo hace falta repetirlo cuando un parche cambie el mapa.

```sh
python3 tools/extraer_mapa.py "/ruta/a/MechWarrior 5 Mercenaries"
python3 tools/generar_mapa.py
```

`generar_mapa.py` lee también los nombres de los pilotos hero que dan algunas misiones de campaña (`tools/datos-juego/pilotos/hero.json`, de `extraer_pilotos.py`).

| Archivo | Asset del juego | Contenido |
|---|---|---|
| `sistemas.json` | `InnerSphereData/MW5_InnerSphereData` | 2174 sistemas con coordenadas, clúster y fecha de cada cambio de propietario |
| `facciones.json` | `Factions/*` | Nombre y estencil del mapa de cada facción |
| `colores.json` | `Faction_Colours_MPC` | Color de cada estencil, de los Clanes, de los clústeres y de los centros industriales |
| `eventos.json` | `BorderChanges/*/Borders*` | Los 19 cambios de frontera, de 3025 a 3060 |
| `centros_industriales.json` | `SafeZone_*_ClusterAsset` y su malla | Los 35 centros industriales con su capital, sus sistemas y las líneas que los unen |
| `clusteres.json` y `textos.json` | Assets de clúster y `Faction_StringTable` | Nombres de los clústeres |
| `misiones.json` | Acciones `Show…`, `Place…` y `Generate…` de las HRQ y sus objetivos | Sistema de la oferta y de cada misión, títulos, resúmenes y quien la encarga |
| `recompensas_misiones.json` | Objetivos de las HRQ con `bHasRewards` | C-Bills, reputación, 'Mechs, armas, equipo y texto final de cada recompensa |
| `mercados.json` y `mechs_unicos.json` | Assets `CustomMarket` y acciones con `HeroMechToPlace` | Mercados con su inventario y 'Mechs únicos con su fecha |
| `zonas.json` | `*_ClusterAsset` de campaña, de carrera y de las campañas de los DLC | Sistemas, nombre, descripción, capital, reputación recomendada, dificultad, recargo de reparación y contratos de varias misiones de cada zona |
| `rivales.json` | `RivalMercs/StarMapRadialInfluences` y `RivalMercs/Companies` (DLC4) | Las 18 compañías de mercenarios rivales y sus 76 zonas de influencia con su dueño por fechas |
| `arenas.json` | `ArenaStarSystemTable` y `ArenaFameProgressionTable` (DLC6) | Sistemas con arena y rangos de fama con sus recompensas |
| `campanas.json` y `nombres_campanas.json` | Scripts de los arcos de cada parte de las campañas de los DLC (`DLCn/CampaignData`), sus acciones `Place` y sus escenarios, y la cabecera de cada DLC | Las partes de cada campaña con su sistema y su fecha, y sus misiones en orden con sistema, textos y pago; el nombre de cada campaña |
| `academias.json` y `programas.json` | `PilotTraining/AcademyDataAssets` y `TrainingAssets` (DLC7) | Las 93 academias de pilotos con su sistema, fundación y programas, y las cifras y los rasgos propios de cada programa |
| `alianzas.json` | `Allegiance` de los assets de `Factions/*` | Facción a la que responde cada una, para la tabla de rareza de las facciones menores |
| `recompensas_campana.json` | Objetivos con `bHasRewards` y `MechLoadouts` fuera de las HRQ, y la acción que los coloca | 'Mechs de las campañas de los DLC, el Bounty Hunter o promociones, con su sistema |
| `heroes_en_venta.json` | `HeroMechsForPurchase` | Los 95 'Mechs hero que el juego puede poner a la venta |
| `public/starmap/logos/` | Texturas `LogoLarge` de cada facción | Logos de facción en PNG de 128 px, descomprimidos de DXT5 |

### Unidades enemigas

Las unit cards de los tanques, VTOL, torretas y armaduras de combate están en `unitcard/`, pero no traen su vida, su velocidad ni sus armas. `extraer_unidades.py` las saca de los blueprints del `.pak`, siguiendo la herencia, las torretas montadas y el bytecode del script de construcción que les pone los cañones, y las guarda en `tools/datos-juego/unidades/`. `generar_unidades.py` lo une a las unit cards en `src/data/units.json`.

```sh
python3 tools/extraer_unidades.py "/ruta/a/MechWarrior 5 Mercenaries"
python3 tools/imagenes_sarna.py
python3 tools/generar_unidades.py
```

| Archivo | Asset del juego | Contenido |
|---|---|---|
| `unidades.json` | Blueprint de cada unidad (`UnitClass`) y de sus torretas | Vida base, velocidad, armas y tamaño del grupo de las armaduras de combate |
| `armas.json` | `WeaponDataAsset` de cada arma | Nombre, estadísticas y quirks, también de las armas de vehículo que no están en `items/` |
| `facciones.json` | `Factions/*` y sus StringTables | Nombre de las facciones de la rareza, con las compañías de mercenarios y los patrocinadores de las arenas |
| `sarna.json` | API de Sarna (`imagenes_sarna.py`), no el juego | Página y dibujo principal de cada chasis, a partir de la tabla de títulos de `generar_unidades.py` |

### Pilotos

Los rasgos de piloto del DLC7 y los pilotos hero no se exportan con el editor de mods: `extraer_pilotos.py` los lee del `.pak`. De cada rasgo sigue el árbol de componentes (afinidad con un chasis, quirks de arma, blindaje, sensores, costes del piloto…); de cada piloto hero saca sus habilidades, sus rasgos fijos y las misiones que lo dan. `generar_pilotos.py` rellena los textos, convierte las cifras en efectos, ordena los rasgos por subgrupos y les añade los programas de las academias de `tools/datos-juego/starmap/`, agrupados por familias.

```sh
python3 tools/extraer_pilotos.py "/ruta/a/MechWarrior 5 Mercenaries"
python3 tools/generar_pilotos.py
```

| Archivo | Asset del juego | Contenido |
|---|---|---|
| `rasgos.json` | `DLC7/TOIs/PilotTraining/PilotTraits/**` | Los 184 rasgos con su nombre, sus descripciones, sus etiquetas (hero, contratables, academias, DLC) y las cifras de cada componente |
| `hero.json` | `MWPilotPersonaAsset` con `PilotPersona.Use.Hero`, su `MWPersonaAsset` y los `PilotRewards` que los dan | Los pilotos hero con su nombre, biografía, habilidades, sueldo, rasgos fijos, retrato y las misiones que los dan |
| `public/pilots/portraits/` | Textura del `MWPortraitAsset` de cada piloto hero | Retratos en PNG de 160 px, descomprimidos de DXT5 |
| `niveles.json` | `Campaign/Pilots/_common/PilotSkillLevelCurve` | La experiencia que pide cada nivel de habilidad |

### Mapa estelar de BATTLETECH

*BATTLETECH* (Harebrained Schemes, 2018) guarda sus datos como JSON sueltos en `BattleTech_Data/StreamingAssets/` de la instalación. `tools/battletech.py` los lee aunque traigan comas finales, comentarios o alguna coma de menos, como los admite el juego, y saca los nombres de las etiquetas de `MDD/data/tagdata.sql`. Solo cuenta el juego base: la carpeta `Mods/` de una instalación con mods no se lee.

```sh
python3 tools/extraer_mapa_battletech.py "/ruta/a/BATTLETECH"
python3 tools/generar_mapa_battletech.py
```

| Archivo | Del juego | Contenido |
|---|---|---|
| `battletech/starmap/sistemas.json` | `data/starsystem/` | Las 256 fichas de sistema (una por modo y momento de la campaña) con coordenadas, dueño, etiquetas, dificultad por modo, contratos, biomas y tiendas |
| `battletech/starmap/facciones.json` | `data/factions/` | Nombre, color del mapa e icono de cada facción |
| `battletech/starmap/etiquetas.json` | `MDD/data/tagdata.sql` | Nombre visible y descripción de las etiquetas de planeta |
| `battletech/public/starmap/logos/` | `emblems/factions/*.dds` | Logos de las facciones en PNG de 128 px, descomprimidos de DXT5 |

### Argo de BATTLETECH

*BATTLETECH* guarda sus datos en JSON sueltos dentro de `BattleTech_Data/StreamingAssets/`. `extraer_argo_battletech.py` copia lo que necesita la página de la Argo a `tools/datos-juego/battletech/argo/` y guarda las ilustraciones y los retratos en PNG en `battletech/public/argo/`. `generar_argo_battletech.py` genera `src/data/battletech/argo.json`. Los DLC no traen mejoras de la nave.

```sh
python3 tools/extraer_argo_battletech.py "/ruta/a/BATTLETECH"
python3 tools/generar_argo_battletech.py
```

| Archivo | Origen en el juego | Contenido |
|---|---|---|
| `shipUpgrades/` | `data/shipUpgrades/*.json` | Las 35 mejoras con su categoría, precio, mantenimiento, requisitos, estadísticas, ilustración y tripulante |
| `estadisticas.json` | `data/simGameStatDesc/` | La frase con la que el juego explica cada estadística que cambia una mejora |
| `categorias.json` | `data/enums/ShipUpgradeCategory.json` | Las 9 categorías con su nombre visible |
| `tripulacion.json` | `data/cast/castDef_*Default.json` | Nombre, rango y retrato de Farah, Yang, Darius y Sumire |
| `constantes.json` | `data/simGameConstants/SimGameConstants.json` | Mantenimiento base, mejoras iniciales de la campaña y de la carrera, multiplicadores de la carrera y valores iniciales |
| `battletech/public/argo/` | `sprites/Illustrations/*.dds` y `sprites/Portraits/*.png` | Ilustraciones de las mejoras (de DXT1 y DXT5, a 375 × 150) y retratos de 96 px |

### MechLab de BATTLETECH

El juego base trae sus datos en JSON sueltos, y los DLC (Heavy Metal, Flashpoint y Urban Warfare) dentro de bundles de Unity 2018 en `data/assetbundles/`. `tools/unityfs.py` lee esos bundles en Python puro: solo su tabla de bloques va comprimida con LZ4, y cada JSON es un TextAsset. `extraer_mechlab_battletech.py` guarda en `tools/datos-juego/battletech/mechlab/` lo que necesita el MechLab, con la fuente de cada cosa, y los iconos en `battletech/public/mechlab/icons/`. `generar_mechlab_battletech.py` genera `src/data/battletech/mechs.json`, `items.json` y `constants.json`.

```sh
python3 tools/extraer_mechlab_battletech.py "/ruta/a/BATTLETECH"
python3 tools/generar_mechlab_battletech.py
```

| Archivo | Origen en el juego | Contenido |
|---|---|---|
| `battletech/mechlab/chasis.json` | `data/chassis/` y los bundles de los DLC | Los 122 chasis con sus ubicaciones (anclajes, ranuras, blindaje máximo y estructura), equipo fijo, tonelaje, retrorreactores, rol e icono |
| `battletech/mechlab/mechs.json` | `data/mech/` y los bundles | Las 140 variantes con su inventario y blindaje de serie, coste y etiquetas |
| `battletech/mechlab/componentes.json` | `data/weapon/`, `ammunitionBox/`, `heatsinks/`, `jumpjets/`, `upgrades/` y los bundles | Armas, cajas de munición, disipadores, retrorreactores y mejoras con sus efectos |
| `battletech/mechlab/municiones.json` | `data/ammunition/` y los bundles | La categoría de munición de cada caja |
| `battletech/mechlab/movimiento.json` | `data/movement/` y los bundles | Distancia de andar y de correr de cada chasis |
| `battletech/mechlab/constantes.json` | `data/constants/` | Calor (`CombatGameConstants`) y blindaje y coste (`MechStatisticsConstants`) |
| `battletech/public/mechlab/icons/` | `sprites/MechPortraits/uixTxrIcon_*.dds` | Iconos de los chasis en PNG de 128 px, descomprimidos de DXT5 |

## Calidad y comprobación contra el juego

- **496 tests** con Vitest sobre la lógica: cálculos, reglas de equipo, código de las builds, builds guardadas, mejoras y el Worker (incluidas las restricciones de seguridad del proxy de imágenes).
- **Cobertura:** el 95 % de las líneas de la lógica (`src/utils`) está cubierto por tests. `npm run coverage` genera el informe, y el CI publica el resumen en cada ejecución. La interfaz (componentes de React) todavía no tiene tests.
- `gameReference.test.ts` y `upgrades.test.ts` reproducen capturas del mechlab del juego (por ejemplo, el Grand Dragon DRG-1G-S o el Battlemaster BLR-1P) y comprueban que la web da las mismas cifras: daño, armadura, refrigeración, giro, capacidad de calor y efecto de las mejoras.
- `stockBuilds.test.ts` comprueba que las builds de fábrica de las 639 variantes se cargan sin perder ninguna pieza.
- GitHub Actions ejecuta lint, tests con cobertura y build en cada push a `main` y en cada pull request.
- **CodeQL** analiza la seguridad del código (TypeScript, Python y los workflows) en cada pull request y cada semana.
- **Revisión de código con IA:** CodeRabbit (configurado en `.coderabbit.yaml`) y GitHub Copilot revisan cada pull request.
- El backlog está en las [issues de GitHub](https://github.com/PonchoiDev/mechlab-web/issues).
- TypeScript en modo estricto y análisis estático con oxlint.
- Dependabot propone cada semana las actualizaciones de dependencias y avisa de las vulnerabilidades conocidas (`npm audit` sin vulnerabilidades).

## Despliegue

La web está publicada en **https://mw-builder.com/mercs/** con Cloudflare Workers (`wrangler.jsonc`). La raíz del dominio es una portada con una carátula por juego, y cada juego tiene su propia ruta; de momento solo existe `/mercs/`.

- `npm run build` genera la web en `dist/mercs/` y copia `site/` en la raíz de `dist/`.
- Los assets estáticos se sirven directamente. El Worker solo ejecuta código en `/mercs/api/*`:
  - `/mercs/api/sarna-image`: proxy de las imágenes de Sarna, que no envían cabeceras CORS y por eso no se podrían dibujar en la imagen de la build. Guarda cada imagen en la caché de Cloudflare.
  - `/mercs/api/feedback`: recibe los mensajes del formulario y los envía con Cloudflare Email Routing. La dirección de destino es el secreto `FEEDBACK_TO` del Worker, así que no aparece en el código.
- Cada fusión en `main` se publica automáticamente, y cada pull request tiene una URL de vista previa.

Para el formulario de feedback hay que activar **Email Routing** en la zona del dominio, verificar la dirección de destino y añadir el secreto `FEEDBACK_TO` en **Settings → Variables and secrets** del Worker. Sin esa configuración, la ruta responde 503 y el formulario muestra un error.

## Aviso legal

Herramienta hecha por un fan, sin relación con Piranha Games, Microsoft ni los titulares de las marcas MechWarrior y BattleTech. Los datos del juego pertenecen a sus respectivos propietarios. Las imágenes de los 'Mechs son de [Sarna.net](https://www.sarna.net).
