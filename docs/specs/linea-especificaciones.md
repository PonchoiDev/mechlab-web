# Especificación: línea de especificaciones como la del juego

- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/gameReference.test.ts` y `src/utils/mechs.test.ts`) y por último el código, en commits separados.

## Contexto

Bajo el nombre del 'Mech, el MechLab enseña una línea con el motor, los disipadores, la estructura y la armadura (`380 C-XL DHS C-ENDO C-FERRO`) y AP si la build lleva una sonda ([filtros-sonda-artilleria.md](filtros-sonda-artilleria.md)). La del mechlab del juego trae más: el equipo especial montado y las ranuras de mejoras. El Gladiator EXE-PRIME de serie sale en el juego como `380 C-XL DHS C-ENDO C-FERRO MOTIVE JJ 0/6` y el Zeus ZEU-SA3 como `320 XL DHS ENDO ECM AP 0/10`.

## Requisitos funcionales

- **RF1.** Tras las especificaciones del chasis, la línea enseña el equipo especial que lleva montado la build, con los colores del juego:
  - **ECM**, si lleva un ECM;
  - **AP**, si lleva una sonda activa;
  - **MOTIVE**, si lleva un MASC o un Supercharger;
  - **JJ**, si lleva jump jets.
- **RF2.** Al final, las ranuras de mejoras de la cantina usadas de las que tiene el 'Mech (`0/6`).
- **RF3.** El equipo y las ranuras dependen de la build: salen en el tablero, en la comparación y en la imagen para compartir. En el selector de 'Mechs y en la lista de chasis, que no tienen build, solo salen las del chasis.
- **RF4.** Las etiquetas de My builds no cambian: ya enseñan ese equipo a su manera (`JJ 3`, `ECM`, `MASC`, `SC`).

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `getMechSpecs` (`src/utils/mechs.ts`), con sus tests.
- **RNF2.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | El EXE-PRIME de serie, sin mejoras | se escribe su línea | `380 C-XL DHS C-ENDO C-FERRO MOTIVE JJ 0/6`, como en el juego |
| CA2 | El ZEU-SA3 de serie, sin mejoras | se escribe su línea | `320 XL DHS ENDO ECM AP 0/10`, como en el juego |
| CA3 | El HBR-A de serie | se escribe su línea | empieza por `325 C-XL DHS C-ENDO C-FERRO AP`, como en el juego |
| CA4 | Un 'Mech sin build | se escribe su línea | solo las especificaciones del chasis, sin equipo ni ranuras |
| CA5 | Una build con mejoras de dos ranuras en total | se escriben sus ranuras | `2/N`, con las N del 'Mech |

## Fuera de alcance

- El orden entre ECM o AP y MOTIVE o JJ cuando una build lleva de los dos grupos: ninguna captura los junta, así que se supone ECM, AP, MOTIVE, JJ.
- BATTLETECH, que tiene su propia línea (tonelaje, clase y fuente).

## Plan de pruebas

1. **Lógica (CA1 a CA5):** `src/utils/gameReference.test.ts` con las capturas del juego y `src/utils/mechs.test.ts`.
2. **Interfaz:** en el navegador, la línea del tablero con el EXE-PRIME y el ZEU-SA3, que cambie al montar o quitar equipo y al instalar mejoras, y la de la comparación.
