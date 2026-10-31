# MechLab MW5

🇪🇸 Español · [🇬🇧 English](README.en.md)

Configurador web de 'Mechs para *MechWarrior 5: Mercenaries*. Permite elegir uno de los 639 chasis jugables, equiparlo respetando las reglas del mechlab del juego, aplicarle las mejoras de la cantina y ver al momento cómo cambian el peso, el daño, el calor, la velocidad y el resto de estadísticas. Las builds se pueden guardar, compartir con un enlace o exportar como imagen.

| | |
|---|---|
| **Web en producción** | **https://mw-builder.com/mercs/** |
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
| Tests | Vitest 5 (272 tests, cobertura con V8) |
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
- **Comparar:** la build actual junto a otro 'Mech, con la imagen y el loadout de cada uno. Se compara con la build de serie de cualquier 'Mech o con una build guardada, y cada tarjeta lleva sus cifras (anclajes, defensa, potencia de fuego, calor, movilidad y ranuras de mejora) alineadas con las de la otra, con el valor mejor resaltado en verde.

**Guardar y compartir**
- Builds guardadas en el navegador: guardar, actualizar, cargar, duplicar, renombrar, borrar, y exportar o importar en JSON.
- Enlace que abre la build tal cual (`/mercs/?b=…`).
- Imagen PNG de la build con el 'Mech, su equipo, sus mejoras y sus estadísticas, lista para copiar o descargar.

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
| `npm test` | Tests unitarios con Vitest |
| `npm run coverage` | Tests con informe de cobertura en `coverage/` |
| `npm run lint` | Análisis estático con oxlint |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |

En desarrollo, el servidor de Vite hace de proxy de las imágenes de Sarna, y el formulario de feedback escribe el mensaje en la terminal en vez de enviarlo.

## Estructura del proyecto

```
src/
  App.tsx               Componente principal: estado de la build y composición de la página
  components/           Componentes de la interfaz (tablero, selector, panel de mejoras, diálogos…)
  hooks/                Estado de la build, builds guardadas, preferencias de vista e imagen de Sarna
  utils/                Lógica del configurador: cálculos, reglas de equipo, mejoras, código de las builds
  services/             API de Sarna, portapapeles e imagen PNG de la build (canvas)
  types/                Tipos de TypeScript
  data/                 mechs.json, items.json y traits.json generados, y las novedades
  test/                 Datos de prueba compartidos
worker/                 Worker de Cloudflare: proxy de imágenes de Sarna y formulario de feedback
site/                   Portada de la raíz del dominio (mw-builder.com)
docs/                   Análisis, arquitectura, diagramas UML y desarrollo con IA
tools/
  generar_mechs.py      Genera src/data/mechs.json
  generar_items.py      Genera src/data/items.json
  generar_traits.py     Genera src/data/traits.json (mejoras de la cantina)
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

## Calidad y comprobación contra el juego

- **272 tests** con Vitest sobre la lógica: cálculos, reglas de equipo, código de las builds, builds guardadas, mejoras y el Worker (incluidas las restricciones de seguridad del proxy de imágenes).
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
