import os
import struct

# Lectura de los archivos de Unreal Engine 4 que usa MechWarrior 5: el .pak de la instalación y los
# assets cocinados (.uasset con su .uexp). Solo cubre lo que trae el juego: un .pak de la versión 11
# sin cifrar ni comprimir y propiedades etiquetadas, sin dependencias externas.
MAGIA_PAK = 0x5A6F12E1
# Cada archivo del .pak empieza con una copia de su entrada del índice: 53 bytes sin compresión.
CABECERA_ENTRADA = 53
FILTRO_SOLO_EDITOR = 0x80000000
TAMANO_EXPORT = 104

# Structs que se guardan en binario, sin etiquetas, y su formato.
STRUCTS_BINARIOS = {
    "Vector": "3f", "Vector2D": "2f", "Rotator": "3f", "Quat": "4f", "LinearColor": "4f",
    "Color": "4B", "IntPoint": "2i", "DateTime": "q", "Timespan": "q",
}


class Lector:
    def __init__(self, datos, posicion=0):
        self.datos = datos
        self.posicion = posicion

    def varios(self, formato):
        valores = struct.unpack_from("<" + formato, self.datos, self.posicion)
        self.posicion += struct.calcsize("<" + formato)
        return valores

    def leer(self, formato):
        """Un solo valor; para varios seguidos, varios()."""
        return self.varios(formato)[0]

    def cadena(self):
        longitud = self.leer("i")
        if longitud == 0:
            return ""
        # Una longitud negativa indica UTF-16.
        if longitud < 0:
            fin = self.posicion - 2 * longitud
            texto = self.datos[self.posicion:fin].decode("utf-16-le")
        else:
            fin = self.posicion + longitud
            texto = self.datos[self.posicion:fin].decode("utf-8", errors="replace")
        self.posicion = fin
        return texto.rstrip("\0")


class Pak:
    """Índice de un .pak: ruta de cada archivo y dónde está."""

    def __init__(self, ruta):
        self.archivo = open(ruta, "rb")
        self.archivo.seek(0, os.SEEK_END)
        tamano = self.archivo.tell()
        self.archivo.seek(tamano - 300)
        cola = self.archivo.read()
        magia = cola.rfind(struct.pack("<I", MAGIA_PAK))
        version, inicio_indice, tamano_indice = struct.unpack_from("<iqq", cola, magia + 4)
        if version != 11 or cola[magia - 1]:
            raise ValueError(f"Formato de .pak no soportado (versión {version} o índice cifrado)")
        indice = Lector(self._leer(inicio_indice, tamano_indice))
        indice.cadena()
        indice.leer("i")
        indice.leer("Q")
        if indice.leer("i"):
            indice.posicion += 16 + 20
        if not indice.leer("i"):
            raise ValueError("El .pak no trae el índice de directorios")
        inicio_directorios, tamano_directorios = indice.varios("qq")
        indice.posicion += 20
        tamano_entradas = indice.leer("i")
        self.entradas = indice.datos[indice.posicion:indice.posicion + tamano_entradas]
        self.archivos = self._leer_directorios(Lector(self._leer(inicio_directorios, tamano_directorios)))

    def _leer(self, inicio, tamano):
        self.archivo.seek(inicio)
        return self.archivo.read(tamano)

    def _leer_directorios(self, lector):
        archivos = {}
        for _ in range(lector.leer("i")):
            directorio = lector.cadena()
            for _ in range(lector.leer("i")):
                nombre = lector.cadena()
                desplazamiento = lector.leer("i")
                if desplazamiento >= 0:
                    archivos[(directorio + nombre).lstrip("/")] = desplazamiento
        return archivos

    def _entrada(self, desplazamiento):
        # Entrada codificada: unos bits de flags dicen si cada campo ocupa 32 o 64 bits.
        flags = struct.unpack_from("<I", self.entradas, desplazamiento)[0]
        if (flags >> 23) & 0x3F or (flags >> 22) & 1:
            raise ValueError("Archivo comprimido o cifrado dentro del .pak")
        posicion = desplazamiento + 4
        formato_inicio = "<I" if flags & (1 << 31) else "<Q"
        inicio = struct.unpack_from(formato_inicio, self.entradas, posicion)[0]
        posicion += struct.calcsize(formato_inicio)
        formato_tamano = "<I" if flags & (1 << 30) else "<Q"
        tamano = struct.unpack_from(formato_tamano, self.entradas, posicion)[0]
        return inicio, tamano

    def leer_archivo(self, ruta):
        inicio, tamano = self._entrada(self.archivos[ruta])
        return self._leer(inicio + CABECERA_ENTRADA, tamano)

    def buscar(self, prefijo):
        return sorted(ruta for ruta in self.archivos if ruta.startswith(prefijo))


class Asset:
    """Un asset cocinado: la tabla de nombres y los objetos (exports) con sus propiedades."""

    def __init__(self, uasset, uexp):
        cabecera = Lector(uasset)
        cabecera.leer("I")
        version_antigua = cabecera.leer("i")
        if version_antigua != -4:
            cabecera.leer("i")
        cabecera.varios("ii")
        if version_antigua <= -2:
            versiones_propias = cabecera.leer("i")
            cabecera.posicion += 20 * versiones_propias
        tamano_cabecera = cabecera.leer("i")
        self.tamano_cabecera = tamano_cabecera
        cabecera.cadena()
        flags = cabecera.leer("I")
        total_nombres, inicio_nombres = cabecera.varios("ii")
        if not flags & FILTRO_SOLO_EDITOR:
            cabecera.cadena()
        cabecera.varios("ii")
        total_exports, inicio_exports = cabecera.varios("ii")

        cabecera.posicion = inicio_nombres
        self.nombres = []
        for _ in range(total_nombres):
            self.nombres.append(cabecera.cadena())
            cabecera.leer("I")

        self.exports = {}
        for numero in range(total_exports):
            cabecera.posicion = inicio_exports + numero * TAMANO_EXPORT + 16
            nombre = self.nombres[cabecera.leer("i")]
            cabecera.varios("iI")
            _tamano, inicio = cabecera.varios("qq")
            # El .uexp continúa al .uasset: los desplazamientos cuentan desde el principio de los dos.
            self.exports[nombre] = inicio - tamano_cabecera
        self.datos = uexp

    @classmethod
    def desde_pak(cls, pak, ruta_sin_extension):
        return cls(pak.leer_archivo(ruta_sin_extension + ".uasset"), pak.leer_archivo(ruta_sin_extension + ".uexp"))

    def principal(self):
        """El objeto del asset cuando solo hay uno, aunque no se llame como el archivo."""
        return next(nombre for nombre in self.exports if not nombre.startswith("Default__"))

    def lector(self, export):
        return LectorPropiedades(self.nombres, Lector(self.datos, self.exports[export]))

    def propiedades(self, export):
        return self.lector(export).propiedades()

    def filas(self, export):
        """Filas de una DataTable, por nombre de fila."""
        lector = self.lector(export)
        lector.propiedades()
        lector.lector.leer("i")
        filas = {}
        for _ in range(lector.lector.leer("i")):
            nombre = lector.nombre()
            filas[nombre] = lector.propiedades()
        return filas

    def textos(self, export):
        """Pares clave y texto de una StringTable."""
        lector = self.lector(export)
        lector.propiedades()
        lector.lector.leer("i")
        lector.lector.cadena()
        textos = {}
        for _ in range(lector.lector.leer("i")):
            clave = lector.lector.cadena()
            textos[clave] = lector.lector.cadena()
        return textos


class LectorPropiedades:
    def __init__(self, nombres, lector):
        self.nombres = nombres
        self.lector = lector

    def nombre(self):
        indice, numero = self.lector.varios("ii")
        nombre = self.nombres[indice]
        return nombre if numero == 0 else f"{nombre}_{numero - 1}"

    def propiedades(self):
        resultado = {}
        while True:
            clave = self.nombre()
            if clave == "None":
                return resultado
            tipo = self.nombre()
            tamano, indice = self.lector.varios("ii")
            extra = {}
            if tipo == "StructProperty":
                extra["struct"] = self.nombre()
                self.lector.posicion += 16
            elif tipo == "BoolProperty":
                extra["bool"] = self.lector.leer("B")
            elif tipo in ("ByteProperty", "EnumProperty"):
                extra["enum"] = self.nombre()
            elif tipo in ("ArrayProperty", "SetProperty"):
                extra["interno"] = self.nombre()
            elif tipo == "MapProperty":
                extra["interno"] = self.nombre()
                extra["valor"] = self.nombre()
            if self.lector.leer("B"):
                self.lector.posicion += 16
            inicio = self.lector.posicion
            valor = self.valor(tipo, extra, etiquetado=True)
            # Si el lector no conoce un tipo, el tamaño de la etiqueta permite saltarlo igualmente.
            self.lector.posicion = inicio + tamano
            resultado[clave if indice == 0 else f"{clave}[{indice}]"] = valor

    def valor(self, tipo, extra, etiquetado=False):
        lector = self.lector
        if tipo == "BoolProperty":
            return bool(extra["bool"]) if etiquetado else bool(lector.leer("B"))
        formatos = {"IntProperty": "i", "UInt32Property": "I", "Int64Property": "q", "FloatProperty": "f", "DoubleProperty": "d"}
        if tipo in formatos:
            return lector.leer(formatos[tipo])
        if tipo == "StrProperty":
            return lector.cadena()
        if tipo in ("NameProperty", "EnumProperty"):
            return self.nombre()
        if tipo == "ByteProperty":
            return self.nombre() if etiquetado and extra.get("enum") not in (None, "None") else lector.leer("B")
        if tipo == "ObjectProperty":
            return lector.leer("i")
        if tipo == "SoftObjectProperty":
            ruta = self.nombre()
            lector.cadena()
            return ruta
        if tipo == "TextProperty":
            return self.texto()
        if tipo == "StructProperty":
            return self.struct(extra["struct"])
        if tipo in ("ArrayProperty", "SetProperty"):
            if tipo == "SetProperty":
                lector.leer("i")
            total = lector.leer("i")
            if extra["interno"] == "StructProperty":
                self.nombre()
                self.nombre()
                lector.varios("ii")
                struct_interno = self.nombre()
                lector.posicion += 16
                if lector.leer("B"):
                    lector.posicion += 16
                return [self.struct(struct_interno) for _ in range(total)]
            return [self.valor(extra["interno"], {}) for _ in range(total)]
        if tipo == "MapProperty":
            lector.leer("i")
            return [[self.valor(extra["interno"], {}), self.valor(extra["valor"], {})] for _ in range(lector.leer("i"))]
        return None

    def struct(self, nombre):
        if nombre in STRUCTS_BINARIOS:
            # Las fechas son un solo número; vectores y colores, una lista.
            valores = self.lector.varios(STRUCTS_BINARIOS[nombre])
            return valores[0] if len(valores) == 1 else list(valores)
        if nombre == "Guid":
            self.lector.posicion += 16
            return None
        if nombre == "GameplayTag":
            return self.nombre()
        if nombre == "GameplayTagContainer":
            return [self.nombre() for _ in range(self.lector.leer("i"))]
        if nombre == "SoftObjectPath":
            ruta = self.nombre()
            self.lector.cadena()
            return ruta
        return self.propiedades()

    def texto(self):
        lector = self.lector
        lector.leer("I")
        historia = lector.leer("b")
        if historia == -1:
            return lector.cadena() if lector.leer("i") else None
        if historia == 0:
            lector.cadena()
            lector.cadena()
            return lector.cadena()
        if historia == 11:
            # Referencia a una StringTable: se guarda la tabla y la clave para resolverla después.
            return {"tabla": self.nombre(), "clave": lector.cadena()}
        return None


# Flags de FByteBulkData: datos al final del paquete, tamaños de 64 bits y datos en el .ubulk aparte.
BULK_AL_FINAL = 0x1
BULK_TAMANO_64 = 0x2000
BULK_EN_UBULK = 0x100


def leer_textura(pak, ruta_sin_extension):
    """Mip más grande de una Texture2D cocinada en DXT5 o sin comprimir: (ancho, alto, píxeles RGBA)."""
    asset = Asset.desde_pak(pak, ruta_sin_extension)
    propiedades = asset.lector(asset.principal())
    propiedades.propiedades()
    lector = propiedades.lector
    # Guid del objeto y las marcas de datos quitados de UTexture y UTexture2D.
    lector.leer("i")
    lector.posicion += 4
    if lector.leer("i") != 1:
        raise ValueError("Textura sin datos cocinados")
    lector.varios("iiq")
    lector.varios("iii")
    formato = lector.cadena()
    if formato not in ("PF_DXT5", "PF_B8G8R8A8"):
        raise ValueError(f"Formato de textura no soportado: {formato}")
    lector.varios("ii")
    lector.leer("i")
    flags = lector.leer("I")
    lector.leer("q" if flags & BULK_TAMANO_64 else "i")
    tamano = lector.leer("q" if flags & BULK_TAMANO_64 else "i")
    inicio = lector.leer("q")
    if flags & BULK_EN_UBULK:
        datos = pak.leer_archivo(ruta_sin_extension + ".ubulk")[inicio:inicio + tamano]
    elif flags & BULK_AL_FINAL:
        # El desplazamiento cuenta desde el principio del .uasset: se pasa al .uexp.
        inicio_uexp = inicio - asset.tamano_cabecera
        datos = lector.datos[inicio_uexp:inicio_uexp + tamano]
    else:
        datos = lector.datos[lector.posicion:lector.posicion + tamano]
        lector.posicion += tamano
    ancho, alto = lector.varios("ii")
    if formato == "PF_B8G8R8A8":
        pixeles = bytearray(datos)
        pixeles[0::4], pixeles[2::4] = datos[2::4], datos[0::4]
        return ancho, alto, pixeles
    return ancho, alto, descomprimir_dxt5(datos, ancho, alto)


def descomprimir_dxt5(datos, ancho, alto):
    """Bloques de 4x4 píxeles: 8 bytes de alfa interpolado y 8 de color en RGB565."""
    pixeles = bytearray(ancho * alto * 4)
    bloques_por_fila = ancho // 4

    def rgb565(valor):
        return ((valor >> 11) * 255 // 31, ((valor >> 5) & 63) * 255 // 63, (valor & 31) * 255 // 31)

    for bloque_y in range(alto // 4):
        for bloque_x in range(bloques_por_fila):
            origen = (bloque_y * bloques_por_fila + bloque_x) * 16
            a0, a1 = datos[origen], datos[origen + 1]
            bits_alfa = int.from_bytes(datos[origen + 2:origen + 8], "little")
            if a0 > a1:
                alfas = [a0, a1] + [((7 - i) * a0 + i * a1) // 7 for i in range(1, 7)]
            else:
                alfas = [a0, a1] + [((5 - i) * a0 + i * a1) // 5 for i in range(1, 5)] + [0, 255]
            c0, c1, bits_color = struct.unpack_from("<HHI", datos, origen + 8)
            p0, p1 = rgb565(c0), rgb565(c1)
            colores = [p0, p1, tuple((2 * a + b) // 3 for a, b in zip(p0, p1)), tuple((a + 2 * b) // 3 for a, b in zip(p0, p1))]
            for i in range(16):
                destino = ((bloque_y * 4 + i // 4) * ancho + bloque_x * 4 + i % 4) * 4
                pixeles[destino:destino + 3] = bytes(colores[(bits_color >> (2 * i)) & 3])
                pixeles[destino + 3] = alfas[(bits_alfa >> (3 * i)) & 7]
    return pixeles
