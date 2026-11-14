import json
import os
import sys

from battletech import ASSETS, DATOS, leer_carpeta, leer_etiquetas, leer_json, leer_json_texto
from extraer_mapa import escribir_png, reducir
from ue4 import descomprimir_dxt5
from unityfs import textos_del_bundle

# Extrae de la instalación de BATTLETECH lo que necesita su MechLab: chasis, variantes ('Mechs de
# serie), armas, munición, disipadores, retrorreactores, mejoras, movimiento y las constantes de calor y
# blindaje. El juego base trae JSON sueltos; los DLC (Heavy Metal, Flashpoint y Urban Warfare) los
# guardan en bundles de Unity. Lo deja en tools/datos-juego/battletech/mechlab/ con la fuente de cada
# cosa, y los iconos de los chasis en PNG en battletech/public/mechlab/icons/. Después,
# generar_mechlab_battletech.py trabaja con esos archivos sin tocar el juego.
#
#   python3 tools/extraer_mechlab_battletech.py "/ruta/a/BATTLETECH"
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_DESTINO = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "battletech", "mechlab")
RUTA_ICONOS = os.path.join(DIRECTORIO_SCRIPT, "..", "battletech", "public", "mechlab", "icons")
# Bundles de los DLC dentro de data/assetbundles/, con el nombre de la fuente que se guarda.
DLC = {"heavymetal": "heavymetal", "flashpoint": "flashpoint", "urbanwarfare": "urbanwarfare"}
RETRATOS = os.path.join(ASSETS, "sprites", "MechPortraits")
# Cabecera de un DDS: 4 bytes de firma y 124 de descripción; detrás van los bloques DXT5.
CABECERA_DDS = 128
TAMANO_ICONO = 96
PREFIJO_ICONO = "uixTxrIcon_"
# Carpetas de componentes del juego base y el tipo con el que se guardan.
CARPETAS_DE_COMPONENTES = {"weapon": "Weapon", "ammunitionBox": "AmmunitionBox", "heatsinks": "HeatSink",
                           "jumpjets": "JumpJet", "upgrades": "Upgrade"}
# Lo que se descarta de cada JSON: posiciones de la línea de visión, prefabs, efectos visuales y textos
# que el MechLab no enseña. El resto se guarda tal cual.
CAMPOS_FUERA_CHASIS = {"LOSSourcePositions", "LOSTargetPositions", "PrefabIdentifier", "PrefabBase",
                       "PathingCapDefID", "HardpointDataDefID", "Radius", "StabilityDefenses",
                       "SpotterDistanceMultiplier", "VisibilityMultiplier", "SensorRangeMultiplier", "Signature"}
CAMPOS_FUERA_INVENTARIO = {"SimGameUID", "GUID", "DamageLevel", "prefabName", "hasPrefabName"}
CAMPOS_FUERA_UBICACION = {"DamageLevel", "CurrentArmor", "CurrentRearArmor", "CurrentInternalStructure"}
CAMPOS_FUERA_COMPONENTE = {"WeaponEffectID", "PrefabIdentifier", "BattleValue", "AttackRecoil", "AOECapable",
                           "OverheatedDamageMultiplier", "EvasiveDamageMultiplier", "DamageVariance"}


def fuente_de_id(componentes, id_, fuente, objeto, tipo):
    """Guarda un objeto con su fuente. Si un id aparece en el juego base y en un DLC, manda el base."""
    if id_ in componentes and componentes[id_]["fuente"] == "base":
        return
    componentes[id_] = {"fuente": fuente, "tipo": tipo, **objeto}


def limpiar_chasis(chasis):
    return {clave: valor for clave, valor in chasis.items() if clave not in CAMPOS_FUERA_CHASIS}


def limpiar_mech(mech):
    limpio = {clave: valor for clave, valor in mech.items() if clave not in ("Locations", "inventory")}
    limpio["Locations"] = [{c: v for c, v in ubicacion.items() if c not in CAMPOS_FUERA_UBICACION}
                           for ubicacion in mech.get("Locations") or []]
    limpio["inventory"] = [{c: v for c, v in pieza.items() if c not in CAMPOS_FUERA_INVENTARIO}
                           for pieza in mech.get("inventory") or []]
    return limpio


def limpiar_componente(componente):
    limpio = {clave: valor for clave, valor in componente.items() if clave not in CAMPOS_FUERA_COMPONENTE}
    descripcion = dict(limpio.get("Description") or {})
    descripcion.pop("Details", None)
    limpio["Description"] = descripcion
    # De los efectos solo cuenta la estadística que cambian; la duración y los iconos son del combate.
    limpio["statusEffects"] = [{"nombre": (efecto.get("Description") or {}).get("Name"), **efecto["statisticData"]}
                               for efecto in componente.get("statusEffects") or [] if efecto.get("statisticData")]
    return limpio


def leer_base(juego):
    chasis = {id_: {"fuente": "base", **limpiar_chasis(c)} for id_, c in leer_carpeta(juego, "chassis").items()}
    mechs = {id_: {"fuente": "base", **limpiar_mech(m)} for id_, m in leer_carpeta(juego, "mech").items()}
    movimiento = dict(leer_carpeta(juego, "movement"))
    municiones = dict(leer_carpeta(juego, "ammunition"))
    componentes = {}
    for carpeta, tipo in CARPETAS_DE_COMPONENTES.items():
        raiz = os.path.join(juego, DATOS, carpeta)
        # Las mejoras están repartidas en subcarpetas (actuadores, cabina, giroscopios…).
        for directorio, _, archivos in sorted(os.walk(raiz)):
            for nombre in sorted(archivos):
                if nombre.endswith(".json"):
                    objeto = leer_json(os.path.join(directorio, nombre))
                    fuente_de_id(componentes, nombre[: -len(".json")], "base", limpiar_componente(objeto), tipo)
    return chasis, mechs, movimiento, municiones, componentes


def leer_dlc(juego, chasis, mechs, movimiento, municiones, componentes):
    for bundle, fuente in DLC.items():
        textos = textos_del_bundle(os.path.join(juego, DATOS, "assetbundles", bundle))
        for nombre, contenido in sorted(textos.items()):
            if not nombre.startswith(("chassisdef_", "mechdef_", "movedef_", "Ammunition_", "Weapon_", "Ammo_", "Gear_")):
                continue
            objeto = leer_json_texto(contenido)
            if nombre.startswith("chassisdef_"):
                chasis.setdefault(nombre, {"fuente": fuente, **limpiar_chasis(objeto)})
            elif nombre.startswith("mechdef_"):
                mechs.setdefault(nombre, {"fuente": fuente, **limpiar_mech(objeto)})
            elif nombre.startswith("movedef_"):
                movimiento.setdefault(nombre, objeto)
            elif nombre.startswith("Ammunition_"):
                municiones.setdefault(nombre, objeto)
            else:
                fuente_de_id(componentes, nombre, fuente, limpiar_componente(objeto), objeto.get("ComponentType"))


def leer_constantes(juego):
    combate = leer_json(os.path.join(juego, DATOS, "constants", "CombatGameConstants.json"))
    estadisticas = leer_json(os.path.join(juego, DATOS, "constants", "MechStatisticsConstants.json"))
    return {"Heat": combate["Heat"], "MechStatistics": estadisticas}


def extraer_iconos(juego, chasis):
    """El icono de cada chasis (Description.Icon), de DXT5 de 128 px a PNG."""
    os.makedirs(RUTA_ICONOS, exist_ok=True)
    escritos, sin_icono = set(), set()
    for c in chasis.values():
        icono = (c.get("Description") or {}).get("Icon")
        # Los muñecos de prácticas (TARGETDUMMY, TESTDUMMY) usan el retrato grande de otro chasis y no
        # se pueden elegir: solo cuentan los iconos del mechlab (uixTxrIcon_).
        if not icono or not icono.startswith(PREFIJO_ICONO) or icono in escritos or icono in sin_icono:
            continue
        ruta = os.path.join(juego, RETRATOS, icono + ".dds")
        if not os.path.exists(ruta):
            sin_icono.add(icono)
            continue
        with open(ruta, "rb") as archivo:
            datos = archivo.read()
        alto, ancho = int.from_bytes(datos[12:16], "little"), int.from_bytes(datos[16:20], "little")
        pixeles = descomprimir_dxt5(datos[CABECERA_DDS:], ancho, alto)
        escribir_png(os.path.join(RUTA_ICONOS, icono.removeprefix(PREFIJO_ICONO) + ".png"), TAMANO_ICONO,
                     reducir(ancho, alto, pixeles, TAMANO_ICONO))
        escritos.add(icono)
    print(f"iconos: {len(escritos)} imágenes")
    if sin_icono:
        print(f"Aviso: iconos que no están en {RETRATOS}: {', '.join(sorted(sin_icono))}")


def guardar(nombre, datos):
    with open(os.path.join(RUTA_DESTINO, nombre), "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, ensure_ascii=False, indent=1, sort_keys=True)
        archivo.write("\n")


def main():
    if len(sys.argv) != 2:
        print('Uso: python3 tools/extraer_mechlab_battletech.py "<carpeta del juego>"')
        sys.exit(1)
    juego = sys.argv[1]
    os.makedirs(RUTA_DESTINO, exist_ok=True)

    chasis, mechs, movimiento, municiones, componentes = leer_base(juego)
    leer_dlc(juego, chasis, mechs, movimiento, municiones, componentes)
    usadas = {etiqueta for m in mechs.values() for etiqueta in (m.get("MechTags") or {}).get("items", [])}
    etiquetas = {nombre: datos for nombre, datos in leer_etiquetas(juego).items() if nombre in usadas}

    guardar("chasis.json", chasis)
    guardar("mechs.json", mechs)
    guardar("componentes.json", componentes)
    guardar("municiones.json", municiones)
    guardar("movimiento.json", {id_: {"MaxWalkDistance": m.get("MaxWalkDistance"), "MaxSprintDistance": m.get("MaxSprintDistance")}
                                for id_, m in movimiento.items()})
    guardar("constantes.json", leer_constantes(juego))
    guardar("etiquetas.json", etiquetas)
    extraer_iconos(juego, chasis)
    print(f"chasis: {len(chasis)} · mechs: {len(mechs)} · componentes: {len(componentes)} · movimiento: {len(movimiento)}")


if __name__ == "__main__":
    main()
