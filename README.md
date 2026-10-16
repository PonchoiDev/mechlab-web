# MechLab MW5

Configurador web de 'Mechs para *MechWarrior 5: Mercenaries*. Permite elegir un chasis, equipar armas y equipo en sus anclajes y ranuras, repartir la armadura y ver al momento el peso, el daño por salva, el calor, la refrigeración y el rendimiento de cada arma.

## Funcionalidades

- Selector de chasis con búsqueda por nombre, variante o ID (552 variantes jugables).
- Equipamiento por componente respetando el tipo y tamaño de los anclajes y las ranuras especiales (motor, jump jets por clase, supercargadores).
- Tiers de armas (0–5) que cambian sus estadísticas.
- Armadura delantera y trasera por zona, con botones para vaciarla o maximizarla según el tonelaje libre.
- Vista de taller y vista previa del build completo.
- Tabla de rendimiento de armas (daño, calor, RPM, DPS y alcance) y resumen de munición.
- Imagen de referencia de cada 'Mech obtenida de [Sarna.net](https://www.sarna.net).

## Requisitos

- Node.js 24 o superior
- Python 3 (solo para regenerar los datos de los 'Mechs)

## Uso

```sh
npm install
npm run dev          # servidor de desarrollo
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
  services/            Acceso a la API de Sarna
  utils/               Lógica del configurador: cálculos, equipo, items y zonas
  types/               Tipos de TypeScript
  data/                mechs.json e items.json que usa la web
  test/                Datos de prueba compartidos por los tests
tools/
  generar_mechs.py     Genera src/data/mechs.json a partir de los datos del juego
  datos-juego/         Archivos exportados del juego (mda/ para 'Mechs, items/ para equipo)
```

## Regenerar los datos de los 'Mechs

```sh
python3 tools/generar_mechs.py
```

Lee los archivos de `tools/datos-juego/mda/` y escribe `src/data/mechs.json`. Opcionalmente acepta otra ruta de destino como argumento. Descarta las variantes no jugables (campaña, tutorial, jefes y cinemáticas), listadas en `ARCHIVOS_NO_JUGABLES`, y avisa si encuentra variantes repetidas.

## Integración continua

Cada push a `main` y cada pull request ejecuta lint, tests y build en GitHub Actions (`.github/workflows/ci.yml`).
