# Arquitectura

Los diagramas UML (casos de uso, clases del dominio y secuencias) están en [uml.md](uml.md).

## Visión general

MechLab es una web estática hecha con React y TypeScript. No tiene base de datos ni backend propio: los datos del juego van incluidos en el build como JSON, las builds del usuario se guardan en su navegador o viajan dentro de un enlace, y un pequeño Worker de Cloudflare atiende las dos únicas rutas que necesitan servidor.

```mermaid
flowchart LR
  subgraph Datos["Datos (en desarrollo)"]
    Juego["Archivos del juego<br/>editor de mods y .pak"] --> Scripts["Scripts Python<br/>tools/generar_*.py · extraer_*.py"]
    Scripts --> JSON["mechs.json · items.json · traits.json · starmap.json · units.json"]
  end
  subgraph Web["Web (en el navegador)"]
    JSON --> Logica["Lógica pura<br/>src/utils"]
    Logica --> UI["Componentes React"]
    UI <--> Local["localStorage<br/>builds y preferencias"]
    UI <--> Enlace["Enlace ?b=…<br/>build codificada"]
  end
  subgraph Cloudflare
    Assets["Assets estáticos"]
    Worker["Worker<br/>/mercs/api/*"]
  end
  UI -- "imagen del 'Mech" --> Worker
  UI -- "feedback" --> Worker
  Worker --> Sarna["Sarna.net"]
  Worker --> Correo["Email Routing"]
```

## Flujo de datos del juego

Los datos se exportan con el editor de mods oficial de *MechWarrior 5: Mercenaries* a `tools/datos-juego/` y tres scripts de Python (sin dependencias externas) generan los JSON de `src/data/`:

| Script | Lee | Genera |
|---|---|---|
| `generar_items.py` | `items/` | `items.json`: armas por tier, equipo, munición, disipadores |
| `generar_mechs.py` | `mda/`, `mdl/`, `hps/`, `loadout/`, `unitcard/`, `mech_string_table/` e `items.json` | `mechs.json`: 639 variantes con componentes, anclajes, build de fábrica, año y rol |
| `generar_traits.py` | `traits/` | `traits.json`: las 50 mejoras de la cantina y sus efectos |
| `generar_mapa.py` | `starmap/` (lo extrae `extraer_mapa.py` del `.pak` de la instalación) | `starmap.json`: 2172 sistemas con su dueño de 3015 a 3060, facciones, eventos, clústeres y centros industriales con su reputación recomendada y su dificultad; `availability.json`: la rareza de cada variante por facción (de las unit cards, con las funciones de `generar_mechs.py`) |
| `generar_unidades.py` | `unitcard/` y `unidades/` (lo extrae `extraer_unidades.py` del `.pak`) e `items.json` | `units.json`: 115 unidades enemigas (tanques, aerodeslizadores, VTOL, torretas y armaduras de combate) con su vida base, velocidad, armas en el formato de `items.json` y rareza por facción |

Algunos datos no están donde parecería:

- **El tamaño de cada anclaje** no está en el archivo del 'Mech (MDA). Hay que seguir su modelo (MDL) hasta la tabla de anclajes del chasis (HPS).
- **El nombre de cada chasis** solo aparece como una clave de texto; el texto está en la tabla `Mech_StringTable`.
- **La build de fábrica** está en otro archivo (`*_Loadout`) y sirve también para validar los datos.

- **El mapa estelar** no se puede exportar con el editor de mods, así que `extraer_mapa.py` lee el `.pak` de la instalación con un lector propio de Unreal Engine 4 (`tools/ue4.py`). El color de cada facción no está en la facción: sale del estencil del mapa y de la colección de parámetros `Faction_Colours_MPC`.

Los scripts avisan al terminar de todo lo que no cuadra (piezas que no caben, variantes sin ficha, anclajes cuyo tamaño se ha tenido que deducir), para revisarlo con cada parche.

## Capas de la web

```mermaid
flowchart TB
  App["App.tsx<br/>composición de la página"] --> Hooks["hooks/<br/>useMechBuild · useSavedBuilds · useViewPreferences · useSarnaAsset"]
  App --> Componentes["components/<br/>tablero, selector, panel de mejoras, estadísticas, diálogos"]
  Hooks --> Utils["utils/ (lógica pura, con tests)<br/>calculators · equipment · upgrades · buildCode · savedBuilds · mechs"]
  Componentes --> Utils
  Componentes --> Services["services/<br/>Sarna · portapapeles · imagen PNG (canvas)"]
  Utils --> Data["data/<br/>mechs.json · items.json · traits.json · changelog"]
```

- **`utils/`** es el núcleo: funciones puras que reciben datos y devuelven datos, sin React ni efectos. Por ejemplo, `getBuildSummary(mech, loadout, armor, upgrades)` calcula todas las estadísticas. Es lo que cubren los tests.
- **`hooks/`** guarda el estado: la build en curso, las builds guardadas y las preferencias de vista.
- **`components/`** solo pinta y llama a la lógica.
- **`services/`** aísla lo que depende del exterior: la API de Sarna, el portapapeles y el canvas de la imagen.


### Mapa estelar

El mapa es otra página (`starmap/index.html`, servida en `/mercs/starmap/`) con su propio bundle, así que el MechLab no descarga sus datos. Sigue la misma separación:

- **`utils/starmap.ts`:** el dueño de cada sistema en una fecha, los eventos, los centros industriales, la reputación y la dificultad de cada zona, la búsqueda, la rejilla de territorios y el contorno de los clústeres. Son funciones puras con sus tests (`starmap.test.ts`).
- **`utils/academies.ts`:** las academias de pilotos abiertas en una fecha (con su fundación y su cierre cuando un Clan toma el sistema, que es permanente), las de un sistema, la búsqueda y la descripción de cada programa.
- **`utils/mercs.ts`:** el dueño de una zona de influencia de los mercenarios rivales en una fecha (con la rotación al azar al acabar el historial), las zonas de una compañía y la zona bajo un punto.
- **`utils/clusters.ts`:** la zona de conflicto bajo un punto del mapa (con los mismos contornos que dibuja el renderer), la descripción del recargo de reparación y de los contratos de varias misiones, y la arena de un sistema.
- **`utils/availability.ts`:** la tabla de rareza que usa cada facción (la suya o la de su alianza), la rareza de una variante en una fecha, sus fuentes fijas y la lista de 'Mechs hero. La rareza va en `availability.json`, que el mapa carga con un `import()` al abrir Find a 'Mech o Hero 'Mechs, así que no pesa en la carga inicial.
- **`starmap/renderer.ts`:** pinta en un canvas. La rejilla que dice a qué sistema pertenece cada punto del mapa se calcula una vez, porque no depende de la fecha. Al mover la fecha solo se vuelve a colorear y se genera la textura de territorios, con el borde brillante como en el juego. El arrastre y el zoom solo redibujan esa textura.
- **Novedades en la portada:** la portada (`site/index.html`) es HTML estático, así que el build escribe `changelog.json` en la raíz a partir de `src/data/changelog.ts`. La campana de la portada lo lee y guarda lo ya visto con la misma clave que la del MechLab.
- **`starmap/StarmapApp.tsx`:** la ficha del sistema, el control de fecha, el buscador y la leyenda. La fecha y el sistema elegido van en la URL.

### Unidades enemigas

Es la tercera página (`units/index.html`, servida en `/mercs/units/`), también con su propio bundle:

- **`utils/units.ts`:** las armas de una unidad con su daño, DPS y alcance (con `getWeaponStats`, la misma función que el MechLab, porque `units.json` guarda las armas en el formato de `items.json`), la potencia de fuego, los filtros, el orden, la rareza agrupada y la vista en la URL. Tiene sus tests (`units.test.ts`).
- **Las armas, en el bytecode:** las torretas montan sus cañones como `ChildActorComponent` y les dan la clase en el script de construcción con `SetChildActorClass`, así que `extraer_unidades.py` busca esa llamada en el bytecode de `UserConstructionScript` para saber qué arma va en cada componente.
- **Dibujos de Sarna:** el juego no los trae, así que `generar_unidades.py` tiene una tabla con el título de Sarna de cada chasis e `imagenes_sarna.py` busca una vez su página y su dibujo en la API de Sarna. Van en `units.json`: la página no consulta Sarna al cargar, solo descarga los dibujos de las fichas que se ven.
- **`units/UnitsApp.tsx`:** los filtros, el orden y la ficha de cada unidad. Solo pinta y llama a la lógica.

### Pilotos

Es la cuarta página (`pilots/index.html`, servida en `/mercs/pilots/`), con su propio bundle. Usa los estilos de las unidades enemigas (`units.css`) y solo añade los suyos y el color de acento:

- **Efectos en los datos:** `generar_pilotos.py` convierte cada propiedad de los componentes de un rasgo en un efecto con texto, valor y si es bueno, y los agrupa por dónde se aplican (con unos 'Mechs, con un arma, contra una facción, al piloto). La página no interpreta cifras del juego: solo las pinta.
- **El árbol de componentes:** cada rasgo apunta a su componente principal (`UnitTrait`) y este a los suyos (`UnitTraits`). Se siguen esas referencias, porque algunos assets traen componentes sueltos que el rasgo no usa. Para ello `ue4.py` guarda el orden de los exports.
- **Orden en los datos:** `generar_pilotos.py` da a cada rasgo su subgrupo (clase de peso, clase de arma, tipo de facción…) y los deja ordenados; a cada programa, su familia y lo que lo distingue dentro de ella (nivel, curso o academia). La página solo los agrupa en ese orden.
- **Pilotos hero:** sus habilidades llegan ya en niveles (la curva del juego convierte la experiencia), y sus rasgos son ids de la lista de rasgos, para enseñar los mismos efectos.
- **`utils/pilots.ts`:** los filtros por categoría y hero, la búsqueda por nombre o efecto, las secciones de rasgos, las familias de programas, la duración en años y la vista en la URL. Tiene sus tests (`pilots.test.ts`).
- **`pilots/PilotsApp.tsx`:** las pestañas de pilotos hero, rasgos y programas, las fichas y las tablas. Solo pinta y llama a la lógica.

## Decisiones de diseño

### La build viaja en el enlace

Una build compartida es un JSON compacto en base64url dentro de la URL: `[versión, id del mech, armadura, armas y equipo por zona, mejoras]`. Las armas guardan su anclaje y su tier solo si no es el de catálogo, y las mejoras solo se añaden si hay alguna.

- **A favor:** no hace falta servidor ni base de datos, el enlace funciona para siempre y no se recoge ningún dato.
- **Compatibilidad:** al abrir un enlace, la build se reconstruye con las reglas del taller y se descarta lo que ya no existe o no cabe, en vez de fallar. Por eso los enlaces y las builds guardadas siguen funcionando tras actualizar los datos. Los IDs de las variantes se mantienen aunque el juego cambie cómo las nombra (los campeones siguen siendo `ARC-2R (C)`).

### Lógica separada de la interfaz

Las reglas del juego (qué cabe en cada anclaje, cuánto pesa la armadura, cómo se suman las mejoras) están en funciones puras. Así se pueden probar con tests sin montar componentes, y las mismas funciones sirven para la web, la imagen PNG y los tests de referencia contra el juego.

### Un Worker solo para la API

Cloudflare sirve los archivos estáticos directamente; el Worker solo se ejecuta en `/mercs/api/*` (`run_worker_first` en `wrangler.jsonc`):

- **`/mercs/api/sarna-image`:** proxy de las imágenes de Sarna. Sarna no envía cabeceras CORS, así que el navegador no deja dibujar sus imágenes en un canvas para exportarlo. El proxy solo acepta imágenes de la wiki de Sarna, limita su tamaño y las guarda en la caché de Cloudflare.
- **`/mercs/api/feedback`:** recibe el formulario de feedback y lo envía por correo con Email Routing. La dirección de destino es un secreto del Worker.

En desarrollo, el servidor de Vite atiende esas mismas rutas con el mismo código (`vite.config.ts`).

### Estadísticas comprobadas contra el juego

Cuando una cifra no coincide con la del juego, se hace una captura del mechlab real y se convierte en un test (`gameReference.test.ts`, `upgrades.test.ts`). Así se descubrieron reglas que los archivos no dicen: los disipadores dobles de la Esfera Interior suman +1,0 a la refrigeración del motor, la Ferro-Fibrosa da 35,84 puntos por tonelada, el juego trunca en vez de redondear, o los porcentajes de las mejoras se suman en lugar de multiplicarse.

### Un dominio, una ruta por juego

`mw-builder.com` tiene una portada (`site/`) y cada juego vive en su propia ruta (`/mercs/`). Así se puede añadir *MechWarrior 5: Clans* más adelante sin tocar lo que ya existe.

## Principios de diseño

### SOLID

- **Responsabilidad única.** Cada módulo de `src/utils/` tiene un solo motivo para cambiar: `calculators.ts` calcula las estadísticas, `equipment.ts` decide qué cabe en cada anclaje y ranura, `buildCode.ts` define el formato del enlace, `upgrades.ts` aplica las mejoras y `buildActions.ts` agrupa las acciones sobre la build. Los componentes solo pintan, y `services/` aísla lo que depende del exterior.
- **Abierto/cerrado.** Los datos del juego dirigen el comportamiento: un ’Mech, un arma o una mejora nuevos llegan en los JSON sin tocar el código. Las mejoras de la cantina se describen como datos (`{ stat, value, weaponTypes }`), así que una mejora nueva con una estadística conocida no necesita código.
- **Sustitución de Liskov.** Un `EquippedItem` extiende `Item` y se puede usar en cualquier sitio que espere un objeto del catálogo: los cálculos reciben `Item` y funcionan igual con objetos equipados.
- **Segregación de interfaces.** Los componentes reciben solo lo que usan: `StatsReadout` recibe el resumen, `UpgradesPanel` las mejoras instaladas y sus acciones, sin acceso al resto del estado.
- **Inversión de dependencias.** La lógica recibe sus datos como parámetros en lugar de importarlos: `decodeBuild(código, mechs, catálogo)` o `getBuildSummary(mech, loadout, armadura, mejoras)`. Por eso los tests usan los datos reales o datos de prueba sin cambiar nada.

### DRY, KISS y YAGNI

- **DRY.** Las primeras refactorizaciones eliminaron la lógica duplicada de zonas, equipo, tipos y cálculos. Hoy las mismas funciones sirven a la web, a la imagen PNG y a los tests, y el Worker y el servidor de desarrollo de Vite comparten el mismo código (`worker/feedback.ts`, `worker/sarnaImage.ts`).
- **KISS.** Sin librería de estado (hooks de React), sin framework de estilos (CSS propio), sin backend (la build viaja en el enlace) y sin base de datos (`localStorage` para lo que guarda el usuario).
- **YAGNI.** Sin cuentas de usuario, sin servidor y sin *MW5: Clans* hasta que hagan falta. El dominio está preparado para otro juego (una ruta por juego), pero no se ha construido nada para él todavía.

## Relación con Clean Architecture

MechLab no sigue Clean Architecture al pie de la letra, pero su estructura respeta la idea central: las reglas del negocio (las del juego) están en el centro, sin depender de React, del navegador ni de Cloudflare.

| Capa de Clean Architecture | En MechLab |
|---|---|
| Entidades y reglas del dominio | `src/types/` y las funciones puras de `src/utils/`: anclajes, ranuras, armadura, estadísticas, mejoras |
| Casos de uso | `src/utils/buildActions.ts` (cambiar un arma, duplicarla, mover equipo…) y las acciones de `useMechBuild`: reciben la build y devuelven la build nueva |
| Adaptadores | `src/services/` (API de Sarna, portapapeles, imagen en canvas), `useSavedBuilds` (`localStorage`), `buildCode.ts` (la URL) y `worker/` (correo y proxy) |
| Frameworks y drivers | React, Vite y Cloudflare Workers |
| Raíz de composición | `App.tsx`: crea el estado y conecta la lógica, los servicios y los componentes |

**La regla de dependencias** se cumple casi siempre: `src/utils/` no importa componentes, hooks ni React. Hay tres excepciones pequeñas y conocidas: `menuPosition.ts` usa un tipo de evento de React, `mechs.ts` usa `getSarnaTitle` de `services/` para buscar por el nombre de Sarna, y `upgrades.ts` importa directamente `traits.json` en lugar de recibirlo como parámetro.

**Por qué no se aplica entera.** Clean Architecture compensa cuando hay persistencia compleja o varios adaptadores intercambiables para una misma necesidad. Aquí no los hay: lo único que se guarda es una lista de builds en `localStorage` y un código en la URL, hay una sola interfaz y una sola fuente de datos. Añadir puertos, interfaces y una raíz de composición formal metería capas de indirección sin ningún beneficio, justo lo que piden evitar KISS y YAGNI. El punto donde sí compensaría es el día que exista un segundo juego: los datos de cada juego serían adaptadores de un mismo puerto.

## Despliegue

- `npm run build` genera la web en `dist/mercs/` y copia `site/` en la raíz.
- Cada fusión en `main` se publica automáticamente en Cloudflare Workers, y cada pull request tiene una URL de vista previa.
- GitHub Actions ejecuta lint, tests con cobertura y build en cada push y pull request, y CodeQL analiza la seguridad del código. Dependabot propone las actualizaciones de dependencias.
