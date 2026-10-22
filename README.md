# MechLab MW5

Configurador web de 'Mechs para *MechWarrior 5: Mercenaries*. Permite elegir un chasis, equipar armas y equipo en sus anclajes y ranuras, repartir la armadura y ver al momento el peso, el daño por salva, el calor, la refrigeración y el rendimiento de cada arma.

## Funcionalidades

- Selector de chasis con búsqueda por nombre, variante o ID (552 variantes jugables).
- Equipamiento por componente respetando el tipo y tamaño de los anclajes y las ranuras especiales (motor, jump jets por clase, supercargadores).
- Tiers de armas (0–5) que cambian sus estadísticas.
- Armadura delantera y trasera por zona, con botones para vaciarla o maximizarla según el tonelaje libre.
- Tablero con el 'Mech en el centro y sus componentes alrededor; al pulsar un componente o un anclaje se abre un panel lateral para equiparlo, con filtros por texto, base tecnológica y tipo de arma.
- Resumen de pendientes de la build (anclajes libres, armas sin munición, armadura incompleta, sobrepeso) y duración de la munición instalada.
- Tabla de rendimiento de armas (daño, calor, RPM, DPS y alcance) y resumen de munición.
- Imagen de referencia de cada 'Mech obtenida de [Sarna.net](https://www.sarna.net).
- Compartir la build: un enlace que la abre tal cual (`/mercs/?b=…`) y una imagen PNG con el 'Mech, su equipo y sus estadísticas, lista para copiar o descargar.

## Requisitos

- Node.js 24 o superior
- Python 3 (solo para regenerar los datos de los 'Mechs)

## Uso

```sh
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173/mercs/
npm run dev -- --host 0.0.0.0   # accesible desde otros dispositivos de la red
```

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm test` | Tests unitarios con Vitest |
| `npm run lint` | Análisis estático con oxlint |
| `npm run build` | Comprobación de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |

## Estructura

```
src/
  App.tsx              Componente principal
  components/          Componentes de la interfaz
  hooks/               Hooks de React (imagen de Sarna)
  services/            Acceso a la API de Sarna e imagen de la build
  utils/               Lógica del configurador: cálculos, equipo, items y zonas
  types/               Tipos de TypeScript
  data/                mechs.json e items.json que usa la web
  test/                Datos de prueba compartidos por los tests
worker/                Script del Worker de Cloudflare (proxy de imágenes de Sarna)
site/                  Archivos de la raíz del dominio (redirección a /mercs/), copiados al build
tools/
  generar_mechs.py     Genera src/data/mechs.json a partir de los datos del juego
  generar_items.py     Genera src/data/items.json a partir de los datos del juego
  datos-juego/         Archivos exportados del juego (mda/ para 'Mechs, items/ para equipo)
```

## Regenerar los datos

```sh
python3 tools/generar_mechs.py
python3 tools/generar_items.py
```

`generar_mechs.py` lee los archivos de `tools/datos-juego/mda/` y escribe `src/data/mechs.json`. Descarta las variantes no jugables (campaña, tutorial, jefes y cinemáticas), listadas en `ARCHIVOS_NO_JUGABLES`, y avisa si encuentra variantes repetidas. Para cada anclaje cuerpo a cuerpo guarda su tamaño (S antebrazo, M mano, L brazo de arma), la clase de peso del 'Mech y, si lo tiene, el arma especial que usa cuando el anclaje está vacío.

`generar_items.py` lee los archivos de `tools/datos-juego/items/` y escribe `src/data/items.json`. Agrupa los tiers de cada arma (`_Lvl0` a `_Lvl5`) aplicando sus quirks, guarda la base tecnológica de cada objeto, el tipo de munición de cada arma y munición, los multiplicadores de la salva (proyectiles para el daño, misiles y disparos de ráfaga para el calor) y la munición que gasta cada arma por salva. Las armas no guardan slots, porque en MW5 Mercenaries solo ocupan un anclaje. Ignora los archivos que no son objetos equipables y, al terminar, avisa de las municiones que faltan.

Ambos aceptan opcionalmente otra ruta de destino como argumento.

## Publicación

La web está publicada en **https://mw-builder.com/mercs/** con Cloudflare Workers (`wrangler.jsonc`). Cada juego tiene su propia ruta en el dominio; de momento solo existe `/mercs/` (MW5: Mercenaries) y la raíz redirige a ella (`site/_redirects`).

`npm run build` genera la web en `dist/mercs/` y copia el contenido de `site/` en la raíz de `dist/`.

El Worker solo ejecuta código en `/mercs/api/*`; el resto lo sirven los assets estáticos. Ahí está `/mercs/api/sarna-image`, un proxy que sirve desde el dominio las imágenes de Sarna (solo de su wiki) para poder dibujarlas en la imagen de la build, porque su servidor de imágenes no envía cabeceras CORS. Guarda cada imagen en la caché de Cloudflare. En desarrollo, el servidor de Vite hace el mismo papel.

Cada fusión en `main` se publica automáticamente y cada pull request tiene una URL de vista previa.

## Integración continua

Cada push a `main` y cada pull request ejecuta lint, tests y build en GitHub Actions (`.github/workflows/ci.yml`).
