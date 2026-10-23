import base64
import json
import os
import re
import sys

DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "mda")
RUTA_LOADOUTS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "loadout")
RUTA_UNIT_CARDS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "unitcard")
RUTA_ITEMS_JSON = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "items.json")
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


def ajustar_a_build_de_fabrica(mech, contenido_mda, contenido_loadout, catalogo, ajustes):
    # El juego no guarda el tamaño de los anclajes en el MDA (se deduce del nombre). La build de
    # fábrica muestra lo que el juego monta, así que cada anclaje es al menos del tamaño de su arma de serie.
    indices = obtener_indices_anclajes(contenido_mda)
    for anclaje, arma_id in REGEX_ARMA_INSTALADA.findall(contenido_loadout):
        item, _ = buscar_item(catalogo, arma_id)
        posicion = indices.get(anclaje.lower()) or indices.get(clave_anclaje(anclaje))
        if not item or not posicion or item.get("size") not in ORDEN_TAMANOS:
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

            mech = parsear_mech(contenido, variante)
            # Algunas variantes nuevas heredan el DefaultMech de su padre aunque tengan su propio loadout.
            propio = f"{variante.lower()}_loadout"
            loadout = propio if propio in loadouts else (buscar_texto(REGEX_DEFAULT_MECH, contenido) or "").lower()
            if loadout in loadouts:
                contenido_loadout = leer_archivo(loadouts[loadout])
                ajustar_a_build_de_fabrica(mech, contenido, contenido_loadout, catalogo, ajustes_fabrica)
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
    if ajustes_fabrica:
        print(f"\nℹ️ Datos del taller ajustados a la build de fábrica ({len(ajustes_fabrica)}):")
        for ajuste in ajustes_fabrica:
            print(f"  - {ajuste}")
    if avisos_builds:
        print(f"\n⚠️ Piezas de las builds de fábrica que se quedan fuera, porque no están en el catálogo o no caben ({len(avisos_builds)}):")
        for aviso in avisos_builds:
            print(f"  - {aviso}")

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
