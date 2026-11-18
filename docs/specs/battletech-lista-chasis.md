# Especificación: lista de chasis de BATTLETECH

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/chassisList.test.ts`) y por último la lógica y la interfaz, en commits separados.

## Contexto

La lista de chasis de MW5 (`docs/specs/lista-chasis.md`) enseña todas las variantes en una tabla con sus cifras, filtros y orden. BATTLETECH no tiene una: el selector de su MechLab filtra, pero no compara las variantes por velocidad, armadura o tonelaje libre. Esta página es la misma tabla con los 'Mechs de BATTLETECH (juego base y DLC) y sus propias cifras.

`mechs.json` e `items.json` de BATTLETECH ya traen lo necesario: las cifras de cada chasis y su equipo fijo. La página no necesita datos nuevos.

## Cifras de BATTLETECH

Las de MW5 no sirven tal cual: BATTLETECH no tiene motores a la vista, giro ni año de aparición, y mueve los 'Mechs en metros por turno. Las cifras son las del chasis vacío (sin equipo ni armadura, con su equipo fijo), calculadas con `getBuildSummary`, la misma función que el MechLab:

| Columna | Qué es |
|---|---|
| Tons | Tonelaje del chasis |
| Hardpoints | Anclajes por tipo («2E 3B 1S») |
| Free t | Toneladas libres del chasis vacío: lo que queda para armas, equipo y armadura |
| Armor y Struct. | Armadura máxima y estructura |
| Walk y Sprint | Distancia de andar y de correr en metros, con lo que cambie su equipo fijo |
| JJ | Retrorreactores que admite |
| Stab. | Estabilidad |
| Melee y DFA | Daño del cuerpo a cuerpo y del ataque desde arriba |
| Source | Juego base o DLC |

La disipación (30) y el calor máximo (100) del chasis vacío son iguales en todos los 'Mechs del juego: no van en la tabla.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/chassis/`, con el título **Chassis**, su carátula en la fila de BATTLETECH de la página de inicio (junto al MechLab) y un enlace en la cabecera del MechLab y de las demás páginas de BATTLETECH.
- **RF2.** Una tabla con una fila por variante (las 96 que ofrece el selector del MechLab) y las columnas de la tabla de arriba. El nombre lleva el rol del juego y el equipo fijo del chasis, con las etiquetas de My builds («Targeting Baffle ×2»).
- **RF3.** Los filtros del selector de 'Mechs de BATTLETECH, con la misma lógica (`filterBtMechs`): el buscador con sus atajos («3e 2m jj»), clase de peso, fuente, rol (las etiquetas del juego; vale cualquiera de las marcadas), anclajes mínimos y retrorreactores mínimos.
- **RF4.** Filtros nuevos con las cifras del chasis: tonelaje mínimo y máximo, y distancia de correr mínima.
- **RF5.** El orden por columnas de la lista de MW5: las cifras de mayor a menor y el nombre de la A a la Z; otra pulsación invierte el orden.
- **RF6.** Pulsar una variante abre el MechLab de BATTLETECH con su build de serie (`/battletech/?mech=HBK-4G`).
- **RF7.** Los filtros, la búsqueda y el orden van en la URL.
- **RF8.** El recuento de variantes y chasis, y Clear filters, como en MW5.
- **RF9.** La campana de novedades y el botón de feedback en la cabecera.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/battletech/chassisList.ts`, con sus tests. Reutiliza los filtros del selector y el orden por columnas de la lista de MW5, que pasa a `src/utils/tableSort.ts` para los dos juegos.
- **RNF2.** La página tiene su propio bundle, usa los estilos de la lista de MW5 y funciona a 390 × 844 sin desbordar la página.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los 'Mechs | se cargan las filas | son 96 variantes de 51 chasis: 70 del juego base, 15 de Heavy Metal, 6 de Flashpoint y 5 de Urban Warfare |
| CA2 | El HBK-4G | se consulta su fila | Hunchback, medium, 50 t, 2E 3B 0M 1S, 31,5 t libres, 1045 de armadura, 416 de estructura, 120 m andando y 200 corriendo, 4 retrorreactores, 130 de estabilidad, 80 de cuerpo a cuerpo y 65 de DFA, del juego base y sin equipo fijo |
| CA3 | El FLE-15 y el RVN-1X | se consultan sus filas | FLE-15: Heavy Metal, 5 anclajes de apoyo y Targeting Baffle ×2. RVN-1X: Urban Warfare y X-1 EW Equipment |
| CA4 | Las filas | se busca «atlas» / «3e 2m» / se filtra por Light / Heavy Metal / el rol Sniper / al menos 6 retrorreactores / de 20 a 35 t / al menos 200 m corriendo | todas son Atlas / todas tienen al menos 3E y 2M / 20 / 15 / todas tienen la etiqueta Sniper / todas admiten 6 o más / 20 / 84 |
| CA5 | Las filas | se ordenan por Sprint / Free t / nombre / Sprint dos veces | la primera corre 350 m / la primera es el ANH-1A (76,5 t) / de la A a la Z por chasis / la primera es la que menos corre |
| CA6 | La URL | se lee y se vuelve a escribir | `?q=atlas&class=assault&source=base,heavymetal&role=Sniper,Tank&min=3e,2m,1s&jj=4&tmin=20&tmax=35&sprint=200&sort=sprint&dir=asc` se conserva igual; sin parámetros, la vista por defecto y una URL vacía; lo que no se conoce se ignora |
| CA7 | El HBK-4G | se enlaza al MechLab | `/battletech/?mech=HBK-4G` |

## Fuera de alcance

- El coste de cada chasis.
- La disipación y el calor máximo, iguales en todos.

## Plan de pruebas

1. **Lógica (CA1 a CA7):** `src/utils/battletech/chassisList.test.ts`, con los datos reales de BATTLETECH.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: la tabla, los filtros, el orden, la URL, el enlace al MechLab y la carátula.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después la lógica, la página y los enlaces, en commits separados.
- **Tests:** los siete criterios están en `src/utils/battletech/chassisList.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1366 × 800 y a 390 × 844: la tabla con las 96 variantes y 51 chasis, que cabe sin desplazarse a lo ancho; al menos 1E y 2 retrorreactores ordenado por Sprint (95 variantes, los de 350 m primero), la URL (`?min=1e&jj=2&sort=sprint`), un clic en una variante que abre el MechLab de BATTLETECH y la carátula de la página de inicio con el Hunchback de Sarna.
- **Decisiones durante el desarrollo:**
  - El orden por columnas de la lista de MW5 pasó a `utils/tableSort.ts`, y su tabla a `components/ChassisTable.tsx`, para las dos listas.
  - Rol y fuente se eligen de uno en uno en la página; la URL admite varios.
