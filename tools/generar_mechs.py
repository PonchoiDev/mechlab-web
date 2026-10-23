import json
import os
import re
import sys

DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "mda")
RUTA_DESTINO_POR_DEFECTO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "mechs.json")

REGEX_VARIANTE = re.compile(r'VariantName\s*=\s*INVTEXT\("([^"]+)"\)', re.IGNORECASE)
REGEX_KEYNAME = re.compile(r'KeyName\s*=\s*"([^"]+)"', re.IGNORECASE)
REGEX_TAGNAME = re.compile(r'TagName\s*=\s*"Mech\.[^.]+\.[^.]+\.([^"]+)"', re.IGNORECASE)
REGEX_CHASIS = re.compile(r'ChassisFullName\s*=\s*INVTEXT\("([^"]+)"\)', re.IGNORECASE)
# Los archivos más recientes no traen el texto, sino una clave de la tabla de textos del juego:
# VariantName=LOCTABLE(..., "Mech_Warhammer_WHM-7S_VariantName") y ChassisFullName=LOCTABLE(..., "Mech_Warhammer_ChassisName").
REGEX_VARIANTE_LOCTABLE = re.compile(r'VariantName\s*=\s*LOCTABLE\(', re.IGNORECASE)
REGEX_CHASIS_LOCTABLE = re.compile(r'ChassisFullName\s*=\s*LOCTABLE\("[^"]*",\s*"Mech_(.+?)_ChassisName"\)', re.IGNORECASE)
REGEX_MECH_TYPE_NAME = re.compile(r'MechType=\(TagName="Mech\.[^.]+\.([^.\"]+)', re.IGNORECASE)
REGEX_TECH_BASE = re.compile(r'TechBase=\(TagName="TechBase\.([^.\"]+)', re.IGNORECASE)

REGEX_TONS = re.compile(r'Tons\s*=\s*([0-9.]+)', re.IGNORECASE)
REGEX_BASE_TONS = re.compile(r'BaseTons\s*=\s*([0-9.]+)', re.IGNORECASE)
REGEX_SPEED = re.compile(r'TopSpeed\s*=\s*([0-9.]+)', re.IGNORECASE)
REGEX_BASE_COOLING_RATE = re.compile(r'BaseCoolingRate\s*=\s*([0-9.]+)', re.IGNORECASE)

REGEX_MAX_ARMOR = re.compile(r'MaxArmor=\((.*?)\)', re.DOTALL)
REGEX_MAX_STRUCT = re.compile(r'MaxStructure=\((.*?)\)', re.DOTALL)
REGEX_HARDPOINTS = re.compile(r'SelectedWeaponHardPoints=\((.*?)\)', re.DOTALL)
REGEX_BLOQUES_SLOTS = re.compile(r'MWSlotTypeDataAsset:([^"]+)"\).*?SlotCounts=\(\((.*?)\)\)')

MAPA_COMPONENTES = {
    "Head": "head", "CenterTorso": "centerTorso", "LeftTorso": "leftTorso",
    "RightTorso": "rightTorso", "LeftArm": "leftArm", "RightArm": "rightArm",
    "LeftLeg": "leftLeg", "RightLeg": "rightLeg"
}
COMPONENTES_CON_ARMADURA_TRASERA = {"centerTorso", "leftTorso", "rightTorso"}

# Clases de peso de MW5 por tonelaje máximo: las armas cuerpo a cuerpo solo encajan en su clase.
CLASES_DE_PESO = ((35, "light"), (55, "medium"), (75, "heavy"))
ARMAS_ESPECIALES_CUERPO_A_CUERPO = {
    "battle_fist": "Battle Fist",
    "barrelfist": "Barrel Fist",
    "inductiveclaws": "Inductive Claws"
}

ARCHIVOS_NO_JUGABLES = {
    "A1M4_JR7-D_MDA.copy",
    "ANH-1A_Boss_MDA.copy",
    "AS7-D_Nicole_MDA.copy",
    "COM-1D_Cinematic_MDA.copy",
    "HBR-A_DLC8_MDA.copy",
    "LCT-1V-TUTORIAL_MDA.copy",
    "MAD-BH_Boss_MDA.copy",
    "SHD-TUTORIAl_MDA1.copy",
    "WHM-DNC_MDA.copy"
}


def leer_archivo(ruta_archivo):
    with open(ruta_archivo, 'rb') as f:
        raw_bytes = f.read()

    if raw_bytes.startswith(b'\xff\xfe') or raw_bytes.startswith(b'\xfe\xff'):
        contenido = raw_bytes.decode('utf-16', errors='ignore')
    else:
        contenido = raw_bytes.decode('utf-8', errors='ignore')
        if '\x00' in contenido and len(contenido) > 10:
            contenido = raw_bytes.decode('utf-16-le', errors='ignore')

    return contenido.replace('\xa0', ' ').replace('\r', '').replace('\x00', '')


def buscar_texto(regex, contenido):
    coincidencia = regex.search(contenido)
    return coincidencia.group(1).strip() if coincidencia else None


def buscar_numero(regex, contenido, por_defecto):
    coincidencia = regex.search(contenido)
    return float(coincidencia.group(1)) if coincidencia else por_defecto


# Disipación de calor base cambiada por un parche del juego que todavía no recogen los archivos
# exportados. Se aplica por encima del BaseCoolingRate del archivo; el HTM-SG aparece en las notas
# del parche como HTM-SH.
REFRIGERACION_PARCHEADA = {
    **dict.fromkeys([
        "ARC-5S", "BJ2-O", "CDA-3F", "CN9-D3D", "CRD-6T", "CTF-3D", "CTF-3L", "DV-7P", "ENF-5D",
        "HBK-6S", "HTM-SG", "KGC-A", "LCT-3M", "LGB-OC", "NSR-10P", "NSR-9FC", "NSR-WP", "PRS-P1",
        "PRS-P1B", "PXH-R", "VT-5M", "VT-5S", "VTR-9B-LI", "WHM-7S", "ZEU-9S2"
    ], 2.0),
    "AWS-9Q": 1.8,
    **dict.fromkeys(["JVN-11A", "JVN-11B", "VND-5L"], 1.4),
}


def obtener_variante(contenido):
    # Con LOCTABLE, KeyName apunta a la variante de la que hereda el archivo; la etiqueta del mech
    # (Mech.Heavy.Warhammer.WHM-7S) es la que lleva la variante real.
    orden = (REGEX_TAGNAME, REGEX_KEYNAME) if REGEX_VARIANTE_LOCTABLE.search(contenido) else (REGEX_KEYNAME, REGEX_TAGNAME)
    for regex in (REGEX_VARIANTE, *orden):
        variante = buscar_texto(regex, contenido)
        if variante:
            return variante
    return None


def quitar_sufijo_variante(chasis, variante):
    variante_normalizada = ''.join(char.lower() for char in variante if char.isalnum())
    chasis_normalizado = ''.join(char.lower() for char in chasis if char.isalnum())
    if not variante_normalizada or not chasis_normalizado.endswith(variante_normalizada):
        return chasis

    caracteres_variante = 0
    for indice in range(len(chasis) - 1, -1, -1):
        if chasis[indice].isalnum():
            caracteres_variante += 1
        if caracteres_variante == len(variante_normalizada):
            chasis_base = chasis[:indice].rstrip(' _-')
            return chasis_base or chasis

    return chasis


def obtener_nombre_sarna(contenido, chasis, variante, tech_base):
    if tech_base and tech_base.lower() == 'clan':
        tipo_mech = buscar_texto(REGEX_MECH_TYPE_NAME, contenido)
        return separar_palabras(tipo_mech) if tipo_mech else chasis
    return quitar_sufijo_variante(chasis, variante)


def obtener_parte_cuerpo(hp_str):
    hp_lower = hp_str.lower()
    if "head" in hp_lower:
        return "head"
    if "center" in hp_lower:
        return "centerTorso"
    for lado in ("left", "right"):
        if lado not in hp_lower:
            continue
        if "arm" in hp_lower or "hand" in hp_lower:
            return f"{lado}Arm"
        if "leg" in hp_lower:
            return f"{lado}Leg"
        if "torso" in hp_lower or "clavicle" in hp_lower:
            return f"{lado}Torso"
    return None


def obtener_tipo_arma(hp_str):
    hp_upper = hp_str.upper()
    # _OH: anclaje omni de los omnimechs, que admite energía, balística o misiles.
    # Los de artillería (Arrow IV) se llaman _MH1_Artillery y solo admiten artillería.
    if "ARTILLERY" in hp_upper:
        return "artillery"
    for marcador, tipo in (("_EH", "energy"), ("_BH", "ballistic"), ("_MH", "missile"), ("_OH", "omni"), ("_AH", "ams"), ("MELEE", "melee")):
        if marcador in hp_upper:
            return tipo
    return None


def obtener_tamano_arma(hp_str):
    hp_lower = hp_str.lower()
    if "artillery" in hp_lower:
        return "large"

    for tamano in ("large", "medium", "small"):
        if tamano in hp_lower:
            return tamano

    hp_upper = hp_str.upper()
    if "AMS" in hp_upper or "ANTIMISSILE" in hp_upper or "_AH" in hp_upper or "machinegun" in hp_lower:
        return "small"
    if "gaussrifle" in hp_lower or "ppc" in hp_lower or "lrm" in hp_lower or "mrm" in hp_lower:
        return "large"
    if "srm" in hp_lower:
        return "medium"

    match_ac = re.search(r'(?:ac|autocannon)(\d+)', hp_lower)
    if match_ac:
        calibre = int(match_ac.group(1))
        if calibre >= 20:
            return "large"
        if calibre >= 5:
            return "medium"
        return "small"

    return "medium"


def obtener_clase_de_peso(tonelaje):
    for limite, clase in CLASES_DE_PESO:
        if tonelaje <= limite:
            return clase
    return "assault"


def obtener_anclaje_cuerpo_a_cuerpo(hp_str, contenido, clase_de_peso):
    # S = antebrazo (solo Hammerfist), M = mano (puños), L = brazo de arma (espadas, hachas...).
    hp_lower = hp_str.lower()
    especial = next((nombre for clave, nombre in ARMAS_ESPECIALES_CUERPO_A_CUERPO.items() if clave in hp_lower), None)

    if "lowerarm" in hp_lower or "lower_actuator" in hp_lower:
        tamano = "small"
    elif "meleeweapon" in hp_lower:
        tamano = "large"
    elif "hand" in hp_lower or especial:
        tamano = "medium"
    else:
        # Anclaje genérico (Arm_Left_Melee): es una mano si ese brazo tiene actuador de antebrazo.
        lado = "Left" if "left" in hp_lower else "Right"
        tamano = "medium" if f"{lado}Arm_LowerActuator" in contenido else "small"

    anclaje = {"type": "melee", "size": tamano, "weightClass": clase_de_peso}
    if especial:
        anclaje["defaultWeapon"] = especial
    return anclaje


def obtener_valores_por_componente(regex, contenido):
    valores = {}
    coincidencia = regex.search(contenido)
    if coincidencia:
        for comp, cantidad in re.findall(r'([A-Za-z]+)=([0-9.]+)', coincidencia.group(1)):
            if comp in MAPA_COMPONENTES:
                valores[MAPA_COMPONENTES[comp]] = float(cantidad)
    return valores


def obtener_ranuras(contenido):
    ranuras_generales = {}
    ranuras_especiales = {}

    for tipo_asset, raw_counts in REGEX_BLOQUES_SLOTS.findall(contenido):
        for comp, cantidad in re.findall(r'([A-Za-z]+),\s*(\d+)', raw_counts):
            comp = comp.strip()
            if comp not in MAPA_COMPONENTES:
                continue
            if 'General_SlotType' in tipo_asset:
                ranuras_generales[MAPA_COMPONENTES[comp]] = int(cantidad)
            else:
                ranuras_especiales.setdefault(tipo_asset, {})[MAPA_COMPONENTES[comp]] = int(cantidad)

    return ranuras_generales, ranuras_especiales


def obtener_hardpoints(contenido, clase_de_peso):
    hardpoints = {componente: [] for componente in MAPA_COMPONENTES.values()}
    coincidencia = REGEX_HARDPOINTS.search(contenido)
    if coincidencia:
        for hp in re.findall(r'"([^"]+)"', coincidencia.group(1)):
            parte = obtener_parte_cuerpo(hp)
            tipo = obtener_tipo_arma(hp)
            if not parte or not tipo:
                continue
            if tipo == "melee":
                hardpoints[parte].append(obtener_anclaje_cuerpo_a_cuerpo(hp, contenido, clase_de_peso))
            else:
                hardpoints[parte].append({"type": tipo, "size": obtener_tamano_arma(hp)})
    return hardpoints


def construir_componentes(contenido, clase_de_peso):
    ranuras_generales, ranuras_especiales = obtener_ranuras(contenido)
    armadura = obtener_valores_por_componente(REGEX_MAX_ARMOR, contenido)
    estructura = obtener_valores_por_componente(REGEX_MAX_STRUCT, contenido)
    hardpoints = obtener_hardpoints(contenido, clase_de_peso)

    componentes = {}
    for componente in MAPA_COMPONENTES.values():
        ranuras_especiales_parte = {
            tipo: cantidades.get(componente, 0)
            for tipo, cantidades in ranuras_especiales.items()
            if cantidades.get(componente, 0) > 0
        }
        componentes[componente] = {
            "maxSlots": ranuras_generales.get(componente, 0),
            "jumpJetSlots": sum(
                cantidad for tipo, cantidad in ranuras_especiales_parte.items()
                if tipo.startswith("JumpJetClass")
            ),
            "engineHeatsinkSlots": ranuras_especiales_parte.get("EngineHeatsink_SlotType", 0),
            "specialSlots": ranuras_especiales_parte,
            "maxArmor": armadura.get(componente, 0.0),
            "structure": estructura.get(componente, 0.0),
            "hasRearArmor": componente in COMPONENTES_CON_ARMADURA_TRASERA,
            "hardpoints": hardpoints[componente]
        }
    return componentes


def separar_palabras(clave):
    return re.sub(r'(?<=[a-z0-9])(?=[A-Z])', ' ', clave.replace('_', ' ')).strip()


def obtener_chasis(contenido, variante):
    chasis = buscar_texto(REGEX_CHASIS, contenido)
    if chasis:
        return chasis
    clave = buscar_texto(REGEX_CHASIS_LOCTABLE, contenido)
    return separar_palabras(clave) if clave else variante.split('-')[0]


def parsear_mech(contenido, variante):
    chasis = obtener_chasis(contenido, variante)
    tech_base = buscar_texto(REGEX_TECH_BASE, contenido)
    refrigeracion_base = REFRIGERACION_PARCHEADA.get(variante, buscar_numero(REGEX_BASE_COOLING_RATE, contenido, None))
    velocidad_raw = buscar_numero(REGEX_SPEED, contenido, 0.0)
    tonelaje = buscar_numero(REGEX_TONS, contenido, 0.0)

    mech = {
        "id": variante,
        "name": chasis,
        "variant": variante,
        "tonnageMax": tonelaje,
        "baseTonnage": buscar_numero(REGEX_BASE_TONS, contenido, 0.0),
        "baseSpeed": round((velocidad_raw / 3150.0) * 97.2, 1) if velocidad_raw > 0 else 0.0,
        "components": construir_componentes(contenido, obtener_clase_de_peso(tonelaje))
    }
    if refrigeracion_base is not None:
        mech["BaseCoolingRate"] = refrigeracion_base
    mech["sarnaName"] = obtener_nombre_sarna(contenido, chasis, variante, tech_base)
    if tech_base is not None:
        mech["techBase"] = tech_base
    return mech


def main():
    ruta_destino = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(RUTA_DESTINO_POR_DEFECTO)

    if not os.path.exists(RUTA_ORIGEN):
        print(f"❌ La ruta origen no existe: {RUTA_ORIGEN}")
        sys.exit(1)

    base_de_datos = []
    errores = []
    sin_refrigeracion_base = []
    variantes_vistas = {}
    duplicados = []

    for archivo in sorted(os.listdir(RUTA_ORIGEN)):
        if not archivo.endswith((".copy", ".txt")) or archivo in ARCHIVOS_NO_JUGABLES:
            continue

        try:
            contenido = leer_archivo(os.path.join(RUTA_ORIGEN, archivo))
            variante = obtener_variante(contenido)

            if not variante:
                errores.append(f"{archivo} (No se pudo identificar el ID/Variante)")
                continue
            if variante in variantes_vistas:
                duplicados.append(f"{archivo} (repite {variante} de {variantes_vistas[variante]})")
                continue
            variantes_vistas[variante] = archivo

            mech = parsear_mech(contenido, variante)
            if "BaseCoolingRate" not in mech:
                sin_refrigeracion_base.append(archivo)
            base_de_datos.append(mech)
        except (OSError, ValueError) as error:
            errores.append(f"{archivo} ({error})")

    os.makedirs(os.path.dirname(ruta_destino) or ".", exist_ok=True)
    with open(ruta_destino, 'w', encoding='utf-8') as f_out:
        json.dump(base_de_datos, f_out, indent=2, ensure_ascii=False)

    sin_archivo = sorted(set(REFRIGERACION_PARCHEADA) - set(variantes_vistas))
    if sin_archivo:
        print(f"\n⚠️ Variantes con disipación parcheada que no están en los archivos: {', '.join(sin_archivo)}")

    print(f"\n✅ ¡Proceso completado! Se actualizaron {len(base_de_datos)} mechs en {ruta_destino}")
    if duplicados:
        print(f"\n⚠️ Se descartaron {len(duplicados)} variantes repetidas:")
        for duplicado in duplicados:
            print(f"  - {duplicado}")
    if sin_refrigeracion_base:
        print(f"\n⚠️ No se encontró BaseCoolingRate en {len(sin_refrigeracion_base)} archivos.")
    if errores:
        print(f"\n⚠️ Quedaron {len(errores)} archivos con error:")
        for error in errores[:10]:
            print(f"  - {error}")


if __name__ == "__main__":
    main()
