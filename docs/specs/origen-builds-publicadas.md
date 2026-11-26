# Especificación: origen exclusivo en la página de builds de MW5

- **Estado:** implementada
- **Cambia:** [publicar-builds-yaml.md](publicar-builds-yaml.md) (RF3, CA7, RNF2 y lo que quedaba fuera de alcance)
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/buildSource.test.ts`; CA5, en el navegador, porque los tests no montan componentes) y por último el código, en commits separados.

## Contexto

En `/mercs/builds/` las builds de MW5 sin mods y las de YAML salen en la misma lista, con dos interruptores en la fila **Source** de los filtros que enseñan u ocultan cada origen. Mezclarlas no sirve: una build de YAML se juega con otras reglas, otras piezas y otras cifras, y sus filtros propios (artillería, AMS, cuerpo a cuerpo, motor, estructura, blindaje, disipadores, rasgos de la variante) no se podían usar porque la lista llevaba los de MW5. Además, **My builds** solo abría las builds de MW5, así que las de YAML no se podían publicar desde la página.

## Decisiones

- **Un origen cada vez:** la página enseña las builds de MW5 o las de YAML, nunca las dos. Se elige con un selector de dos botones, con el icono de MW5 y el de Yet Another Mechlab, encima de la lista; ya no es un filtro.
- **Todo sigue al origen:** con YAML, la lista usa los filtros de My builds de YAML ([builds-guardadas-yaml.md](builds-guardadas-yaml.md)) y **My builds** abre las builds de YAML guardadas en el navegador, para publicarlas desde la página. Con Vanilla, los de MW5 y las guardadas de MW5, como antes.
- **Se recuerda el último:** el origen elegido se guarda en el navegador (`mw-builder:mercs:builds-source`). La primera vez, o si no se puede leer, Vanilla.
- **Los datos de YAML a demanda:** se descargan al elegir YAML, no por traer la lista alguna build de YAML, porque con Vanilla no se ven.

## Requisitos funcionales

- **RF1. Selector de origen.** Dos botones, **Vanilla** y **YAML**, con su icono y su nombre; el elegido sale marcado. Pulsar el otro cambia la lista entera: sus builds, el contador y los filtros.
- **RF2. Filtros por origen.** Al cambiar de origen se borran los filtros (buscador incluido), porque los de un origen no valen para el otro. El orden y **By votes** se mantienen.
- **RF3. My builds por origen.** **My builds** y su contador son los de las builds guardadas del origen elegido; **Open** lleva a su MechLab (`/mercs/` o `/mercs/yaml/`) y **Publish** las publica con la etiqueta de su origen.
- **RF4. Enlace a una build.** Si la página se abre con `?build=<id>` (el enlace que da publicar) y esa build es del otro origen, la página pasa a ese origen para enseñarla, sin cambiar el que se recuerda.
- **RF5. Lista de chasis.** `?mech=<id>` deja las builds de esa variante del origen elegido.

## Requisitos no funcionales

- **RNF1.** Elegir el origen de una build, leer el recordado y decidir el de un enlace va en `src/utils/buildSource.ts`, con sus tests.
- **RNF2.** La página de builds de BATTLETECH no cambia.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Un código de YAML y uno de MW5 | se pide su origen | `yaml` y `vanilla` |
| CA2 | Lo guardado en el navegador | se lee el origen | `yaml` si es `yaml`; `vanilla` si es `vanilla`, si no hay nada o si es otra cosa |
| CA3 | Una lista con una build de YAML y el origen Vanilla | se abre con `?build=` de esa build | el origen pasa a `yaml`; con el id de una de MW5, de un id que no está o sin `?build=`, sigue el que había |
| CA4 | Builds de los dos orígenes | se filtran por un origen | quedan solo las de ese origen |
| CA5 | Las builds guardadas de MW5 y las de YAML en el navegador | My builds cambia de clave | lista las de la clave nueva |

## Fuera de alcance

- Comparar builds de YAML.
- Recordar el origen en la dirección de la página.

## Plan de pruebas

1. **Lógica (CA1 a CA4):** `src/utils/buildSource.test.ts`.
2. **Interfaz:** en el navegador, con el servidor de desarrollo, a 1440 × 900 y a 390 × 844: cambiar de origen y ver que cambian la lista, el contador, los filtros y My builds (CA5); recargar y ver que se recuerda; abrir el enlace de una build de YAML con Vanilla recordado; publicar una build de YAML desde My builds de la página.
