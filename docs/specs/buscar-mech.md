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
| 'Mechs hero en venta | DataTable `Campaign/Progression/DataTables/HeroMechsForPurchase` | Los 95 'Mechs hero que el juego puede poner a la venta (WVR-Q, ARC-T…) |
| Recompensas fuera de las HRQ | Objetivos con `bHasRewards` y `MechLoadouts` de todo el juego, y la acción que los coloca (en su export `Default__`), en cualquier carpeta: en las campañas de los DLC 5 a 7 va en la subcarpeta `ArcActions` de la misión | Misiones de las campañas de los DLC, el final de una campaña, la información del Bounty Hunter (DLC4) o desbloqueos de promociones (el Wolverine de Razer, WVR-7H), con su sistema si lo tienen |

`extraer_mapa.py` guarda las alianzas en `tools/datos-juego/starmap/alianzas.json`. `generar_mapa.py` lee las unit cards con las funciones de `generar_mechs.py` (la misma unit card que usa el MechLab para cada variante) y escribe `src/data/availability.json`, con la tabla que usa cada facción del mapa y la rareza y la fecha de cada variante.

**Decisiones sobre los datos:**

- **Archivo aparte:** la rareza de 627 variantes pesa unos 115 KB (10 KB comprimido). Va en su propio archivo, que el mapa solo carga al abrir el panel o si la URL trae una variante.
- **Facciones sin tabla propia:** las unit cards solo traen rareza para las grandes facciones, los Clanes y unas pocas más (Periphery, Independent, Outlaws…). Las facciones menores usan la tabla de su alianza, subiendo por la cadena hasta una que la tenga: Magistracy of Canopus usa la de Periphery, y Elysian Fields la de Outlaws (Elysian Fields responde a Oberon, Oberon a Bandits y Bandits a Outlaws). Una facción con tabla propia usa la suya aunque tenga alianza (Lyran Alliance responde a Steiner, pero tiene tabla). Arc-Royal Defense Cordon no tiene asset en el juego y se queda sin tabla.
- **Facciones sin entrada:** si la tabla de la facción no nombra la variante, esa facción no la vende.
- **Fuentes fijas:** la recompensa de una HRQ, un 'Mech que el juego coloca en un sistema (`HeroMechToPlace`, el Atlas II en Romulus), un mercado especial ([recompensas-hrq.md](recompensas-hrq.md) y [mercados-especiales.md](mercados-especiales.md)) o una recompensa fuera de las HRQ. `extraer_mapa.py` guarda estas últimas en `recompensas_campana.json` y la tabla de hero en venta en `heroes_en_venta.json`; `generar_mapa.py` pasa a `starmap.json` las recompensas que no son de una HRQ del mapa (esas ya van en su ficha) y marca en `availability.json` los hero en venta.
- **'Mechs de un solo sitio:** los que no se pueden comprar como hero, tienen una fuente fija y, o son hero (14), o ninguna facción los vende (13 variantes especiales, como el WVR-7H o las de los mercados del DLC2). Los hero de `HeroMechsForPurchase` no tienen un sitio fijo: se compran cuando salen a la venta.
- **Nombres de los loadouts de recompensa:** llevan la variante con prefijos y sufijos (`AS7-D_DLC4_Reward`, `D7M3_HBR-A_Reward_Loadout`) y a veces sin respetar las mayúsculas (`KTO-19b_Loadout`).

## Requisitos funcionales

- **RF1.** Un panel **Find a 'Mech**, junto a Quests y Special markets, busca variantes por nombre o por variante (`atlas`, `AS7-D`). Solo muestra las que ya existen en la fecha del mapa: buscar una que todavía no existe confunde. Si hay variantes que coinciden pero entran en producción más adelante, la lista lo dice al final, con cuántas son, aunque haya otras en la lista (buscar «archer» en 3015 da cinco y avisa de otras cinco posteriores), y ofrece un botón que lleva el mapa a la fecha de la siguiente; si esa fecha es posterior al final del mapa (3060), solo lo dice.
- **RF2.** Al elegir una variante, el mapa colorea el territorio de cada facción según su rareza en la fecha elegida, de Very common a Very rare, con Unique y Unavailable aparte y el resto atenuado (no la vende). Al cerrar la ficha, el mapa vuelve a los colores de las facciones.
- **RF3.** La ficha de la variante muestra su nombre, si ya existe en la fecha del mapa (`Not produced until 1 JAN 3045`), las facciones con sistemas en esa fecha que la venden, agrupadas por rareza con su número de sistemas (las que no la venden ya salen en gris en el mapa y no se listan), sus fuentes fijas (HRQ, mercados especiales y 'Mech único, con enlace a cada una) y un enlace al MechLab con su build de serie.
- **RF4.** Un panel **Hero 'Mechs** lista los 'Mechs de un solo sitio: primero los hero y después las variantes especiales, con la HRQ, el mercado, la recompensa o el sistema de cada uno. Al elegir uno, se abre su ficha.
- **RF9.** La ficha muestra las recompensas fuera de las HRQ como fuente fija: el título de la misión, su DLC y su sistema, si lo tiene, con enlace; y el mapa encuadra ese sistema como el de un 'Mech único.
- **RF10.** La ficha de un hero que puede salir a la venta lo dice, también cuando ninguna facción lo vende (el ARC-T).
- **RF11.** La ficha dice siempre cómo se consigue cada recompensa, aunque no esté en el mapa ni sea de una misión. Cada recompensa lleva su tipo:
  - **Misión:** el título de la misión, su DLC y su sistema.
  - **Final de campaña** (`*CampaignComplete*`): completar la campaña de su DLC.
  - **Información del Bounty Hunter** (`BountyHunterLevelUpN`, DLC4): llegar a ese nivel de información.
  - **Rango de la arena** (`ArenaFameLevelUp*`, DLC6): llegar a ese rango de fama en las arenas de Solaris.
  - **Promoción** (carpetas `*_Exclusive`): llega con un mensaje, sin misión. `Razer_Exclusive` es la de Razer (el registro de eventos dice «Claimed Razer WVR-7H») y `MS_Exclusive` la de Microsoft (su arco comprueba `HasMSMechEntitlement`), solo en carrera.
  - **Sistema de un arco:** si ninguna acción coloca la recompensa, el sistema puede estar en la condición `StarSystemTrigger` del arco de su carpeta. El de Razer se dispara al llegar a Valentina, así que el WVR-7H se consigue allí.
- **RF5.** La URL guarda la variante elegida (`?mech=AS7-D`), para compartir la vista.
- **RF6.** Si la variante se consigue en un sitio pequeño, el mapa lo encuadra al elegirla, porque el color de un solo sistema no se ve con el mapa entero:
  - un 'Mech hero con fuente fija, o una variante que no vende ninguna facción: su HRQ, con la ruta marcada como al elegir la HRQ, o el sistema del 'Mech único o del mercado especial;
  - una variante que solo venden facciones con 30 sistemas o menos en total en esa fecha: esos sistemas.
- **RF7.** En la ficha, las facciones con 5 sistemas o menos muestran sus sistemas, con enlace a cada uno.
- **RF8.** Si ninguna facción vende la variante, la ficha lo dice; y si además no tiene fuente fija, dice que el juego no le da un sitio fijo.

- **RF12.** El título de una misión con sistema se puede pulsar: el mapa encuadra su sistema y lo marca como la ruta de una HRQ, sin cerrar la ficha del 'Mech. Al elegir un 'Mech que se encuadra por una de esas misiones, el sistema se marca solo.

- **RF13.** El buscador también encuentra las variantes por su otro nombre, como el MechLab: el Puma es el Adder en la Esfera Interior (`sarnaName` de `mechs.json`). La lista y la ficha muestran los dos.

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
| CA6 | Los 'Mechs de un solo sitio | se listan | hay 14 hero, ordenados por nombre, todos con al menos una fuente y ninguno en venta; entre ellos el ARC-AGC (Bow and Arrow), el AS7-D-H (Romulus), el MAD-BH y el PXH-KB |
| CA17 | Las variantes especiales | se listan | son 13, ninguna hero ni vendida por una facción; entre ellas el WVR-7H, recompensa de «Hidden Cache Found» sin sistema, y el TDR-5SE, del mercado especial del DLC2 |
| CA18 | El MAD-BH | se consultan sus fuentes y qué encuadrar | es la recompensa de «Head Hunting», del DLC4, en Robinson, y se encuadra Robinson |
| CA19 | El WVR-Q y el ARC-T | se consultan | pueden salir a la venta como hero y no están en la lista |
| CA20 | Las recompensas fuera de las HRQ | se cargan | ninguna es de una HRQ del mapa (no está «Bow and Arrow Pt.4»); «Gunzburg Pt.3» da el AS7-D y «Battle at New Starburg» el HBR-A |
| CA7 | Una variante hero sin rareza (BattleMaster BLR-1GHE) | se agrupan las facciones | todas van al grupo de no vendido |
| CA8 | Las búsquedas «atlas», «as7-d» y vacía | se busca | la primera incluye el AS7-D y el AS7-D-H, la segunda da primero el AS7-D y la vacía no da nada |
| CA9 | `?mech=AS7-D` | se lee y se escribe la URL | se lee el AS7-D; una variante que no existe se descarta; la URL del mapa con la variante lleva `mech=AS7-D` |
| CA11 | La búsqueda «atlas» el 1 de enero de 3030 y el 1 de enero de 3045 | se busca | en 3030 no está el AS7-D-H, que existe desde noviembre de 3041; en 3045 sí |
| CA12 | El ARC-AGC (hero, recompensa de Bow and Arrow) | se pide qué encuadrar | la ruta de Bow and Arrow, con su id para marcarla |
| CA13 | El AS7-D-H, el ARC-2W en 3050, el AS7-D en 3025 y el ARC-T (hero sin rareza ni fuente fija) | se pide qué encuadrar | Romulus sin HRQ; Outreach, el único sistema de Wolf's Dragoons, que es quien lo vende; nada, porque lo venden facciones grandes; y nada |
| CA14 | El AS7-D en 3025 | se agrupan las facciones | ComStar, con un sistema, trae ese sistema (Terra); Steiner, con cientos, no trae la lista |
| CA15 | Las búsquedas «as7-d-h», «arctic wolf» y «acw-prime» el 1 de enero de 3030 | se piden las variantes posteriores | la primera da una, desde el 11 de noviembre de 3041; la segunda, cinco, la siguiente el 1 de enero de 3059 (el ACW-1); la tercera, una, el 1 de enero de 3067, después del final del mapa; una búsqueda sin resultados, ninguna |
| CA16 | La búsqueda «archer» el 1 de enero de 3015 | se busca y se piden las variantes posteriores | da cinco variantes y avisa de otras cinco posteriores, la siguiente el ARC-T el 20 de febrero de 3016 |
| CA21 | La recompensa «Shielded Withdrawal» (DLC5, BLR-1G-S), cuya acción está en la subcarpeta `ArcActions` de su misión | se consulta | tiene el sistema de su misión, Vega |
| CA22 | Las recompensas del WVR-7H y del PXH-KB | se consultan | son promociones, de Razer en Valentina (por la condición de su arco) y de Microsoft sin sistema; la de Head Hunting es una misión; el WVR-7H encuadra Valentina |
| CA23 | Las recompensas sin sistema | se describen | el WVR-7H: «Razer promotion: arrives as a message (Hidden Cache Found) when you arrive», con el sistema detrás; el FS9-A: «Reach Bounty Hunter intel level 3 (DLC 4)»; el AS7-BH: «Reach the Rudiarius fame rank in the Solaris arenas (DLC 6)»; el SNV-BR: «Complete the DLC 9 campaign (Promises Kept)»; el PXH-KB: «Microsoft promotion, career mode only: arrives as a message (Heya Ryana, I'm Back!)» |
| CA24 | La búsqueda «adder» | se busca | da las variantes del Puma, con su otro nombre, Adder |
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
- **Tests:** los veintitrés criterios (CA1 a CA23) están en `src/utils/availability.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: el AS7-D en 3025 (Steiner en verde, Liao y la periferia en rojo) y en 3052 (los Clanes en gris), el ARC-AGC en 3030 (todavía no existe), la lista de hero con el Atlas II y la búsqueda «atlas».
- **Decisiones durante el desarrollo:**
  - La cadena de alianzas siempre acaba en una facción con tabla (Elysian Fields, Oberon, Bandits y Outlaws), lo que apoya que el juego usa la tabla de la alianza.
  - Con una variante elegida, el color de cada facción solo cambia al cambiar de variante o al cruzar su fecha de introducción, para no cortar la animación al saltar entre eventos.
  - Tras la primera revisión en el navegador se añadieron el filtro por fecha y el encuadre (RF6 a RF8, CA11 a CA14): sin ellos, una variante que solo vende Wolf's Dragoons (el ARC-2W, en Outreach) o un hero sin rareza (el ARC-T) no cambiaban nada visible en el mapa entero. El encuadre de varios sistemas deja libre la parte que tapa la ficha en escritorio, y el cajón se cierra al elegir.
  - La ficha listaba también las facciones que no venden la variante (Not sold). Era casi siempre una lista larga que tapaba lo útil, y el mapa ya las pinta en gris, así que se quitó.
  - La primera lista de hero solo miraba las HRQ, los mercados especiales y el Atlas II, y dejaba fuera cuatro hero (el MAD-BH del Bounty Hunter, los dos del final del DLC9 y el PXH-KB) y el Wolverine de Razer (WVR-7H), que no está marcado como hero. Se añadieron las recompensas de todo el juego y la tabla de hero en venta, que explica por qué el WVR-Q y el ARC-T no tienen un sitio fijo.
  - Las recompensas de los DLC 5 a 7 se quedaban sin sistema porque su acción está en la subcarpeta `ArcActions`; ahora se busca en todo el juego (CA21). El Wolverine de Razer y el PXH-KB no tienen sistema porque son desbloqueos de promociones, y la ficha lo explica (CA22). Después se pasó a describir siempre cómo se consigue cada recompensa, también los niveles de información del Bounty Hunter, los rangos de la arena y los finales de campaña (CA23). El título de esas misiones se puede pulsar para encuadrar y marcar su sistema (RF12): antes solo se podía pulsar el sistema, que cerraba la ficha del 'Mech.
  - Con un cajón abierto, la caja que agrupa los cajones tapaba el mapa en el hueco entre ellos y no dejaba arrastrarlo: ahora solo los cajones reciben los toques.
  - En el móvil, la ficha ocupa casi toda la pantalla y tapa lo encuadrado hasta cerrarla, igual que la de una HRQ.
  - En el móvil, cinco cajones no cabían en el hueco de antes y tapaban la ficha. Los botones son más compactos y desaparecen el + y el −, porque el mapa se amplía con dos dedos; queda el botón de ver el mapa entero.
