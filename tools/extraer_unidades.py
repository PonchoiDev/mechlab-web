import json
import os
import re
import struct
import sys

from extraer_mapa import CONTENIDO, PAK_DEL_JUEGO, extraer_por_nombre
from ue4 import Asset, Pak

# Extrae del .pak de la instalación lo que las unit cards de las unidades enemigas (tanques, VTOL,
# torretas y armaduras de combate) no traen: la vida, la velocidad y las armas de cada blueprint, y las
# estadísticas de las armas que no se pueden montar en un 'Mech. Lo guarda en tools/datos-juego/unidades/;
# después, generar_unidades.py trabaja con estos archivos sin tocar el juego.
#
#   python3 tools/extraer_unidades.py "/ruta/a/MechWarrior 5 Mercenaries"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "unidades")
RUTA_UNIT_CARDS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "unitcard")

REGEX_CLASE = re.compile(r'UnitClass=([^,]+?)\.[^.,]+_C[,)]')
REGEX_TIPO = re.compile(r'UnitType=\(UnitType=\(TagName="([^"]+)"')
REGEX_FACCION = re.compile(r'Id="MWFactionAsset:([^"]+)"')
# Propiedades del objeto por defecto de un vehículo que guardan la clase de su torreta: los tanques
# usan TurretBlueprint o Turret, y los VTOL PointDefenseClass.
CAMPOS_DE_TORRETA = ("TurretBlueprint", "Turret", "PointDefenseClass")
# Las armaduras de combate son un grupo que crea un traje por cada punto de aparición.
CAMPO_DE_TRAJE = "ElementalClass"
# El componente donde los tanques montan la torreta. Si el script de construcción le pone una clase,
# esa sustituye a la de la propiedad: el Condor (Davion) cambia así la torreta del Condor, y su
# BattleValue (444, menos que los 485 del Condor) confirma que no lleva las dos.
COMPONENTE_DE_TORRETA = "TurretActor"
REGEX_PUNTO_DE_APARICION = re.compile(r"Spawn Point \d+_GEN_VARIABLE$")
# Bytecode del script de construcción: un componente (EX_Context + EX_InstanceVariable con una ruta de
# un solo nombre) seguido de la llamada a SetChildActorClass (EX_FinalFunction) con una clase constante
# (EX_ObjectConst). Así montan sus armas las torretas, sin dejar la clase en el componente.
CONTEXTO_DE_COMPONENTE = b"\x19\x01\x01\x00\x00\x00"
LLAMADA_A_FUNCION = b"\x1c"
OBJETO_CONSTANTE = b"\x20"
# Lo que se guarda de las estadísticas de cada arma; el resto son sonidos, efectos y clases.
CAMPOS_DE_ARMA = ("Cooldown", "Projectile", "MissileStats", "Trace", "Range", "Ranges", "NumberOfTimesToFire")
CAMPOS_DE_PROYECTIL = ("Damage", "HeatGenerated", "Speed", "NumberOfProjectiles", "NumberOfMissiles",
                       "DamageOverDuration", "HeatGeneratedOverDuration", "Duration", "OptimalRange", "MaxRange",
                       "CachedExplosionDamageDisplay")


class Blueprints:
    """Lee los blueprints del .pak una sola vez: las torretas y las armas se repiten entre unidades."""

    def __init__(self, pak):
        self.pak = pak
        self.cache = {}

    def asset(self, paquete):
        if paquete not in self.cache:
            self.cache[paquete] = Asset.desde_pak(self.pak, CONTENIDO + paquete[len("/Game/"):])
        return self.cache[paquete]


def propiedades(asset, export):
    # Algunos exports (funciones, gráficos de animación) no son objetos con propiedades.
    try:
        return asset.propiedades(export)
    except Exception:
        return {}


def clase_importada(asset, referencia):
    """Ruta del paquete de una clase de blueprint del juego a la que apunta una referencia, o None."""
    if not isinstance(referencia, int) or referencia >= 0:
        return None
    paquete, nombre = asset.ruta_import(referencia)
    return paquete if paquete.startswith("/Game/") and nombre.endswith("_C") else None


def hijos_por_bytecode(asset):
    """Componentes ChildActor a los que el script de construcción da una clase: {componente: paquete}."""
    if "UserConstructionScript" not in asset.exports:
        return {}
    funcion = next((-numero - 1 for numero in range(len(asset.imports))
                    if asset.ruta_import(-numero - 1)[1] == "SetChildActorClass"), None)
    if funcion is None:
        return {}
    codigo = asset.bytes_de("UserConstructionScript")
    llamada = re.escape(LLAMADA_A_FUNCION + struct.pack("<i", funcion) + OBJETO_CONSTANTE) + b"(....)"
    hijos = {}
    for coincidencia in re.finditer(llamada, codigo, re.S):
        clase = clase_importada(asset, struct.unpack("<i", coincidencia.group(1))[0])
        componente = codigo.rfind(CONTEXTO_DE_COMPONENTE, 0, coincidencia.start())
        if clase and componente >= 0:
            nombre = asset.nombres[struct.unpack_from("<i", codigo, componente + len(CONTEXTO_DE_COMPONENTE))[0]]
            hijos[nombre] = clase
    return hijos


def componente(nombre):
    return nombre.removesuffix("_GEN_VARIABLE")


def leer_clase(blueprints, paquete, profundidad=0):
    """Lo que define un blueprint, con lo heredado de sus padres: un hijo sustituye lo del padre
    componente a componente, como hace el juego."""
    asset = blueprints.asset(paquete)
    principal = paquete.rsplit("/", 1)[1] + "_C"
    padre = clase_importada(asset, asset.clases[principal][1])
    if padre and profundidad < 10:
        heredado = leer_clase(blueprints, padre, profundidad + 1)
        clase = {clave: dict(valor) if isinstance(valor, dict) else valor for clave, valor in heredado.items()}
    else:
        clase = {"armas": {}, "hijos": {}, "vida": None, "velocidad": None, "torreta": None, "traje": None, "escuadra": 0,
                 "objetivo": None}

    puntos = 0
    for export in asset.exports:
        datos = propiedades(asset, export)
        arma = datos.get("WeaponDataAsset")
        if isinstance(arma, int) and arma < 0:
            clase["armas"][componente(export)] = asset.ruta_import(arma)[0]
        elif export.endswith("_GEN_VARIABLE") and asset.clases[export][0] < 0:
            # Un componente de arma de blueprint propio (WeaponComponent_PPC_Manticore) trae el arma en
            # su objeto por defecto.
            paquete_clase, nombre_clase = asset.ruta_import(asset.clases[export][0])
            if paquete_clase.startswith("/Game/") and "Weapon" in nombre_clase:
                clase_arma = blueprints.asset(paquete_clase)
                arma = propiedades(clase_arma, "Default__" + nombre_clase).get("WeaponDataAsset")
                if isinstance(arma, int) and arma < 0:
                    clase["armas"][componente(export)] = clase_arma.ruta_import(arma)[0]
        # El nombre que enseña el juego al fijar el blanco; la unit card de la Battle Armor no trae otro.
        if isinstance(datos.get("TargetName"), str):
            clase["objetivo"] = datos["TargetName"]
        if "MaxHitPoints" in datos and not export.startswith("Default__"):
            clase["vida"] = datos["MaxHitPoints"]
        movimiento = datos.get("MoveStats")
        if isinstance(movimiento, dict) and "MaxSpeed" in movimiento:
            clase["velocidad"] = movimiento["MaxSpeed"]
        hijo = clase_importada(asset, datos.get("ChildActorClass"))
        if hijo:
            clase["hijos"][componente(export)] = hijo
        if export == "Default__" + principal:
            for campo in CAMPOS_DE_TORRETA:
                clase["torreta"] = clase_importada(asset, datos.get(campo)) or clase["torreta"]
            clase["traje"] = clase_importada(asset, datos.get(CAMPO_DE_TRAJE)) or clase["traje"]
        if REGEX_PUNTO_DE_APARICION.search(export):
            puntos += 1
    por_bytecode = hijos_por_bytecode(asset)
    clase["hijos"].update(por_bytecode)
    if COMPONENTE_DE_TORRETA in por_bytecode:
        clase["torreta"] = None
    clase["escuadra"] = puntos or clase["escuadra"]
    return clase


def armas_de(blueprints, paquete, profundidad=0):
    """Las armas de una unidad: las suyas y las de las torretas y piezas que lleva montadas."""
    clase = leer_clase(blueprints, paquete)
    armas = list(clase["armas"].values())
    montadas = list(clase["hijos"].values()) + [clase["torreta"]] * bool(clase["torreta"])
    if profundidad < 6:
        for hijo in montadas:
            armas += armas_de(blueprints, hijo, profundidad + 1)
    return armas


def leer_unidad(blueprints, paquete):
    clase = leer_clase(blueprints, paquete)
    unidad = {"vida": clase["vida"], "velocidad": clase["velocidad"], "armas": armas_de(blueprints, paquete),
              "objetivo": clase["objetivo"]}
    if clase["traje"]:
        # Un grupo de armaduras: la vida y las armas son las de cada traje.
        traje = leer_clase(blueprints, clase["traje"])
        unidad = {"vida": traje["vida"], "velocidad": traje["velocidad"], "armas": armas_de(blueprints, clase["traje"]),
                  "escuadra": clase["escuadra"], "objetivo": traje["objetivo"]}
    return unidad


def limpiar(valor, campos):
    return {clave: valor[clave] for clave in campos if clave in valor and not isinstance(valor[clave], dict)}


def leer_arma(blueprints, paquete):
    """Nombre y estadísticas de un arma: el mismo StatsData que generar_items.py lee de los archivos
    exportados del editor, que no incluyen las armas de vehículos ni de los Elementals."""
    asset = blueprints.asset(paquete)
    datos = propiedades(asset, paquete.rsplit("/", 1)[1])
    estadisticas = datos.get("StatsData", {})
    arma = {"Name": datos.get("Name"), "Stats": (datos.get("Stats") or {}).get("KeyName")}
    for campo in CAMPOS_DE_ARMA:
        valor = estadisticas.get(campo)
        if isinstance(valor, dict):
            plano = limpiar(valor, CAMPOS_DE_PROYECTIL)
            interior = valor.get("Projectile")
            if isinstance(interior, dict):
                plano["Projectile"] = limpiar(interior, CAMPOS_DE_PROYECTIL)
            arma[campo] = plano
        elif valor is not None:
            arma[campo] = valor
    # Los niveles de un arma (_Lvl0) son la de fábrica con quirks que suben o bajan sus estadísticas.
    quirks = (datos.get("QuirkSet") or {}).get("QuirkList") or []
    if quirks:
        arma["Quirks"] = {asset.ruta_import(quirk["Quirk"])[1].removesuffix("_C"): quirk["Value"] for quirk in quirks}
    return arma


def texto(pak, tablas, valor):
    """El texto de un nombre, que puede venir como clave de una StringTable del juego."""
    if not isinstance(valor, dict):
        return valor
    ruta = valor["tabla"].split(".")[0]
    if ruta not in tablas:
        tablas[ruta] = Asset.desde_pak(pak, CONTENIDO + ruta[len("/Game/"):]).textos(ruta.rsplit("/", 1)[1])
    return tablas[ruta].get(valor["clave"])


def tarjetas():
    """Las unit cards de unidades que no son 'Mechs, con la ruta de su blueprint."""
    resultado = []
    for archivo in sorted(os.listdir(RUTA_UNIT_CARDS)):
        with open(os.path.join(RUTA_UNIT_CARDS, archivo), encoding="utf-8", errors="ignore") as entrada:
            contenido = entrada.read()
        tipo = REGEX_TIPO.search(contenido)
        clase = REGEX_CLASE.search(contenido)
        if tipo and clase and not tipo.group(1).startswith("UnitType.Mech"):
            resultado.append((os.path.splitext(archivo)[0], clase.group(1), set(REGEX_FACCION.findall(contenido))))
    return resultado


def guardar(nombre, datos):
    # Una entrada por línea: los cambios de un parche se leen bien en el diff.
    with open(os.path.join(RUTA_DESTINO, nombre), "w", encoding="utf-8") as archivo:
        archivo.write("{\n" + ",\n".join(f"{json.dumps(clave)}: {json.dumps(valor, ensure_ascii=False)}"
                                          for clave, valor in sorted(datos.items())) + "\n}\n")


def main():
    if len(sys.argv) != 2:
        print("Uso: python3 tools/extraer_unidades.py <carpeta del juego>")
        sys.exit(1)
    pak = Pak(os.path.join(sys.argv[1], PAK_DEL_JUEGO))
    blueprints = Blueprints(pak)
    os.makedirs(RUTA_DESTINO, exist_ok=True)

    unidades, errores, facciones = {}, [], set()
    for tarjeta, clase, de_tarjeta in tarjetas():
        facciones |= de_tarjeta
        try:
            unidades[clase] = leer_unidad(blueprints, clase)
        except Exception as error:  # noqa: BLE001: se avisa y se sigue con las demás
            errores.append(f"{tarjeta} ({error})")

    armas = {}
    for paquete in sorted({arma for unidad in unidades.values() for arma in unidad["armas"]}):
        nombre = paquete.rsplit("/", 1)[1]
        if nombre in armas:
            errores.append(f"arma repetida con otra ruta: {paquete}")
        armas[nombre] = leer_arma(blueprints, paquete)
    for unidad in unidades.values():
        unidad["armas"] = [paquete.rsplit("/", 1)[1] for paquete in unidad["armas"]]

    nombres, sin_asset = extraer_por_nombre(pak, "/Factions/", facciones, ("Name",))
    guardar("unidades.json", unidades)
    guardar("armas.json", armas)
    tablas = {}
    guardar("facciones.json", {faccion: texto(pak, tablas, datos["Name"]) for faccion, datos in nombres.items()})

    print(f"{len(unidades)} blueprints de unidades y {len(armas)} armas en {RUTA_DESTINO}")
    if sin_asset:
        print(f"Aviso: facciones sin asset: {', '.join(sorted(sin_asset))}")
    for error in errores:
        print(f"Aviso: {error}")


if __name__ == "__main__":
    main()
