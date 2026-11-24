import struct

# Desensamblador del bytecode de los blueprints (Kismet) de Unreal Engine 4.26, el de MechWarrior 5.
# Algunos mods guardan reglas del juego en la lógica de sus blueprints y no en datos: YAML, por
# ejemplo, cambia al arrancar el tamaño de los tipos de ranura del juego. Para leerlas, cada sentencia
# se convierte en un árbol de tuplas (nodo, ...) que se recorre después.
#
# Solo se usa con assets cocinados: las referencias a objetos son índices de paquete de 4 bytes y las
# propiedades, rutas de campos (FFieldPath). Los saltos guardan desplazamientos de memoria, que no
# coinciden con los del archivo, así que no se siguen: las sentencias se leen en orden.

FIN_DE_PARAMETROS = 0x16
FIN_DE_SCRIPT = 0x53
# UFunction guarda, tras el bytecode, sus flags y algún puntero: el script no llega al final del export.
COLA_MAXIMA_DE_FUNCION = 24

# Variables: local, de instancia, por defecto, parámetro de salida y de datos dispersos de la clase.
VARIABLES = {0x00: "local", 0x01: "instancia", 0x02: "defecto", 0x48: "salida", 0x6C: "disperso"}
# Contextos: llamar o leer algo de otro objeto (o de una clase), devolviendo nulo si falla o no.
CONTEXTOS = (0x12, 0x19, 0x1A)
# Asignaciones sin propiedad delante: booleanas, de objetos, de punteros débiles y de delegados.
ASIGNACIONES_SIMPLES = (0x14, 0x5F, 0x60, 0x43, 0x44)
# Llamadas: virtuales (por nombre) y finales, matemáticas o a delegados (por objeto función).
LLAMADAS_POR_NOMBRE = (0x1B, 0x45)
LLAMADAS_POR_OBJETO = (0x1C, 0x46, 0x68, 0x63)
CONVERSIONES = (0x2E, 0x52, 0x54, 0x55)
# Marcas de depuración sin contenido.
SIN_CONTENIDO = {0x0B: ("nada",), 0x15: ("fin_parametro",), 0x17: ("self",), 0x2A: ("ninguno",),
                 0x2D: ("sin_interfaz",), 0x4D: ("pop",), 0x50: ("traza",), 0x5A: ("traza",),
                 0x5E: ("traza",), FIN_DE_SCRIPT: ("fin",)}


class Desensamblador:
    def __init__(self, nombres, referencia, datos):
        self.nombres = nombres
        # Convierte un índice de paquete (negativo: import, positivo: export) en su nombre.
        self.referencia = referencia
        self.datos = datos
        self.posicion = 0

    def _leer(self, formato):
        valor = struct.unpack_from("<" + formato, self.datos, self.posicion)[0]
        self.posicion += struct.calcsize("<" + formato)
        return valor

    def _nombre(self):
        indice, numero = struct.unpack_from("<ii", self.datos, self.posicion)
        self.posicion += 8
        nombre = self.nombres[indice]
        return nombre if numero == 0 else f"{nombre}_{numero - 1}"

    def _objeto(self):
        return self.referencia(self._leer("i"))

    def _propiedad(self):
        ruta = [self._nombre() for _ in range(self._leer("i"))]
        self._leer("i")
        return ".".join(ruta)

    def _cadena(self):
        fin = self.datos.index(b"\0", self.posicion)
        texto = self.datos[self.posicion:fin].decode("latin-1")
        self.posicion = fin + 1
        return texto

    def _cadena_unicode(self):
        fin = self.posicion
        while self.datos[fin:fin + 2] != b"\0\0":
            fin += 2
        texto = self.datos[self.posicion:fin].decode("utf-16-le")
        self.posicion = fin + 2
        return texto

    def _hasta(self, fin):
        elementos = []
        while self.datos[self.posicion] != fin:
            elementos.append(self.expresion())
        self.posicion += 1
        return elementos

    def expresion(self):
        codigo = self._leer("B")
        if codigo in VARIABLES:
            return ("variable", VARIABLES[codigo], self._propiedad())
        if codigo in SIN_CONTENIDO:
            return SIN_CONTENIDO[codigo]
        if codigo == 0x04:
            return ("return", self.expresion())
        if codigo == 0x06:
            return ("goto", self._leer("I"))
        if codigo == 0x07:
            destino = self._leer("I")
            return ("if_not", self.expresion(), destino)
        if codigo == 0x09:
            self._leer("H")
            self._leer("B")
            return ("assert", self.expresion())
        if codigo == 0x0F:
            self._propiedad()
            destino = self.expresion()
            return ("let", destino, self.expresion())
        if codigo in ASIGNACIONES_SIMPLES:
            destino = self.expresion()
            return ("let", destino, self.expresion())
        if codigo == 0x64:
            return ("let", ("variable", "persistente", self._propiedad()), self.expresion())
        if codigo in CONTEXTOS:
            objeto = self.expresion()
            self._leer("I")
            self._propiedad()
            return ("contexto", objeto, self.expresion())
        if codigo == 0x42:
            propiedad = self._propiedad()
            return ("miembro", self.expresion(), propiedad)
        if codigo == 0x13:
            clase = self._objeto()
            return ("cast", clase, self.expresion())
        if codigo in CONVERSIONES:
            clase = self._objeto()
            return ("cast", clase, self.expresion())
        if codigo == 0x18:
            self._leer("I")
            return self.expresion()
        if codigo in LLAMADAS_POR_NOMBRE:
            nombre = self._nombre()
            return ("call", nombre, self._hasta(FIN_DE_PARAMETROS))
        if codigo in LLAMADAS_POR_OBJETO:
            funcion = self._objeto()
            return ("call", funcion, self._hasta(FIN_DE_PARAMETROS))
        if codigo == 0x1D:
            return ("int", self._leer("i"))
        if codigo in (0x24, 0x2C):
            return ("int", self._leer("B"))
        if codigo == 0x25:
            return ("int", 0)
        if codigo == 0x26:
            return ("int", 1)
        if codigo in (0x35, 0x36):
            return ("int", self._leer("q"))
        if codigo == 0x1E:
            return ("float", self._leer("f"))
        if codigo == 0x1F:
            return ("str", self._cadena())
        if codigo == 0x34:
            return ("str", self._cadena_unicode())
        if codigo == 0x20:
            return ("objeto", self._objeto())
        if codigo == 0x21:
            return ("name", self._nombre())
        if codigo == 0x27:
            return ("bool", True)
        if codigo == 0x28:
            return ("bool", False)
        if codigo in (0x22, 0x23):
            return ("vector", [self._leer("f") for _ in range(3)])
        if codigo == 0x2B:
            return ("transform", [self._leer("f") for _ in range(10)])
        if codigo == 0x29:
            return self._texto()
        if codigo == 0x2F:
            tipo = self._objeto()
            self._leer("i")
            return ("struct", tipo, self._hasta(0x30))
        if codigo == 0x31:
            destino = self.expresion()
            return ("let", destino, ("array", self._hasta(0x32)))
        if codigo == 0x65:
            self._propiedad()
            self._leer("i")
            return ("array", self._hasta(0x66))
        if codigo == 0x39:
            destino = self.expresion()
            self._leer("i")
            return ("let", destino, ("array", self._hasta(0x3A)))
        if codigo == 0x3B:
            destino = self.expresion()
            self._leer("i")
            return ("let", destino, ("map", self._hasta(0x3C)))
        if codigo == 0x3D:
            self._propiedad()
            self._leer("i")
            return ("array", self._hasta(0x3E))
        if codigo == 0x3F:
            self._propiedad()
            self._propiedad()
            self._leer("i")
            return ("map", self._hasta(0x40))
        if codigo == 0x33:
            return ("propiedad", self._propiedad())
        if codigo == 0x38:
            self._leer("B")
            return self.expresion()
        if codigo == 0x4B:
            return ("delegado", self._nombre())
        if codigo == 0x4C:
            return ("push", self._leer("I"))
        if codigo == 0x4E:
            return ("goto_calculado", self.expresion())
        if codigo == 0x4F:
            return ("pop_if_not", self.expresion())
        if codigo == 0x51:
            return self.expresion()
        if codigo == 0x5B:
            return ("int", self._leer("I"))
        if codigo in (0x5C, 0x62):
            destino = self.expresion()
            return ("delegado_multiple", destino, self.expresion())
        if codigo == 0x5D:
            return ("delegado_multiple", self.expresion(), None)
        if codigo == 0x61:
            nombre = self._nombre()
            delegado = self.expresion()
            return ("bind", nombre, delegado, self.expresion())
        if codigo == 0x67:
            return ("soft", self.expresion())
        if codigo == 0x69:
            return self._switch()
        if codigo == 0x6B:
            lista = self.expresion()
            return ("indice", lista, self.expresion())
        if codigo == 0x6D:
            return ("ruta_de_campo", self.expresion())
        raise ValueError(f"Código de Kismet desconocido {codigo:#x} en la posición {self.posicion - 1}")

    def _texto(self):
        tipo = self._leer("B")
        if tipo == 0:
            return ("str", "")
        if tipo == 1:
            # Texto localizado: fuente, clave y espacio de nombres.
            fuente = self.expresion()
            self.expresion()
            self.expresion()
            return fuente
        if tipo in (2, 3):
            return self.expresion()
        if tipo == 4:
            self._objeto()
            tabla = self.expresion()
            return ("tabla_de_textos", tabla, self.expresion())
        return ("str", "")

    def _switch(self):
        casos = self._leer("H")
        self._leer("I")
        indice = self.expresion()
        resultado = []
        for _ in range(casos):
            caso = self.expresion()
            self._leer("I")
            resultado.append((caso, self.expresion()))
        return ("switch", indice, resultado, self.expresion())

    def sentencias(self):
        resultado = []
        while self.posicion < len(self.datos):
            resultado.append(self.expresion())
        return resultado


def bytecode_de_funcion(datos):
    """El bytecode de un export UFunction: va tras su tamaño en memoria y en el archivo (dos int32)."""
    for inicio in range(len(datos) - 8):
        tamano = struct.unpack_from("<i", datos, inicio + 4)[0]
        fin = inicio + 8 + tamano
        if tamano > 0 and 0 <= len(datos) - fin <= COLA_MAXIMA_DE_FUNCION and datos[fin - 1] == FIN_DE_SCRIPT:
            return datos[inicio + 8:fin]
    raise ValueError("El export no contiene bytecode de Kismet")


def desensamblar(asset, funcion):
    """Las sentencias de una función de blueprint de un asset (ue4.Asset), como árboles de tuplas."""
    def referencia(indice):
        if indice < 0:
            return asset.imports[-indice - 1][0]
        return asset.orden[indice - 1] if indice > 0 else None

    return Desensamblador(asset.nombres, referencia, bytecode_de_funcion(asset.bytes_de(funcion))).sentencias()


def id_de_asset(nodo):
    """(tipo, nombre) de una constante PrimaryAssetId, o None si el nodo no lo es."""
    if nodo and nodo[0] == "struct" and nodo[1] == "PrimaryAssetId" and len(nodo[2]) == 2:
        tipo, nombre = nodo[2]
        if tipo[0] == "struct" and tipo[2] and tipo[2][0][0] == "name" and nombre[0] == "name":
            return tipo[2][0][1], nombre[1]
    return None


def etiqueta(nodo):
    """El nombre de una constante GameplayTag, o None."""
    if nodo and nodo[0] == "struct" and nodo[1] == "GameplayTag" and nodo[2] and nodo[2][0][0] == "name":
        return nodo[2][0][1]
    return None


def ultimo_nombre(nodo):
    """El último nombre de una variable, un contexto o un miembro: a qué se asigna algo."""
    if nodo[0] == "variable":
        return nodo[2]
    if nodo[0] == "contexto":
        return ultimo_nombre(nodo[2])
    if nodo[0] == "miembro":
        return nodo[2]
    return None


def base(nodo):
    """La variable sobre la que actúa un miembro o un contexto (K2Node_MakeStruct_X de X.Id = ...)."""
    while nodo[0] in ("miembro", "contexto"):
        nodo = nodo[1]
    return nodo[2] if nodo[0] == "variable" else None


def recorrer(nodo):
    """Todos los subnodos de un árbol, en orden."""
    yield nodo
    for hijo in nodo[1:]:
        if isinstance(hijo, tuple):
            yield from recorrer(hijo)
        elif isinstance(hijo, list):
            for elemento in hijo:
                if isinstance(elemento, tuple):
                    yield from recorrer(elemento)
