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

    def leer(self, formato):
        valores = struct.unpack_from("<" + formato, self.datos, self.posicion)
        self.posicion += struct.calcsize("<" + formato)
        return valores[0] if len(valores) == 1 else list(valores)

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
        inicio_directorios, tamano_directorios = indice.leer("qq")
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
        cabecera.leer("ii")
        if version_antigua <= -2:
            versiones_propias = cabecera.leer("i")
            cabecera.posicion += 20 * versiones_propias
        tamano_cabecera = cabecera.leer("i")
        cabecera.cadena()
        flags = cabecera.leer("I")
        total_nombres, inicio_nombres = cabecera.leer("ii")
        if not flags & FILTRO_SOLO_EDITOR:
            cabecera.cadena()
        cabecera.leer("ii")
        total_exports, inicio_exports = cabecera.leer("ii")

        cabecera.posicion = inicio_nombres
        self.nombres = []
        for _ in range(total_nombres):
            self.nombres.append(cabecera.cadena())
            cabecera.leer("I")

        self.exports = {}
        for numero in range(total_exports):
            cabecera.posicion = inicio_exports + numero * TAMANO_EXPORT + 16
            nombre = self.nombres[cabecera.leer("i")]
            cabecera.leer("iI")
            _tamano, inicio = cabecera.leer("qq")
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
        indice, numero = self.lector.leer("ii")
        nombre = self.nombres[indice]
        return nombre if numero == 0 else f"{nombre}_{numero - 1}"

    def propiedades(self):
        resultado = {}
        while True:
            clave = self.nombre()
            if clave == "None":
                return resultado
            tipo = self.nombre()
            tamano, indice = self.lector.leer("ii")
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
                lector.leer("ii")
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
            return self.lector.leer(STRUCTS_BINARIOS[nombre])
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
