# Especificación: unidades enemigas de BATTLETECH

- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/battletech/units.test.ts`) y por último el código, en commits separados.

## Contexto

La página de unidades enemigas de MW5 (`/mercs/units/`, `docs/specs/unidades-enemigas.md`) reúne los vehículos y las torretas de los contratos con sus armas. BATTLETECH también los tiene: tanques, vehículos de ruedas, transportes de escolta y torretas de defensa. Esta página hace lo mismo para BATTLETECH, con sus reglas: blindaje y estructura por ubicación, ataques por turno y movimiento en metros por turno.

## Datos del juego

| Dato | Origen | Contenido |
|---|---|---|
| Vehículo | `data/vehicle/vehicledef_*.json` y los bundles de Heavy Metal y Urban Warfare | Nombre, etiquetas (clase de peso, no combatiente, `BLACKLISTED`), blindaje asignado por ubicación e inventario |
| Chasis del vehículo | `data/vehicleChassis/` y los mismos bundles | Tonelaje, tipo de movimiento (`Tracked` o `Wheeled`), estructura por ubicación y el `movedef` |
| Movimiento | `data/movement/` y los bundles | `MaxWalkDistance` y `MaxSprintDistance`, en metros |
| Torreta | `data/turrets/` y `data/turretChassis/` | Nombre, etiquetas, blindaje asignado, estructura del chasis e inventario |
| Armas y equipo | `src/data/battletech/items.json` (`generar_mechlab_battletech.py`) | Las mismas armas que el MechLab y la página de equipo, por id |
| Página y dibujo de Sarna | API de Sarna (`imagenes_sarna_battletech.py`) | A partir de una tabla de títulos en `generar_unidades_battletech.py`, porque el juego no los trae |

`extraer_unidades_battletech.py` guarda lo que saca del juego en `tools/datos-juego/battletech/unidades/` y `generar_unidades_battletech.py` crea `src/data/battletech/units.json`.

**Decisiones sobre los datos:**

- **Qué unidades entran:** todas menos las `BLACKLISTED`, que no salen en contratos al azar: los muñecos de prácticas, el camión de munición, los drones de la Liga Estelar y las versiones blindadas del cuartel móvil y del Swift Wind. Quedan 37: 13 de cadenas, 12 de ruedas y 12 torretas.
- **Tipo:** el `movementType` del chasis (`Tracked` o `Wheeled`); las torretas, aparte.
- **Clase de peso:** la etiqueta `unit_light`, `unit_medium`, `unit_heavy` o `unit_assault` de la unidad, que es la que usa el juego para formar las lanzas enemigas. El `weightClass` del chasis no siempre coincide (el Bulldog dice MEDIUM y lleva `unit_heavy`).
- **Blindaje y estructura:**
  - el blindaje es el asignado en la definición (`AssignedArmor`);
  - la estructura es la del chasis, como en los 'Mechs: `InternalStructure` de cada ubicación en los vehículos y `MaxInternalStructure` en las torretas;
  - las torretas tienen una sola ubicación.
- **No combatientes:** los que llevan `unit_noncombatant` (transportes, cuartel móvil y Swift Wind) son objetivos de escolta o de caza; la ficha lo dice.
- **Tonelaje:** el del chasis en los vehículos. El de las torretas (75 o 100) no sale en el juego y no se muestra.
- **Dibujos de Sarna:** las variantes de los DLC comparten el de su chasis (el Scorpion Mk II, el del Scorpion) y el Inferno Carrier usa el SRM Carrier. El Alsvin, el Arvakr y las torretas no tienen página.

## Requisitos funcionales

- **RF1.** Una página propia, `/battletech/units/`, con su carátula en la fila de BATTLETECH de la página de inicio y un enlace en las cabeceras de las demás páginas de BATTLETECH. Usa el mismo color que la página de unidades de MW5.
- **RF2.** La lista se filtra por tipo (All, Tracked, Wheeled, Turret) y por nombre, y se ordena por nombre, daño, blindaje, tonelaje o velocidad. La vista va en la URL.
- **RF3.** Cada unidad tiene una ficha con:
  - nombre, tipo, clase de peso, tonelaje (vehículos), fuente (juego base o DLC) y si es no combatiente;
  - blindaje y estructura totales, y el blindaje y la estructura de cada ubicación;
  - movimiento: andar y correr, en metros por turno (las torretas no se mueven);
  - daño de todas sus armas en un ataque, daño a la estabilidad y daño de calor;
  - sus armas, con cuántas lleva, el daño, la estabilidad y el alcance de cada una;
  - su equipo (ECM, sonda activa, ordenador de batalla…).
- **RF4.** Las armas usan las mismas cifras que el MechLab: el daño de un ataque es el daño por disparo por los disparos (un LRM10 son 10 misiles de 4).
- **RF5.** La ficha enseña el dibujo del chasis de Sarna, con el aspecto de holograma de la página de MW5, y enlaza su página.
- **RF6.** La campana de novedades y el botón de feedback están en la cabecera, como en las demás páginas.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/battletech/units.ts`, con sus tests: armas de una unidad, potencia de fuego, blindaje, filtros, orden y vista en la URL.
- **RNF2.** La página tiene su propio bundle: no carga los 'Mechs del MechLab.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Las unidades | se cargan | son 37: 13 Tracked, 12 Wheeled y 12 Turret; ninguna es `BLACKLISTED` y todas sus armas, munición y equipo están en el catálogo |
| CA2 | El Manticore | se consulta | es Tracked, heavy, de 60 t y del juego base; anda 120 m y corre 200 m; lleva 880 de blindaje (210 delante, 165 a cada lado, 130 detrás y 210 en la torreta) y 60 de estructura (12 por ubicación) |
| CA3 | El Manticore | se calculan sus armas | lleva 1 LRM10, 1 M Laser, 1 PPC y 1 SRM6; el LRM10 hace 40 (10 × 4); la unidad suma 163 de daño y 58 de estabilidad, con 630 m de alcance máximo |
| CA4 | El Heavy Shredder Turret | se calculan sus armas | hace 216 de daño y 40 de calor (los 4 Flamer); es Turret, heavy, con 300 de blindaje en una ubicación y sin movimiento ni tonelaje |
| CA5 | El Swift Wind | se consulta | no tiene armas, no combate y hace 0 de daño |
| CA6 | El Packrat Support Vehicle | se consulta su equipo | lleva el ECM (`Gear_Sensor_Prototype_ECM`); es de Urban Warfare |
| CA7 | La lista | se filtra por Turret / se busca «carrier» | salen las 12 torretas / los 3 Carrier (LRM, SRM e Inferno), sin distinguir mayúsculas |
| CA8 | La lista | se ordena por daño / por velocidad | la primera es el SRM Carrier (480) / el Rotunda Recon Vehicle y el Swift Wind (400 m corriendo, por nombre al empatar), y las torretas van al final |
| CA9 | Las unidades | se consulta su página de Sarna | el Scorpion y el Scorpion Mk II enlazan `Scorpion_(Combat_Vehicle)`; el Inferno Carrier, el SRM Carrier; el Alsvin y las torretas no tienen; todos los dibujos son de `cfw.sarna.net` |
| CA10 | Una vista con tipo, búsqueda y orden | se pasa a la URL y se vuelve a leer | sale la misma vista; la vista por defecto deja la URL limpia |

## Fuera de alcance

- Los 'Mechs enemigos, que están en el MechLab.
- Las lanzas y las facciones que usan cada vehículo: el juego las elige por etiquetas en cada contrato, sin una tabla de rarezas como la de MW5.

## Plan de pruebas

1. **Datos y lógica (CA1 a CA10):** `src/utils/battletech/units.test.ts`, con `units.json` e `items.json` reales.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: la carátula nueva, filtrar por tipo, buscar, ordenar por daño y abrir las fichas del Manticore y de una torreta.
3. **En el juego:** una captura de un vehículo fijado como blanco para comprobar la estructura (la del chasis, 12 por ubicación en el Manticore, y no los 30 que trae su definición).
