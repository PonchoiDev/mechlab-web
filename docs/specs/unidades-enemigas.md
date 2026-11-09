# Especificación: unidades enemigas

- **Issue:** [#81](https://github.com/PonchoiDev/mechlab-web/issues/81)
- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/units.test.ts`) y por último el código, en commits separados.

## Contexto

La web solo cubre 'Mechs, pero en los contratos también hay tanques, aerodeslizadores, VTOL, torretas y armaduras de combate. El juego no enseña sus estadísticas en ningún sitio: solo se ven al fijarlas como blanco. Esta página las reúne, con sus armas, para saber a qué se enfrenta uno.

## Datos del juego

| Dato | Origen | Contenido |
|---|---|---|
| Ficha de la unidad | Unit cards exportadas (`tools/datos-juego/unitcard/`) | Nombre, tipo (`UnitType`), rol (`CombatRole`), tier, `BattleValue`, fecha de introducción, rareza por facción y el blueprint de la unidad (`UnitClass`) |
| Vida, velocidad y armas | Blueprints del `.pak` (`extraer_unidades.py`) | `MaxHitPoints` del `SimpleLivingActorComponent`, `MoveStats.MaxSpeed` del componente de movimiento y las armas (`WeaponDataAsset`) de la unidad y de las torretas que lleva montadas |
| Estadísticas de las armas | `items.json` o el arma del `.pak` | Las que se pueden montar en un 'Mech salen de `items.json`; las de vehículos (AC/5 del Scorpion, LRM 10 de los Carrier…) y las de los Elementals, de su propio `StatsData` |
| Página y dibujo de Sarna | API de Sarna (`imagenes_sarna.py`) | La página de cada chasis y su dibujo principal, a partir de una tabla de títulos en `generar_unidades.py`, porque el juego no los trae |
| Nombres de facción | Assets de facción del `.pak` | Con los de las compañías de mercenarios y los patrocinadores de las arenas, que salen de sus StringTables |

`extraer_unidades.py` guarda lo que saca del `.pak` en `tools/datos-juego/unidades/` y `generar_unidades.py` lo une a las unit cards en `src/data/units.json`.

**Cómo se montan las armas:**

- **Herencia:** un blueprint hereda de su padre (el Scorpion (ML) del Scorpion, y este de `Tank`); un componente del hijo sustituye al del padre con el mismo nombre.
- **Torretas:** los tanques guardan la torreta en `TurretBlueprint` o `Turret`, y los VTOL en `PointDefenseClass`. Las torretas montan sus cañones como `ChildActorComponent`, a los que el script de construcción da la clase con `SetChildActorClass`: esa llamada solo está en el bytecode, así que se lee de ahí.
- **Componentes de blueprint propio:** un componente de arma de blueprint propio, como el `WeaponComponent_PPC_Manticore` del Schrek, trae el arma en su objeto por defecto.
- **Torreta cambiada en el script:** si el script de construcción pone otra clase en `TurretActor`, esa sustituye a la torreta de la propiedad. Es el caso del Condor (Davion): lleva solo los dos AC/2 de su torreta, y su BattleValue (444, menos que los 485 del Condor) lo confirma.

**Decisiones sobre los datos:**

- **Qué unit cards entran:** solo las `*_UnitCard`. Las `_Recruit_` son copias de las normales con una IA menos agresiva para las primeras misiones, y las torretas de las naves de descenso no salen en los contratos. Quedan 115 unidades.
- **Tipos:**
  - **Tracked, Hover y Wheeled:** según su etiqueta `UnitType.Vehicle.*`.
  - **VTOL:** según `UnitType.VTOL`.
  - **Turret:** según `UnitType.Turret`.
  - **Battle armor:** las armaduras de combate (Battle Armor y Clan Elemental) solo dicen `UnitType.Vehicle`. Se reconocen porque son un grupo que crea un traje por cada punto de aparición: 4 la Battle Armor y 5 los Elementals. La vida y las armas son las de cada traje.
- **Vida:** la del blueprint, como base. El juego la escala con la dificultad del contrato, así que la página lo avisa.
- **Velocidad:**
  - Se pasa de cm/s a km/h.
  - Los VTOL se mueven por física (empuje y masa), sin velocidad máxima.
  - Varios tanques (Demolisher, los Carrier) usan la del código del juego, que no está en el `.pak`.
  - En todos esos casos no se muestra.
- **Armas:**
  - Las de los niveles (`SRM2_Lvl0`) son las de `items.json` en ese tier.
  - Las demás aplican sus quirks como `generar_items.py`: el AC/20 del Demolisher tiene un cooldown un 100 % mayor.
  - El Arrow IV hace su daño con la explosión, que es la cifra que enseña el juego.
- **Nombre:** la unit card de la Battle Armor no trae nombre; vale el que enseña el juego al fijar el blanco (`TargetName`).

## Requisitos funcionales

- **RF1.** Una página propia, `/mercs/units/`, con su portada en la página de inicio junto al MechLab y el mapa estelar.
- **RF2.** La lista de unidades se filtra por tipo (All, Tracked, Hover, Wheeled, VTOL, Turret, Battle armor) y por nombre, y se ordena por nombre, Battle Value, DPS, vida o año de introducción.
- **RF3.** Cada unidad tiene una ficha con:
  - nombre, tipo, rol, tier, Battle Value y año de introducción;
  - vida base (por traje en las armaduras, con el tamaño del grupo) y velocidad;
  - daño por salva y DPS de todas sus armas;
  - sus armas, con cuántas lleva, el daño, el DPS y el alcance de cada una.
- **RF4.** La ficha dice con qué frecuencia la usa cada facción, agrupada por rareza y sin las que no la usan (`Unavailable`).
- **RF5.** La vida lleva una nota: es la base y el juego la escala con la dificultad del contrato.
- **RF6.** La campana de novedades está en la cabecera, como en el MechLab y el mapa.
- **RF7.** La ficha enseña el dibujo del chasis de Sarna, con el aspecto de holograma de la portada, y enlaza su página. Las variantes comparten el dibujo de su chasis; las unidades sin página (las torretas, el Convoy y el Arrow IV Carrier) no llevan ni dibujo ni enlace, y las que tienen página sin dibujo (Igor y Riverjack) solo llevan el enlace.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/units.ts`, con sus tests: armas de una unidad con sus estadísticas, potencia de fuego, filtros, orden y rareza agrupada.
- **RNF2.** El daño y el DPS de cada arma se calculan con la misma función que el MechLab (`getWeaponStats`).
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.
- **RNF4.** La página tiene su propio bundle: no carga los datos del MechLab ni del mapa.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las unidades | se cargan | son 115: 43 Tracked, 15 Hover, 8 Wheeled, 12 VTOL, 35 Turret y 2 Battle armor; ninguna es `_Recruit_`, todas tienen armas y todas sus armas están en el catálogo |
| CA2 | El Condor | se consulta | es Hover, Striker, tier 1, Battle Value 485, de 2564, con 30 de vida base y 126 km/h; lleva 1 Machine Gun, 1 Autocannon/5 Burst Fire y 2 Medium Laser |
| CA3 | El Condor (Davion) | se consultan sus armas | son 1 Machine Gun y 2 Autocannon/2 Burst Fire, sin las de la torreta del Condor |
| CA4 | La Heavy Turret 4 x AC/5 | se calculan sus armas | son 4 Autocannon/5 de 5 de daño y 2,5 de DPS cada uno, con 620 m de alcance; la unidad suma 20 de daño por salva y 10 de DPS |
| CA5 | El Demolisher Heavy Tank | se calculan sus armas | lleva 2 Autocannon/20 de 20 de daño con 9,6 s de cooldown (el quirk del 100 %) |
| CA6 | La Turret 2 x SRM2 | se calculan sus armas | sus SRM 2 son los del tier 0 de `items.json`, con el mismo daño y DPS que en el MechLab |
| CA7 | Los Clan Elemental y la Battle Armor | se consultan | son Battle armor; los Elementals van en grupos de 5 con 20 de vida por traje y llevan Clan SRM 2, Clan ER Medium Laser y Clan ER Small Laser; la Battle Armor va en grupos de 4 con un Small Laser y sin vida conocida |
| CA8 | La lista | se filtra por VTOL / se busca «scorpion» | salen las 12 VTOL / los 8 Scorpion, sin distinguir mayúsculas |
| CA9 | La lista | se ordena por DPS | la primera es la de más DPS y las unidades sin dato de un campo (vida, velocidad) van al final al ordenar por él |
| CA10 | El Demolisher Heavy Tank (Gauss) | se agrupa su rareza | salen tres grupos ordenados de más común a más rara: Common (2 facciones), Uncommon (23) y Very rare (3), con los nombres de las facciones sin repetir |
| CA11 | Los VTOL y las torretas | se consultan | no tienen velocidad |
| CA12 | Las unidades | se consulta su página de Sarna | todos los Scorpion enlazan `Scorpion_(Combat_Vehicle)` con su dibujo; el MRM30 Carrier enlaza el LRM Carrier; el Igor tiene página sin dibujo; ninguna torreta tiene página; todos los dibujos son de `cfw.sarna.net` |

## Fuera de alcance

- La dificultad mínima del contrato a partir de la que aparece cada unidad (`IntroDifficulty`), hasta comprobar en el juego cómo se corresponde con la dificultad que enseña.
- La vida escalada a cada dificultad, porque la fórmula no está en los datos.
- Los 'Mechs enemigos, que ya están en el MechLab.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA11):** `src/utils/units.test.ts`, con `units.json` real.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844:
   - la portada nueva en la página de inicio;
   - filtrar por tipo y buscar por nombre;
   - ordenar por DPS;
   - abrir la ficha de un Condor y la de los Elementals;
   - la campana de novedades.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después los datos, la lógica y la interfaz, en commits separados.
- **Dibujos:** 24 páginas de Sarna, 22 con dibujo: 78 unidades enlazan su página y 69 enseñan el dibujo.
- **Datos:** 115 unidades (43 Tracked, 15 Hover, 8 Wheeled, 12 VTOL, 35 Turret y 2 Battle armor) con 80 armas, 16 de ellas propias de vehículos o de los Elementals. `units.json` pesa 160 KB (13 KB comprimido en el bundle de la página).
- **Tests:** los once criterios (CA1 a CA11) están en `src/utils/units.test.ts` y pasan, con dos más de la vista en la URL.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844: la portada nueva, los filtros por tipo y la búsqueda, el orden por DPS, la rareza desplegada, la campana de novedades y los enlaces nuevos de las cabeceras del MechLab y del mapa.
- **Decisiones durante el desarrollo:**
  - Con tres carátulas, el hueco de los próximos juegos quedaba solo en otra fila: ahora es una franja a lo ancho debajo de ellas.
  - En el móvil, el segundo enlace partía en tres líneas el título del MechLab: los enlaces van uno debajo de otro.
  - La vista (tipo, búsqueda y orden) va en la URL, para compartir una lista.
- **Pendiente de comprobar en el juego:** el MechLab trata el daño de las ametralladoras y los lanzallamas (`DamageOverDuration`, con `RateOfFire`) como daño por disparo, lo que les da un DPS muy alto también aquí. Hace falta una captura del juego antes de cambiar el cálculo, que es el mismo en las dos páginas.
