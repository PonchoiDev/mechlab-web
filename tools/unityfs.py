import struct

# Lector mínimo de AssetBundles de Unity (formato UnityFS) en Python puro, sin dependencias.
# BATTLETECH guarda los datos de sus DLC (Heavy Metal, Flashpoint y Urban Warfare) en bundles de
# Unity 2018.4 dentro de data/assetbundles/, en lugar de en JSON sueltos como el juego base. Cada
# JSON del DLC es un TextAsset (clase 49) de un SerializedFile v17 dentro del bundle. El juego solo
# comprime con LZ4 la tabla de bloques; aun así se admiten bloques comprimidos con LZ4 por si acaso.

CLASE_TEXT_ASSET = 49
# Bits bajos de las banderas de bloque y de cabecera: tipo de compresión.
SIN_COMPRESION = 0
LZ4 = (2, 3)
# La tabla de bloques va al final del archivo en lugar de tras la cabecera.
INFO_AL_FINAL = 0x80


def descomprimir_lz4(origen):
    """Descompresor de bloque LZ4 (sin marco): secuencias de literales y copias hacia atrás."""
    destino = bytearray()
    i = 0
    n = len(origen)
    while i < n:
        token = origen[i]
        i += 1
        literales = token >> 4
        if literales == 15:
            while True:
                extra = origen[i]
                i += 1
                literales += extra
                if extra != 255:
                    break
        destino += origen[i: i + literales]
        i += literales
        # El último bloque de una secuencia LZ4 termina con literales, sin copia.
        if i >= n:
            break
        desplazamiento = origen[i] | (origen[i + 1] << 8)
        i += 2
        longitud = token & 15
        if longitud == 15:
            while True:
                extra = origen[i]
                i += 1
                longitud += extra
                if extra != 255:
                    break
        longitud += 4
        inicio = len(destino) - desplazamiento
        if desplazamiento >= longitud:
            destino += destino[inicio: inicio + longitud]
        else:
            # Copia solapada: repite el patrón byte a byte, como manda el formato.
            for k in range(longitud):
                destino.append(destino[inicio + k])
    return bytes(destino)


def _cadena(archivo):
    texto = bytearray()
    while True:
        caracter = archivo.read(1)
        if caracter in (b"\0", b""):
            return texto.decode()
        texto += caracter


def _descomprimir(datos, banderas):
    tipo = banderas & 0x3F
    if tipo == SIN_COMPRESION:
        return datos
    if tipo in LZ4:
        return descomprimir_lz4(datos)
    raise ValueError(f"Compresión de Unity no admitida: {tipo}")


def leer_bundle(ruta):
    """Los archivos internos de un bundle UnityFS, como {nombre: bytes}."""
    with open(ruta, "rb") as archivo:
        if _cadena(archivo) != "UnityFS":
            raise ValueError(f"{ruta} no es un bundle UnityFS")
        (version,) = struct.unpack(">I", archivo.read(4))
        _cadena(archivo)
        _cadena(archivo)
        _, tamano_info, _, banderas = struct.unpack(">QIII", archivo.read(20))
        if version >= 7:
            archivo.read((16 - archivo.tell() % 16) % 16)
        if banderas & INFO_AL_FINAL:
            posicion = archivo.tell()
            archivo.seek(-tamano_info, 2)
            info = archivo.read(tamano_info)
            archivo.seek(posicion)
        else:
            info = archivo.read(tamano_info)
        info = _descomprimir(info, banderas)

        # La tabla empieza con un hash de 16 bytes; después, los bloques y los nodos (archivos).
        p = 16
        (num_bloques,) = struct.unpack_from(">I", info, p)
        p += 4
        bloques = []
        for _ in range(num_bloques):
            descomprimido, comprimido, banderas_bloque = struct.unpack_from(">IIH", info, p)
            p += 10
            bloques.append((descomprimido, comprimido, banderas_bloque))
        (num_nodos,) = struct.unpack_from(">I", info, p)
        p += 4
        nodos = []
        for _ in range(num_nodos):
            desplazamiento, tamano, _ = struct.unpack_from(">QQI", info, p)
            p += 20
            fin = info.index(b"\0", p)
            nodos.append((info[p:fin].decode(), desplazamiento, tamano))
            p = fin + 1

        # Los nodos se direccionan sobre los bloques ya descomprimidos y concatenados.
        if all(b[2] & 0x3F == SIN_COMPRESION for b in bloques):
            inicio = archivo.tell()
            archivos = {}
            for nombre, desplazamiento, tamano in nodos:
                archivo.seek(inicio + desplazamiento)
                archivos[nombre] = archivo.read(tamano)
            return archivos
        datos = bytearray()
        for descomprimido, comprimido, banderas_bloque in bloques:
            datos += _descomprimir(archivo.read(comprimido), banderas_bloque)
        return {nombre: bytes(datos[d: d + t]) for nombre, d, t in nodos}


class _Lector:
    def __init__(self, datos, posicion=0, little_endian=True):
        self.datos = datos
        self.p = posicion
        self.orden = "<" if little_endian else ">"

    def leer(self, formato):
        valores = struct.unpack_from(self.orden + formato, self.datos, self.p)
        self.p += struct.calcsize(self.orden + formato)
        return valores if len(valores) > 1 else valores[0]

    def cadena(self):
        fin = self.datos.index(b"\0", self.p)
        texto = self.datos[self.p:fin].decode()
        self.p = fin + 1
        return texto

    def alinear(self):
        self.p = (self.p + 3) & ~3


def _objetos(datos):
    """Objetos de un SerializedFile (versión 17, la de Unity 2018): (inicio, tamaño, clase)."""
    lector = _Lector(datos, 0, little_endian=False)
    _, _, version, desplazamiento_datos = lector.leer("IIII")
    if version != 17:
        raise ValueError(f"SerializedFile versión {version}; solo se admite la 17 (Unity 2018)")
    big_endian = lector.leer("B")
    lector.p += 3
    lector.orden = ">" if big_endian else "<"
    lector.cadena()
    lector.leer("i")
    con_arbol = lector.leer("?")
    clases = []
    for _ in range(lector.leer("i")):
        clase = lector.leer("i")
        lector.leer("?")
        lector.leer("h")
        # Los MonoBehaviour (114) y los tipos de script llevan además el hash del script.
        if clase == 114 or clase < 0:
            lector.p += 16
        lector.p += 16
        if con_arbol:
            nodos, tamano_cadenas = lector.leer("ii")
            lector.p += nodos * 24 + tamano_cadenas
        clases.append(clase)
    objetos = []
    for _ in range(lector.leer("i")):
        lector.alinear()
        lector.leer("q")
        inicio, tamano, indice_tipo = lector.leer("IIi")
        objetos.append((desplazamiento_datos + inicio, tamano, clases[indice_tipo]))
    return objetos


def text_assets(datos):
    """Los TextAsset de un SerializedFile, como (nombre, bytes del contenido)."""
    for inicio, _, clase in _objetos(datos):
        if clase != CLASE_TEXT_ASSET:
            continue
        lector = _Lector(datos, inicio)
        n = lector.leer("i")
        nombre = datos[lector.p: lector.p + n].decode("utf-8", "replace")
        lector.p += n
        lector.alinear()
        n = lector.leer("i")
        yield nombre, datos[lector.p: lector.p + n]


def textos_del_bundle(ruta):
    """Todos los TextAsset de un bundle, como {nombre: bytes}. Los recursos (.resS) no son SerializedFile."""
    textos = {}
    for nombre, datos in leer_bundle(ruta).items():
        if nombre.endswith((".resS", ".resource")):
            continue
        for nombre_texto, contenido in text_assets(datos):
            textos[nombre_texto] = contenido
    return textos
