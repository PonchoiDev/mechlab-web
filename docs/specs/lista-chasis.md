# Especificación: lista de chasis de MW5

- **Estado:** en desarrollo
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`src/utils/chassisList.test.ts`) y por último la lógica y la interfaz, en commits separados.

## Contexto

El MechLab elige un 'Mech con el selector, que filtra bien pero enseña pocas cifras de cada variante: no se pueden comparar todos los 'Mechs por velocidad, armadura o potencia de fuego, ni ordenarlos. La página de armas y equipo (`docs/specs/pagina-equipo.md`) ya hace eso con las armas: una tabla con filtros y columnas que ordenan. Esta página hace lo mismo con los 'Mechs de *MechWarrior 5: Mercenaries*.

`mechs.json` ya trae todo lo necesario: las cifras del chasis y la build de serie de cada variante. La página no necesita datos nuevos.

## Requisitos funcionales

- **RF1.** Una página propia, `/mercs/chassis/`, con el título **Chassis**, su carátula en la fila de MW5 de la página de inicio (junto al MechLab) y un enlace en la cabecera del MechLab y de las demás páginas de MW5.
- **RF2.** Una tabla con una fila por variante (las mismas que ofrece el selector del MechLab) y estas columnas:
  - **'Mech:** el chasis y la variante, con su rol, su tecnología (XL, DHS, ENDO, FERRO y AP, como en el selector) y si es hero;
  - **Tons;**
  - **Hardpoints:** los anclajes por tipo («4E 1B 2M»), con los colores del MechLab;
  - **Engine:** la potencia del motor y si es XL;
  - **Speed:** la velocidad máxima en km/h, como la enseña el mechlab del juego;
  - **Armor** y **Structure:** los puntos máximos de armadura y los de estructura;
  - **JJ:** los jump jets que admite el chasis;
  - **Turn** y **Twist:** el giro de pie y el del torso en °/s;
  - **Upgr.:** las ranuras para las mejoras de la cantina;
  - **de la build de serie:** la potencia de fuego de una salva (**Alpha**), el **DPS**, la capacidad de calor y la refrigeración, como las calcula el MechLab;
  - **Year** (cuándo se puede conseguir, como el filtro Available by del selector) y **DLC**.
- **RF3.** Los filtros del selector de 'Mechs, con la misma lógica:
  - el buscador, por nombre, variante o ID, con sus atajos («3e 2m jj ecm hero dlc7»);
  - clase de peso, tecnología (IS o Clan), rol, Jump jets, ECM, AMS, Hero, anclajes mínimos (los omni cuentan como comodín), Available by y DLC.
- **RF4.** Filtros nuevos con las cifras del chasis: tonelaje mínimo y máximo, y velocidad mínima.
- **RF5.** Cada columna con cifras ordena la tabla al pulsar su cabecera, y otra pulsación invierte el orden, como en la página de armas: las cifras empiezan de mayor a menor y el nombre de la A a la Z (por chasis y, dentro, por variante). Las variantes sin el dato van al final.
- **RF6.** Pulsar una variante abre el MechLab con su build de serie (`/mercs/?mech=AS7-D`, el mismo enlace que usa el mapa estelar).
- **RF7.** Los filtros, la búsqueda y el orden van en la URL, para poder compartir la lista.
- **RF8.** El recuento dice cuántas variantes y chasis salen de cuántas hay («42 of 639 variants · 9 chassis»), y si no queda ninguna, la lista lo dice y ofrece quitar los filtros.
- **RF9.** La campana de novedades y el botón de feedback están en la cabecera, como en las demás páginas.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y está en `src/utils/chassisList.ts`, con sus tests: filas, filtros, orden, enlaces y vista en la URL. Los filtros del selector se reutilizan de `src/utils/mechs.ts`, no se copian.
- **RNF2.** La página tiene su propio bundle y funciona a 390 × 844 sin desbordar la página: la tabla se desplaza dentro de su caja y la primera columna se queda fija.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Los 'Mechs | se cargan las filas | son 639 variantes de 109 chasis; 198 son Clan y 109 son hero |
| CA2 | El AS7-D | se consulta su fila | Atlas, assault, 100 t, 4E 1B 2M, motor 300 sin XL, 48,6 km/h, 626 de armadura, 313 de estructura, 0 jump jets, giro 60,73 y torso 76,5 °/s, 6 ranuras de mejoras; de serie, 78,4 de alpha, 22,2 de DPS, 49 de capacidad de calor y 1,9 de refrigeración; del año 3015 y del juego base |
| CA3 | El LCT-1V y el ADR-A | se consultan sus filas | LCT-1V: 129,6 km/h, 8 ranuras de mejoras y 8 de alpha. ADR-A: Puma (Adder), 1E 2M y 2 omni, motor 210 XL, del DLC 7 y del año 3050 |
| CA4 | Las filas | se busca «atlas» / «3e 2m jj» / se filtra por Clan / Hero / de 20 a 35 t / al menos 120 km/h | todas son Atlas o Atlas II (la hero AS7-D-H), el AS7-D entre ellas / todas tienen al menos 3E y 2M (con los omni) y admiten jump jets / 198 / 109 / 99 / 51 |
| CA5 | Las filas | se ordenan por Speed / Alpha / nombre / Speed dos veces | la primera va a 162 km/h / es el BANE-3 (215) / la primera es de un chasis que va antes por orden alfabético que el de la segunda / la primera es la más lenta |
| CA6 | La URL | se lee y se vuelve a escribir | `?q=atlas&class=assault&tech=clan&role=Juggernaut&jj=1&ecm=1&hero=1&min=3e,2m,1ams&year=3050&dlc=base,7&tmin=20&tmax=35&speed=120&sort=speed&dir=asc` se conserva igual; sin parámetros, la vista por defecto y una URL vacía; lo que no se conoce se ignora |
| CA7 | El AS7-D | se enlaza al MechLab | `/mercs/?mech=AS7-D` |

## Fuera de alcance

- Los quirks de cada variante: el juego no los trae en los datos exportados.
- Comparar varias variantes lado a lado: el MechLab ya tiene la comparación (`docs/specs/comparar-chasis.md`).
- La lista de chasis de BATTLETECH.

## Plan de pruebas

1. **Lógica (CA1 a CA7):** `src/utils/chassisList.test.ts`, con `mechs.json` e `items.json` reales.
2. **Interfaz:** en el navegador, a 1440 × 900 y a 390 × 844: la tabla, los filtros, el orden, la URL, el enlace al MechLab con la build de serie y la carátula de la página de inicio.
