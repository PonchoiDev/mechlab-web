import os
import struct
import sys
import zlib

from extraer_argo_battletech import CLASE_TEXTURA, RECURSOS, Lector, leer_recursos, leer_textura_dxt5
from extraer_mapa import CONTENIDO, PAK_DEL_JUEGO
from ue4 import Pak, leer_textura

# Extrae los logos de los dos juegos para las carátulas de la portada (site/): el de MechWarrior 5:
# Mercenaries, del .pak de su instalación, y el de BATTLETECH, de su resources.assets. También el icono de
# MW5 (el «M5» de la biblioteca de Steam), del ejecutable, para el interruptor Vanilla de la página de
# builds (public/mechlab/mw5-icon.png). Solo hace falta repetirlo si un juego cambia su logo.
#
#   python3 tools/extraer_logos.py "<carpeta de MW5>" "<carpeta de BATTLETECH>"
RUTA_SITIO = os.path.join(os.path.dirname(__file__), "..", "site")
RUTA_ICONO_MW5 = os.path.join(os.path.dirname(__file__), "..", "public", "mechlab", "mw5-icon.png")
EJECUTABLE_MW5 = os.path.join("MW5Mercs", "Binaries", "Win64", "MechWarrior-Win64-Shipping.exe")
RT_ICON, RT_GROUP_ICON = 3, 14
# El de 1200 px del menú, con «MERCENARIES» y el 5 en degradado; hay otros más pequeños y uno en negativo.
LOGO_MW5 = "UI/Textures/GenericButtons_Icons/MW5_Logo_1200_UIX"
# El de la pantalla de inicio. En el juego es todo blanco: la portada pinta la A de naranja.
LOGO_BATTLETECH = "uixTxr_landingLogo"


def escribir_png_rgba(ruta, ancho, alto, pixeles):
    filas = b"".join(b"\0" + bytes(pixeles[y * ancho * 4:(y + 1) * ancho * 4]) for y in range(alto))

    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))

    with open(ruta, "wb") as archivo:
        archivo.write(b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 6, 0, 0, 0))
                      + bloque(b"IDAT", zlib.compress(filas, 9)) + bloque(b"IEND", b""))


def logo_mw5(juego):
    pak = Pak(os.path.join(juego, PAK_DEL_JUEGO))
    return leer_textura(pak, CONTENIDO + LOGO_MW5)


def logo_battletech(juego):
    ruta = os.path.join(juego, RECURSOS)
    datos, objetos = leer_recursos(ruta)
    for posicion, _, clase in objetos:
        if clase == CLASE_TEXTURA and Lector(datos, posicion).cadena() == LOGO_BATTLETECH:
            return leer_textura_dxt5(datos, posicion, ruta + ".resS")
    raise ValueError(f"No está la textura {LOGO_BATTLETECH} en {RECURSOS}")


def recursos_pe(ruta):
    """Los recursos de un ejecutable de Windows por tipo e id (el primer idioma de cada uno)."""
    with open(ruta, "rb") as archivo:
        datos = archivo.read()
    pe = struct.unpack_from("<I", datos, 0x3C)[0]
    num_secciones = struct.unpack_from("<H", datos, pe + 6)[0]
    tam_opcional = struct.unpack_from("<H", datos, pe + 20)[0]
    pe32_plus = struct.unpack_from("<H", datos, pe + 24)[0] == 0x20B
    # El directorio de recursos es la tercera entrada de los directorios de datos de la cabecera opcional.
    rva_recursos = struct.unpack_from("<I", datos, pe + 24 + (112 if pe32_plus else 96) + 2 * 8)[0]
    tabla = pe + 24 + tam_opcional
    secciones = [struct.unpack_from("<8sIIII", datos, tabla + 40 * i) for i in range(num_secciones)]

    def a_fichero(rva):
        for _, tam_virtual, dir_virtual, tam_bruto, dir_bruta in secciones:
            if dir_virtual <= rva < dir_virtual + max(tam_virtual, tam_bruto):
                return rva - dir_virtual + dir_bruta
        raise ValueError(f"RVA fuera de las secciones: {rva:#x}")

    base = a_fichero(rva_recursos)

    def entradas(posicion):
        con_nombre, con_id = struct.unpack_from("<HH", datos, posicion + 12)
        return [struct.unpack_from("<II", datos, posicion + 16 + 8 * i) for i in range(con_nombre + con_id)]

    def hoja(destino):
        while destino & 0x80000000:
            destino = entradas(base + (destino & 0x7FFFFFFF))[0][1]
        rva, tam = struct.unpack_from("<II", datos, base + destino)
        return datos[a_fichero(rva):a_fichero(rva) + tam]

    return {tipo: {ident: hoja(d) for ident, d in entradas(base + (destino & 0x7FFFFFFF))}
            for tipo, destino in entradas(base)}


def icono_mw5(juego):
    """El PNG de mayor tamaño del icono del ejecutable (256 px)."""
    recursos = recursos_pe(os.path.join(juego, EJECUTABLE_MW5))
    grupo = next(iter(recursos[RT_GROUP_ICON].values()))
    imagenes = [struct.unpack_from("<BBBBHHIH", grupo, 6 + 14 * i) for i in range(struct.unpack_from("<H", grupo, 4)[0])]
    *_, ident = max(imagenes, key=lambda imagen: (imagen[0] or 256, imagen[5]))
    png = recursos[RT_ICON][ident]
    if not png.startswith(b"\x89PNG"):
        raise ValueError("El icono mayor de MW5 no es un PNG")
    return png


def main():
    if len(sys.argv) != 3:
        sys.exit('Uso: python3 tools/extraer_logos.py "<carpeta de MW5>" "<carpeta de BATTLETECH>"')
    for nombre, (ancho, alto, pixeles) in (("mw5-logo.png", logo_mw5(sys.argv[1])),
                                           ("battletech-logo.png", logo_battletech(sys.argv[2]))):
        escribir_png_rgba(os.path.join(RUTA_SITIO, nombre), ancho, alto, pixeles)
        print(f"site/{nombre}: {ancho} × {alto}")
    with open(RUTA_ICONO_MW5, "wb") as archivo:
        archivo.write(icono_mw5(sys.argv[1]))
    print("public/mechlab/mw5-icon.png")


if __name__ == "__main__":
    main()
