# Especificación: filtros de sonda activa y artillería en el selector de 'Mechs

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/mechs.test.ts` y `src/utils/chassisList.test.ts`) y por último el código, en commits separados.

## Contexto

El selector de 'Mechs de MW5 filtra por Jump jets, ECM y AMS, pero no por sonda activa, y sus contadores de anclajes mínimos no tienen la artillería (Arrow IV), que solo se podía pedir escribiendo «1art» en el buscador. Un jugador lo ha pedido para buscar 'Mechs de apoyo. La lista de chasis (`docs/specs/lista-chasis.md`) usa los mismos filtros, así que los recibe también.

## Datos del juego

- **Sonda activa:** la sonda de la Inner Sphere (Beagle, EW o Black Market) solo cabe en una ranura especial (`BAP_SlotType`), y la tienen 16 variantes: ARC-5CS, ARC-AGC, BL-6-KNT, BL-6B-KNT, BLR-1P, CTF-0X, CTF-0XP, FS9-S, JVN-11B, QKD-4P, RVN-1X, RVN-3L, SHC-B, TBT-LG, VL-2P y ZEU-SA3. La Clan Active Probe cabe también en una ranura normal de cualquier 'Mech, Clan o IS, así que no cuenta para el filtro: con ella, todos los 'Mechs pueden llevar sonda. **Corrección (22 de noviembre de 2026):** antes se contaban además las 202 variantes con `bBeagleActiveProbe=True`, pero esa marca está en los datos de importación del chasis (`MechImportData`, que también traen un motor y un blindaje que no coinciden con los del juego) y el juego no la usa: el EXE-PRIME la tiene y el juego no le pone AP. El AP de la línea de especificaciones del juego sale por la sonda **montada**: el HBR-A la lleva sin tener ranura y sale con AP, y el ZEU-SA3 la lleva en su ranura y también (capturas en `src/utils/gameReference.test.ts`). La web pone AP igual: en el tablero, en la comparación y en la imagen para compartir, si la build lleva una sonda; en el selector y la lista de chasis, que no tienen build, no.
- **Artillería:** 7 variantes tienen anclaje de artillería: BSK-AIV, CPLT-C3, KFX-V, LGB-8V, MDD-V, NGA-PRIME y UM-AIV.

## Requisitos funcionales

- **RF1.** Un botón **Active probe** en la fila Equipment del selector, junto a Jump jets, ECM y AMS, que deja los 'Mechs con ranura de sonda. El buscador lo entiende con «bap».
- **RF2.** Un contador **ART** en Min hardpoints, junto a E, B, M y Omni, para pedir un mínimo de anclajes de artillería, igual que «1art» en el buscador.
- **RF3.** La lista de chasis tiene los dos: el botón Active probe con los de Equipment y el contador ART con los de anclajes. La sonda va en la URL (`bap=1`) y la artillería en los mínimos (`min=1art`).
- **RF4.** Active probe cuenta como un filtro activo más en el resumen del selector.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los 'Mechs | se filtra por Active probe | salen los 16 con ranura de sonda, entre ellos el ARC-AGC, el JVN-11B y el ZEU-SA3; el EXE-PRIME, que solo tiene la marca de importación, no |
| CA2 | Los 'Mechs | se pide al menos 1 anclaje de artillería | salen BSK-AIV, CPLT-C3, KFX-V, LGB-8V, MDD-V, NGA-PRIME y UM-AIV |
| CA3 | El buscador | se escribe «bap» | pide la sonda activa y no busca «bap» como texto |
| CA4 | Los filtros | se marca Active probe | cuenta como un filtro activo |
| CA5 | La lista de chasis | se lee `?bap=1&min=1art` y se vuelve a escribir | se conserva igual y deja 16 / 7 variantes |

## Resultado

- **Orden seguido:** esta especificación, los tests de los criterios de aceptación (que fallaban) y después la lógica y la interfaz, en commits separados.
- **Tests:** los cinco criterios están en `src/utils/mechs.test.ts` y `src/utils/chassisList.test.ts` y pasan. Un test anterior de los atajos del buscador compara el objeto entero de filtros y recibe el campo nuevo.
- **Interfaz:** comprobada en el navegador: Active probe y el contador ART en el selector, y en la lista de chasis `?bap=1&min=1art` deja el NGA-PRIME, el KFX-V y el MDD-V (con la regla de entonces, que contaba la marca de importación).
