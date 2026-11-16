# Especificación: página de armas y equipo de MW5

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/arsenal.test.ts`) y por último los datos, la lógica y la interfaz, en commits separados.

## Contexto

El MechLab enseña las cifras de cada arma cuando se monta, pero no hay un sitio donde ver todas las armas y el equipo de *MechWarrior 5: Mercenaries* juntos, compararlos y ordenarlos. Las cifras cambian con el tier (del 0 al 5, el 5 es Lost Tech), y el juego solo las enseña de una en una en el mercado.

`items.json` ya trae las armas por tier, el equipo y la munición. Faltan algunos datos que el juego sí tiene y que la página necesita.

## Datos del juego

`generar_items.py` añade a `items.json`, desde los mismos archivos de `tools/datos-juego/items/`:

| Dato | De dónde sale | Campo |
|---|---|---|
| Fabricante de cada tier | `Manufacturer` de cada archivo `_LvlN` | `tiers[n].manufacturer` |
| Precio de cada tier | `CBillBaseValueBigInt` por `1 + CBillValuePercentage_Quirk` del tier (−0,5 en el 0, +2,5 en el 5) | `tiers[n].cost` |
| Precio del equipo y la munición | `CBillBaseValueBigInt` | `cost` |
| DLC | `AssociatedDLC` o, si trae varios, el primero de `MultipleAssociatedDLC` (la munición de los rifles: DLC 1 y 6) | `dlc` |
| Descripción del equipo | `Description` | `description` |
| Retrorreactores | `InitialVelocityZ` (empuje), `BurnTime`, `RegenTime` y la clase de 'Mech de la descripción | `jumpJet` |
| ECM | Alcances de los modos disrupt y counter y sus modificadores | `ecm` |
| Sondas activas | Alcance, modificador de sensores y reducción de la distorsión del ECM | `probe` |
| MASC y Supercharger | `BoostAccel`, `BoostTurn` y `DamageParts` de `MASCStats` | `masc` |
| Computadores de puntería | Su rasgo (`EquipmentTrait`, en `tools/datos-juego/traits/`): alcance de sensores, velocidad del proyectil de balísticas y PPC y alcance de los láseres | `targetingComputer` |
| Daño de la munición al explotar | `ExplosionDamagePerRound` | `explosionDamagePerRound` |

**Decisiones sobre los datos:**

- Ningún campo que ya existía cambia: solo se añaden. El MechLab y los enlaces guardados no se enteran.
- Los alcances van en metros, como el resto de `items.json` (el juego los guarda en centímetros).
- La precisión y la letalidad de los computadores de puntería son de la resolución automática de misiones (`UnitCardTrait`): no se guardan.
- Las armas Clan tienen un solo tier, que el juego llama tier Clan; su precio ya lleva el `CBillValuePercentage_Quirk` de su archivo.
- Dos armas cuerpo a cuerpo no traen fabricante en un tier (Claymore en el 1 y Hatchet en el 3): se queda sin él.

## Requisitos funcionales

- **RF1.** Una página propia, `/mercs/equipment/`, con su portada en la página de inicio, en la fila de MW5 junto al MechLab, el mapa, las unidades enemigas y los pilotos.
- **RF2.** Dos pestañas: **Weapons** y **Equipment**.
- **RF3.** La pestaña de armas es una tabla con una fila por arma y estas columnas:
  - el nombre, el fabricante del tier y si es Clan;
  - el anclaje: tipo y tamaño;
  - toneladas;
  - daño por salva, calor por salva, cooldown, disparos por minuto, DPS y daño por tonelada (solo el tonelaje del arma);
  - alcance óptimo y máximo, y velocidad del proyectil;
  - munición por tonelada y salvas por tonelada, en las que usan munición;
  - tecnología, DLC y precio.

  Las armas no ocupan ranuras en Mercenaries (solo necesitan un anclaje de su tipo y tamaño), así que no hay columna de ranuras: la introducción lo dice.
- **RF4.** Un selector de tier para toda la lista (Tier 0 a 4 y Lost Tech). Las armas Clan, con un solo tier, enseñan siempre el suyo.
- **RF5.** Las armas se buscan por nombre o fabricante y se filtran por tipo (energía, balística, misiles, artillería, cuerpo a cuerpo y AMS), tamaño del anclaje, tecnología (Inner Sphere o Clan) y DLC (juego base o un DLC).
- **RF6.** Cada columna con cifras ordena la tabla al pulsar su cabecera; otra pulsación invierte el orden. Las cifras empiezan de mayor a menor y el nombre de la A a la Z. Las armas sin el dato van al final.
- **RF7.** La pestaña de equipo tiene fichas por categoría, con el tonelaje, las ranuras, el precio, la tecnología, el DLC y los efectos:
  - **Heat sinks:** refrigeración y capacidad de calor;
  - **Jump jets:** empuje, tiempo de combustión, recarga y la clase de 'Mech que los monta;
  - **Motive upgrades** (MASC y Supercharger): velocidad, aceleración, giro y qué piezas daña;
  - **Electronics:** ECM (alcances y modificadores) y sondas activas;
  - **Targeting computers:** alcance de sensores, velocidad del proyectil y alcance de los láseres;
  - **Ammo:** una tabla con las toneladas, ranuras, cargas, daño al explotar por carga, precio y las armas que la usan.

  Se filtran por categoría, búsqueda, tecnología y DLC.
- **RF8.** La pestaña, los filtros, el tier y el orden van en la URL.
- **RF9.** El MechLab, el mapa, las unidades enemigas y los pilotos enlazan la página nueva.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/arsenal.ts`, con sus tests: filas de armas por tier, munición por tonelada, filtros, orden, categorías y efectos del equipo, munición y vista en la URL.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF3.** La página tiene su propio bundle y funciona a 390 × 844 sin desbordar la página (la tabla se desplaza dentro de su caja).

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El catálogo | se cargan las armas | son 191: 37 de energía, 60 balísticas, 66 de misiles, 2 de artillería, 24 cuerpo a cuerpo y 2 AMS; 60 son Clan |
| CA2 | El Medium Laser | se ve en tier 1 / Lost Tech | tier 1: 5 de daño, 2,25 de calor, 4 s de cooldown, 15 disparos por minuto, 1,25 de DPS, 5 de daño por tonelada, 270 y 405 m, Magna Mk.II, 80.000 C-Bills. Lost Tech: 6,5 de daño, Krupp, 280.000 C-Bills |
| CA3 | El Autocannon/10 | se ve en tier 1 | 12 t, anclaje balístico mediano, 10 de daño, 600 m/s, 40 cargas y 40 salvas por tonelada, 400.000 C-Bills |
| CA4 | El LRM 10 | se ve en tier 1 | 12 de daño por salva (10 misiles de 1,2), 440 cargas y 44 salvas por tonelada |
| CA5 | El Clan ER Medium Laser | se pide en tier 3 | enseña su único tier (Clan): 9,1 de daño, Strana Mechty MechWorks, 560.000 C-Bills |
| CA6 | Las armas | se filtran por energía / tamaño grande / Clan / DLC 3 / búsqueda «gauss» / búsqueda «krupp» en Lost Tech | salen 37 / 56 / 60 / 17 / las 4 Gauss / Large Laser y Medium Laser |
| CA7 | Las armas en tier 1 | se ordenan por DPS / daño por tonelada / nombre / munición por tonelada | la primera es Clan Heavy Machine Gun (40 de DPS) / Light Knuckles (30) / AMS, Arrow IV y Assault Arena Fist. Al pulsar otra vez DPS, la última es Clan Heavy Machine Gun. Las armas sin munición van al final en los dos sentidos |
| CA8 | El equipo | se agrupa por categorías | 3 heat sinks, 5 jump jets, 20 motive upgrades, 8 electronics (4 ECM y 4 sondas), 7 targeting computers y 108 municiones |
| CA9 | Los efectos | se piden | Single Heat Sink: +0,1 de refrigeración y +1 de capacidad. Jump Jets Class III: 12,5 m/s, 2,75 s, 8 s y 'Mechs de 60 a 75 t. MASC MK II: +50 % de velocidad, ×4 de aceleración, +45 % de giro y daña las piernas. Guardian ECM: 220 y 400 m. Beagle Active Probe: 450 m y +25 % de sensores. Targeting Computer Mk7: +22 % de sensores, +35 % de velocidad del proyectil y +10 % de alcance de los láseres |
| CA10 | La munición del AC/10 | se consulta | 1 t, 1 ranura, 40 cargas, 10 de daño por carga al explotar, 12.000 C-Bills, la usan Autocannon/10, Autocannon/10 rapid-fire y Autocannon/10 Burst Fire |
| CA11 | La vista | se guarda en la URL y se lee | conserva la pestaña (Weapons si no hay ninguna), la búsqueda, el tipo, el tamaño, la tecnología, el DLC, el tier (1 si no hay), el orden y su sentido, y la categoría del equipo; ignora lo que no conoce |

## Fuera de alcance

- Las mejoras de la cantina y los quirks de los 'Mechs: la tabla enseña las cifras del arma sola.
- El calor de los retrorreactores: el juego lo guarda en una curva que el exportador no trae.
- Los iconos de las armas: son texturas del juego.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA11):** `src/utils/arsenal.test.ts`, con `items.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: la tabla de armas con filtros y orden, el selector de tier y las fichas de equipo; la portada con la carátula nueva.
