# Especificación: publicar builds del MechLab de YAML

- **Estado:** implementada
- **Completa:** [builds-publicadas.md](builds-publicadas.md) (las builds publicadas de MW5 y BATTLETECH) y [builds-guardadas-yaml.md](builds-guardadas-yaml.md), que dejaba fuera publicar
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`worker/builds.test.ts` y `src/utils/publishedBuilds.test.ts`) y por último el código, en commits separados.

## Contexto

Los MechLabs de MW5 y de BATTLETECH publican sus builds en la página de builds de su juego. El de YAML solo las guarda en el navegador. Una build de YAML es una build de MW5 Mercenaries con el mod, así que se publica en la misma página que las de MW5, `/mercs/builds/`, con una etiqueta que la distingue de las del juego sin mods.

El código de una build de YAML no tiene la forma de los de MW5 y BATTLETECH (`[1, mechId, armadura, zonas]`): es `Y1.` seguido del JSON `{ m: mechId, b: build }` en base64url (`src/utils/yaml/buildCode.ts`), y es más largo. El de serie más largo, el ANH-1E con cinco mejoras de la cantina, tiene 5063 caracteres; la mediana, unos 2500.

## Decisiones

- **Mismo juego, sin migración:** las builds de YAML se publican con `game: "mercs"`. Lo que las distingue es el prefijo `Y1.` de su código, que ya separa los enlaces de los dos MechLabs. Así comparten la lista, los votos, las denuncias, las claves de edición y el límite de publicaciones, y la tabla de D1 no cambia.
- **Validación en el Worker:** un código `Y1.` vale si el resto es base64url, decodifica a un objeto con `m` (un id de variante, con el mismo patrón que los demás) y `b` (un objeto), y no pasa de 16 000 caracteres. Como con los otros, el Worker no decodifica la build entera; la página descarta las que no se pueden abrir. Un código `Y1.` solo vale para `mercs`.
- **Datos de YAML a demanda:** la página de builds de MW5 descarga los datos de YAML (3,8 MB sin comprimir) solo si la lista trae alguna build de YAML. Mientras llegan, esas builds salen sin cifras ni botón Open, con el aviso «Loading YAML data…».
- **Visibles desde ya:** publicar una build de YAML la enseña a todo el mundo, y con ella el MechLab de YAML.

## Requisitos funcionales

- **RF1. Publicar desde el MechLab de YAML.** Un botón **Publish** en el grupo BUILD de la barra, como en MW5 y BATTLETECH, con la misma ventana de publicar. Sin armas ni equipo montados no se puede publicar. Cada build de My builds tiene también **Publish**, que abre la ventana con esa build sin cargarla; My builds sigue abierta debajo. Al publicar, el enlace lleva a la build en `/mercs/builds/`.
- **RF2. Etiqueta YAML.** En `/mercs/builds/`, cada build de YAML lleva la etiqueta **YAML** delante de las demás, y sus etiquetas, armas y cifras son las de My builds de YAML ([builds-guardadas-yaml.md](builds-guardadas-yaml.md), RF5).
- **RF3. Filtro de origen.** La página tiene un desplegable **Source** con **Vanilla** y **YAML**, con los demás filtros. Sin ninguno marcado salen todas. El resto de filtros (clase, anclajes y armas mínimos, tecnología, rol, equipo y buscador) son los de MW5 y valen para las dos.
- **RF4. Abrir y copiar el enlace.** **Open** y **Copy link** de una build de YAML llevan al MechLab de YAML (`/mercs/yaml/?b=`), y las de MW5 al de MW5, como hasta ahora.
- **RF5. Lista de chasis.** `?mech=<id>` deja las builds de esa variante de los dos MechLabs: los ids de las variantes del juego base son los mismos en los dos.

## Requisitos no funcionales

- **RNF1.** La validación del código va en `worker/builds.ts`, con sus tests. Distinguir un código de YAML y elegir su enlace, en `src/utils/publishedBuilds.ts`, también con tests.
- **RNF2.** El MechLab de MW5 y la ventana My builds de la página de builds no cambian: siguen publicando y listando solo builds de MW5.
- **RNF3.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Un código de YAML, `Y1.` y el JSON `{ m, b }` en base64url | se valida | vale y su mechId es `m`; no vale si `m` no es un id, si `b` no es un objeto, si el resto no es base64url o JSON, o si pasa de 16 000 caracteres |
| CA2 | Un código de YAML de 5063 caracteres | se publica en `mercs` | responde 201 y sale en la lista de `mercs` con su mechId |
| CA3 | Un código de YAML | se publica en `battletech` | responde 400 |
| CA4 | Un código de MW5 de más de 4000 caracteres | se valida | sigue sin valer: el tope de 16 000 es solo para los de YAML |
| CA5 | Un código | se pregunta si es de YAML | lo es si empieza por `Y1.` |
| CA6 | Un código de YAML y uno de MW5 | se pide su enlace | el de YAML abre `/mercs/yaml/?b=` y el de MW5, `/mercs/?b=` |

## Fuera de alcance

- Las builds de YAML guardadas en el navegador en la ventana My builds de la página de builds (RF2b de [builds-publicadas.md](builds-publicadas.md)): se publican desde el MechLab de YAML.
- Filtros propios de YAML en la página de builds (las piezas internas, los anclajes de artillería, AMS y cuerpo a cuerpo o los rasgos de la variante): ya están en My builds de YAML.
- Comparar builds de YAML.

## Plan de pruebas

1. **Worker (CA1 a CA4):** `worker/builds.test.ts`, con el almacén en memoria.
2. **Navegador (CA5 y CA6):** `src/utils/publishedBuilds.test.ts`.
3. **Interfaz:** en el navegador, con el servidor de desarrollo, a 1440 × 900 y a 390 × 844: publicar desde la barra y desde My builds del MechLab de YAML, ver la build en `/mercs/builds/` con la etiqueta YAML y sus cifras, filtrar por Source, abrirla en el MechLab de YAML y copiar su enlace, y comprobar que las de MW5 siguen igual.
