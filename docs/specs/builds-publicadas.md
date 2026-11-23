# Especificación: builds publicadas

- **Estado:** implementada
- **Issue:** #164
- **Método:** Spec Driven Development. Primero esta especificación, después los tests de los criterios de aceptación (`worker/builds.test.ts`, `src/utils/publishedBuilds.test.ts` y `src/data/portal.test.ts`) y por último el código, en commits separados.

## Contexto

Hoy una build se comparte por enlace o como imagen: viaja codificada en la URL (`src/utils/buildCode.ts` en MW5, `src/utils/battletech/buildCode.ts` en BATTLETECH) o se guarda en el navegador (My builds). No hay un sitio donde encontrar las builds de otros jugadores.

Esta funcionalidad deja publicar una build desde el MechLab de cada juego y verlas todas en una página propia por juego, con los filtros de My builds, votos y denuncias.

Cambia un principio del análisis: la web deja de ser «sin servidor de datos». Sigue sin cuentas: quien publica guarda en su navegador una clave para editar o borrar su build.

## Decisiones

- **Almacén:** una base de datos D1 de Cloudflare (`BUILDS_DB`), junto al Worker. Guarda el código de la build, no la build decodificada: se reconstruye en el navegador con los datos del juego del momento, como My builds y los enlaces.
- **Validación en el Worker:** el código de build debe tener la forma de los dos juegos (`[1, mechId, armadura, zonas]` en base64url). El Worker no decodifica la build entera: necesitaría los datos de los juegos (`mechs.json` pesa 2,5 MB) y no caben en él. La página descarta las builds que no se pueden abrir.
- **Sin cuentas:** al publicar, el Worker devuelve una clave de edición aleatoria que el navegador guarda. Con ella se edita el nombre, la descripción y el autor, o se borra la build. El Worker solo guarda su hash.
- **Votos:** uno por build y por IP. La IP no se guarda tal cual: se guarda el hash de la IP con un secreto (`BUILDS_SALT`).
- **Denuncias:** una por build y por IP. Con tres, la build se oculta sola. Cada denuncia avisa por correo al dueño de la web, con el mismo envío que el feedback (Email Routing y el secreto `FEEDBACK_TO`): si el correo no está configurado o falla, la denuncia cuenta igual.
- **Administración:** el dueño de la web borra cualquier build con la clave de administración (`BUILDS_ADMIN_KEY`, secreto del Worker) en la cabecera `Authorization: Bearer`.
- **Límite de publicaciones:** cien por hora y por IP. Es alto a propósito: frena un script que publique sin parar, no a un jugador que publica varias builds.
- **Escala:** la página carga las builds visibles del juego (hasta 1000, las más recientes) y filtra y ordena en el navegador, como My builds. Si algún día hay más, se pagina en el servidor.

## API

Rutas del Worker, con el mismo prefijo que el resto de la API (`/mercs/api/` y `/battletech/api/`, que el Worker trata igual). El juego va en el cuerpo o en la consulta.

| Método y ruta | Cuerpo o consulta | Respuesta |
|---|---|---|
| `GET /api/builds` | `?game=mercs` o `battletech` | `200 { builds: [...] }` con las visibles, de la más reciente a la más antigua |
| `POST /api/builds` | `{ game, code, name, description, author, website }` | `201 { build, editKey }`; `400` si no es válida; `429` si se pasa del límite |
| `PATCH /api/builds/:id` | `{ editKey, name, description, author }` | `200 { build }`; `403` sin la clave buena; `404` si no existe |
| `DELETE /api/builds/:id` | `{ editKey }` o la clave de administración | `200 { ok: true }`; `403`; `404` |
| `POST /api/builds/:id/vote` | | `200 { votes }`; `409` si ya votó desde esa IP |
| `DELETE /api/builds/:id/vote` | | `200 { votes }` |
| `POST /api/builds/:id/report` | | `200 { ok: true }`; `409` si ya la denunció desde esa IP |

Sin la base de datos configurada, todas responden `503`, como el feedback sin correo.

Cada build publicada: `id`, `game`, `mechId`, `code`, `name`, `description`, `author`, `createdAt`, `updatedAt` y `votes`.

## Requisitos funcionales

- **RF1. Publicar.** En los dos MechLabs, un botón **Publish** en el grupo BUILD de la barra, junto a Save build y My builds. Abre una ventana con el nombre (el de la build guardada abierta o el del 'Mech), una descripción opcional (hasta 500 caracteres) y un nombre de autor opcional (hasta 40), que se recuerda para la siguiente vez. Al publicar, enseña el enlace a la build en la página de builds. Sin equipo montado no se puede publicar.
- **RF2. Página de builds.** `/mercs/builds/` y `/battletech/builds/`, con el título **Builds** y un enlace en la cabecera de las demás páginas de su juego y su fila en la portada. Cada build enseña su nombre, el 'Mech, sus cifras, sus armas, sus etiquetas, el autor, la fecha, la descripción y los votos, como My builds.
- **RF3. Filtros y orden.** Los de My builds (clase, anclajes o armas mínimos, tecnología, rol, equipo y buscador), y el orden por más recientes, más votadas, nombre, chasis, tonelaje o potencia de fuego. `?mech=<id>` deja solo las builds de esa variante: así enlaza la lista de chasis.
- **RF4. Abrir.** Cada build se abre en el MechLab con su enlace de siempre (`?b=`), y se puede copiar el enlace.
- **RF5. Votar.** Un botón con los votos de la build: pulsado vota, pulsado otra vez retira el voto. El navegador recuerda qué builds votó.
- **RF6. Denunciar.** Un botón Report, con confirmación. La build denunciada desaparece de la lista de quien la denunció, también al recargar: el navegador recuerda las builds que denunció, como las que votó.
- **RF7. Las propias.** Las builds publicadas desde este navegador llevan la marca **Yours** y botones para editar su nombre, descripción y autor, y para borrarlas.
- **RF8. Lista de chasis.** Cada variante de la lista de chasis de los dos juegos enlaza a sus builds publicadas.
- **RF9. Sin servicio.** Si la API no responde o devuelve `503`, la página lo dice y el botón Publish avisa de que la publicación no está disponible.

## Requisitos no funcionales

- **RNF1.** La lógica es pura y tiene tests: la validación y las rutas del Worker en `worker/builds.ts`, sobre un almacén con interfaz propia (`BuildStore`), que en producción es D1 (`worker/buildStore.ts`) y en los tests y en el servidor de desarrollo, uno en memoria (`worker/memoryBuildStore.ts`). La parte del navegador, en `src/utils/publishedBuilds.ts`.
- **RNF2.** El esquema de la base de datos va en una migración de D1 (`migrations/0001_published_builds.sql`).
- **RNF3.** Los textos se limpian en el Worker: sin caracteres de control, con los espacios normalizados y con su longitud máxima. React los escapa al pintarlos.
- **RNF4.** Textos de la interfaz en inglés y sin guiones largos.

## Criterios de aceptación

| # | Dado | Cuando | Entonces |
|---|---|---|---|
| CA1 | Un código de build de MW5 o de BATTLETECH | se valida | vale si es base64url, decodifica a `[1, mechId, armadura, zonas]` y el mechId es un id; no vale con otra versión, otro formato o más de 4000 caracteres |
| CA2 | Una publicación | se valida | el nombre se normaliza y se corta a 80, la descripción a 500 y el autor a 40; sin nombre o con el campo trampa relleno no vale; el juego tiene que ser `mercs` o `battletech` |
| CA3 | Una build válida | se publica | responde 201 con la build y una clave de edición, y sale en la lista de su juego y no en la del otro |
| CA4 | Ciento una publicaciones desde la misma IP en una hora | se envía la que hace ciento una | responde 429 |
| CA5 | Una build publicada | se edita o se borra con otra clave | responde 403; con su clave, 200 |
| CA6 | Una build publicada | se borra con la clave de administración | responde 200 y desaparece de la lista |
| CA7 | Una build | se vota dos veces desde la misma IP | la segunda responde 409; los votos son 1; al retirar el voto, 0 |
| CA8 | Una build | la denuncian tres IP distintas | deja de salir en la lista; la misma IP no puede denunciarla dos veces |
| CA9 | El Worker sin base de datos | se llama a la API de builds | responde 503 |
| CA10 | Las claves de edición y los votos guardados en el navegador | se leen dañados | se ignoran sin fallar |
| CA11 | Builds publicadas | se ordenan por votos | van de más a menos votos y, con los mismos, de la más reciente a la más antigua |
| CA12 | La portada | se leen sus herramientas | cada juego tiene ocho, con Builds después del MechLab |
| CA13 | Una build | se denuncia | el aviso lleva el nombre de la build, su juego, las denuncias que lleva, si ya se ha ocultado, el enlace a la build y el comando para borrarla; si el aviso falla, la denuncia responde 200 igual |
| CA14 | Las builds denunciadas guardadas en el navegador | se leen dañadas | se ignoran sin fallar |

## Puesta en marcha

1. Crear la base de datos: `npx wrangler d1 create mechlab-builds`, y añadir a `wrangler.jsonc` el enlace `d1_databases` con `binding: "BUILDS_DB"` y el `database_id` que devuelve. No va en `previews`: las vistas previas de los pull request escribirían en la base de datos de la web publicada, así que en ellas la API responde 503.
2. Crear las tablas: `npx wrangler d1 migrations apply mechlab-builds --remote`.
3. Crear los secretos: `npx wrangler secret put BUILDS_SALT` y `npx wrangler secret put BUILDS_ADMIN_KEY`, con dos valores aleatorios largos.

Hasta entonces, la API responde 503 y la web lo dice.

## Fuera de alcance

- Cuentas de usuario.
- Comentarios en las builds.
- Paginación en el servidor.
- Un panel de administración: se borra con la clave por la API.

## Plan de pruebas

1. **Worker (CA1 a CA9):** `worker/builds.test.ts`, con el almacén en memoria.
2. **Navegador (CA10 y CA11):** `src/utils/publishedBuilds.test.ts`.
3. **Portada (CA12):** `src/data/portal.test.ts`.
4. **Aviso y denuncias guardadas (CA13 y CA14):** `worker/builds.test.ts` y `src/utils/publishedBuilds.test.ts`.
4. **Interfaz:** en el navegador, con el servidor de desarrollo (que usa el almacén en memoria): publicar desde los dos MechLabs, la página de builds con filtros, votar, retirar el voto, denunciar, editar y borrar una propia, y el enlace desde la lista de chasis.
