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
# tools/datos-juego/battletech/argo/; las ilustraciones, los retratos y el plano de la nave en
# battletech/public/argo/, y los iconos de la pantalla Ship Upgrades en battletech/public/argo/icons/.
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
# La opción de carrera «Reduced Argo Upgrade Costs» y su valor activado, que cambia los dos
# multiplicadores de CareerMode.
DIFICULTAD = os.path.join("constants", "CareerDifficultySettings.json")
OPCION_PRECIO_REDUCIDO = ("diff_argoUpgradeCost", "diff_AUCR_on")
# Lo que no está en StreamingAssets va en los assets de Unity: los iconos de la pantalla Ship Upgrades
# (Description.Icon de cada mejora y los de sus tres secciones) y el plano de la nave.
RECURSOS = os.path.join("BattleTech_Data", "resources.assets")
PREFIJO_ICONO = "uixSvgIcon_shipUpgrade_"
PLANO = "uixTxrIndc_argoNavDiagram"
CLASE_MALLA = 43
CLASE_TEXTURA = 28
CLASE_SCRIPT = 114
FORMATO_DXT5 = 12


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


class Lector:
    def __init__(self, datos, posicion=0, orden="<"):
        self.datos, self.posicion, self.orden = datos, posicion, orden

    def leer(self, formato):
        valores = struct.unpack_from(self.orden + formato, self.datos, self.posicion)
        self.posicion += struct.calcsize(self.orden + formato)
        return valores if len(valores) > 1 else valores[0]

    def alinear(self):
        self.posicion = (self.posicion + 3) & ~3

    def cadena_c(self):
        fin = self.datos.index(b"\0", self.posicion)
        texto = self.datos[self.posicion:fin].decode()
        self.posicion = fin + 1
        return texto

    def bytes(self):
        """Un array de Unity: su longitud y su contenido, alineado a 4."""
        longitud = self.leer("i")
        contenido = self.datos[self.posicion:self.posicion + longitud]
        self.posicion += longitud
        self.alinear()
        return contenido

    def cadena(self):
        return self.bytes().decode("utf-8", "replace")

    def saltar_array(self, tamano):
        elementos = self.leer("i")
        self.posicion += elementos * tamano


def leer_recursos(ruta):
    """Los objetos de un SerializedFile de Unity 2018.4 (versión 17) sin árbol de tipos, como
    resources.assets: posición, tamaño y clase de cada uno."""
    with open(ruta, "rb") as archivo:
        datos = archivo.read()
    lector = Lector(datos, 0, ">")
    _, _, version, inicio = lector.leer("IIII")
    if version != 17:
        raise ValueError(f"{ruta}: SerializedFile versión {version}, se esperaba 17")
    lector.orden = ">" if lector.leer("B") else "<"
    lector.posicion += 3
    lector.cadena_c()
    lector.leer("i")
    if lector.leer("?"):
        raise ValueError(f"{ruta}: trae árbol de tipos, que este lector no sabe leer")
    clases = []
    for _ in range(lector.leer("i")):
        clase = lector.leer("i")
        lector.leer("?h")
        # Los scripts llevan además el hash de su clase.
        lector.posicion += 32 if clase == CLASE_SCRIPT or clase < 0 else 16
        clases.append(clase)
    objetos = []
    for _ in range(lector.leer("i")):
        lector.alinear()
        _, posicion, tamano, tipo = lector.leer("qIIi")
        objetos.append((inicio + posicion, tamano, clases[tipo]))
    return datos, objetos


def leer_malla(datos, posicion):
    """Nombre, vértices y triángulos de una malla de Unity 2018.4 sin comprimir. Las de los iconos
    traen posición (tres float) y color (cuatro bytes) por vértice, e índices de 16 bits."""
    lector = Lector(datos, posicion)
    nombre = lector.cadena()
    lector.saltar_array(48)  # submallas
    lector.saltar_array(40)  # formas de mezcla: vértices
    lector.saltar_array(12)  # formas
    for _ in range(lector.leer("i")):  # canales de las formas
        lector.cadena()
        lector.posicion += 12
    lector.saltar_array(4)  # pesos
    lector.saltar_array(64)  # bind poses
    lector.saltar_array(4)  # huesos
    lector.posicion += 4  # hueso raíz
    compresion = lector.leer("B")
    lector.leer("BBB")
    lector.alinear()
    formato_indices = lector.leer("i")
    indices = lector.bytes()
    vertices = lector.leer("I")
    canales = [lector.leer("BBBB") for _ in range(lector.leer("i"))]
    datos_vertices = lector.bytes()
    # Canal 0: posición (float32 × 3); canal 3: color (unorm8 × 4), los dos en el flujo 0.
    if compresion or formato_indices != 0 or canales[0] != (0, 0, 0, 3) or canales[3][2:] != (2, 4):
        raise ValueError(f"La malla {nombre} no tiene el formato de los iconos SVG: ¿ha cambiado el juego?")
    paso = len(datos_vertices) // vertices
    color = canales[3][1]
    posiciones = [struct.unpack_from("<ff", datos_vertices, i * paso) for i in range(vertices)]
    colores = {datos_vertices[i * paso + color:i * paso + color + 4] for i in range(vertices)}
    return nombre, posiciones, struct.unpack(f"<{len(indices) // 2}H", indices), colores


def escribir_svg(ruta, posiciones, triangulos):
    """Los triángulos de un icono en un solo trazado, que así no deja costuras entre ellos. Unity
    tiene la y hacia arriba y SVG hacia abajo."""
    puntos = [(x, -y) for x, y in posiciones]
    xs = [x for x, _ in puntos]
    ys = [y for _, y in puntos]
    trazado = "".join("M{:.3f} {:.3f}L{:.3f} {:.3f}L{:.3f} {:.3f}Z".format(*puntos[a], *puntos[b], *puntos[c])
                      for a, b, c in zip(triangulos[0::3], triangulos[1::3], triangulos[2::3]))
    caja = f"{min(xs):.3f} {min(ys):.3f} {max(xs) - min(xs):.3f} {max(ys) - min(ys):.3f}"
    with open(ruta, "w", encoding="utf-8") as archivo:
        archivo.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{caja}"><path fill="#fff" d="{trazado}"/></svg>\n')


def leer_textura_dxt5(datos, posicion, recursos_externos):
    """Una textura DXT5 de Unity 2018.4 cuyos píxeles están en el .resS, en RGBA y del derecho."""
    lector = Lector(datos, posicion)
    nombre = lector.cadena()
    lector.leer("i")
    lector.leer("B")
    lector.alinear()
    ancho, alto, _, formato, _ = lector.leer("iiiii")
    lector.leer("BB")
    lector.alinear()
    # Prioridad de streaming, número de imágenes y dimensión, ajustes de filtrado, formato de
    # lightmap y espacio de color.
    lector.posicion += 4 + 8 + 24 + 8
    lector.bytes()
    inicio, tamano = lector.leer("II")
    if formato != FORMATO_DXT5:
        raise ValueError(f"{nombre}: formato {formato}, se esperaba DXT5")
    with open(recursos_externos, "rb") as archivo:
        archivo.seek(inicio)
        rgba = descomprimir_dxt5(archivo.read(tamano), ancho, alto)
    # Unity guarda las texturas de abajo arriba.
    filas = [rgba[y * ancho * 4:(y + 1) * ancho * 4] for y in range(alto)]
    return ancho, alto, b"".join(reversed(filas))


def extraer_recursos(juego, iconos_usados):
    """Los iconos de las mejoras y de las secciones, en SVG, y el plano de la Argo, en PNG."""
    ruta = os.path.join(juego, RECURSOS)
    datos, objetos = leer_recursos(ruta)
    destino_iconos = os.path.join(RUTA_IMAGENES, "icons")
    shutil.rmtree(destino_iconos, ignore_errors=True)
    os.makedirs(destino_iconos)
    iconos, plano = set(), False
    for posicion, _, clase in objetos:
        if clase == CLASE_MALLA:
            if not Lector(datos, posicion).cadena().startswith(PREFIJO_ICONO):
                continue
            nombre, posiciones, triangulos, colores = leer_malla(datos, posicion)
            # Son blancos: la página les da el color del estado de cada mejora.
            if colores != {b"\xff\xff\xff\xff"}:
                raise ValueError(f"El icono {nombre} no es blanco: ¿ha cambiado el juego?")
            escribir_svg(os.path.join(destino_iconos, nombre.removeprefix(PREFIJO_ICONO) + ".svg"), posiciones, triangulos)
            iconos.add(nombre)
        elif clase == CLASE_TEXTURA and Lector(datos, posicion).cadena() == PLANO:
            ancho, alto, pixeles = leer_textura_dxt5(datos, posicion, ruta + ".resS")
            if ancho != alto:
                raise ValueError(f"El plano {PLANO} no es cuadrado")
            escribir_png(os.path.join(RUTA_IMAGENES, "blueprint.png"), ancho, pixeles)
            plano = True
    faltan = set(iconos_usados) - iconos
    if faltan or not plano:
        raise ValueError(f"Faltan en {RECURSOS}: {', '.join(sorted(faltan)) or PLANO}")
    return len(iconos)


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
    constantes = {seccion: {clave: todas[seccion][clave] for clave in claves} for seccion, claves in CONSTANTES.items()}
    ajuste, valor = OPCION_PRECIO_REDUCIDO
    opcion = next(opcion for dificultad in leer_json(os.path.join(juego, DATOS, DIFICULTAD))["difficultyList"] if dificultad["ID"] == ajuste
                  for opcion in dificultad["Options"] if opcion["ID"] == valor)
    constantes["ReducedArgoUpgradeCosts"] = {constante["ConstantName"]: float(constante["ConstantValue"])
                                             for constante in opcion["DifficultyConstants"]}
    guardar_json("constantes.json", constantes)

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

    iconos = extraer_recursos(juego, {mejora["Description"]["Icon"] for mejora in mejoras.values()})

    print(f"{len(mejoras)} mejoras, {len(descripciones)} estadísticas, {len(tripulacion)} tripulantes, "
          f"{len(ilustraciones)} ilustraciones y {iconos} iconos en {RUTA_DESTINO}")


if __name__ == "__main__":
    main()
