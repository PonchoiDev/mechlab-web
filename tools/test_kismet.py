import struct
import unittest

from extraer_yaml import ranuras_de_armas, tamanos_de_tipos_de_ranura
from kismet import Desensamblador, bytecode_de_funcion

# El desensamblador del bytecode de los blueprints y la lectura de las reglas de YAML que salen de él.
#
#   python3 -m unittest discover tools

NOMBRES = ["None", "SlotSize", "K2Node_Item", "PrimaryAssetType", "MWSlotTypeDataAsset", "AC10_SlotType"]
IMPORTS = {-1: "EqualEqual_StrStr"}


def nombre(texto):
    return struct.pack("<ii", NOMBRES.index(texto), 0)


def propiedad(texto):
    return struct.pack("<i", 1) + nombre(texto) + struct.pack("<i", 0)


def sentencias(datos):
    return Desensamblador(NOMBRES, IMPORTS.get, datos).sentencias()


class Desensamblado(unittest.TestCase):
    def test_asignacion_de_un_entero_a_un_miembro_de_otro_objeto(self):
        contexto = b"\x19" + b"\x00" + propiedad("K2Node_Item") + struct.pack("<I", 9) + propiedad("SlotSize") + b"\x01" + propiedad("SlotSize")
        datos = b"\x0f" + propiedad("SlotSize") + contexto + b"\x1d" + struct.pack("<i", 7) + b"\x53"
        self.assertEqual(sentencias(datos), [
            ("let", ("contexto", ("variable", "local", "K2Node_Item"), ("variable", "instancia", "SlotSize")), ("int", 7)),
            ("fin",),
        ])

    def test_llamada_a_una_funcion_importada_con_una_cadena(self):
        datos = b"\x1c" + struct.pack("<i", -1) + b"\x1fAC10_SlotType\x00" + b"\x16" + b"\x53"
        self.assertEqual(sentencias(datos)[0], ("call", "EqualEqual_StrStr", [("str", "AC10_SlotType")]))

    def test_codigo_desconocido(self):
        with self.assertRaises(ValueError):
            sentencias(b"\xfe")

    def test_el_bytecode_va_tras_sus_tamanos_y_antes_de_la_cola_de_la_funcion(self):
        script = b"\x0b\x53"
        export = b"\x00" * 20 + struct.pack("<ii", 8, len(script)) + script + b"\x00" * 12
        self.assertEqual(bytecode_de_funcion(export), script)


def id_de_asset(tipo, nombre_asset):
    return ("struct", "PrimaryAssetId", [("struct", "PrimaryAssetType", [("name", tipo)]), ("name", nombre_asset)])


def asignar(destino, valor):
    return ("let", destino, valor)


def miembro(variable, campo):
    return ("contexto", ("variable", "local", variable), ("variable", "instancia", campo))


class ReglasDeYaml(unittest.TestCase):
    def test_tamano_de_los_tipos_de_ranura_por_nombre(self):
        comparar = [asignar(("variable", "local", f"Igual{i}"), ("call", "EqualEqual_StrStr", [("variable", "local", "Nombre"), ("str", tipo)]))
                    for i, tipo in enumerate(["AC10_SlotType", "AC10_Burst_SlotType"])]
        codigo = comparar + [asignar(miembro("Item", "SlotSize"), ("int", 7))]
        self.assertEqual(tamanos_de_tipos_de_ranura(codigo), [{"tiposDeRanura": ["AC10_SlotType", "AC10_Burst_SlotType"], "ranuras": 7}])

    def test_un_tamano_sin_condicion_de_nombre_no_se_acepta(self):
        with self.assertRaises(ValueError):
            tamanos_de_tipos_de_ranura([asignar(miembro("Item", "SlotSize"), ("int", 7))])

    def test_ranura_de_armas_por_lista_y_por_etiqueta(self):
        tipo = ("miembro", ("variable", "local", "MakeStruct_SlotType"), "Id")
        codigo = [
            asignar(("variable", "local", "Lista"), ("array", [id_de_asset("MWProjectileWeaponDataAsset", "LBXAutocannon20")] * 2)),
            asignar(tipo, id_de_asset("MWSlotTypeDataAsset", "Ballistic11_DLC9_SlotType")),
            asignar(miembro("Arma", "WeaponSlotTypeAssetId"), ("variable", "local", "MakeStruct_SlotType")),
            asignar(("variable", "local", "Tiene"), ("call", "HasTag", [("variable", "local", "Etiquetas"), ("struct", "GameplayTag", [("name", "Weapon.Energy.Laser.Binary.Large")]), ("bool", False)])),
            asignar(tipo, id_de_asset("MWSlotTypeDataAsset", "BinaryLargeLaser_SlotType")),
            asignar(miembro("Arma", "WeaponSlotTypeAssetId"), ("variable", "local", "MakeStruct_SlotType")),
        ]
        self.assertEqual(ranuras_de_armas(codigo), [
            {"armas": ["LBXAutocannon20"], "etiquetas": [], "tipoDeRanura": "Ballistic11_DLC9_SlotType"},
            {"armas": [], "etiquetas": [{"etiqueta": "Weapon.Energy.Laser.Binary.Large", "exacta": False}], "tipoDeRanura": "BinaryLargeLaser_SlotType"},
        ])

    def test_las_armas_que_solo_cambian_de_dlc_no_pasan_a_la_regla_siguiente(self):
        tipo = ("miembro", ("variable", "local", "MakeStruct_SlotType"), "Id")
        codigo = [
            asignar(("variable", "local", "Lista"), ("array", [id_de_asset("MWProjectileWeaponDataAsset", "HeavyGaussRifle")])),
            asignar(miembro("Arma", "AssociatedDLC"), ("struct", "GameplayTag", [("name", "DLC.DLC9")])),
            asignar(("variable", "local", "Lista"), ("array", [id_de_asset("MWProjectileWeaponDataAsset", "LightGaussRifle")])),
            asignar(tipo, id_de_asset("MWSlotTypeDataAsset", "Ballistic5_DLC7_SlotType")),
            asignar(miembro("Arma", "WeaponSlotTypeAssetId"), ("variable", "local", "MakeStruct_SlotType")),
        ]
        self.assertEqual(ranuras_de_armas(codigo)[0]["armas"], ["LightGaussRifle"])


if __name__ == "__main__":
    unittest.main()
