import json
import os
import struct
import urllib.parse
import urllib.request
import zlib

from imagenes_sarna import API_SARNA

# Descarga de Sarna los dibujos del banner de la portada y los guarda en site/banner/ como líneas sobre
# transparente. La portada los usa de máscara y los pinta del verde de la web: así el color es exacto y no
# queda a la vista el fondo blanco de los dibujos, que con un filtro y mezcla de capas se veía como una caja.
# Solo hace falta repetirlo si cambian los dibujos.
#
#   python3 tools/imagenes_portada.py
RUTA_BANNER = os.path.join(os.path.dirname(__file__), "..", "site", "banner")
ANCHO = 600
DIBUJOS = {
    "warhammer.png": "File:Warhammer RGilClan v07.png",
    "black-knight.png": "File:Black Knight RGilClan v12.png",
    "kodiak.png": "File:Kodiak RGilClan v21.png",
    "union.png": "File:Union TRO3025Revised.png",
}
AGENTE = {"User-Agent": "MW-Builder-data-script/1.0"}


def urls_de_sarna(archivos):
    parametros = urllib.parse.urlencode({
        "action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url",
        "iiurlwidth": ANCHO, "titles": "|".join(archivos),
    })
    peticion = urllib.request.Request(f"{API_SARNA}?{parametros}", headers=AGENTE)
    with urllib.request.urlopen(peticion, timeout=30) as respuesta:
        paginas = json.load(respuesta)["query"]["pages"].values()
    return {pagina["title"]: (pagina["imageinfo"][0].get("thumburl") or pagina["imageinfo"][0]["url"]) for pagina in paginas}


def descargar(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=AGENTE), timeout=60) as respuesta:
        return respuesta.read()


def leer_png(datos):
    """Ancho, alto, gris (0 negro, 255 blanco) y alfa de cada píxel de un PNG de 8 bits sin entrelazar."""
    posicion, idat, paleta = 8, b"", None
    while posicion < len(datos):
        tamano, tipo = struct.unpack(">I4s", datos[posicion:posicion + 8])
        contenido = datos[posicion + 8:posicion + 8 + tamano]
        if tipo == b"IHDR":
            ancho, alto, bits, color, _, _, entrelazado = struct.unpack(">IIBBBBB", contenido)
        elif tipo == b"PLTE":
            paleta = contenido
        elif tipo == b"IDAT":
            idat += contenido
        posicion += 12 + tamano
    if bits != 8 or entrelazado:
        raise ValueError(f"PNG de {bits} bits o entrelazado: no se admite")
    canales = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    paso = ancho * canales
    crudo = zlib.decompress(idat)
    pixeles, anterior = bytearray(), bytearray(paso)
    for y in range(alto):
        filtro = crudo[y * (paso + 1)]
        fila = bytearray(crudo[y * (paso + 1) + 1:(y + 1) * (paso + 1)])
        for x in range(paso):
            a = fila[x - canales] if x >= canales else 0
            b = anterior[x]
            c = anterior[x - canales] if x >= canales else 0
            if filtro == 1:
                fila[x] = (fila[x] + a) & 255
            elif filtro == 2:
                fila[x] = (fila[x] + b) & 255
            elif filtro == 3:
                fila[x] = (fila[x] + ((a + b) >> 1)) & 255
            elif filtro == 4:
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                fila[x] = (fila[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        pixeles += fila
        anterior = fila
    gris, alfa = bytearray(ancho * alto), bytearray(b"\xff" * (ancho * alto))
    for i in range(ancho * alto):
        p = pixeles[i * canales:(i + 1) * canales]
        if color == 3:
            p = paleta[p[0] * 3:p[0] * 3 + 3]
        gris[i] = p[0] if len(p) <= 2 else (p[0] * 3 + p[1] * 6 + p[2]) // 10
        if color in (4, 6):
            alfa[i] = p[-1]
    return ancho, alto, gris, alfa


def lineas_sobre_transparente(ancho, alto, gris, alfa):
    """PNG con las líneas en negro y la opacidad de lo oscuro que era cada píxel: el blanco desaparece."""
    filas = bytearray()
    for y in range(alto):
        filas.append(0)
        for x in range(ancho):
            i = y * ancho + x
            filas += bytes((0, 0, 0, (255 - gris[i]) * alfa[i] // 255))

    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))

    return (b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 6, 0, 0, 0))
            + bloque(b"IDAT", zlib.compress(bytes(filas), 9)) + bloque(b"IEND", b""))


def main():
    os.makedirs(RUTA_BANNER, exist_ok=True)
    urls = urls_de_sarna(list(DIBUJOS.values()))
    for nombre, archivo in DIBUJOS.items():
        if archivo not in urls:
            raise ValueError(f"Sarna no tiene {archivo}")
        ancho, alto, gris, alfa = leer_png(descargar(urls[archivo]))
        with open(os.path.join(RUTA_BANNER, nombre), "wb") as destino:
            destino.write(lineas_sobre_transparente(ancho, alto, gris, alfa))
        print(f"site/banner/{nombre}: {ancho} × {alto}")


if __name__ == "__main__":
    main()
