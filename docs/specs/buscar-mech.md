# Especificación: Find a 'Mech y 'Mechs hero en el mapa estelar

- **Issue:** [#76](https://github.com/PonchoiDev/mechlab-web/issues/76)
- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/availability.test.ts`) y por último el código, en commits separados.

## Contexto

En el juego, el mercado de cada sistema vende 'Mechs según la facción dueña del sistema: cada variante es más o menos común en cada facción. Para encontrar una variante concreta hay que saber qué facciones la producen y dónde están en la fecha de la partida, y el juego no lo enseña en ningún sitio. Además, muchos 'Mechs hero solo se consiguen en un sitio: como recompensa de una HRQ o colocados en un sistema a partir de una fecha.

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Rareza por facción | `FactionRarity` de la unit card de cada variante (`tools/datos-juego/unitcard/`) | Para cada facción, `VeryCommon`, `Common`, `Uncommon`, `Rare`, `VeryRare`, `Unique` o `Unavailable` |
| Fecha de introducción | `IntroDate` de la unit card | Desde cuándo existe la variante |
| Alianza de cada facción | `Allegiance` de los assets de facción (`Factions/*`) | A qué facción responde: Canopus a Periphery, St. Ives a Independent |

`extraer_mapa.py` guarda las alianzas en `tools/datos-juego/starmap/alianzas.json`. `generar_mapa.py` lee las unit cards con las funciones de `generar_mechs.py` (la misma unit card que usa el MechLab para cada variante) y escribe `src/data/availability.json`, con la tabla que usa cada facción del mapa y la rareza y la fecha de cada variante.

**Decisiones sobre los datos:**

- **Archivo aparte:** la rareza de 627 variantes pesa unos 115 KB (10 KB comprimido). Va en su propio archivo, que el mapa solo carga al abrir el panel o si la URL trae una variante.
- **Facciones sin tabla propia:** las unit cards solo traen rareza para las grandes facciones, los Clanes y unas pocas más (Periphery, Independent, Outlaws…). Las facciones menores usan la tabla de su alianza, subiendo por la cadena hasta una que la tenga: Magistracy of Canopus usa la de Periphery, y Elysian Fields la de Outlaws (Elysian Fields responde a Oberon, Oberon a Bandits y Bandits a Outlaws). Una facción con tabla propia usa la suya aunque tenga alianza (Lyran Alliance responde a Steiner, pero tiene tabla). Arc-Royal Defense Cordon no tiene asset en el juego y se queda sin tabla.
- **Facciones sin entrada:** si la tabla de la facción no nombra la variante, esa facción no la vende.
- **'Mechs hero con fuente fija:** los que son recompensa de una HRQ, los que el juego coloca en un sistema (`HeroMechToPlace`, el Atlas II en Romulus) y los que vende un mercado especial. Salen de los datos que el mapa ya tiene ([recompensas-hrq.md](recompensas-hrq.md) y [mercados-especiales.md](mercados-especiales.md)).

## Requisitos funcionales

- **RF1.** Un panel **Find a 'Mech**, junto a Quests y Special markets, busca variantes por nombre o por variante (`atlas`, `AS7-D`).
- **RF2.** Al elegir una variante, el mapa colorea el territorio de cada facción según su rareza en la fecha elegida, de Very common a Very rare, con Unique y Unavailable aparte y el resto atenuado (no la vende). Al cerrar la ficha, el mapa vuelve a los colores de las facciones.
- **RF3.** La ficha de la variante muestra su nombre, si ya existe en la fecha del mapa (`Not produced until 1 JAN 3045`), las facciones con sistemas en esa fecha agrupadas por rareza con su número de sistemas, sus fuentes fijas (HRQ, mercados especiales y 'Mech único, con enlace a cada una) y un enlace al MechLab con su build de serie.
- **RF4.** Un panel **Hero 'Mechs** lista los 'Mechs hero con fuente fija, con la HRQ, el mercado o el sistema de cada uno. Al elegir uno, se abre su ficha.
- **RF5.** La URL guarda la variante elegida (`?mech=AS7-D`), para compartir la vista.

## Requisitos no funcionales

- **RNF1.** La lógica (tabla de cada facción, rareza en una fecha, fuentes fijas, lista de hero, búsqueda y URL) es pura y está en `src/utils/availability.ts`, con sus tests.
- **RNF2.** `starmap.json` no crece: la rareza va en `availability.json`, que se carga aparte.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El Atlas AS7-D | se consulta su rareza | existe desde el 1 de enero de 2755; es común en Steiner, poco común en Kurita y muy raro en Liao |
| CA2 | Magistracy of Canopus, Elysian Fields, Lyran Alliance y Arc-Royal Defense Cordon | se consulta la tabla que usan | Periphery, Outlaws, la suya y ninguna; el AS7-D es muy raro en Canopus |
| CA3 | El AS7-D el 1 de junio de 3025 | se agrupan las facciones del mapa por rareza | el primer grupo es Common, con Steiner y su número de sistemas; Liao y Canopus están en Very rare; las facciones sin entrada van al final, como no vendido |
| CA4 | El Archer ARC-AGC (hero) | se consulta | existe desde el 1 de enero de 3045, es Unique en Marik, no existe el 1 de enero de 3030 y es recompensa de Bow and Arrow |
| CA5 | El Atlas II AS7-D-H y el Thunderbolt TDR-5S | se consultan sus fuentes fijas | el primero está en Romulus desde el 10 de mayo de 3043; el segundo se vende en el mercado del DLC4 en Rasalhague |
| CA6 | Los 'Mechs hero | se listan los que tienen fuente fija | son 10, ordenados por nombre, todos hero y con al menos una fuente; entre ellos el ARC-AGC (Bow and Arrow) y el AS7-D-H (Romulus) |
| CA7 | Una variante hero sin rareza (BattleMaster BLR-1GHE) | se agrupan las facciones | todas van al grupo de no vendido |
| CA8 | Las búsquedas «atlas», «as7-d» y vacía | se busca | la primera incluye el AS7-D y el AS7-D-H, la segunda da primero el AS7-D y la vacía no da nada |
| CA9 | `?mech=AS7-D` | se lee y se escribe la URL | se lee el AS7-D; una variante que no existe se descarta; la URL del mapa con la variante lleva `mech=AS7-D` |
| CA10 | `availability.json` | se carga | todas sus variantes están en `mechs.json` con el mismo nombre, y todas las facciones del mapa salvo Arc-Royal Defense Cordon tienen tabla |

## Fuera de alcance

- La probabilidad exacta de que una variante salga en un mercado, que el juego calcula con más factores (tamaño del mercado, centros industriales, reputación).
- Las recompensas de las campañas de los DLC que no son HRQ.
- La rareza en el MechLab.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/availability.test.ts`, con `starmap.json` y `availability.json` reales.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: buscar «atlas», elegir el AS7-D en 3025 y en 3050 (el mapa cambia de color), elegir el ARC-AGC antes y después de 3045, abrir Hero 'Mechs y elegir el Atlas II, y abrir un enlace con `?mech=`.
