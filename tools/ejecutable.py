import mmap
import struct
import sys

# Lectura del ejecutable de MW5 (MechWarrior-Win64-Shipping.exe) para encontrar el código de las funciones nativas
# que llaman los blueprints de YAML (EstimateMaxJumpJetHeight, GetDisplayedDamage...) y los desplazamientos de las
# propiedades con reflexión. El código se desensambla después con objdump:
#
#   python3 tools/ejecutable.py "<carpeta del juego>" funcion EstimateMaxJumpJetHeight
#   python3 tools/ejecutable.py "<carpeta del juego>" propiedad CachedExplosionDamageDisplay
#   objdump -d -M intel --no-show-raw-insn --start-address=0x... "<ejecutable>"
#
# Unreal registra cada función nativa en una tabla de pares (nombre, puntero): el segundo puntero de la función es
# su envoltorio exec, que lee los parámetros y llama a la implementación. Cada propiedad con reflexión tiene un
# FPropertyParams: NameUTF8 (8), RepNotify (8), PropertyFlags (8), Flags y ObjectFlags (4 + 4), ArrayDim (4) y
# Offset (4).
RUTA_EJECUTABLE = "MW5Mercs/Binaries/Win64/MechWarrior-Win64-Shipping.exe"


class Ejecutable:
    def __init__(self, ruta):
        self.archivo = open(ruta, "rb")
        self.datos = mmap.mmap(self.archivo.fileno(), 0, access=mmap.ACCESS_READ)
        pe = struct.unpack_from("<I", self.datos, 0x3C)[0]
        secciones = struct.unpack_from("<H", self.datos, pe + 6)[0]
        opcional = struct.unpack_from("<H", self.datos, pe + 20)[0]
        self.base = struct.unpack_from("<Q", self.datos, pe + 24 + 24)[0]
        self.secciones = []
        posicion = pe + 24 + opcional
        for _ in range(secciones):
            nombre = self.datos[posicion:posicion + 8].rstrip(b"\0").decode()
            tamano_virtual, virtual, tamano, inicio = struct.unpack_from("<IIII", self.datos, posicion + 8)
            self.secciones.append((nombre, virtual, tamano_virtual, inicio, tamano))
            posicion += 40

    def direccion(self, desplazamiento):
        for _, virtual, _, inicio, tamano in self.secciones:
            if inicio <= desplazamiento < inicio + tamano:
                return self.base + virtual + desplazamiento - inicio
        return None

    def desplazamiento(self, direccion):
        for _, virtual, _, inicio, tamano in self.secciones:
            if self.base + virtual <= direccion < self.base + virtual + tamano:
                return direccion - self.base - virtual + inicio
        return None

    def buscar(self, contenido):
        posiciones, posicion = [], self.datos.find(contenido)
        while posicion != -1:
            posiciones.append(posicion)
            posicion = self.datos.find(contenido, posicion + 1)
        return posiciones

    def referencias(self, nombre):
        """Las posiciones de los punteros a la cadena ASCII `nombre`."""
        for cadena in self.buscar(nombre.encode() + b"\0"):
            yield from self.buscar(struct.pack("<Q", self.direccion(cadena)))

    def funciones_nativas(self, nombre):
        """Los punteros que siguen al nombre en las tablas de registro: el segundo suele ser el envoltorio exec."""
        return [struct.unpack_from("<Q", self.datos, posicion + 8)[0] for posicion in self.referencias(nombre)]

    def propiedades(self, nombre):
        """(dirección del FPropertyParams, desplazamiento de la propiedad) de cada propiedad con ese nombre."""
        return [(self.direccion(posicion), struct.unpack_from("<i", self.datos, posicion + 36)[0]) for posicion in self.referencias(nombre)]

    def float(self, direccion):
        return struct.unpack_from("<f", self.datos, self.desplazamiento(direccion))[0]


def main():
    if len(sys.argv) != 4 or sys.argv[2] not in ("funcion", "propiedad", "float"):
        print("Uso: python3 tools/ejecutable.py \"<carpeta de MW5>\" funcion|propiedad|float <nombre o dirección>")
        sys.exit(1)
    ejecutable = Ejecutable(f"{sys.argv[1]}/{RUTA_EJECUTABLE}")
    if sys.argv[2] == "funcion":
        print([hex(puntero) for puntero in ejecutable.funciones_nativas(sys.argv[3])])
    elif sys.argv[2] == "propiedad":
        print([(hex(params), hex(desplazamiento)) for params, desplazamiento in ejecutable.propiedades(sys.argv[3])])
    else:
        print(ejecutable.float(int(sys.argv[3], 16)))


if __name__ == "__main__":
    main()
