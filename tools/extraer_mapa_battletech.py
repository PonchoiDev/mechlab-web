import json
import os
import struct
import sys

from battletech import ASSETS, leer_carpeta, leer_etiquetas
from extraer_mapa import escribir_png, reducir
from ue4 import descomprimir_dxt5
from unityfs import CLASE_MESH, buscar_objeto, leer_malla_2d

# Extrae de la instalación de BATTLETECH (juego base, sin mods) lo que necesita el mapa estelar: los
# sistemas con todas sus fichas (una por modo y momento de la campaña), las facciones, los nombres de
# las etiquetas de planeta, los logos de las facciones y las imágenes de los planetas en PNG, y la
# calavera de la dificultad en SVG. Después, generar_mapa_battletech.py
# trabaja con estos archivos sin tocar el juego.
#
#   python3 tools/extraer_mapa_battletech.py "/ruta/a/BATTLETECH"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "starmap")
RUTA_LOGOS = os.path.join(DIRECTORIO_SCRIPT, "..", "battletech", "public", "starmap", "logos")
LOGOS = os.path.join(ASSETS, "emblems", "factions")
TAMANO_LOGO = 128
# La ficha del juego enseña un planeta según el clima del sistema: hay una imagen por etiqueta de clima
# (planet_climate_terran.dds), de 64 px en DXT1, y la del sistema es la de su primera etiqueta de clima.
PLANETAS = os.path.join(ASSETS, "sprites", "Planets")
RUTA_PLANETAS = os.path.join(RUTA_LOGOS, "..", "planets")
# La calavera de CHALLENGE no es una textura: el juego importa sus iconos vectoriales con SVG Importer,
# que los guarda como un Mesh de Unity (clase 43) ya triangulado, en sharedassets0.assets. Se vuelve a
# escribir como SVG con un solo trazado de triángulos: así no se ven las juntas entre ellos.
ARCHIVO_CALAVERA = os.path.join("BattleTech_Data", "sharedassets0.assets")
MALLA_CALAVERA = "uixSvgIcon_skullAtlas"
RUTA_CALAVERA = os.path.join(RUTA_LOGOS, "..", "skull.svg")
# Lado del SVG: los vértices van de -0,3 a 0,3 y se escalan a 0..100.
LADO_SVG = 100
# Las etiquetas de planeta empiezan así; el resto (de pilotos, mapas, eventos…) no hace falta.
PREFIJO_PLANETA = "planet_"


def sistema(ficha):
    descripcion = ficha["Description"]
    return {
        "id": descripcion["Id"],
        "nombre": descripcion["Name"],
        "descripcion": descripcion.get("Details", ""),
        "x": ficha["Position"]["x"],
        "y": ficha["Position"]["y"],
        "dueno": ficha["ownerID"],
        "modos": ficha.get("StartingSystemModes") or [],
        "dificultad": dict(zip(ficha.get("DifficultyModes") or [], ficha.get("DifficultyList") or [])),
        "etiquetas": ficha["Tags"]["items"],
        "empleadores": ficha.get("contractEmployerIDs") or [],
        "objetivos": ficha.get("contractTargetIDs") or [],
        "biomas": ficha.get("SupportedBiomes") or [],
        "mercado_negro": ficha.get("BlackMarketShopItems") or [],
        "tienda_faccion": ficha.get("factionShopOwnerID"),
    }


def leer_dds(ruta):
    """Ancho, alto y píxeles RGBA del primer nivel de una textura DDS en DXT5."""
    with open(ruta, "rb") as archivo:
        datos = archivo.read()
    alto, ancho = struct.unpack_from("<II", datos, 12)
    if datos[84:88] != b"DXT5":
        raise ValueError(f"{ruta}: formato {datos[84:88]!r}, solo se lee DXT5")
    return ancho, alto, descomprimir_dxt5(datos[128:], ancho, alto)


def voltear(pixeles, ancho, alto):
    # Las DDS de Unity guardan las filas de abajo arriba.
    fila = ancho * 4
    return b"".join(pixeles[(alto - 1 - y) * fila:(alto - y) * fila] for y in range(alto))


def extraer_planetas(juego):
    # Las imágenes de los planetas no llevan transparencia: el juego las enseña en un recuadro negro.
    from extraer_argo_battletech import escribir_png_rgb, leer_dds as leer_dds_rgb
    os.makedirs(RUTA_PLANETAS, exist_ok=True)
    nombres = sorted(nombre for nombre in os.listdir(os.path.join(juego, PLANETAS)) if nombre.endswith(".dds"))
    for nombre in nombres:
        ancho, alto, pixeles = leer_dds_rgb(os.path.join(juego, PLANETAS, nombre))
        escribir_png_rgb(os.path.join(RUTA_PLANETAS, nombre[:-len(".dds")] + ".png"), ancho, alto, pixeles)
    print(f"planetas: {len(nombres)} imágenes en {os.path.normpath(RUTA_PLANETAS)}")


def extraer_calavera(juego):
    with open(os.path.join(juego, ARCHIVO_CALAVERA), "rb") as archivo:
        datos = archivo.read()
    vertices, triangulos = leer_malla_2d(datos, buscar_objeto(datos, CLASE_MESH, MALLA_CALAVERA))
    xs, ys = [x for x, _ in vertices], [y for _, y in vertices]
    escala = LADO_SVG / max(max(xs) - min(xs), max(ys) - min(ys))
    ancho, alto = (max(xs) - min(xs)) * escala, (max(ys) - min(ys)) * escala

    # La Y de Unity crece hacia arriba y la del SVG hacia abajo.
    def punto(indice):
        x, y = vertices[indice]
        return f"{(x - min(xs)) * escala:.2f} {(max(ys) - y) * escala:.2f}"

    trazado = "".join(f"M{punto(a)}L{punto(b)}L{punto(c)}Z" for a, b, c in triangulos)
    with open(RUTA_CALAVERA, "w", encoding="utf-8") as archivo:
        archivo.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ancho:.2f} {alto:.2f}">'
                      f'<path fill="#fff" d="{trazado}"/></svg>\n')
    print(f"calavera: {len(triangulos)} triángulos en {os.path.normpath(RUTA_CALAVERA)}")


def guardar(nombre, datos):
    with open(os.path.join(RUTA_DESTINO, nombre), "w", encoding="utf-8") as archivo:
        if isinstance(datos, list):
            archivo.write("[\n" + ",\n".join(json.dumps(fila, ensure_ascii=False) for fila in datos) + "\n]\n")
        else:
            json.dump(datos, archivo, ensure_ascii=False, indent=1, sort_keys=True)
            archivo.write("\n")
    print(f"{nombre}: {len(datos)} entradas")


def main():
    if len(sys.argv) != 2:
        print('Uso: python3 tools/extraer_mapa_battletech.py "/ruta/a/BATTLETECH"')
        sys.exit(1)
    juego = sys.argv[1]
    os.makedirs(RUTA_DESTINO, exist_ok=True)
    os.makedirs(RUTA_LOGOS, exist_ok=True)

    sistemas = [sistema(ficha) for ficha in leer_carpeta(juego, "starsystem").values()]
    facciones = {}
    for nombre, ficha in leer_carpeta(juego, "factions").items():
        if not ficha.get("factionID") or nombre.endswith("Template"):
            continue
        facciones[ficha["factionID"]] = {
            "nombre": ficha.get("Name"),
            "corto": ficha.get("ShortName"),
            "color": ficha.get("factionMapColor"),
            "icono": ficha.get("icon"),
        }
    etiquetas = {nombre: etiqueta for nombre, etiqueta in leer_etiquetas(juego).items() if nombre.startswith(PREFIJO_PLANETA)}

    # Logos de las facciones que salen en el mapa: dueños y facciones de los contratos.
    usadas = {s["dueno"] for s in sistemas} | {f for s in sistemas for f in s["empleadores"] + s["objetivos"]}
    escritos = 0
    for id_faccion in sorted(usadas):
        icono = facciones.get(id_faccion, {}).get("icono")
        ruta = os.path.join(juego, LOGOS, f"{icono}.dds") if icono else None
        if not ruta or not os.path.exists(ruta):
            print(f"Aviso: {id_faccion} no tiene logo")
            continue
        ancho, alto, pixeles = leer_dds(ruta)
        escribir_png(os.path.join(RUTA_LOGOS, f"{icono}.png"), TAMANO_LOGO,
                     reducir(ancho, alto, voltear(pixeles, ancho, alto), TAMANO_LOGO))
        escritos += 1

    extraer_planetas(juego)
    extraer_calavera(juego)

    guardar("sistemas.json", sorted(sistemas, key=lambda s: s["id"]))
    guardar("facciones.json", facciones)
    guardar("etiquetas.json", etiquetas)
    print(f"logos: {escritos} imágenes en {os.path.normpath(RUTA_LOGOS)}")


if __name__ == "__main__":
    main()
