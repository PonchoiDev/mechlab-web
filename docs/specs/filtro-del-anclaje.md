# Especificación: el inventario al elegir un anclaje

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/inventory.test.ts`, `src/utils/battletech/inventory.test.ts`, `src/utils/yaml/inventory.test.ts`) y por último el código, en commits separados.

## Contexto

Al pulsar un arma montada (o un anclaje vacío) en el tablero, el inventario queda apuntando a ese anclaje para sustituir el arma, con «Fits» marcado. En los tres MechLabs la pestaña o el filtro vuelve a All, aunque solo valen armas del tipo del anclaje. En el de YAML, además, se cuelan el equipo y la munición que caben en la ubicación, porque la comprobación de «Fits» no mira el anclaje: en el brazo derecho del NSR-9J, al pulsar el Gauss salen la Alu-Ceramic Shoulder o el Battle Fist.

## Requisitos funcionales

- **RF1. El filtro del anclaje.** Al elegir un anclaje, el inventario marca la pestaña (MW5 y BATTLETECH) o el filtro (YAML) de su tipo: Ballistic en un anclaje balístico, Energy en uno de energía... En un anclaje omni, como admite varios tipos, All en MW5 y ALL W en YAML. Al elegir una ubicación sin anclaje, sigue volviendo a All (o sin filtro en YAML).
- **RF2. Solo armas en un anclaje.** Con un anclaje elegido y «Fits» marcado, en el MechLab de YAML solo salen las armas que admite, como en MW5 y BATTLETECH: el equipo y la munición se montan apuntando a la ubicación.

## Requisitos no funcionales

- **RNF1.** La lógica va en el `inventory.ts` de cada MechLab, con sus tests.
- **RNF2.** Sin novedad en la campana.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Un anclaje balístico, uno de energía y uno omni en MW5 | se pide la pestaña del destino | ballistic, energy y all; sin anclaje, all |
| CA2 | Un anclaje balístico y uno de energía en BATTLETECH | se pide la pestaña del destino | ballistic y energy; sin anclaje, all |
| CA3 | El anclaje del Gauss del brazo derecho del NSR-9J en YAML | se pide el filtro del destino | ballistic; sin anclaje, ninguno |
| CA4 | Ese mismo anclaje, con «Fits» | se filtra el inventario | solo salen armas balísticas; ni la Alu-Ceramic Shoulder ni el Battle Fist ni munición |

## Plan de pruebas

1. **Lógica (CA1 a CA4):** los `inventory.test.ts` de cada MechLab.
2. **Interfaz:** en el navegador, en los tres MechLabs: pulsar un arma balística y una de energía y ver la pestaña o el filtro marcado y la lista.
