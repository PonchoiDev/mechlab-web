# Especificación: flashpoints de BATTLETECH

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/flashpoints.test.ts`) y por último el código, en commits separados.

## Contexto

La página de HRQ y campañas de MW5 (`/mercs/campaigns/`, `docs/specs/pagina-campanas.md`) reúne las cadenas de misiones del juego. BATTLETECH tiene algo parecido: los flashpoints, cadenas de contratos que se ofrecen en un sistema concreto, con conversaciones entre ellos y, en muchos, una decisión que lleva a un final u otro. Los trajeron el DLC Flashpoint, Heavy Metal y Urban Warfare. El juego no los enseña juntos en ningún sitio: solo aparecen en el mapa cuando se ofrecen.

## Datos del juego

Los flashpoints están en los bundles de Unity de los tres DLC (`data/assetbundles/flashpoint`, `heavymetal` y `urbanwarfare`), como los vehículos de Heavy Metal:

| Dato | Origen | Contenido |
|---|---|---|
| Flashpoint | `fp_*` | Nombre, resumen, descripción, dificultad (1 a 10), duración (`SHORT`, `MEDIUM`, `LONG`), quién lo encarga, contra quién, la etiqueta del planeta donde se ofrece, los requisitos, si se repite, su conjunto de hitos y la colección de su recompensa |
| Hitos | `ms_fp_*` | Un grafo: cada hito lleva al siguiente, añade un contrato, abre una conversación, se ramifica según la elección del jugador (`fp_choice_a`, `fp_choice_b`, `fp_choice_cancel`) o completa el flashpoint con su pago (`Funds`, `Reputation.*`, `Morale`) |
| Contratos | `c_fp_*` | Nombre, tipo, descripción y objetivos |
| Recompensa final | `itemCollection_*` (en los bundles o en `data/itemCollections/`) | Título, descripción y lo que trae: un 'Mech concreto o tablas al azar |
| Sistema | `planet_name_*` de los sistemas del mapa de BATTLETECH (`tools/datos-juego/battletech/starmap/`) | Dónde se ofrece |
| Nombres | Facciones del mapa de BATTLETECH y chasis del MechLab (`tools/datos-juego/battletech/mechlab/`) | Quién lo encarga, la reputación que da y el nombre de los 'Mechs de las recompensas |

`extraer_flashpoints_battletech.py` guarda lo que saca del juego en `tools/datos-juego/battletech/flashpoints/` y `generar_flashpoints_battletech.py` crea `src/data/battletech/flashpoints.json`.

**Decisiones sobre los datos:**

- **Caminos:** el generador recorre el grafo de hitos desde el inicio y saca cada camino hasta un final. Los contratos que comparten todos los caminos son los del tronco; después, cada camino lleva los suyos y su pago. El que abandona el flashpoint (`fp_choice_cancel`) no paga nada y no se cuenta como camino: la página dice que se puede abandonar.
- **Nombre de cada camino:** las opciones de la conversación no están en los datos, así que se llaman por su letra («Path A», «Path B»), y si hay dos decisiones seguidas, por las dos («Path A, then B»).
- **Dificultad:** la del flashpoint, de 1 a 10, como la del juego (que la pinta en calaveras: la mitad).
- **'Mechs de la recompensa:** los de la colección. Las variantes especiales que no se pueden comprar (el Bull Shark BSK-MAZ, el Big Steel Claw BSC-20) no están en el MechLab: salen con su nombre y sin enlace.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/flashpoints/`, con el título **Flashpoints**, su carátula en la fila de BATTLETECH de la página de inicio (entre el MechLab y el mapa estelar, como HRQ & Campaigns en la de MW5) y un enlace en las cabeceras de las demás páginas de BATTLETECH. Usa el mismo rosa que HRQ & Campaigns.
- **RF2.** Los flashpoints se agrupan por DLC (Flashpoint, Heavy Metal y Urban Warfare) en listas como las de HRQ & Campaigns: una fila por flashpoint con las mismas columnas en todas: el nombre (con su dificultad, su duración y su número de contratos), dónde se ofrece y quién lo encarga, y la recompensa (los 'Mechs que da o, si no da ninguno, el pago y el título de la recompensa).
- **RF3.** Al desplegar una fila:
  - la descripción con la que el juego lo ofrece;
  - los requisitos: alianza con una casa o reputación mínima, y si se repite;
  - los contratos del tronco en orden, como una línea de pasos, con su nombre, su tipo, su objetivo principal y su descripción desplegable;
  - cada camino con sus contratos y su pago: C-Bills, reputación con cada facción y moral;
  - si se puede abandonar;
  - la recompensa final: su título, su descripción y sus 'Mechs, enlazados al MechLab si están en él.
- **RF4.** El sistema enlaza al mapa estelar de BATTLETECH con el sistema elegido (`/battletech/starmap/?system=Viribium`).
- **RF5.** Un buscador por nombre, sistema, quien lo encarga, contrato o 'Mech de la recompensa, y un filtro por DLC.
- **RF6.** El filtro, la búsqueda y el flashpoint desplegado van en la URL (`?dlc=heavymetal`, `?fp=morganKell`).
- **RF7.** La campana de novedades y el botón de feedback están en la cabecera, como en las demás páginas.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/battletech/flashpoints.ts`, con sus tests: grupos, filtros, búsqueda, enlaces y vista en la URL.
- **RNF2.** La página tiene su propio bundle: no carga los 'Mechs del MechLab, solo los ids de las variantes para saber si enlazarlas.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los flashpoints | se cargan | son 32: 18 del DLC Flashpoint, 4 de Heavy Metal y 10 de Urban Warfare. Todos tienen sistema en el mapa de BATTLETECH, al menos un contrato y todos sus contratos tienen nombre |
| CA2 | The Baying of Hounds | se consulta | es del DLC Flashpoint, se ofrece en Viribium, lo encargan los Kell Hounds, dificultad 7 y duración media. Su tronco son The Baying of Hounds y The Baying of Hounds II; los caminos A y B llevan un contrato cada uno (The Baying of Hounds III: SimpleBattle y CaptureBase) y pagan 1.000.000 C-Bills y 9 de reputación con el Mercenary Review Board. Se puede abandonar, y su recompensa es Rare Items |
| CA3 | Hourglass, The Steel Beast y Prototype | se consultan sus recompensas | Hourglass (Heavy Metal) da el Bull Shark BSK-MAZ y The Steel Beast el Big Steel Claw BSC-20, que no están en el MechLab y no llevan enlace; Prototype (Urban Warfare) da el Raven RVN-1X, que sí está y se enlaza |
| CA4 | Los requisitos | se consultan | Davion Alliance pide estar aliado con Davion; Red Hunt, más de 40 de reputación con Kurita; The Baying of Hounds, nada. Yang Virtanen's Big Score se repite |
| CA5 | La lista | se filtra por Heavy Metal / se busca «kell», «viribium» y «raven» | salen los 4 de Heavy Metal / The Baying of Hounds, The Baying of Hounds y Prototype, sin distinguir mayúsculas |
| CA6 | The Baying of Hounds | se enlaza al mapa | `/battletech/starmap/?system=Viribium` |
| CA7 | La URL | se abre y se construye | sin parámetros, todo y nada desplegado. `?dlc=heavymetal&q=hour` se lee y se vuelve a escribir igual. `?fp=morganKell` despliega The Baying of Hounds. Un flashpoint o un DLC que no existen se ignoran |

## Fuera de alcance

- Los textos de las conversaciones y el nombre de cada opción: están en las conversaciones del juego, que no se extraen.
- El contenido de las tablas al azar de las recompensas: la página da su título y su descripción, como el juego.
- Los contratos sueltos y la campaña principal.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA7):** `src/utils/battletech/flashpoints.test.ts`, con `flashpoints.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: la carátula nueva, los grupos, el filtro y la búsqueda, The Baying of Hounds desplegado con sus dos caminos y un flashpoint con una decisión doble, y un enlace al mapa.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Corrección de un criterio:** el Raven RVN-1X de Prototype sí está en el MechLab; las variantes que no están son el Bull Shark BSK-MAZ y el Big Steel Claw BSC-20.
- **Datos:** 32 flashpoints con 65 caminos. `flashpoints.json` pesa 110 KB.
- **Tests:** los siete criterios están en `src/utils/battletech/flashpoints.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: la lista, The Baying of Hounds, The Long Hunt (dos decisiones seguidas), Prototype (siete caminos) y Yang Virtanen's Big Score.
- **Decisiones durante el desarrollo:**
  - Las bifurcaciones tienen, además de las opciones marcadas, un resultado sin condición: lo que pasa si no se elige ninguna (en Flattened Earth, seguir en vez de abandonar). Cuenta como camino y no añade letra.
  - Dos caminos se descartan porque no se pueden jugar: el B de Hourglass lleva a un contrato que no está en ningún archivo del juego (`HM5_hourglass_b1_3wayBattle`) y el B de Bourbon & BattleMechs a uno sin rellenar. El juego marca la opción A de Hourglass al empezar.
  - Los caminos con los mismos contratos y el mismo pago se juntan en uno («A or B, then B» en The Long Hunt).
  - Los contratos de Heavy Metal y Urban Warfare no empiezan por `c_`: el extractor los reconoce por su contenido.
- **Pendiente de comprobar en el juego:** Yang Virtanen's Big Score deja elegir la recompensa al final (`fp_reward_a` a `d`). La página da los cuatro 'Mechs de la serie que declara el flashpoint (`hotrod`: Vindicator, Firestarter, Trebuchet y Enforcer); el DLC trae otra serie (`monster`: Catapult, Thunderbolt, Dragon y Kintaro) que ningún dato enlaza con un camino.

