# Especificación: filtro Motive y filtros de equipo en My builds

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/mechs.test.ts`, `src/utils/chassisList.test.ts` y `src/utils/savedBuildRows.test.ts`) y por último el código, en commits separados.

## Contexto

Un jugador ha pedido poder buscar los 'Mechs que admiten un **Motive Upgrade** (MASC o Supercharger) en el selector de 'Mechs y en la lista de chasis, y poder filtrar las builds guardadas por Motive y por sonda activa. Solo 33 de las 639 variantes tienen el hueco, así que buscarlas a mano es imposible. El selector y la lista de chasis ya filtran por Jump jets, ECM, AMS y Active probe ([filtros-sonda-artilleria.md](filtros-sonda-artilleria.md)); My builds filtra por el equipo que lleva montado cada build ([buscar-builds-guardadas.md](buscar-builds-guardadas.md)).

## Datos del juego

- **Motive Upgrade:** el MASC y el Supercharger van en una ranura especial de su tamaño, de la MK I a la MK V (`MASC_MKI_SlotType` a `MASC_MKV_SlotType`). La tienen 33 variantes: 8 de MK I, 9 de MK II, 4 de MK III, 10 de MK IV y 2 de MK V. Entre ellas, el CTF-3L, que lleva un MASC de serie, y el BNC-3P, que lleva un Supercharger.
- **Sonda activa en una build:** la que trae el chasis de serie o una montada, como la etiqueta AP de My builds.

## Requisitos funcionales

- **RF1.** Un botón **Motive** en la fila Equipment del selector de 'Mechs, junto a Jump jets, ECM, AMS y Active probe, que deja los 'Mechs con ranura de Motive Upgrade de cualquier tamaño. El buscador lo entiende con «masc». Cuenta como un filtro activo más.
- **RF2.** La lista de chasis tiene el mismo botón, con los de Equipment, y lo guarda en la URL (`masc=1`).
- **RF3.** My builds tiene dos botones más en Equipment, con la regla de los demás (lo que **lleva montado** la build, no lo que admite el chasis):
  - **Active probe:** la build lleva sonda activa, la de serie del chasis o una montada;
  - **Motive:** la build lleva montado un MASC o un Supercharger.
- **RF4.** El selector de builds guardadas del comparador tiene los mismos botones, porque comparte los filtros con My builds.
- **RF5.** En BATTLETECH no cambia nada: no tiene MASC ni Supercharger, y su selector de 'Mechs no filtra por sonda.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/mechs.ts` (el filtro de 'Mechs y el atajo), `src/utils/chassisList.ts` (la URL) y `src/utils/savedBuildRows.ts` (el equipo de cada build), con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los 'Mechs | se filtra por Motive | salen 33, entre ellos el CTF-3L, el BNC-3P y el FLE-17; el HBK-4G no |
| CA2 | El buscador | se escribe «masc» | pide Motive y no busca «masc» como texto |
| CA3 | Los filtros | se marca Motive | cuenta como un filtro activo |
| CA4 | La lista de chasis | se lee `?masc=1` y se vuelve a escribir | se conserva igual y deja 33 variantes |
| CA5 | Las builds de serie guardadas del CTF-3L, el BNC-3P, el RVN-3L, el ADR-A y el HBK-4G | se resume su equipo | el CTF-3L (MASC) y el BNC-3P (Supercharger) llevan Motive; el RVN-3L (sonda montada) y el ADR-A (sonda de serie) llevan Active probe; el HBK-4G, ninguno de los dos |
| CA6 | Los botones de equipo de My builds en MW5 | se listan | son Jump jets, ECM, AMS, Active probe, Motive y Hero, en ese orden |

## Fuera de alcance

- Filtrar por el tamaño de la ranura (MK I a MK V).
- Una etiqueta de Motive en la lista de 'Mechs del selector.

## Plan de pruebas

1. **Lógica (CA1 a CA6):** `src/utils/mechs.test.ts`, `src/utils/chassisList.test.ts` y `src/utils/savedBuildRows.test.ts`, con los 'Mechs de serie reales.
2. **Interfaz:** en el navegador, el botón Motive en el selector y en la lista de chasis (con su URL), y los botones Active probe y Motive en My builds y en el selector de builds del comparador.

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después la lógica y la interfaz, en commits separados.
- **Tests:** los seis criterios pasan: CA1 a CA3 en `src/utils/mechs.test.ts`, CA4 en `src/utils/chassisList.test.ts` y CA5 y CA6 en `src/utils/savedBuildRows.test.ts`. Un test anterior de los atajos del buscador compara el objeto entero de filtros y recibe el campo nuevo.
- **Interfaz:** comprobada en el navegador:
  - en el selector, Motive deja 33 variantes y cuenta como un filtro;
  - la lista de chasis con `?masc=1` enseña 33 filas con el botón marcado;
  - My builds tiene Jump jets, ECM, AMS, Active probe, Motive y Hero. Con trece builds de serie guardadas, Active probe deja el NTG-C, el ADR-A y el RVN-3L, y Motive, el BNC-3P y el CTF-3L.

