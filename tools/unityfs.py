import struct

# Lector mínimo de AssetBundles de Unity (formato UnityFS) en Python puro, sin dependencias.
# BATTLETECH guarda los datos de sus DLC (Heavy Metal, Flashpoint y Urban Warfare) en bundles de
# Unity 2018.4 dentro de data/assetbundles/, en lugar de en JSON sueltos como el juego base. Cada
# JSON del DLC es un TextAsset (clase 49) de un SerializedFile v17 dentro del bundle. El juego solo
# comprime con LZ4 la tabla de bloques; aun así se admiten bloques comprimidos con LZ4 por si acaso.

CLASE_TEXT_ASSET = 49
CLASE_MESH = 43
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


def buscar_objeto(datos, clase, nombre):
    """Inicio del objeto de una clase con ese nombre (m_Name, su primer campo) en un SerializedFile."""
    for inicio, _, clase_objeto in _objetos(datos):
        if clase_objeto != clase:
            continue
        lector = _Lector(datos, inicio)
        n = lector.leer("i")
        if datos[lector.p: lector.p + n] == nombre.encode():
            return inicio
    raise ValueError(f"No hay ningún objeto de clase {clase} llamado {nombre}")


# Bytes de cada formato de vértice de Unity 2018 (VertexFormat): Float, Float16, UNorm8, SNorm8,
# UNorm16, SNorm16, UInt8, SInt8, UInt16, SInt16, UInt32 y SInt32.
BYTES_FORMATO_VERTICE = [4, 2, 1, 1, 2, 2, 1, 1, 2, 2, 4, 4]


def leer_malla_2d(datos, inicio):
    """Vértices (x, y) y triángulos de un Mesh de Unity 2018 sin comprimir, como los que el importador
    de SVG del juego hace con sus iconos vectoriales. Solo se lee lo que hace falta para dibujarlo."""
    lector = _Lector(datos, inicio)
    # Ojo: en «lector.p += lector.leer(...)» Python lee lector.p antes de que leer() lo avance, así que
    # cada salto se calcula aparte.
    def saltar_lista(tamano):
        cuantos = lector.leer("i")
        lector.p += cuantos * tamano

    saltar_lista(1)
    lector.alinear()
    # m_SubMeshes: primer byte, índices, topología, vértice base, primer vértice, vértices y su caja.
    submallas = [lector.leer("IIiIII6f") for _ in range(lector.leer("i"))]
    # m_Shapes (formas de mezcla): vértices de 40 bytes, formas de 12 y canales con nombre.
    saltar_lista(40)
    saltar_lista(12)
    for _ in range(lector.leer("i")):
        saltar_lista(1)
        lector.alinear()
        lector.p += 12
    saltar_lista(4)
    # m_BindPose (matrices de 4 × 4), m_BoneNameHashes y m_RootBoneNameHash.
    saltar_lista(64)
    saltar_lista(4)
    lector.p += 4
    compresion = lector.leer("B")
    lector.p += 3
    lector.alinear()
    if compresion:
        raise ValueError(f"Mesh comprimido (m_MeshCompression {compresion}): no se admite")
    formato_indices = lector.leer("i")
    n = lector.leer("i")
    indices = struct.unpack_from("<%d%s" % (n // (4 if formato_indices else 2), "I" if formato_indices else "H"), datos, lector.p)
    lector.p += n
    lector.alinear()
    numero_vertices = lector.leer("I")
    canales = [lector.leer("BBBB") for _ in range(lector.leer("i"))]
    n = lector.leer("i")
    vertices_crudos = datos[lector.p: lector.p + n]
    # Canal 0: la posición, en float. Todos los canales van intercalados en el flujo 0.
    flujo, desplazamiento, formato, dimension = canales[0]
    if flujo or formato or dimension < 2 or any(canal[0] for canal in canales if canal[3]):
        raise ValueError(f"Mesh con una disposición de vértices que no se admite: {canales}")
    paso = sum(BYTES_FORMATO_VERTICE[canal[2]] * canal[3] for canal in canales if canal[3])
    vertices = [struct.unpack_from("<2f", vertices_crudos, i * paso + desplazamiento) for i in range(numero_vertices)]
    triangulos = []
    for primer_byte, cuantos, topologia, base, *_ in submallas:
        if topologia != 0:
            raise ValueError(f"Submalla con topología {topologia}: solo se admiten triángulos")
        primero = primer_byte // (4 if formato_indices else 2)
        trozo = indices[primero: primero + cuantos]
        triangulos += [tuple(base + indice for indice in trozo[i:i + 3]) for i in range(0, cuantos, 3)]
    return vertices, triangulos
