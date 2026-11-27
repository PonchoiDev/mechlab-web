# Especificación: quirks con su color en el MechLab de YAML

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/colors.test.ts`) y por último los datos y el código, en commits separados.

## Contexto

El mechlab de YAML enseña los quirks del 'Mech como una pila de etiquetas, cada una con su color: Command 'Mech en azul, Improved Targeting en naranja, Difficult To Maintain en rojo, Star League Relic en dorado... El MechLab de la web los enseña bajo el nombre del 'Mech como chips grises, todos iguales, en una fila.

Los 'Mechs de MW5 sin mods no tienen quirks, así que el MechLab de MW5 no cambia.

## Datos del juego

- **Color:** cada quirk de `Resources/quirks.json` de YAML trae `color`, un `FLinearColor` en texto: `(R=1,G=0.4,B=0,A=1)`. Es un color lineal, y el juego lo enseña en sRGB, como los de las ranuras (`color_hex` de `generar_yaml.py`): Star League Relic, `(1, 0.4, 0)`, sale `#ffaa00`.
- **Textos mal escritos:** algunos traen un paréntesis de más (Battle Computer, `A=1))`) o un número con dos puntos (Illegal Design, `B=0.250000.0`). Se lee el número hasta el segundo punto, como hace la conversión de texto de Unreal.
- **Sin color:** Extended Torso Twist y los tres Improved Targeting (Short, Medium y Long) no traen `color`.

## Requisitos funcionales

- **RF1.** `generar_yaml.py` guarda en `src/data/yaml/quirks.json` el color de cada quirk en sRGB («#rrggbb»), si lo trae.
- **RF2.** Un quirk sin color usa el color general del mechlab (`colors.json`, `general`).
- **RF3.** El tablero de YAML enseña los quirks bajo el nombre del 'Mech, uno debajo de otro y en el orden del 'Mech. Cada uno es una caja con el borde de su color y el fondo de ese color al 20 % («Equipment Tint Opacity», como las piezas). La descripción sigue en el título.
- **RF4.** En el tablero compacto, los quirks siguen ocultos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Star League Relic (`SLDF`) y Command 'Mech (`CMD-MECH`) | se pide su color | `#ffaa00` y `#00a2ff` |
| CA2 | Battle Computer (`BATTLECOMP`), con el paréntesis de más | se pide su color | el mismo que Command 'Mech |
| CA3 | Los dos Difficult To Maintain (`DIFFICULTTOMAINTAIN` y `NSR-DIFFICULTTOMAINTAIN`) | se pide su color | cada uno el suyo: `#ff00aa` y `#ffbc00` |
| CA4 | Extended Torso Twist, sin color | se pide su color | el general del mechlab |
| CA5 | Todos los quirks de las variantes | se pide su color | todos tienen uno con el formato «#rrggbb» |

## Pendiente de comprobar en el juego

- El color con el que el juego enseña los cuatro quirks sin `color`.
