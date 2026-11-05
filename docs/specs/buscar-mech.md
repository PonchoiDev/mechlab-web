# Especificación: Find a 'Mech y 'Mechs hero en el mapa estelar

- **Issue:** [#76](https://github.com/PonchoiDev/mechlab-web/issues/76)
- **Estado:** implementada
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

- **RF1.** Un panel **Find a 'Mech**, junto a Quests y Special markets, busca variantes por nombre o por variante (`atlas`, `AS7-D`). Solo muestra las que ya existen en la fecha del mapa: buscar una que todavía no existe confunde.
- **RF2.** Al elegir una variante, el mapa colorea el territorio de cada facción según su rareza en la fecha elegida, de Very common a Very rare, con Unique y Unavailable aparte y el resto atenuado (no la vende). Al cerrar la ficha, el mapa vuelve a los colores de las facciones.
- **RF3.** La ficha de la variante muestra su nombre, si ya existe en la fecha del mapa (`Not produced until 1 JAN 3045`), las facciones con sistemas en esa fecha que la venden, agrupadas por rareza con su número de sistemas (las que no la venden ya salen en gris en el mapa y no se listan), sus fuentes fijas (HRQ, mercados especiales y 'Mech único, con enlace a cada una) y un enlace al MechLab con su build de serie.
- **RF4.** Un panel **Hero 'Mechs** lista los 'Mechs hero con fuente fija, con la HRQ, el mercado o el sistema de cada uno. Al elegir uno, se abre su ficha.
- **RF5.** La URL guarda la variante elegida (`?mech=AS7-D`), para compartir la vista.
- **RF6.** Si la variante se consigue en un sitio pequeño, el mapa lo encuadra al elegirla, porque el color de un solo sistema no se ve con el mapa entero:
  - un 'Mech hero con fuente fija, o una variante que no vende ninguna facción: su HRQ, con la ruta marcada como al elegir la HRQ, o el sistema del 'Mech único o del mercado especial;
  - una variante que solo venden facciones con 30 sistemas o menos en total en esa fecha: esos sistemas.
- **RF7.** En la ficha, las facciones con 5 sistemas o menos muestran sus sistemas, con enlace a cada uno.
- **RF8.** Si ninguna facción vende la variante, la ficha lo dice; y si además no tiene fuente fija, dice que el juego no le da un sitio fijo.

## Requisitos no funcionales

- **RNF1.** La lógica (tabla de cada facción, rareza en una fecha, fuentes fijas, lista de hero, búsqueda y URL) es pura y está en `src/utils/availability.ts`, con sus tests.
- **RNF2.** `starmap.json` no crece: la rareza va en `availability.json`, que se carga aparte.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El Atlas AS7-D | se consulta su rareza | existe desde el 1 de enero de 2755; es común en Steiner, poco común en Kurita y muy raro en Liao |
| CA2 | Magistracy of Canopus, Elysian Fields, Lyran Alliance y Arc-Royal Defense Cordon | se consulta la tabla que usan | Periphery, Outlaws, la suya y ninguna; el AS7-D es muy raro en Canopus |
| CA3 | El AS7-D el 1 de junio de 3025 y el 1 de junio de 3052 | se agrupan las facciones del mapa por rareza | en 3025 el primer grupo es Common, con Steiner y su número de sistemas, y Liao y Canopus están en Very rare; en 3052 los Clanes, que no lo tienen en su tabla, van al final, como no vendido |
| CA4 | El Archer ARC-AGC (hero) | se consulta | existe desde el 1 de enero de 3045, es Unique en Marik, no existe el 1 de enero de 3030 y es recompensa de Bow and Arrow |
| CA5 | El Atlas II AS7-D-H y el Thunderbolt TDR-5S | se consultan sus fuentes fijas | el primero está en Romulus desde el 10 de mayo de 3043; el segundo se vende en el mercado del DLC4 en Rasalhague |
| CA6 | Los 'Mechs hero | se listan los que tienen fuente fija | son 10, ordenados por nombre, todos hero y con al menos una fuente; entre ellos el ARC-AGC (Bow and Arrow) y el AS7-D-H (Romulus) |
| CA7 | Una variante hero sin rareza (BattleMaster BLR-1GHE) | se agrupan las facciones | todas van al grupo de no vendido |
| CA8 | Las búsquedas «atlas», «as7-d» y vacía | se busca | la primera incluye el AS7-D y el AS7-D-H, la segunda da primero el AS7-D y la vacía no da nada |
| CA9 | `?mech=AS7-D` | se lee y se escribe la URL | se lee el AS7-D; una variante que no existe se descarta; la URL del mapa con la variante lleva `mech=AS7-D` |
| CA11 | La búsqueda «atlas» el 1 de enero de 3030 y el 1 de enero de 3045 | se busca | en 3030 no está el AS7-D-H, que existe desde noviembre de 3041; en 3045 sí |
| CA12 | El ARC-AGC (hero, recompensa de Bow and Arrow) | se pide qué encuadrar | la ruta de Bow and Arrow, con su id para marcarla |
| CA13 | El AS7-D-H, el ARC-2W en 3050, el AS7-D en 3025 y el ARC-T (hero sin rareza ni fuente fija) | se pide qué encuadrar | Romulus sin HRQ; Outreach, el único sistema de Wolf's Dragoons, que es quien lo vende; nada, porque lo venden facciones grandes; y nada |
| CA14 | El AS7-D en 3025 | se agrupan las facciones | ComStar, con un sistema, trae ese sistema (Terra); Steiner, con cientos, no trae la lista |
| CA10 | `availability.json` | se carga | todas sus variantes están en `mechs.json` con el mismo nombre, y todas las facciones del mapa salvo Arc-Royal Defense Cordon tienen tabla |

## Fuera de alcance

- La probabilidad exacta de que una variante salga en un mercado, que el juego calcula con más factores (tamaño del mercado, centros industriales, reputación).
- Las recompensas de las campañas de los DLC que no son HRQ.
- La rareza en el MechLab.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/availability.test.ts`, con `starmap.json` y `availability.json` reales.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: buscar «atlas», elegir el AS7-D en 3025 y en 3050 (el mapa cambia de color), elegir el ARC-AGC antes y después de 3045, abrir Hero 'Mechs y elegir el Atlas II, y abrir un enlace con `?mech=`.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados. El CA3 se corrigió con los datos: en 3025 todas las facciones con sistemas venden el AS7-D, así que las que no lo venden se comprueban en 3052, con los Clanes.
- **Datos:** 627 variantes con su unit card (las 12 de `mechs.json` sin ella son copias de campaña), 98 sin rareza en ninguna facción y 108 hero. 48 facciones del juego con alianza; todas las del mapa tienen tabla salvo Arc-Royal Defense Cordon. `availability.json` pesa 115 KB y 10 KB comprimido, en su propio fragmento del build.
- **Tests:** los catorce criterios (CA1 a CA14) están en `src/utils/availability.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: el AS7-D en 3025 (Steiner en verde, Liao y la periferia en rojo) y en 3052 (los Clanes en gris), el ARC-AGC en 3030 (todavía no existe), la lista de hero con el Atlas II y la búsqueda «atlas».
- **Decisiones durante el desarrollo:**
  - La cadena de alianzas siempre acaba en una facción con tabla (Elysian Fields, Oberon, Bandits y Outlaws), lo que apoya que el juego usa la tabla de la alianza.
  - Con una variante elegida, el color de cada facción solo cambia al cambiar de variante o al cruzar su fecha de introducción, para no cortar la animación al saltar entre eventos.
  - Tras la primera revisión en el navegador se añadieron el filtro por fecha y el encuadre (RF6 a RF8, CA11 a CA14): sin ellos, una variante que solo vende Wolf's Dragoons (el ARC-2W, en Outreach) o un hero sin rareza (el ARC-T) no cambiaban nada visible en el mapa entero. El encuadre de varios sistemas deja libre la parte que tapa la ficha en escritorio, y el cajón se cierra al elegir.
  - La ficha listaba también las facciones que no venden la variante (Not sold). Era casi siempre una lista larga que tapaba lo útil, y el mapa ya las pinta en gris, así que se quitó.
  - En el móvil, la ficha ocupa casi toda la pantalla y tapa lo encuadrado hasta cerrarla, igual que la de una HRQ.
  - En el móvil, cinco cajones no cabían en el hueco de antes y tapaban la ficha. Los botones son más compactos y desaparecen el + y el −, porque el mapa se amplía con dos dedos; queda el botón de ver el mapa entero.
