# Especificación: filtros de sonda activa y artillería en el selector de 'Mechs

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/mechs.test.ts` y `src/utils/chassisList.test.ts`) y por último el código, en commits separados.

## Contexto

El selector de 'Mechs de MW5 filtra por Jump jets, ECM y AMS, pero no por sonda activa, y sus contadores de anclajes mínimos no tienen la artillería (Arrow IV), que solo se podía pedir escribiendo «1art» en el buscador. Un jugador lo ha pedido para buscar 'Mechs de apoyo. La lista de chasis (`docs/specs/lista-chasis.md`) usa los mismos filtros, así que los recibe también.

## Datos del juego

- **Sonda activa:** 202 variantes la traen de serie (`activeProbe`) y dos más, el JVN-11B y el ZEU-SA3, tienen una ranura especial para montarla (`BAP_SlotType`). El filtro cuenta las dos, como el de ECM cuenta las ranuras de ECM: 204 variantes.
- **Artillería:** 7 variantes tienen anclaje de artillería: BSK-AIV, CPLT-C3, KFX-V, LGB-8V, MDD-V, NGA-PRIME y UM-AIV.

## Requisitos funcionales

- **RF1.** Un botón **Active probe** en la fila Equipment del selector, junto a Jump jets, ECM y AMS, que deja los 'Mechs con sonda de serie o con ranura para ella. El buscador lo entiende con «bap».
- **RF2.** Un contador **ART** en Min hardpoints, junto a E, B, M y Omni, para pedir un mínimo de anclajes de artillería, igual que «1art» en el buscador.
- **RF3.** La lista de chasis tiene los dos: el botón Active probe con los de Equipment y el contador ART con los de anclajes. La sonda va en la URL (`bap=1`) y la artillería en los mínimos (`min=1art`).
- **RF4.** Active probe cuenta como un filtro activo más en el resumen del selector.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los 'Mechs | se filtra por Active probe | salen 204: los 202 con sonda de serie, el JVN-11B y el ZEU-SA3 |
| CA2 | Los 'Mechs | se pide al menos 1 anclaje de artillería | salen BSK-AIV, CPLT-C3, KFX-V, LGB-8V, MDD-V, NGA-PRIME y UM-AIV |
| CA3 | El buscador | se escribe «bap» | pide la sonda activa y no busca «bap» como texto |
| CA4 | Los filtros | se marca Active probe | cuenta como un filtro activo |
| CA5 | La lista de chasis | se lee `?bap=1&min=1art` y se vuelve a escribir | se conserva igual y deja 204 / 7 variantes |

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después la lógica y la interfaz, en commits separados.
- **Tests:** los cinco criterios están en `src/utils/mechs.test.ts` y `src/utils/chassisList.test.ts` y pasan. Un test anterior de los atajos del buscador compara el objeto entero de filtros y recibe el campo nuevo.
- **Interfaz:** comprobada en el navegador: Active probe y el contador ART en el selector, y en la lista de chasis `?bap=1&min=1art` deja el NGA-PRIME, el KFX-V y el MDD-V.
