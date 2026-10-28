import base64
import csv
import json
import os
import re
import sys

DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "mda")
RUTA_LOADOUTS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "loadout")
RUTA_UNIT_CARDS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "unitcard")
RUTA_MODELOS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "mdl")
RUTA_ANCLAJES = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "hps")
RUTA_ITEMS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "items")
# Tabla de textos del juego exportada a CSV desde el editor (Mech_StringTable): los archivos nuevos
# solo traen la clave del nombre del chasis, no el texto.
RUTA_TEXTOS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "mech_string_table")
RUTA_ITEMS_JSON = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "items.json")
RUTA_DESTINO_POR_DEFECTO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "mechs.json")

REGEX_VARIANTE = re.compile(r'VariantName\s*=\s*INVTEXT\("([^"]+)"\)', re.IGNORECASE)
REGEX_KEYNAME = re.compile(r'KeyName\s*=\s*"([^"]+)"', re.IGNORECASE)
REGEX_TAGNAME = re.compile(r'TagName\s*=\s*"Mech\.[^.]+\.[^.]+\.([^"]+)"', re.IGNORECASE)
REGEX_CHASIS = re.compile(r'ChassisFullName\s*=\s*INVTEXT\("([^"]+)"\)', re.IGNORECASE)
# Los archivos más recientes no traen el texto, sino una clave de la tabla de textos del juego:
# VariantName=LOCTABLE(..., "Mech_Warhammer_WHM-7S_VariantName") y ChassisFullName=LOCTABLE(..., "Mech_Warhammer_ChassisName").
REGEX_VARIANTE_LOCTABLE = re.compile(r'VariantName\s*=\s*LOCTABLE\(', re.IGNORECASE)
REGEX_CLAVE_CHASIS = re.compile(r'ChassisFullName\s*=\s*LOCTABLE\("[^"]*",\s*"([^"]+)"\)', re.IGNORECASE)
REGEX_CHASIS_LOCTABLE = re.compile(r'ChassisFullName\s*=\s*LOCTABLE\("[^"]*",\s*"Mech_(.+?)_ChassisName"\)', re.IGNORECASE)
# La clave de texto de la variante la nombra siempre bien, también cuando la etiqueta del mech es la
# del chasis base (los Timber Wolf A, C, D y S dicen TBR-PRIME) o la de un campeón (ArcherC).
REGEX_VARIANTE_CLAVE = re.compile(r'VariantName\s*=\s*LOCTABLE\([^,]+,\s*"Mech_[A-Za-z0-9]+_(.+?)_VariantName"\)', re.IGNORECASE)
# Los campeones se llamaban "ARC-2R (C)" con el formato anterior; se mantiene ese id para no romper
# los enlaces y las builds guardadas.
REGEX_SUFIJO_CAMPEON = re.compile(r'-(C2?)$')
REGEX_MECH_TYPE_NAME = re.compile(r'MechType=\(TagName="Mech\.[^.]+\.([^.\"]+)', re.IGNORECASE)
REGEX_TECH_BASE = re.compile(r'TechBase=\(TagName="TechBase\.([^.\"]+)', re.IGNORECASE)

REGEX_TONS = re.compile(r'Tons\s*=\s*([0-9.]+)', re.IGNORECASE)
REGEX_BASE_TONS = re.compile(r'BaseTons\s*=\s*([0-9.]+)', re.IGNORECASE)
REGEX_SPEED = re.compile(r'TopSpeed\s*=\s*([0-9.]+)', re.IGNORECASE)
REGEX_BASE_COOLING_RATE = re.compile(r'BaseCoolingRate\s*=\s*([0-9.]+)', re.IGNORECASE)
REGEX_TIPO_ARMADURA = re.compile(r'ArmorDataAssetId=\(Id="MWArmorDataAsset:([^"]+)"')
REGEX_TIPO_DISIPADORES = re.compile(r'AllowedHeatSinkType=\(TagName="Equipment\.HeatSinks\.([^"]+)"')
REGEX_TIPO_ESTRUCTURA = re.compile(r'StructureDataAssetId=\(Id="MWStructureDataAsset:([^"]+)"')
REGEX_POTENCIA_MOTOR = re.compile(r'EngineRating=(\d+)')
# Movimiento y calor del chasis, como los muestra el resumen de la pantalla de mejoras del juego.
REGEX_GIRO = re.compile(r'(?<![A-Za-z])TurnSpeed=([0-9.]+)')
REGEX_GIRO_TORSO = re.compile(r'TorsoTwistRate=\(Yaw=([0-9.]+),Pitch=([0-9.]+)')
REGEX_CAPACIDAD_CALOR = re.compile(r'BaseHeatCapacity=([0-9.]+)')
# Ranuras para las mejoras de la cantina (cada mejora ocupa 1 o 2).
REGEX_RANURAS_MEJORA = re.compile(r'TotalTraitSlots=(\d+)')
# En MW5, velocidad máxima (km/h) = potencia del motor / tonelaje * 16,2.
FACTOR_VELOCIDAD_MOTOR = 16.2

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


def obtener_variante(contenido):
    clave = buscar_texto(REGEX_VARIANTE_CLAVE, contenido)
    if clave:
        etiqueta = buscar_texto(REGEX_TAGNAME, contenido) or ""
        es_campeon = re.fullmatch(r'[A-Za-z]+C2?', etiqueta) is not None
        return REGEX_SUFIJO_CAMPEON.sub(r' (\1)', clave) if es_campeon else clave
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
    # Anclajes de los mechs Hero (Banshee BNC-LM, BNC-SR): Hero_Left/Hero_Right van en el brazo
    # de ese lado y Hero_ sin lado en la cabeza, según el mechlab del juego.
    if hp_lower.startswith("hero_"):
        for lado in ("left", "right"):
            if hp_lower.startswith(f"hero_{lado}_"):
                return f"{lado}Arm"
        return "head"
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
        # Los hombros (Shoulder_Left_EH1, Timber Wolf A) van en el torso.
        if "torso" in hp_lower or "clavicle" in hp_lower or "shoulder" in hp_lower:
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


def obtener_hardpoints(contenido, clase_de_peso, tamanos_anclajes=None):
    # tamanos_anclajes: tamaño de cada anclaje del modelo (HPS), por su nombre en minúsculas. Si un
    # anclaje no está ahí, el tamaño se deduce del nombre.
    tamanos_anclajes = tamanos_anclajes or {}
    hardpoints = {componente: [] for componente in MAPA_COMPONENTES.values()}
    coincidencia = REGEX_HARDPOINTS.search(contenido)
    if coincidencia:
        for hp in re.findall(r'"([^"]+)"', coincidencia.group(1)):
            parte = obtener_parte_cuerpo(hp)
            tipo = obtener_tipo_arma(hp)
            if not parte or not tipo:
                continue
            if tipo == "melee":
                anclaje = obtener_anclaje_cuerpo_a_cuerpo(hp, contenido, clase_de_peso)
                # El HPS dice si es antebrazo, mano o brazo de arma; los actuadores del MDA no siempre
                # coinciden (los Omni Clan los listan todos y en el juego son antebrazo).
                anclaje["size"] = tamanos_anclajes.get(hp.lower()) or anclaje["size"]
                hardpoints[parte].append(anclaje)
            else:
                hardpoints[parte].append({"type": tipo, "size": tamanos_anclajes.get(hp.lower()) or obtener_tamano_arma(hp)})
    return hardpoints


REGEX_MODELO = re.compile(r"MechModel=MWMechModelDataAsset'\"?[^'\"]*/([^/.'\"]+)\.")
REGEX_ASSET_ANCLAJES = re.compile(r'WeaponHardpointAsset=\(Id="MWMechHardpointAsset:([^"]+)"')
REGEX_RANURA_ANCLAJE = re.compile(r'HardpointSlotID="([^"]+)"(?:(?!HardpointSlotID=).)*?SlotTypeAssetId=\(Id="MWSlotTypeDataAsset:([^"]+)"\)', re.DOTALL)
REGEX_RANURA_ARMA = re.compile(r'WeaponSlotTypeAssetId=\(Id="MWSlotTypeDataAsset:([^"]+)"')
REGEX_RANURA_GENERICA = re.compile(r'^(?:energy|ballistic|missile|omni)_(xs|small|medium|large)', re.IGNORECASE)
REGEX_TAMANO_ARMA = re.compile(r'WeaponSize=([A-Za-z]+)')
REGEX_SUFIJO_RANURA = re.compile(r'(?:_(?:stream|burst|auto|shortburst))+(?=_slottype$)')


def cargar_tamanos_de_ranuras():
    # Las ranuras de un arma concreta (MediumLaser_SlotType) tienen el tamaño de las armas que las usan.
    # Sin WeaponSize, UE4 toma el primer valor del enum, Small (igual que generar_items.py).
    tamanos = {}
    for ruta in cargar_archivos_por_nombre(RUTA_ITEMS).values():
        contenido = leer_archivo(ruta)
        ranura = buscar_texto(REGEX_RANURA_ARMA, contenido)
        if ranura:
            tamano = (buscar_texto(REGEX_TAMANO_ARMA, contenido) or "small").lower()
            if tamano in ORDEN_TAMANOS:
                tamanos.setdefault(ranura.lower(), tamano)
    return tamanos


# Anclajes cuerpo a cuerpo: S antebrazo, M mano o puño especial, L brazo de arma.
TAMANOS_CUERPO_A_CUERPO = (
    ("meleelowerarmactuator", "small"),
    ("_melee_weapon_", "large"),
    ("melee", "medium"),
)


def tamano_de_ranura(ranura, tamanos_de_ranuras):
    for marca, tamano in TAMANOS_CUERPO_A_CUERPO:
        if marca in ranura.lower():
            return tamano
    # Ranuras genéricas: Missile_Large_SlotType, Omni_MediumReduced_SlotType; XS es extra pequeña.
    generica = REGEX_RANURA_GENERICA.match(ranura)
    if generica:
        tamano = generica.group(1).lower()
        return "small" if tamano == "xs" else tamano
    # Las de versiones de un arma (LRM15_Stream, AC20_Burst, MediumLaser_Shortburst) miden lo que el arma base.
    ranura = ranura.lower()
    return tamanos_de_ranuras.get(ranura) or tamanos_de_ranuras.get(REGEX_SUFIJO_RANURA.sub("", ranura))


def cargar_tamanos_anclajes():
    # Por modelo (Atlas_MDL), el tamaño de cada anclaje según su HPS: MDA -> MDL -> HPS.
    modelos = cargar_archivos_por_nombre(RUTA_MODELOS)
    asset_anclajes = cargar_archivos_por_nombre(RUTA_ANCLAJES)
    tamanos_de_ranuras = cargar_tamanos_de_ranuras()
    por_modelo = {}
    for modelo, ruta in modelos.items():
        hps = (buscar_texto(REGEX_ASSET_ANCLAJES, leer_archivo(ruta)) or "").lower()
        if hps not in asset_anclajes:
            continue
        tamanos = {}
        for anclaje, ranura in REGEX_RANURA_ANCLAJE.findall(leer_archivo(asset_anclajes[hps])):
            tamano = tamano_de_ranura(ranura, tamanos_de_ranuras)
            if tamano:
                tamanos.setdefault(anclaje.lower(), tamano)
        por_modelo[modelo] = tamanos
    return por_modelo


REGEX_CLAVE_ANCLAJE = re.compile(r'^(.*?_[a-z]{2}\d+)')


def clave_anclaje(nombre):
    # Componente, tipo y número del anclaje sin el arma del final: Torso_Left_EH1_ppc -> torso_left_eh1.
    coincidencia = REGEX_CLAVE_ANCLAJE.match(nombre.lower())
    return coincidencia.group(1) if coincidencia else nombre.lower()


def obtener_indices_anclajes(contenido):
    # Mismo recorrido que obtener_hardpoints: para cada anclaje, su componente y su índice, por su
    # nombre completo y por su clave (por si el loadout lo nombra con otra arma al final).
    indices = {}
    contadores = {componente: 0 for componente in MAPA_COMPONENTES.values()}
    coincidencia = REGEX_HARDPOINTS.search(contenido)
    if coincidencia:
        for hp in re.findall(r'"([^"]+)"', coincidencia.group(1)):
            parte = obtener_parte_cuerpo(hp)
            if not parte or not obtener_tipo_arma(hp):
                continue
            indices[hp.lower()] = (parte, contadores[parte])
            indices.setdefault(clave_anclaje(hp), (parte, contadores[parte]))
            contadores[parte] += 1
    return indices


def construir_componentes(contenido, clase_de_peso, tamanos_anclajes=None):
    ranuras_generales, ranuras_especiales = obtener_ranuras(contenido)
    armadura = obtener_valores_por_componente(REGEX_MAX_ARMOR, contenido)
    estructura = obtener_valores_por_componente(REGEX_MAX_STRUCT, contenido)
    hardpoints = obtener_hardpoints(contenido, clase_de_peso, tamanos_anclajes)

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


def cargar_textos():
    # Clave -> texto de las tablas de textos exportadas a CSV (Key, SourceString).
    textos = {}
    if not os.path.isdir(RUTA_TEXTOS):
        return textos
    # El editor la exporta en UTF-16; leer_archivo detecta la codificación. Los archivos sin la
    # cabecera Key,SourceString (una copia vacía del asset, por ejemplo) se ignoran.
    for archivo in sorted(os.listdir(RUTA_TEXTOS)):
        lineas = leer_archivo(os.path.join(RUTA_TEXTOS, archivo)).lstrip("\ufeff").splitlines()
        for fila in csv.DictReader(lineas):
            clave, texto = fila.get("Key"), fila.get("SourceString")
            if clave and texto:
                textos[clave] = texto.strip()
    return textos


def obtener_chasis(contenido, variante, textos=None):
    chasis = buscar_texto(REGEX_CHASIS, contenido)
    if chasis:
        return chasis
    chasis = (textos or {}).get(buscar_texto(REGEX_CLAVE_CHASIS, contenido) or "")
    if chasis:
        return chasis
    clave = buscar_texto(REGEX_CHASIS_LOCTABLE, contenido)
    return separar_palabras(clave) if clave else variante.split('-')[0]


def obtener_potencia_motor(contenido, velocidad_raw, tonelaje):
    # Muchos MDA traen dos potencias (la del mech y la de una plantilla), y en algunos omnimechs
    # ninguna cuadra (el Adder trae 180 y 375, pero su velocidad es la de un motor 210). La velocidad
    # sí está comprobada con el juego, así que la potencia se calcula con ella, en pasos de 5.
    if velocidad_raw > 0 and tonelaje > 0:
        velocidad = (velocidad_raw / 3150.0) * 97.2 * 7 / 6
        return int(round(velocidad * tonelaje / FACTOR_VELOCIDAD_MOTOR / 5) * 5)
    potencias = sorted({int(valor) for valor in REGEX_POTENCIA_MOTOR.findall(contenido)})
    return potencias[0] if potencias else 0


def parsear_mech(contenido, variante, tamanos_anclajes=None, textos=None):
    chasis = obtener_chasis(contenido, variante, textos)
    tech_base = buscar_texto(REGEX_TECH_BASE, contenido)
    refrigeracion_base = buscar_numero(REGEX_BASE_COOLING_RATE, contenido, None)
    velocidad_raw = buscar_numero(REGEX_SPEED, contenido, 0.0)
    tonelaje = buscar_numero(REGEX_TONS, contenido, 0.0)

    mech = {
        "id": variante,
        "name": chasis,
        "variant": variante,
        "tonnageMax": tonelaje,
        "baseTonnage": buscar_numero(REGEX_BASE_TONS, contenido, 0.0),
        "baseSpeed": round((velocidad_raw / 3150.0) * 97.2, 4) if velocidad_raw > 0 else 0.0,
        "components": construir_componentes(contenido, obtener_clase_de_peso(tonelaje), tamanos_anclajes)
    }
    if refrigeracion_base is not None:
        mech["BaseCoolingRate"] = refrigeracion_base
    mech["sarnaName"] = obtener_nombre_sarna(contenido, chasis, variante, tech_base)
    # La armadura Ferro-Fibrosa da más puntos por tonelada, y los disipadores dobles de la Esfera
    # Interior cambian la refrigeración del motor (src/utils/calculators.ts).
    armadura = buscar_texto(REGEX_TIPO_ARMADURA, contenido) or ""
    mech["armorType"] = "ferroFibrous" if "ferro" in armadura.lower() else "standard"
    disipadores = (buscar_texto(REGEX_TIPO_DISIPADORES, contenido) or "Single").lower()
    mech["heatSinkType"] = "clanDouble" if disipadores == "double.clan" else "double" if disipadores == "double" else "single"
    estructura = (buscar_texto(REGEX_TIPO_ESTRUCTURA, contenido) or "").lower()
    mech["structureType"] = "endoSteel" if "endo" in estructura else "standard"
    mech["engine"] = {"rating": obtener_potencia_motor(contenido, velocidad_raw, tonelaje), "xl": "bXLEngine=True" in contenido}
    # Sonda activa de serie: el mechlab del juego la marca como AP junto al motor.
    if "bBeagleActiveProbe=True" in contenido:
        mech["activeProbe"] = True
    if "bIsHeroMech=True" in contenido:
        mech["hero"] = True
    giro = buscar_texto(REGEX_GIRO, contenido)
    if giro:
        mech["turnSpeed"] = round(float(giro), 2)
    giro_torso = REGEX_GIRO_TORSO.search(contenido)
    if giro_torso:
        mech["torsoTwist"] = {"yaw": round(float(giro_torso.group(1)), 2), "pitch": round(float(giro_torso.group(2)), 2)}
    capacidad_calor = buscar_texto(REGEX_CAPACIDAD_CALOR, contenido)
    if capacidad_calor:
        mech["baseHeatCapacity"] = float(capacidad_calor)
    ranuras_mejora = buscar_texto(REGEX_RANURAS_MEJORA, contenido)
    if ranuras_mejora:
        mech["upgradeSlots"] = int(ranuras_mejora)
    if tech_base is not None:
        mech["techBase"] = tech_base
    return mech


# --- Builds de fábrica (loadouts) y datos de las unit cards ------------------------------------

# Orden de los componentes en el código de build de la web (ZONE_KEYS en src/utils/zones.ts).
ZONAS_BUILD = ["head", "centerTorso", "leftTorso", "rightTorso", "leftArm", "rightArm", "leftLeg", "rightLeg"]
VERSION_CODIGO_BUILD = 1

REGEX_DEFAULT_MECH = re.compile(r'DefaultMech=\(Id="MWMechLoadoutAsset:([^"]+)"')
REGEX_ARMADURA_INSTALADA = re.compile(r'InstalledArmor=\(([^)]*)\)')
REGEX_ARMADURA_TRASERA = re.compile(r'InstalledRearArmor=\(([^)]*)\)')
REGEX_ARMA_INSTALADA = re.compile(r'\(HardpointSlotID="([^"]+)",WeaponData=\(WeaponId=\(Id="MW[A-Za-z]+:([^"]+)"\)')
REGEX_EQUIPO_CON_RANURA = re.compile(r'SlotTypeAssetId=\(Id="MWSlotTypeDataAsset:([^"]+)"\),EquipmentData=\(EquipmentId=\(Id="MW[A-Za-z]+:([^"]+)"\)')
REGEX_NIVEL = re.compile(r'_Lvl(\d+)$', re.IGNORECASE)

REGEX_PLANTILLA_LOADOUT = re.compile(r'MechLoadoutTemplate=\(Id="MWMechLoadoutAsset:([^"]+)"')
REGEX_FECHA_INTRO = re.compile(r'IntroDate=(\d{3,4})\.')
REGEX_USO_INTRO = re.compile(r'IntroUsage=\(TagName="([^"]+)"')
REGEX_ROL = re.compile(r'TagName="Unit\.Role\.([A-Za-z]+)"')
ROLES = {
    "skirmisher": "Skirmisher", "sniper": "Sniper", "brawler": "Brawler", "striker": "Striker",
    "scout": "Scout", "juggernaut": "Juggernaut", "missileboat": "Missile Boat", "ambusher": "Ambusher"
}


def cargar_archivos_por_nombre(ruta):
    if not os.path.isdir(ruta):
        return {}
    return {os.path.splitext(archivo)[0].lower(): os.path.join(ruta, archivo) for archivo in os.listdir(ruta)}


def cargar_catalogo():
    with open(os.path.normpath(RUTA_ITEMS_JSON), encoding="utf-8") as archivo:
        return {item_id.lower(): item for item_id, item in json.load(archivo).items()}


def buscar_item(catalogo, item_id):
    # Los loadouts escriben los ids con otras mayúsculas (Mediumlaser) y el tier como sufijo (_Lvl3).
    nivel = REGEX_NIVEL.search(item_id)
    base = REGEX_NIVEL.sub("", item_id).lower()
    item = catalogo.get(base)
    return (item, nivel.group(1) if nivel else None) if item else (None, None)


def valores_armadura(regex, contenido, sufijo=""):
    coincidencia = regex.search(contenido)
    valores = {}
    if coincidencia:
        for parte, cantidad in re.findall(r'([A-Za-z]+)=([0-9.]+)', coincidencia.group(1)):
            parte = parte[:-len(sufijo)] if sufijo and parte.endswith(sufijo) else parte
            if parte in MAPA_COMPONENTES:
                valores[MAPA_COMPONENTES[parte]] = int(round(float(cantidad)))
    return valores


def codificar_build(datos):
    texto = json.dumps(datos, separators=(",", ":"), ensure_ascii=False)
    return base64.urlsafe_b64encode(texto.encode("utf-8")).decode("ascii").rstrip("=")


def espejo(nombre):
    contrarios = {"left": "right", "right": "left", "Left": "Right", "Right": "Left", "LEFT": "RIGHT", "RIGHT": "LEFT"}
    return re.sub(r'left|right', lambda lado: contrarios.get(lado.group(0), lado.group(0)), nombre, flags=re.IGNORECASE)


def corregir_lados_con_loadout(contenido_mda, contenido_loadout, ajustes, variante):
    # Algunos MDA (HBR-A) tienen los brazos al revés que su loadout, que es lo que muestra el juego:
    # si un anclaje no está en el loadout pero el del lado contrario sí, se usa el del loadout.
    en_loadout = {anclaje.lower() for anclaje, _ in REGEX_ARMA_INSTALADA.findall(contenido_loadout)}
    coincidencia = REGEX_HARDPOINTS.search(contenido_mda)
    if not coincidencia:
        return contenido_mda
    bloque = coincidencia.group(1)
    nombres = re.findall(r'"([^"]+)"', bloque)
    corregido = bloque
    for nombre in nombres:
        contrario = espejo(nombre)
        if nombre.lower() not in en_loadout and contrario.lower() in en_loadout and contrario not in nombres:
            corregido = corregido.replace(f'"{nombre}"', f'"{contrario}"')
            ajustes.append(f"{variante}: anclaje {nombre} -> {contrario}")
    return contenido_mda.replace(bloque, corregido)


def construir_build_de_fabrica(mech, contenido_mda, contenido_loadout, catalogo, avisos):
    variante = mech["id"]
    # Genera el mismo código que el enlace de Share (src/utils/buildCode.ts), para que la web la
    # reconstruya con las reglas del taller.
    indices = obtener_indices_anclajes(contenido_mda)
    zonas = {zona: [] for zona in ZONAS_BUILD}

    for anclaje, arma_id in REGEX_ARMA_INSTALADA.findall(contenido_loadout):
        item, nivel = buscar_item(catalogo, arma_id)
        posicion = indices.get(anclaje.lower()) or indices.get(clave_anclaje(anclaje))
        if not item or not posicion:
            avisos.append(f"{variante}: arma {arma_id} en {anclaje}")
            continue
        zona, indice = posicion
        # Igual que con el equipo, un arma más grande que su anclaje se deja fuera (Clan Large Pulse
        # Laser en el omni mediano del KFX-S).
        tamano_anclaje = mech["components"][zona]["hardpoints"][indice].get("size")
        if ORDEN_TAMANOS.get(item.get("size"), 0) > ORDEN_TAMANOS.get(tamano_anclaje, 2):
            avisos.append(f"{variante}: {item['name']} no cabe en {anclaje}")
            continue
        zonas[zona].append([item["id"], indice, nivel] if nivel and nivel != item.get("tier") else [item["id"], indice])

    # El equipo va agrupado por componente: cada trozo empieza en MechPart=<Componente>.
    equipo = contenido_loadout.split("Equipment=(MechPartEquipment=", 1)[-1] if "MechPartEquipment=" in contenido_loadout else ""
    for trozo in equipo.split("MechPart=")[1:]:
        parte, bloque = re.match(r'([A-Za-z]+)(.*)', trozo, re.DOTALL).groups()
        zona = MAPA_COMPONENTES.get(parte)
        if not zona:
            continue
        # Algunas builds de fábrica traen más equipo del que caben en las ranuras del MDA; el juego
        # lo quita al cargar el loadout por defecto, así que aquí también se deja fuera.
        componente = mech["components"][zona]
        generales = 0
        especiales = {}
        for tipo_ranura, equipo_id in REGEX_EQUIPO_CON_RANURA.findall(bloque):
            item, _ = buscar_item(catalogo, equipo_id)
            if not item:
                avisos.append(f"{variante}: equipo {equipo_id} en {parte}")
                continue
            if tipo_ranura == "General_SlotType":
                cabe = generales + (item.get("slots") or 0) <= componente["maxSlots"]
                if cabe:
                    generales += item.get("slots") or 0
            else:
                cabe = especiales.get(tipo_ranura, 0) < componente["specialSlots"].get(tipo_ranura, 0)
                if cabe:
                    especiales[tipo_ranura] = especiales.get(tipo_ranura, 0) + 1
            if cabe:
                zonas[zona].append(item["id"])
            else:
                avisos.append(f"{variante}: {item['name']} no cabe en {parte}")

    frontal = valores_armadura(REGEX_ARMADURA_INSTALADA, contenido_loadout)
    trasera = valores_armadura(REGEX_ARMADURA_TRASERA, contenido_loadout, "Rear")
    armadura = [valor for zona in ZONAS_BUILD for valor in (frontal.get(zona, 0), trasera.get(zona, 0))]
    return codificar_build([VERSION_CODIGO_BUILD, variante, armadura, [zonas[zona] for zona in ZONAS_BUILD]])


ORDEN_TAMANOS = {"small": 0, "medium": 1, "large": 2}


def ajustar_a_build_de_fabrica(mech, contenido_mda, contenido_loadout, catalogo, ajustes, tamanos_anclajes=None):
    # Cuando el tamaño de un anclaje se deduce de su nombre (no está en el HPS), la build de fábrica
    # muestra lo que el juego monta, así que el anclaje es al menos del tamaño de su arma de serie.
    # Los tamaños del HPS no se tocan: el loadout del KFX-S pone un láser grande en un omni mediano
    # y el juego muestra el anclaje mediano.
    indices = obtener_indices_anclajes(contenido_mda)
    del_modelo = {posicion for nombre, posicion in indices.items() if nombre in (tamanos_anclajes or {})}
    for anclaje, arma_id in REGEX_ARMA_INSTALADA.findall(contenido_loadout):
        item, _ = buscar_item(catalogo, arma_id)
        posicion = indices.get(anclaje.lower()) or indices.get(clave_anclaje(anclaje))
        if not item or not posicion or posicion in del_modelo or item.get("size") not in ORDEN_TAMANOS:
            continue
        zona, indice = posicion
        hardpoint = mech["components"][zona]["hardpoints"][indice]
        if hardpoint["type"] != "melee" and ORDEN_TAMANOS[item["size"]] > ORDEN_TAMANOS.get(hardpoint["size"], 0):
            ajustes.append(f"{mech['id']} {zona}: anclaje {hardpoint['type']} {hardpoint['size']} -> {item['size']} ({item['name']})")
            hardpoint["size"] = item["size"]


def cargar_unit_cards(rutas):
    # Por loadout, la unit card que usa el juego para el mercado: la que se llama como la variante
    # (<VARIANTE>_UnitCard) o, si no, la de uso Market; las de campaña o misiones quedan detrás.
    por_loadout = {}
    for nombre, ruta in rutas.items():
        contenido = leer_archivo(ruta)
        plantilla = buscar_texto(REGEX_PLANTILLA_LOADOUT, contenido)
        if not plantilla:
            continue
        uso = buscar_texto(REGEX_USO_INTRO, contenido) or ""
        prioridad = 0 if nombre == f"{plantilla.lower().removesuffix('_loadout')}_unitcard" else 1 if uso.endswith("Market") else 2
        actual = por_loadout.get(plantilla.lower())
        if actual is None or prioridad < actual[0]:
            por_loadout[plantilla.lower()] = (prioridad, contenido)
    return {plantilla: contenido for plantilla, (_, contenido) in por_loadout.items()}


def datos_unit_card(contenido):
    datos = {}
    fecha = buscar_texto(REGEX_FECHA_INTRO, contenido)
    if fecha:
        datos["introYear"] = int(fecha)
    rol = buscar_texto(REGEX_ROL, contenido)
    if rol:
        datos["role"] = ROLES.get(rol.lower(), separar_palabras(rol))
    return datos


def main():
    ruta_destino = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(RUTA_DESTINO_POR_DEFECTO)

    if not os.path.exists(RUTA_ORIGEN):
        print(f"❌ La ruta origen no existe: {RUTA_ORIGEN}")
        sys.exit(1)

    catalogo = cargar_catalogo()
    loadouts = cargar_archivos_por_nombre(RUTA_LOADOUTS)
    unit_cards = cargar_unit_cards(cargar_archivos_por_nombre(RUTA_UNIT_CARDS))
    tamanos_por_modelo = cargar_tamanos_anclajes()
    textos = cargar_textos()
    sin_nombre = []
    sin_modelo = []
    avisos_builds = []
    ajustes_fabrica = []
    sin_build = []
    sin_unit_card = []

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

            # Algunas variantes nuevas heredan el DefaultMech de su padre aunque tengan su propio loadout.
            propio = f"{variante.lower()}_loadout"
            loadout = propio if propio in loadouts else (buscar_texto(REGEX_DEFAULT_MECH, contenido) or "").lower()
            contenido_loadout = leer_archivo(loadouts[loadout]) if loadout in loadouts else None
            if contenido_loadout:
                contenido = corregir_lados_con_loadout(contenido, contenido_loadout, ajustes_fabrica, variante)

            modelo = (buscar_texto(REGEX_MODELO, contenido) or "").lower()
            if modelo not in tamanos_por_modelo:
                sin_modelo.append(variante)
            mech = parsear_mech(contenido, variante, tamanos_por_modelo.get(modelo), textos)
            if not buscar_texto(REGEX_CHASIS, contenido) and buscar_texto(REGEX_CLAVE_CHASIS, contenido) not in textos:
                sin_nombre.append(variante)
            if contenido_loadout:
                ajustar_a_build_de_fabrica(mech, contenido, contenido_loadout, catalogo, ajustes_fabrica, tamanos_por_modelo.get(modelo))
                mech["stockBuild"] = construir_build_de_fabrica(mech, contenido, contenido_loadout, catalogo, avisos_builds)
            else:
                sin_build.append(variante)
            if loadout in unit_cards:
                mech.update(datos_unit_card(unit_cards[loadout]))
            else:
                sin_unit_card.append(variante)
            if "BaseCoolingRate" not in mech:
                sin_refrigeracion_base.append(archivo)
            base_de_datos.append(mech)
        except (OSError, ValueError) as error:
            errores.append(f"{archivo} ({error})")

    os.makedirs(os.path.dirname(ruta_destino) or ".", exist_ok=True)
    with open(ruta_destino, 'w', encoding='utf-8') as f_out:
        json.dump(base_de_datos, f_out, indent=2, ensure_ascii=False)

    if sin_build:
        print(f"\n⚠️ Variantes sin loadout de fábrica ({len(sin_build)}): {', '.join(sorted(sin_build))}")
    if sin_unit_card:
        print(f"\n⚠️ Variantes sin unit card ({len(sin_unit_card)}): {', '.join(sorted(sin_unit_card))}")
    if sin_nombre:
        print(f"\n⚠️ Variantes sin el nombre del chasis en la tabla de textos ({len(sin_nombre)}); se deduce de la clave. Exporta Mech_StringTable a CSV en {RUTA_TEXTOS}")
    if sin_modelo:
        print(f"\n⚠️ Variantes sin modelo (MDL/HPS), con el tamaño de los anclajes deducido del nombre ({len(sin_modelo)}): {', '.join(sorted(sin_modelo))}")
    if ajustes_fabrica:
        print(f"\nℹ️ Datos del taller ajustados a la build de fábrica ({len(ajustes_fabrica)}):")
        for ajuste in ajustes_fabrica:
            print(f"  - {ajuste}")
    if avisos_builds:
        print(f"\n⚠️ Piezas de las builds de fábrica que se quedan fuera, porque no están en el catálogo o no caben ({len(avisos_builds)}):")
        for aviso in avisos_builds:
            print(f"  - {aviso}")

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
