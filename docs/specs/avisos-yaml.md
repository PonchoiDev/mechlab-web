# Especificación: avisos del MechLab de YAML

- **Estado:** implementada
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/yaml/board.test.ts`) y por último el código, en commits separados.

## Contexto

El MechLab de MW5 avisa de lo que le falta a la build (anclajes libres, munición y armadura por debajo del máximo), además de los errores que no dejan usarla. El de YAML solo avisa de los errores (sobrepeso, ranuras que no caben, armas repartidas sin sitio) y de la falta de núcleo de motor. Además, sus avisos nombran la ubicación con la clave interna (`centerTorso: not enough slots`).

## Qué cambia respecto a MW5

- **Anclajes libres: sin aviso.** YAML añade anclajes a casi todas las variantes (el ARC-T pasa de 6 a 10) y las armas ocupan ranuras críticas, así que no se pueden llenar todos. Un anclaje vacío es una opción más, no algo que falte: con el aviso de MW5, 767 de las 790 builds de serie lo tendrían.
- **Munición de consumibles: sin aviso.** Las cargas de los consumibles (Coolant Pod, UAV: tipo `Ammo.Consumable.*`) son munición en los datos, pero no las usa ningún arma. Sin esta excepción, el AS7-SP, el AWS-9Q y otras seis builds de serie avisarían de munición sin uso.
- **Armadura:** igual que en MW5, contra el máximo de cada ubicación (delante y detrás juntos). Los puntos de los quirks no cuentan, como en el máximo.

## Requisitos funcionales

- **RF1.** Los avisos nombran la ubicación como el resto de la web («Center torso», «Left arm»...) y el sobrepeso como en MW5: «Over tonnage by X t».
- **RF2.** Un arma que gasta munición sin ninguna caja de un tipo que use avisa «X has no ammo», una vez por arma distinta, con la ubicación de la primera.
- **RF3.** Una caja de munición de un tipo que no usa ningún arma montada avisa «X is not used by any weapon», una vez por caja distinta, salvo las cargas de consumibles (`Ammo.Consumable.*`).
- **RF4.** La armadura por debajo del máximo da un solo aviso, como en MW5: «Armor below max: Head, Left leg» con una o dos ubicaciones y «Armor below max in N components» con más, que lleva a la primera.
- **RF5.** No hay aviso de anclajes libres.
- **RF6.** Primero los errores (sobrepeso, ranuras, armas repartidas) y después los avisos (núcleo de motor, munición y armadura). Cada aviso tiene un id propio y estable.
- **RF7.** Sin avisos, la lista dice «Nothing to note: the build is within its tonnage, every piece has room, weapons have ammo and armor is maxed.»

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El NSR-9J de serie con doce cajas de munición LRM en la cabeza | se piden los avisos | el de ranuras nombra la ubicación con su etiqueta («Head: not enough slots...»), no con la clave |
| CA2 | El ARC-T de serie sin cajas de munición | se piden los avisos | avisa una sola vez «LRM 20 has no ammo» aunque lleve dos, como aviso y en el torso izquierdo, donde está la primera |
| CA3 | El ARC-T de serie con una caja de AC/20 en la pierna izquierda | se piden los avisos | avisa de que la caja no la usa ningún arma |
| CA4 | El AS7-SP de serie, con cargas de Coolant Pod y de UAV | se piden los avisos | no avisa de munición |
| CA5 | El ARC-T de serie, que tiene anclajes vacíos y la armadura de serie | se piden los avisos | no avisa de anclajes y da un único aviso de armadura «Armor below max in 4 components», que lleva a la cabeza |
| CA6 | El ARC-T con la armadura al máximo salvo la cabeza | se piden los avisos | el aviso de armadura dice «Armor below max: Head» |
| CA7 | El ARC-T con la armadura al máximo | se piden los avisos | no hay aviso de armadura |
| CA8 | El NSR-9J con armadura primitiva y Endo (sobrepeso) y sin armadura en la cabeza | se piden los avisos | el error de sobrepeso va primero y los ids no se repiten |
