# Especificación: recompensas de las misiones de alta recompensa

- **Issue:** [#70](https://github.com/PonchoiDev/mechlab-web/issues/70)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/quests.test.ts`) y por último el código, en commits separados.

## Contexto

Cada HRQ ([misiones-hrq.md](misiones-hrq.md)) tiene su recompensa: C-Bills, reputación y, en muchas, 'Mechs, armas y equipo. Es lo que decide si compensa hacerla, y en las de Heroes of the Inner Sphere el premio es un 'Mech hero.

## Datos del juego

El objetivo de cada misión (`*_Prompt`, el mismo del que salen su título y su resumen) trae en `DisplayInfo`:

| Campo | Contenido |
|---|---|
| `bHasRewards` | La misión paga al completarse |
| `ObjectiveReward.CBills` | C-Bills |
| `ObjectiveReward.ReputationIncrease` | Reputación ganada |
| `ObjectiveReward.ItemRewards` | 'Mechs (`MechLoadouts`), armas y equipo, con su cantidad |
| `RewardBriefing` | Texto de agradecimiento al terminar |

`extraer_mapa.py` guarda los objetivos que pagan de las carpetas de las HRQ en `tools/datos-juego/starmap/recompensas_misiones.json`, y `generar_mapa.py` suma los de cada cadena en `starmap.json`, con los nombres de `mechs.json` e `items.json`.

**Decisiones sobre los datos:**

- **Qué cuenta:** solo los objetivos con `bHasRewards`. Algunos sin esa marca traen una recompensa copiada de otro (la primera parte de Tributes for the Imperator repite la de la tercera) que el juego no entrega.
- **Todos los objetivos de la carpeta:** no solo los de las acciones con sistema, porque el pago final suele estar en un objetivo que activa el arco (A New March, de Adam Steiner, con 30 millones y un Bushwacker). Los de título entre corchetes (`[*] Campaign Complete`) son marcadores internos y no cuentan.
- **Suma por cadena:** C-Bills y reputación de todos los objetivos que pagan, y la lista de 'Mechs, armas y equipo, con las cantidades sumadas. Si dos comparten título, son desenlaces alternativos (Armed Robbery en carrera tiene dos iguales) y cuenta uno.
- **Campaña y carrera:** pagan distinto (Shipping Disruption da unos 300.000 C-Bills en campaña y 2,1 millones en carrera), así que cada modo conserva su recompensa.
- **'Mechs:** el loadout de la recompensa lleva prefijos y sufijos en cualquier orden (`11_2_Reward_FS9-A`, `COR-PVT_CareerSalvage`, `RFL-DNA_Loadout_CareerSalvage`); la variante es la parte central.
- **Armas:** con su tier, como en los mercados especiales.
- **Texto final:** el `RewardBriefing` de la última misión que paga.

## Requisitos funcionales

- **RF1.** Cada HRQ lleva su recompensa por modo (o una sola en las de los DLC): C-Bills, reputación, 'Mechs, armas con su tier, equipo y el texto final.
- **RF2.** La ficha de la HRQ muestra un bloque **Rewards** con los C-Bills, la reputación, los 'Mechs enlazados al MechLab con su build de serie, las armas y el equipo, y el texto final desplegable. Si los modos pagan distinto, cada uno con la suya.
- **RF3.** El buscador de HRQ también encuentra por 'Mech, arma o equipo de la recompensa.

## Requisitos no funcionales

- **RNF1.** La búsqueda es pura y está en `src/utils/quests.ts`, con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Bow and Arrow | se consulta su recompensa | da 304.825 C-Bills, 2.500 de reputación y el Archer ARC-AGC |
| CA2 | Pirate Hunt | se consulta su recompensa | en campaña da 3.202.500 C-Bills, 4.500 de reputación y un Gauss Rifle; en carrera, 705.300 C-Bills, 220 de reputación y un Large Laser Tier 3 |
| CA3 | Tributes for the Imperator | se consulta su recompensa | da 1.104.825 C-Bills y el Warhammer WHM-6R una sola vez, aunque la primera parte repite esa recompensa sin `bHasRewards` |
| CA4 | Those in Need | se consulta su recompensa | suma las de sus partes: el Hatchetman HCT-3F y el Assassin ASN-25 |
| CA5 | Las recompensas | se consultan sus 'Mechs | todos tienen nombre y variante del MechLab |
| CA6 | La búsqueda «gauss» y «ARC-AGC» | se busca | la primera incluye Pirate Hunt y la segunda da Bow and Arrow |

## Fuera de alcance

- Las recompensas de cada contrato de las misiones (pagos por objetivo y salvamento), que dependen de la negociación.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA6):** `src/utils/quests.test.ts`, con `starmap.json` real.
2. **Interfaz:** en el navegador, la ficha de Bow and Arrow, de Pirate Hunt (dos modos) y de Those in Need, y el enlace del 'Mech al MechLab.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Datos:** 113 objetivos que pagan, sumados en las 64 HRQ: todas tienen recompensa, 27 dan algún 'Mech y 38 pagan distinto en campaña y en carrera.
- **Tests:** los seis criterios (CA1 a CA6) están en `src/utils/quests.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador con Bow and Arrow (Archer ARC-AGC), Pirate Hunt (dos modos), Those in Need (solo 'Mechs y armas, sin C-Bills) y Adam Steiner (40 millones y el Bushwacker BSW-HR); la búsqueda «gauss» da Blood Minerals, Errant Signal y Pirate Hunt.
- **Decisiones durante el desarrollo:**
  - Leer las recompensas desde las acciones con sistema dejaba fuera el pago final de varias HRQ (cinco se quedaban sin recompensa y Adam Steiner sin sus 30 millones): se recorren todos los objetivos de la carpeta.
  - Si una HRQ no paga C-Bills ni reputación (Those in Need), la ficha no muestra esa línea.
