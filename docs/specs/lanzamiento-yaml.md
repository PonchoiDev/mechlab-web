# Especificación: lanzamiento de YAML en la portada

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/data/portal.test.ts`, `src/utils/siteNav.test.ts`) y por último el código, en commits separados.

## Contexto

El MechLab de YAML (`/mercs/yaml/`) y su página de equipo (`/mercs/yaml/equipment/`) están desplegados sin anunciar: con `noindex`, sin enlace en la portada y sin novedad en la campana. Para publicarlos, la portada tiene que enseñarlos sin alargar la lista de herramientas de MW5, que ya tiene ocho filas.

Además, el orden de la lista pone las herramientas de consulta (campañas, mapa, unidades, pilotos) antes que el equipo, que es lo que más se usa junto al MechLab.

## Requisitos funcionales

- **RF1. Sello YAML en la carátula de MW5.** Debajo de las cifras de la carátula de MW5 va un sello «YAML compatible» con el logo del mod Yet Another Mechlab (`public/mechlab/yaml/mods/yet-another-mechlab-color.png`), alineado a la derecha como el resto del texto de la carátula.
- **RF2. Nuevo orden.** Las herramientas de cada juego van en este orden, en la portada y en la cabecera de todas las páginas:
  - MW5: MechLab, Builds, Chassis, Equipment, HRQ & Campaigns, Star map, Enemy units, Pilots.
  - BATTLETECH, igual que MW5 para que los dos juegos se lean igual: MechLab, Builds, Chassis, Equipment, Flashpoints, Star map, Enemy units, Argo.
- **RF3. Filas partidas.** Las filas del MechLab y del equipo de MW5 se parten en dos: a la izquierda la herramienta de siempre, con su miniatura, nombre y cifras; a la derecha, su versión YAML, con el logo del mod, el nombre y sus cifras, y su propio «Open». Cada mitad es un enlace aparte y se ilumina sola al pasar el ratón. En móvil la mitad YAML baja debajo de la otra.
  - MechLab YAML (`/mercs/yaml/`): «N variants · Mod rules».
  - Equipo YAML (`/mercs/yaml/equipment/`): «N weapons · N equipment».
- **RF4. Indexable.** Las dos páginas de YAML pierden el `noindex`.
- **RF5. Novedad.** Una entrada en la campana anuncia el MechLab de YAML, su página de equipo y las builds de YAML publicadas en `/mercs/builds/`.

## Requisitos no funcionales

- **RNF1.** Las cifras de las mitades YAML salen de los datos de `src/data/yaml/`, con un test, como las demás.
- **RNF2.** El número de herramientas de la carátula de MW5 sigue en ocho: las versiones YAML son variantes de dos de ellas, no herramientas nuevas, y la cabecera de las páginas no cambia de tamaño.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | La carátula de MW5 | se lee | lleva el sello «YAML compatible» con el logo de Yet Another Mechlab |
| CA2 | Las listas de la portada | se leen sus enlaces principales | van en el orden de RF2, y la cabecera de las páginas en el mismo |
| CA3 | La lista de MW5 | se leen sus enlaces YAML | hay dos, `/mercs/yaml/` en la fila del MechLab y `/mercs/yaml/equipment/` en la del equipo, y ninguno en BATTLETECH |
| CA4 | Las cifras de las mitades YAML | se comparan con los datos | coinciden: variantes de `src/data/yaml/mechs.json`, armas y equipo de la página de equipo de YAML |
| CA5 | `yaml/index.html` y `yaml/equipment/index.html` | se busca `noindex` | no está |

## Fuera de alcance

- Enlaces a las páginas de YAML en la cabecera de las demás páginas.
- Una carátula propia para YAML.

## Plan de pruebas

1. **Contenido (CA1 a CA5):** `src/data/portal.test.ts` y `src/utils/siteNav.test.ts`.
2. **Interfaz:** en el navegador, en escritorio, tableta y móvil: las filas partidas, el resalte de cada mitad y el sello de la carátula.
