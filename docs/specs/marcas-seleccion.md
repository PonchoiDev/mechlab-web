# Especificación: marca de lo elegido en el mapa estelar

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/marks.test.ts`) y por último el código, en commits separados.

## Contexto

Al elegir una academia, el mapa encuadra su sistema y lo marca con un aro azul, esquinas de mira y el nombre del sistema encima (`docs/specs/academias.md`). Así se encuentra aunque haya muchas estrellas alrededor. El resto de selecciones no lo tienen:

- el sistema buscado o pulsado solo lleva un rombo amarillo;
- una HRQ o una campaña dibujan su ruta, pero no destacan dónde se ofrece o dónde empieza;
- Find a 'Mech encuadra dónde se consigue la variante sin marcarlo.

## Requisitos funcionales

- **RF1.** Cada selección marca su sistema con el aro, las esquinas de mira y el nombre, en el color de su panel:

  | Selección | Sistema marcado | Color |
  |---|---|---|
  | Sistema buscado o pulsado | El sistema | Amarillo (`#ffd400`), el del rombo que sustituye |
  | Academia | Su sistema | Azul (`#2f8cff`) |
  | HRQ | Donde se ofrece | Ámbar (`#f2b75e`) |
  | Campaña | Donde empieza | Magenta (`#ff66cc`) |
  | Variante de Find a 'Mech o de los 'Mechs especiales | La misión o la oferta de la HRQ donde se consigue | Cian (`#8be3ff`) |

- **RF2.** Si dos selecciones caen en el mismo sistema, se marca una sola vez, con el color de la que va antes en la tabla: el sistema elegido manda.
- **RF3.** El sistema por el que pasa el ratón sigue con su aro blanco, sin marca.

## Requisitos no funcionales

- **RNF1.** Qué sistemas se marcan y con qué tipo de marca es lógica pura (`src/utils/marks.ts`), con sus tests. El renderer solo pinta cada tipo en su color.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Nada elegido | se calculan las marcas | no hay ninguna |
| CA2 | Un sistema elegido y una HRQ que se ofrece en otro | se calculan las marcas | dos: el sistema (`system`) y la oferta de la HRQ (`quest`), en ese orden |
| CA3 | Un sistema elegido que es también donde se ofrece la HRQ | se calculan las marcas | una sola, del sistema |
| CA4 | Una academia, una campaña y el sistema de una variante | se calculan las marcas | una por cada una (`academy`, `campaign`, `mech`), en el orden de la tabla |

## Plan de pruebas

1. **Lógica (CA1 a CA4):** `src/utils/marks.test.ts`.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: un sistema buscado, una academia, una HRQ, una campaña, una variante de Find a 'Mech y un sistema elegido con una HRQ abierta.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después el código, en commits separados.
- **Tests:** los cuatro criterios (CA1 a CA4) están en `src/utils/marks.test.ts` y pasan.
- **Interfaz:** comprobada en el navegador a 1440 × 900 y a 390 × 844:
  - New Avalon buscado (amarillo);
  - la academia NAIS (azul);
  - Bow and Arrow en Holt (ámbar);
  - Shadow of Kerensky en Alleghe (magenta);
  - el HBR-A en Rodigo al pulsar su misión (cian);
  - Bow and Arrow con Ibstock elegido, con las dos marcas.
- **Decisiones durante el desarrollo:**
  - **Encuadre al abrir un enlace:** el mapa encuadra antes de que carguen las fuentes, y con ellas la ficha crece y en el móvil tapaba el sistema marcado. El encuadre se repite una vez cuando están listas.
  - **El sistema bajo el ratón:** conserva su aro blanco, salvo si es el elegido, que ya lleva su marca.
