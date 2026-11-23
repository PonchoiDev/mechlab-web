import os
import struct
import sys
import zlib

from extraer_argo_battletech import CLASE_TEXTURA, RECURSOS, Lector, leer_recursos, leer_textura_dxt5
from extraer_mapa import CONTENIDO, PAK_DEL_JUEGO
from ue4 import Pak, leer_textura

# Extrae los logos de los dos juegos para las carátulas de la portada (site/): el de MechWarrior 5:
# Mercenaries, del .pak de su instalación, y el de BATTLETECH, de su resources.assets. Solo hace falta
# repetirlo si un juego cambia su logo.
#
#   python3 tools/extraer_logos.py "<carpeta de MW5>" "<carpeta de BATTLETECH>"
RUTA_SITIO = os.path.join(os.path.dirname(__file__), "..", "site")
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


def main():
    if len(sys.argv) != 3:
        sys.exit('Uso: python3 tools/extraer_logos.py "<carpeta de MW5>" "<carpeta de BATTLETECH>"')
    for nombre, (ancho, alto, pixeles) in (("mw5-logo.png", logo_mw5(sys.argv[1])),
                                           ("battletech-logo.png", logo_battletech(sys.argv[2]))):
        escribir_png_rgba(os.path.join(RUTA_SITIO, nombre), ancho, alto, pixeles)
        print(f"site/{nombre}: {ancho} × {alto}")


if __name__ == "__main__":
    main()
