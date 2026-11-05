# Especificación: misiones de alta recompensa en el mapa estelar

- **Issue:** [#64](https://github.com/PonchoiDev/mechlab-web/issues/64)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/quests.test.ts`) y por último el código, en commits separados.

## Contexto

Las misiones de alta recompensa (HRQ, *high reward quests*) son cadenas de misiones que se ofrecen en un sistema concreto y se juegan en uno o varios sistemas. El juego solo las muestra en el mapa cuando se ofrecen, y cuesta saber de antemano dónde están o adónde lleva cada una. Un usuario de Reddit propuso marcarlas en el mapa estelar y poder buscarlas por nombre.

## Datos del juego

Cada misión se define con acciones de la campaña (*arc actions*) cuyos valores por defecto traen el sistema, y con un objetivo que trae los textos.

| Dato | Asset | Contenido |
|---|---|---|
| Oferta | `Show…` (por ejemplo, `ShowArcherSideQuest_ArcAction`) | Sistema donde se ofrece (`StarSystemId`), objetivo, tipos de misión, si la oferta se ve desde cualquier punto del mapa y DLC (`AssociatedDLC`) |
| Misiones | `Place…` y `Generate…` | Sistema donde se juega cada misión y su objetivo |
| Textos | El objetivo de cada acción (`*_Prompt` u objetivo de la cadena) | Título (`ScreenTitleText`), resumen (`ScreenSubText`) y quién la encarga (`Employer`) |

| Grupo | Carpeta | Cadenas |
|---|---|---|
| Misiones de facción (campaña) | `Campaign/CampaignArcs/Regions/<región>/<misión>` | Davion, Kurita, Liao, Marik y Steiner |
| Misiones de facción (carrera) | `DLC1/CareerMode/Sidequests/<casa>/…` | Las mismas y algunas solo de carrera (Return of the Rangers, Bowie Electronics, Competitive Edge, The Powder Keg) |
| Heroes of the Inner Sphere (DLC1) | `DLC1/CareerMode/Sidequests/HeroesOfTheIS/Quest_*` | 7 cadenas de 4 misiones |
| DLC2 | `DLC2/Sidequests/Quest*` | 7 cadenas |
| DLC3 | `DLC3/HatchetmanQuestData` | Those in Need, 5 misiones |
| DLC8 | `DLC8/CampaignData/Quest_*` | Adam Steiner, Guerrero, Lyran Alliance, Sunder y Word of Blake |

`extraer_mapa.py` guarda las acciones con sus textos en `tools/datos-juego/starmap/misiones.json` y `generar_mapa.py` las agrupa en cadenas dentro de `starmap.json`.

**Decisiones sobre los datos:**

- **Cadena:** la carpeta de la misión. Las acciones de las subcarpetas de cada misión (`ARC_Mission_1`, `Mission2`) pertenecen a la cadena de su carpeta.
- **Nombre de la cadena:** el título que comparten la mayoría de sus misiones, sin la parte (`Bow and Arrow Pt.2` pasa a `Bow and Arrow`) y sin distinguir mayúsculas (`Those In Need` y `Those in Need`). Si cada misión tiene su propio título, como en la de Adam Steiner del DLC8, el nombre de la carpeta.
- **Ofertas:** las acciones `Show…` y, en carrera, `Career_Show…`. Una cadena sin oferta (algunas de facción) se ofrece en el sistema de su primera misión.
- **Cambridge:** es el único sistema oculto de la tabla, pero aparece en el mapa durante el DLC8 y allí se juegan cinco misiones de Adam Steiner, así que el mapa lo incluye.
- **Orden de las misiones:** por la parte del título (`Pt. 2`) y después por el nombre de la acción (`_01`, `_02`). Las acciones de viaje (`TravelTo…`, `ReturnTo…`) no son misiones.
- **Campaña y carrera:** la misma cadena aparece en las dos con el mismo nombre. Se une en una sola, que indica los dos modos. Si los sistemas no coinciden, se usan los de carrera, que es donde más se juegan.
- **Fuera de alcance de los datos:** las misiones de la historia principal (`StoryCluster_*`), los clústeres finales (`EndgameClusters`) y las campañas de los DLC 4 a 9, que no son HRQ.
- **DLC:** el de la oferta. Las cadenas sin DLC son del juego base.

## Requisitos funcionales

- **RF1.** El mapa marca con un icono los sistemas donde se ofrece alguna HRQ.
- **RF2.** Un panel **Quests**, junto a la leyenda de facciones, lista las HRQ y permite buscarlas por nombre, por sistema o por quien las encarga. Al elegir una, el mapa se centra en el sistema donde se ofrece.
- **RF3.** Con una HRQ elegida, el mapa une con una línea discontinua el sistema de la oferta y los de sus misiones, en orden y numerados.
- **RF4.** La ficha de la HRQ muestra su nombre, su DLC, si es de campaña, de carrera o de las dos, quién la encarga, los tipos de misión y la lista de misiones con su título, su resumen y su sistema. Cada sistema de la lista centra el mapa en él.
- **RF5.** La ficha de cada sistema indica las HRQ que se ofrecen o se juegan allí, y permite abrirlas.
- **RF6.** La HRQ elegida se guarda en la URL (`?quest=bow-and-arrow`) para compartirla.

## Requisitos no funcionales

- **RNF1.** La lógica (búsqueda, HRQ de un sistema, ruta de una HRQ y URL) es pura y está en `src/utils/quests.ts`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | La HRQ del Archer (DLC1) | se consulta | se llama Bow and Arrow, se ofrece en Holt, es del DLC 1 y sus cuatro misiones son en Holt, Ibstock, Bernardo y Berenson |
| CA2 | Tributes for the Imperator | se consulta | es del DLC 2, se ofrece en Bethonolog y tiene tres misiones, las tres en Bethonolog |
| CA3 | Those in Need (Hatchetman) | se consulta | es del DLC 3 y tiene cinco misiones en Benfled |
| CA4 | Pirate Hunt | se consulta | es de campaña y de carrera, se ofrece en Irece y sus misiones son en Irece, Outer Volta y Unity |
| CA5 | Return of the Rangers | se consulta | es solo de carrera y va de Rijeka a Mezzana y Acrux |
| CA6 | Los nombres de las cadenas | se listan | ninguno termina en `Pt.` y número, no hay dos con el mismo nombre y no aparecen las misiones de la historia principal |
| CA7 | La búsqueda «arrow», «holt» y «BETHONOLOG» | se busca | la primera da Bow and Arrow, la segunda la HRQ que se ofrece en Holt y la tercera Tributes for the Imperator |
| CA8 | Benfled | se consultan sus HRQ | se ofrece Those in Need |
| CA9 | Bow and Arrow | se pide su ruta | es Holt, Ibstock, Bernardo y Berenson, sin repetir Holt aunque se ofrezca y se juegue allí |
| CA10 | La URL `?quest=bow-and-arrow` | se abre | el mapa empieza con esa HRQ elegida; con un id que no existe, sin ninguna |

## Fuera de alcance

- Las recompensas de cada HRQ, que el juego no trae en estos assets.
- Las condiciones para que se ofrezcan (reputación, fecha o progreso de la campaña).

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/quests.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, a 1920 × 1080 y a 390 × 844: iconos de oferta, panel Quests, ruta numerada, ficha de la HRQ y HRQ en la ficha del sistema.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 371 acciones del juego agrupadas en 64 cadenas: 44 de facción (38 en campaña y carrera, 4 solo en carrera y 2 solo en campaña), 7 de Heroes of the Inner Sphere, 7 del DLC2, la del Hatchetman y 5 del DLC8.
- **Tests:** los diez criterios (CA1 a CA10) están en `src/utils/quests.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: icono de oferta, panel Quests con búsqueda, ruta numerada de Bow and Arrow, ficha de la HRQ y HRQ en la ficha de Holt.
- **Decisiones durante el desarrollo:**
  - El lector de Unreal resuelve ahora la tabla de imports: la acción de una misión apunta a su objetivo, y el objetivo a quien la encarga, por referencia a otros paquetes.
  - Quien encarga la misión es una «persona» con nombre visible (`EmployerName`); alguno viene como identificador (`FederatedCommonwealth (FS)`) y se separan las palabras.
  - El objetivo de Pirate Raiders no está en el juego: su primera misión toma el nombre de la cadena.
