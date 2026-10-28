# Arquitectura

## Visión general

MechLab es una web estática hecha con React y TypeScript. No tiene base de datos ni backend propio: los datos del juego van incluidos en el build como JSON, las builds del usuario se guardan en su navegador o viajan dentro de un enlace, y un pequeño Worker de Cloudflare atiende las dos únicas rutas que necesitan servidor.

```mermaid
flowchart LR
  subgraph Datos["Datos (en desarrollo)"]
    Juego["Archivos del juego<br/>editor de mods"] --> Scripts["Scripts Python<br/>tools/generar_*.py"]
    Scripts --> JSON["mechs.json · items.json · traits.json"]
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

Algunos datos no están donde parecería:

- **El tamaño de cada anclaje** no está en el archivo del 'Mech (MDA). Hay que seguir su modelo (MDL) hasta la tabla de anclajes del chasis (HPS).
- **El nombre de cada chasis** solo aparece como una clave de texto; el texto está en la tabla `Mech_StringTable`.
- **La build de fábrica** está en otro archivo (`*_Loadout`) y sirve también para validar los datos.

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

## Despliegue

- `npm run build` genera la web en `dist/mercs/` y copia `site/` en la raíz.
- Cada fusión en `main` se publica automáticamente en Cloudflare Workers, y cada pull request tiene una URL de vista previa.
- GitHub Actions ejecuta lint, tests y build en cada push y pull request. Dependabot propone las actualizaciones de dependencias.
