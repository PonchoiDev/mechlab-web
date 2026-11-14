import json
import os
import shutil
import struct
import sys
import zlib

from battletech import ASSETS, DATOS, leer_carpeta, leer_constantes, leer_json
from extraer_mapa import escribir_png, reducir
from ue4 import descomprimir_dxt5

# Copia de la instalación de BATTLETECH (Harebrained Schemes, 2018) lo que hace falta para la página
# de la Argo: las mejoras de la nave, los textos de las estadísticas que cambian, las categorías, la
# tripulación que las presenta y las constantes de la economía de la nave. Lo guarda en
# tools/datos-juego/battletech/argo/ y las ilustraciones y los retratos en battletech/public/argo/.
# Después, generar_argo_battletech.py trabaja con esos archivos sin tocar el juego.
#
#   python3 tools/extraer_argo_battletech.py "/ruta/a/BATTLETECH"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "argo")
RUTA_IMAGENES = os.path.join(DIRECTORIO_SCRIPT, "..", "battletech", "public", "argo")
ILUSTRACIONES = os.path.join(ASSETS, "sprites", "Illustrations")
# La Argo en órbita: no la usa ninguna mejora, pero es la que el juego enseña al viajar, y sirve de
# portada de la página.
PORTADA = "uixTxrSpot_ArgoTravel"
# Las ilustraciones miden 750 × 300 en DXT1; a la mitad pesan una cuarta parte y bastan para la
# cabecera de una ficha.
DIVISOR_ILUSTRACION = 2
# Retratos de la tripulación, al doble de lo que ocupan en la página (48 px).
TAMANO_RETRATO = 96
# Las constantes de la nave dentro de SimGameConstants.json, por sección.
CONSTANTES = {
    "Finances": ["ArgoBaseMaintenanceCost", "MonthLength"],
    "Story": ["StartingArgoUpgrades", "StartingMechTechSkill", "StartingMedTechSkill", "StartingMorale", "MaxMorale"],
    "CareerMode": ["StartingArgoUpgrades", "ArgoUpgradeCostMultiplier", "ArgoMaintenanceMultiplier"],
}


def descomprimir_dxt1(datos, ancho, alto):
    """Bloques de 4x4 píxeles: dos colores en RGB565 y dos bits por píxel para elegir entre ellos y
    sus mezclas. Las ilustraciones no tienen transparencia: el modo de tres colores no aparece, pero
    se respeta por si acaso."""
    pixeles = bytearray(ancho * alto * 3)
    bloques_por_fila = ancho // 4

    def rgb565(valor):
        return ((valor >> 11) * 255 // 31, ((valor >> 5) & 63) * 255 // 63, (valor & 31) * 255 // 31)

    for bloque_y in range(alto // 4):
        for bloque_x in range(bloques_por_fila):
            c0, c1, bits = struct.unpack_from("<HHI", datos, (bloque_y * bloques_por_fila + bloque_x) * 8)
            p0, p1 = rgb565(c0), rgb565(c1)
            if c0 > c1:
                colores = [p0, p1, tuple((2 * a + b) // 3 for a, b in zip(p0, p1)), tuple((a + 2 * b) // 3 for a, b in zip(p0, p1))]
            else:
                colores = [p0, p1, tuple((a + b) // 2 for a, b in zip(p0, p1)), (0, 0, 0)]
            for i in range(16):
                destino = ((bloque_y * 4 + i // 4) * ancho + bloque_x * 4 + i % 4) * 3
                pixeles[destino:destino + 3] = bytes(colores[(bits >> (2 * i)) & 3])
    return pixeles


def reducir_rgb(ancho, alto, pixeles, divisor):
    """Divide el tamaño de una imagen RGB promediando cuadrados de divisor × divisor píxeles."""
    nuevo_ancho, nuevo_alto = ancho // divisor, alto // divisor
    salida = bytearray(nuevo_ancho * nuevo_alto * 3)
    for y in range(nuevo_alto):
        for x in range(nuevo_ancho):
            suma = [0, 0, 0]
            for dy in range(divisor):
                fila = ((y * divisor + dy) * ancho + x * divisor) * 3
                for dx in range(divisor):
                    for canal in range(3):
                        suma[canal] += pixeles[fila + dx * 3 + canal]
            destino = (y * nuevo_ancho + x) * 3
            salida[destino:destino + 3] = bytes(valor // (divisor * divisor) for valor in suma)
    return nuevo_ancho, nuevo_alto, salida


def escribir_png_rgb(ruta, ancho, alto, pixeles):
    filas = b"".join(b"\0" + bytes(pixeles[y * ancho * 3:(y + 1) * ancho * 3]) for y in range(alto))

    def bloque(tipo, datos):
        return struct.pack(">I", len(datos)) + tipo + datos + struct.pack(">I", zlib.crc32(tipo + datos))

    with open(ruta, "wb") as archivo:
        archivo.write(b"\x89PNG\r\n\x1a\n" + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
                      + bloque(b"IDAT", zlib.compress(filas, 9)) + bloque(b"IEND", b""))


def leer_dds(ruta):
    """Una textura DDS suelta del juego, en RGB: cabecera de 128 bytes y los bloques DXT1 o DXT5."""
    with open(ruta, "rb") as archivo:
        datos = archivo.read()
    alto, ancho = struct.unpack_from("<II", datos, 12)
    # Las ilustraciones miden 750 px de ancho, que no es múltiplo de 4: los bloques cubren 752 y la
    # última columna de bloques se recorta.
    ancho_bloques, alto_bloques = -(-ancho // 4) * 4, -(-alto // 4) * 4
    formato = datos[84:88]
    if formato == b"DXT1":
        pixeles = descomprimir_dxt1(datos[128:], ancho_bloques, alto_bloques)
    elif formato == b"DXT5":
        # Las de la propulsión y la estructura van en DXT5, aunque su alfa es opaco: se descarta.
        rgba = descomprimir_dxt5(datos[128:], ancho_bloques, alto_bloques)
        pixeles = bytearray(b"".join(rgba[i:i + 3] for i in range(0, len(rgba), 4)))
    else:
        raise ValueError(f"{ruta}: formato {formato!r}, se esperaba DXT1 o DXT5")
    # Unity guarda las texturas de abajo arriba: las filas se leen al revés.
    recorte = bytearray(b"".join(pixeles[y * ancho_bloques * 3:(y * ancho_bloques + ancho) * 3] for y in reversed(range(alto))))
    return ancho, alto, recorte


def leer_png_rgba(ruta):
    """Un PNG de 8 bits por canal sin entrelazar, como los retratos de la tripulación, en RGBA."""
    with open(ruta, "rb") as archivo:
        datos = archivo.read()
    posicion, idat, cabecera = 8, b"", None
    while posicion < len(datos):
        longitud, tipo = struct.unpack_from(">I4s", datos, posicion)
        contenido = datos[posicion + 8:posicion + 8 + longitud]
        if tipo == b"IHDR":
            cabecera = struct.unpack(">IIBBBBB", contenido)
        elif tipo == b"IDAT":
            idat += contenido
        posicion += 12 + longitud
    ancho, alto, bits, color, _, _, entrelazado = cabecera
    canales = {2: 3, 6: 4}.get(color)
    if bits != 8 or canales is None or entrelazado:
        raise ValueError(f"{ruta}: PNG no admitido (bits {bits}, color {color}, entrelazado {entrelazado})")
    crudo = zlib.decompress(idat)
    paso = ancho * canales
    filas, anterior = [], bytearray(paso)
    for y in range(alto):
        inicio = y * (paso + 1)
        filtro, fila = crudo[inicio], bytearray(crudo[inicio + 1:inicio + 1 + paso])
        for i in range(paso):
            izquierda = fila[i - canales] if i >= canales else 0
            arriba = anterior[i]
            diagonal = anterior[i - canales] if i >= canales else 0
            if filtro == 1:
                fila[i] = (fila[i] + izquierda) & 255
            elif filtro == 2:
                fila[i] = (fila[i] + arriba) & 255
            elif filtro == 3:
                fila[i] = (fila[i] + (izquierda + arriba) // 2) & 255
            elif filtro == 4:
                p = izquierda + arriba - diagonal
                pa, pb, pc = abs(p - izquierda), abs(p - arriba), abs(p - diagonal)
                fila[i] = (fila[i] + (izquierda if pa <= pb and pa <= pc else arriba if pb <= pc else diagonal)) & 255
        filas.append(fila)
        anterior = fila
    if canales == 4:
        return ancho, alto, b"".join(filas)
    return ancho, alto, b"".join(bytes(fila[i:i + 3]) + b"\xff" for fila in filas for i in range(0, paso, 3))


def guardar_json(nombre, contenido):
    with open(os.path.join(RUTA_DESTINO, nombre), "w", encoding="utf-8") as archivo:
        json.dump(contenido, archivo, ensure_ascii=False, indent=2)
        archivo.write("\n")


def main():
    if len(sys.argv) != 2:
        print(f"Uso: python3 {sys.argv[0]} \"/ruta/a/BATTLETECH\"")
        sys.exit(1)
    juego = sys.argv[1]
    mejoras = leer_carpeta(juego, "shipUpgrades")
    if not mejoras:
        raise ValueError("No hay mejoras de la Argo en data/shipUpgrades: ¿ha cambiado el juego?")

    # Las mejoras, tal cual: el lector del generador ya admite las comas y comentarios del juego.
    destino_mejoras = os.path.join(RUTA_DESTINO, "shipUpgrades")
    shutil.rmtree(destino_mejoras, ignore_errors=True)
    os.makedirs(destino_mejoras)
    for nombre in mejoras:
        shutil.copyfile(os.path.join(juego, DATOS, "shipUpgrades", nombre + ".json"), os.path.join(destino_mejoras, nombre + ".json"))

    estadisticas = sorted({estadistica["name"] for mejora in mejoras.values() for estadistica in mejora.get("Stats") or []})
    descripciones = {}
    for estadistica in estadisticas:
        ruta = os.path.join(juego, DATOS, "simGameStatDesc", f"SimGameStatDesc_{estadistica}.json")
        if os.path.exists(ruta):
            descripciones[estadistica] = leer_json(ruta)
    guardar_json("estadisticas.json", descripciones)
    guardar_json("categorias.json", leer_json(os.path.join(juego, DATOS, "enums", "ShipUpgradeCategory.json")))

    tripulacion = {}
    for id_reparto in sorted({mejora["AssignedCastDefId"] for mejora in mejoras.values() if mejora.get("AssignedCastDefId")}):
        reparto = leer_json(os.path.join(juego, DATOS, "cast", id_reparto + ".json"))
        tripulacion[id_reparto] = {clave: reparto[clave] for clave in ("firstName", "lastName", "rank")}
        tripulacion[id_reparto]["retrato"] = reparto["defaultEmotePortrait"]["portraitAssetPath"]
    guardar_json("tripulacion.json", tripulacion)

    todas = leer_constantes(juego)
    guardar_json("constantes.json", {seccion: {clave: todas[seccion][clave] for clave in claves} for seccion, claves in CONSTANTES.items()})

    os.makedirs(os.path.join(RUTA_IMAGENES, "crew"), exist_ok=True)
    ilustraciones = sorted({mejora["Illustration"] for mejora in mejoras.values() if mejora.get("Illustration")} | {PORTADA})
    for ilustracion in ilustraciones:
        ancho, alto, pixeles = leer_dds(os.path.join(juego, ILUSTRACIONES, ilustracion + ".dds"))
        ancho, alto, pixeles = reducir_rgb(ancho, alto, pixeles, DIVISOR_ILUSTRACION)
        escribir_png_rgb(os.path.join(RUTA_IMAGENES, ilustracion.removeprefix("uixTxrSpot_") + ".png"), ancho, alto, pixeles)
    for id_reparto, persona in tripulacion.items():
        ancho, alto, pixeles = leer_png_rgba(os.path.join(juego, ASSETS, persona["retrato"]))
        if ancho != alto:
            raise ValueError(f"El retrato de {id_reparto} no es cuadrado")
        escribir_png(os.path.join(RUTA_IMAGENES, "crew", persona["firstName"].split()[-1] + ".png"), TAMANO_RETRATO,
                     reducir(ancho, alto, pixeles, TAMANO_RETRATO))

    print(f"{len(mejoras)} mejoras, {len(descripciones)} estadísticas, {len(tripulacion)} tripulantes y "
          f"{len(ilustraciones)} ilustraciones en {RUTA_DESTINO}")


if __name__ == "__main__":
    main()
