# Especificación: campañas de los DLC en el mapa estelar

- **Issue:** [#96](https://github.com/PonchoiDev/mechlab-web/issues/96)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/campaigns.test.ts`) y por último el código, en commits separados.

## Contexto

Varios DLC traen una campaña: una historia de misiones en orden que se juega dentro del modo carrera, de sistema en sistema. El mapa estelar solo enseña los 'Mechs que regalan algunas de sus misiones (`rewards`), pero no dónde empieza cada campaña, cuándo, por dónde pasa ni qué paga cada misión.

Las misiones de alta recompensa (`docs/specs/misiones-hrq.md`) ya resuelven algo parecido: cadena, sistemas en orden, ruta numerada y ficha. Las campañas se presentan igual, con su propio panel y su propio color.

## Datos del juego

| Dato | Asset | Contenido |
|---|---|---|
| Nombre | `DLCn_Header` (`Lancers_Header` en el DLC2) | `HeaderText`: «Shadow of Kerensky», «LEGEND OF THE KESTREL LANCERS» |
| Partes | `DLCn/CampaignData/*` con un script (`LinearCampaignArcScript` o `DLC2_Prologue_Script`) | `Act Variables`: nombre de la parte (`Pt.1`, `Prologue`), sistema al que se viaja (`TravelStarSystemId`) y desde cuándo se ofrece (`StartingOfferTriggerConditions.Date`). `Missions`: cada misión con su acción `Place`, su objetivo y su escenario |
| Qué partes se juegan | `DLCn_CoreCampaign` | `SubCampaigns`, en árbol |
| Misión | Acción `…_Place_Mission` y su objetivo | Sistema (`StarSystemId`), título, resumen y quién la encarga |
| Pago | Escenario de la misión (`MissionScenario`) | `BaseReward`: C-Bills, reputación, pilotos hero, armas y equipo |
| 'Mechs | `recompensas_campana.json`, que ya existía | Los 'Mechs de cada misión (por su título) y los de completar la campaña |

`extraer_mapa.py` guarda las partes en `tools/datos-juego/starmap/campanas.json` y los nombres en `nombres_campanas.json`. `generar_mapa.py` las une en `campaigns` dentro de `starmap.json`.

**Decisiones sobre los datos:**

- **Campañas:** las de los DLC 2, 4, 5, 6, 7 y 9. La del DLC3 (Hatchetman) y las del DLC8 (Quest_*) son cadenas de misiones que el mapa ya enseña como HRQ.
- **Partes que cuentan:** solo las que cuelgan del arco principal por `SubCampaigns`. El prólogo del DLC4 (`DLC4_Pt1_Prologue`, «[*] Operation ASEIR») está en los archivos, pero ningún arco lo usa: la campaña del DLC4 empieza en Kirchbach.
- **Orden de las misiones:** el número del nombre de cada misión en su parte (`D7M7`, `D5_M0`). Las partes no sirven para ordenar: la del DLC7 `Pt1.2` (Last Frontier) es una rama de la `Pt.3`, y en el DLC5 la primera misión es la `D5M14` de Dieron, que la parte llama `D5_M0`.
- **Inicio:** el sistema de la primera parte (la de nombre más bajo: `Prologue`, `Pt.0`) y su fecha si la comprueba (`bCheck`). Si no la comprueba, la del arco principal: el DLC9 empieza en Tharkad, sin misión allí, el 1 de abril de 3058. Las fechas de las demás partes no cuentan: se abren al acabar la anterior.
- **Nombre:** el de la cabecera. Las que están en mayúsculas se escriben como título («Legend of the Kestrel Lancers»).
- **Títulos de las misiones:** «pt.2» se escribe «Pt.2», como en el resto.
- **Pago:** el del escenario, que es el pago base del contrato.
- **'Mechs:** los de `rewards` de una misión del mismo DLC con el mismo título. Los de completar la campaña (`campaignComplete`) van aparte. `rewards` no cambia: la ficha de cada 'Mech sigue diciendo dónde se consigue.
- **Pilotos:** su nombre sale de `tools/datos-juego/pilotos/hero.json`, de `extraer_pilotos.py`.
- **Pilotos de las HRQ:** la campaña del DLC8 son cadenas de HRQ, y la de Adam Steiner da a Valten Ryder al completarla (`PilotRewards` del objetivo A New March). La recompensa de cada HRQ lleva también sus pilotos hero, para que se vean como los de las campañas.

## Requisitos funcionales

- **RF1.** El mapa marca con una bandera el sistema donde empieza cada campaña, atenuada si en la fecha del mapa aún no se ofrece.
- **RF2.** Un panel **Campaigns**, junto al de Quests, lista las campañas con su DLC, su sistema de inicio y su fecha, y permite buscarlas por nombre, por sistema, por misión, por quien la encarga o por recompensa. Al elegir una, el mapa encuadra su recorrido.
- **RF3.** Con una campaña elegida, el mapa une con una línea discontinua de su color el sistema de inicio y los de sus misiones, en orden y numerados, como la ruta de una HRQ.
- **RF4.** La ficha de la campaña muestra su nombre, su DLC, dónde y desde cuándo empieza y la lista de misiones. Cada misión tiene:
  - su título, su resumen y quién la encarga;
  - su sistema, que centra el mapa en él;
  - su pago (C-Bills y reputación) y sus recompensas: 'Mechs enlazados al MechLab, pilotos hero enlazados a la página de pilotos, armas y equipo.

  Al final, lo que da completar la campaña.
- **RF5.** La ficha de cada sistema indica las campañas que empiezan o pasan por él, y permite abrirlas.
- **RF6.** La campaña elegida se guarda en la URL (`?campaign=dlc7`).
- **RF7.** La ficha de una HRQ enseña los pilotos hero que da, enlazados a la página de pilotos.

## Requisitos no funcionales

- **RNF1.** La lógica (búsqueda, campañas de un sistema, ruta, disponibilidad y URL) es pura y está en `src/utils/campaigns.ts`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** El color de las campañas no se confunde con los que ya usa el mapa (HRQ, mercados, arenas, academias, 'Mechs únicos, mercenarios).

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las campañas | se cargan | son 6, de los DLC 2, 4, 5, 6, 7 y 9: Legend of the Kestrel Lancers (14 misiones), Rise of Rasalhague (12), The Dragon's Gambit (15), Solaris Showdown (7), Shadow of Kerensky (12) y Ashes & Ascension (18). Ningún título de misión está vacío ni lleva «[*]» ni «pt.» en minúscula |
| CA2 | Shadow of Kerensky | se consulta | empieza en Alleghe el 15 de septiembre de 3049. Sus misiones van de Hunting Party (Alleghe) a Loose Ends (HD-438297), con Out of The Fire (Last Frontier) en el séptimo lugar. Leading the Charge da a Morgan Trensky, Smoke and Mirrors a Sam Hagel y Battle at New Starburg el HBR-A |
| CA3 | The Dragon's Gambit | se consulta | empieza en Dieron el 1 de julio de 3038 con Rat Infested Shores, y acaba en Trolloc Prime con Checkmate, que da el HTM-26T-S y paga 7.575.000 C-Bills y 2.500 de reputación |
| CA4 | Rise of Rasalhague | se consulta | empieza en Kirchbach el 1 de enero de 3031 con False Promises; no tiene Operation ASEIR |
| CA5 | Ashes & Ascension | se pide su ruta | es Tharkad, Matamoras, Jeanette, Hanover, Bangor y Albiero, sin repetir un sistema seguido; completarla da Promises Kept con el SNV-BR y el HBK-IIC-DW |
| CA6 | La búsqueda | se busca «kerensky», «sarna», «morgan» y «SOLARIS» | salen Shadow of Kerensky, Legend of the Kestrel Lancers, Shadow of Kerensky (por el piloto) y Solaris Showdown |
| CA7 | Un sistema | se consultan sus campañas | en Galatea empieza Solaris Showdown; por Rodigo pasa Shadow of Kerensky |
| CA8 | Shadow of Kerensky | se consulta su disponibilidad | el 1 de enero de 3049 aún no se ofrece (hasta el 15 de septiembre de 3049); en 3050 sí |
| CA9 | La URL | se abre con `?campaign=dlc7` o se construye | elige Shadow of Kerensky; con un id que no existe, ninguna; y la vista con una campaña elegida lleva `campaign=dlc7` |
| CA10 | La HRQ de Adam Steiner (DLC8) | se consulta su recompensa | da a Valten Ryder |

## Fuera de alcance

- Las condiciones de cada parte (misiones que hay que completar, avisos y plazos de la oferta).
- Los mercados de cada campaña, que el mapa ya enseña como mercados especiales.
- La misión del Bounty Hunter (Head Hunting) y los niveles de información del DLC4, que no son de la campaña.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/campaigns.test.ts`, con `starmap.json` real.
2. **Datos que ya existían:** `extraer_mapa.py` saca el resto de archivos idénticos.
3. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - las banderas;
   - el panel Campaigns con la búsqueda;
   - la ruta numerada de una campaña y su ficha con las recompensas;
   - las campañas en la ficha de un sistema;
   - una campaña abierta desde la URL.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 6 campañas con 78 misiones en total. `extraer_mapa.py` saca el resto de archivos idénticos; solo añade `campanas.json` y `nombres_campanas.json`. La lectura de los objetivos pasa a `leer_objetivo`, compartida con las HRQ.
- **Tests:** los diez criterios (CA1 a CA10) están en `src/utils/campaigns.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1920 × 1080, 1440 × 900, 1280 × 800, 390 × 844 y 360 × 740:
  - las banderas;
  - el panel Campaigns con la búsqueda («morgan» da Shadow of Kerensky);
  - la ruta numerada de Shadow of Kerensky y de Ashes & Ascension, con su ficha;
  - las campañas en la ficha de Rodigo;
  - una campaña abierta desde la URL.
- **Decisiones durante el desarrollo:**
  - **Cajones:** con el de Campaigns son ocho, y a 1440 px ya no cabían junto al panel de fecha. En pantallas medianas los botones se ciñen a su texto y, si aun así no caben, suben a una segunda fila por encima en vez de meterse debajo del panel. En el móvil, «Special markets» y «Special 'Mech locations» se acortan a «Markets» y «'Mech locations» para seguir en tres filas.
  - **Mismas clases que las HRQ:** la ficha usa las de la ficha de una HRQ con el color de las campañas. La regla de las misiones numeradas se limita a sus hijos directos, porque también alcanzaba las listas de recompensas de dentro.
