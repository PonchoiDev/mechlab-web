# Especificación: filtros por DLC y por hero

- **Issue:** [#43](https://github.com/PonchoiDev/mechlab-web/issues/43)
- **Estado:** aprobada, pendiente de implementar
- **Método:** Spec Driven Development. Esta especificación se escribió antes que el código; los criterios de aceptación se convirtieron en tests (`src/utils/mechs.test.ts`) y después se implementó lo necesario para que pasaran.

## Contexto

Los jugadores pidieron en Reddit poder filtrar el selector de chasis por lo que realmente pueden usar. Dos datos que el juego trae y la web no aprovecha:

- **El DLC de cada variante.** Sin el DLC correspondiente, la variante no está disponible en la partida. Un jugador con solo algunos DLC quiere ver solo los ’Mechs que puede conseguir.
- **Si la variante es un hero.** Los hero son variantes únicas, con nombre propio y bonificaciones, que no se compran en cualquier mercado. Los jugadores los buscan como grupo.

## Datos

| Dato | Origen | Cobertura |
|---|---|---|
| DLC | `DLCAsset=(Id="MWDLCAsset:DLC_n")` en el MDA de la variante | 414 de 639 variantes, del DLC 1 al 9. Sin el campo: juego base (225) |
| Hero | `bIsHeroMech=True` en el MDA | 109 de 639 variantes |

**Decisión:** el DLC se toma del MDA y no de las fichas de unidad, porque el MDA lo trae también en las variantes sin ficha (los campeones) y es el mismo archivo del que sale el resto de la variante.

**Limitación conocida:** los archivos exportados solo identifican el DLC por su número (`DLC_7`). Los nombres comerciales no están en ningún archivo del juego exportado, así que la interfaz muestra «DLC 1» … «DLC 9». Si se exportan los assets `MWDLCAsset`, el nombre se añade en el generador sin cambiar nada más.

## Requisitos funcionales

- **RF1.** `mechs.json` guarda en cada variante su DLC (`dlc`, del 1 al 9) cuando lo tiene. Las variantes del juego base no llevan el campo.
- **RF2.** El selector de chasis tiene un filtro **Hero** que deja solo las variantes hero.
- **RF3.** El selector tiene una fila **DLC** con una opción por fuente de contenido: **Base** y **DLC 1** … **DLC 9**. Se pueden marcar varias; la lista muestra las variantes de cualquiera de las fuentes marcadas. Sin ninguna marcada, se muestran todas.
- **RF4.** En el buscador, el atajo `hero` activa el filtro Hero, y `dlc1` … `dlc9` y `base` añaden esa fuente al filtro de DLC. Se combinan con los atajos existentes (`3e 2m jj hero dlc7`).
- **RF5.** Cada variante de la lista muestra una etiqueta **HERO** si lo es, y una etiqueta con su DLC si no es del juego base.
- **RF6.** Los filtros nuevos cuentan como filtros activos y se borran con **Clear filters**, como los demás.

## Requisitos no funcionales

- **RNF1.** La lógica de filtrado es pura y está en `src/utils/mechs.ts`, con sus tests.
- **RNF2.** Los IDs de las variantes no cambian.
- **RNF3.** Los textos de la interfaz, en inglés y sin guiones largos.
- **RNF4.** Los controles son botones con `aria-pressed`, como los filtros que ya existen.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los datos generados | se lee `mechs.json` | el ADR-A tiene `dlc: 7`, el ACW-A `dlc: 9` y el AS7-D no tiene `dlc` |
| CA2 | Los datos generados | se cuentan las variantes | hay 109 hero y 414 con DLC |
| CA3 | El filtro Hero activo | se filtra la lista | todas las variantes que quedan son hero y están todas las hero |
| CA4 | El filtro de DLC con **Base** y **DLC 7** | se filtra la lista | solo quedan variantes del juego base o del DLC 7 |
| CA5 | El filtro de DLC vacío | se filtra la lista | no se descarta ninguna variante por su DLC |
| CA6 | El texto `hero dlc7` en el buscador | se interpreta la búsqueda | se activan Hero y DLC 7, y no queda texto de búsqueda |
| CA7 | El texto `base` en el buscador | se interpreta la búsqueda | se activa la fuente Base |
| CA8 | Filtros del panel y atajos a la vez | se combinan | las fuentes de DLC se unen y Hero queda activo si lo está en cualquiera |
| CA9 | Hero activo y dos fuentes de DLC | se cuentan los filtros activos | cuentan como dos filtros: Hero y DLC |
| CA10 | Cualquier combinación | se pulsa Clear filters | Hero y DLC vuelven a su estado vacío |

## Diseño de la interfaz

```
CLASS  L M H A   TECH  IS Clan   Jump jets  ECM  AMS  Hero
MIN HARDPOINTS  …
DLC  Base  1  2  3  4  5  6  7  8  9
AVAILABLE BY  …
```

En la lista, las etiquetas nuevas van con las de anclajes, JJ y ECM: `2E·M 1B·L JJ ECM HERO DLC 7`.

## Fuera de alcance

- Los nombres comerciales de los DLC (ver la limitación conocida).
- Recordar en el navegador qué DLC tiene el jugador.
- Mostrar el DLC fuera del selector (tablero, imagen de Share).

## Plan de pruebas

1. **Datos (CA1, CA2):** tests sobre `mechs.json` en `src/utils/mechs.test.ts`.
2. **Filtrado (CA3 a CA5, CA9, CA10):** `matchesMechFilters` y `countActiveFilters`.
3. **Buscador (CA6 a CA8):** `parseMechQuery` y `mergeMechFilters`.
4. **Interfaz:** comprobación en el navegador del filtro, los atajos y las etiquetas.
