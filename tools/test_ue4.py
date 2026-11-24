import struct
import unittest

from ue4 import Lector, LectorPropiedades

# Casos del lector de propiedades que aparecen en los mods (cocinados con el editor de modding) y no en
# el juego.
#
#   python3 -m unittest discover tools

NOMBRES = ["None", "TagName", "NameProperty", "Weapon.Energy", "EMechParts::Head", "Otro"]


def nombre(texto):
    return struct.pack("<ii", NOMBRES.index(texto), 0)


def lector(datos, ruta_objeto=None):
    return LectorPropiedades(NOMBRES, Lector(datos), ruta_objeto)


class GameplayTag(unittest.TestCase):
    def test_lee_la_etiqueta_guardada_como_nombre(self):
        propiedades = lector(nombre("Weapon.Energy") + nombre("Otro"))
        self.assertEqual(propiedades.struct("GameplayTag"), "Weapon.Energy")
        self.assertEqual(propiedades.lector.posicion, 8)

    def test_lee_la_etiqueta_guardada_como_propiedad_etiquetada(self):
        datos = nombre("TagName") + nombre("NameProperty") + struct.pack("<iiB", 8, 0, 0) + nombre("Weapon.Energy") + nombre("None")
        propiedades = lector(datos)
        self.assertEqual(propiedades.struct("GameplayTag"), "Weapon.Energy")
        self.assertEqual(propiedades.lector.posicion, len(datos))


class Mapas(unittest.TestCase):
    def test_las_claves_byte_de_un_mapa_son_nombres_de_enum(self):
        self.assertEqual(lector(nombre("EMechParts::Head")).elemento_de_mapa("ByteProperty"), "EMechParts::Head")


class Objetos(unittest.TestCase):
    def test_sin_resolver_devuelve_el_indice(self):
        self.assertEqual(lector(struct.pack("<i", -3)).valor("ObjectProperty", {}), -3)

    def test_con_resolver_devuelve_la_ruta(self):
        self.assertEqual(lector(struct.pack("<i", -3), lambda indice: f"ruta{indice}").valor("ObjectProperty", {}), "ruta-3")


if __name__ == "__main__":
    unittest.main()
