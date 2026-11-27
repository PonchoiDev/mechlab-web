# Especificación: filtros de las listas de builds ordenados, sin «YAML only»

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/mechList.test.ts`, `src/utils/yaml/savedBuilds.test.ts`) y por último el código, en commits separados.
- **Cambia:** [filtros-yaml.md](filtros-yaml.md) (RF3 y RF4) y [builds-guardadas-yaml.md](builds-guardadas-yaml.md) (RF4).

## Contexto

En el MechLab de YAML, el filtro «YAML only» deja las variantes que añade el mod, no las builds hechas en YAML. En My builds, donde todas las builds son de YAML, marcarlo esconde las de variantes del juego base (un NSR-9J guardado desaparece), y parece un fallo. El selector de 'Mechs ya marca cada variante nueva con su etiqueta YAML, así que el filtro sobra.

Además, los filtros de las listas de builds (My builds de los tres MechLabs, el selector del comparador, la ventana de publicar y la página de builds publicadas) van cada fila a su aire: la de clase no lleva etiqueta, las demás empiezan a distinta altura según lo largo de su etiqueta y las etiquetas de cada pieza se confunden con las de las filas.

## Requisitos funcionales

- **RF1. Sin «YAML only».** Se quita el filtro del selector de 'Mechs y de las listas de builds de YAML (My builds, comparador, publicar y builds publicadas de YAML), y el atajo `yaml` del buscador del selector, que pasa a buscarse como texto. La etiqueta YAML de las variantes nuevas en el selector se queda.
- **RF2. Filas alineadas.** Debajo del buscador y el orden, cada fila de filtros lleva su etiqueta en una columna del mismo ancho, y sus controles empiezan todos a la misma altura y, si no caben, siguen debajo alineados con el primero:
  1. **Class:** las clases de peso con su recuento; en la misma fila, **Tech** y **Role**.
  2. **Equipment:** el equipo y la variante.
  3. **Parts** (YAML): Engine, Structure, Armor y Heat sinks, cada pieza con su nombre en minúscula pequeña junto a su desplegable, para que no se confunda con las etiquetas de fila.
  4. **Min:** el interruptor Hardpoints / Weapons y los contadores.
- **RF3. Espaciado.** Una línea separa el buscador de los filtros; entre las filas, el mismo espacio. En móvil la etiqueta va encima de sus controles.

## Requisitos no funcionales

- **RNF1.** Los tres MechLabs y la página de builds usan el mismo componente: el cambio vale para todos.
- **RNF2.** Sin novedad en la campana: es un ajuste del MechLab de YAML recién lanzado.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los filtros del selector de 'Mechs de YAML | se leen | no tienen `yamlOnly` |
| CA2 | El buscador del selector | se escribe `yaml` | no filtra por variantes nuevas: se busca como texto |
| CA3 | Una build guardada de una variante nueva de YAML | se resume para la lista | no lleva `yamlOnly` entre sus rasgos, y la lista de YAML no ofrece ese filtro |

## Plan de pruebas

1. **Lógica (CA1 a CA3):** `src/utils/yaml/mechList.test.ts` y `src/utils/yaml/savedBuilds.test.ts`.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: My builds de MW5, BATTLETECH y YAML, el selector del comparador y la página de builds publicadas.
