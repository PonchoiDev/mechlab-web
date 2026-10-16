import os
import re
import json
import sys

directorio_script = os.path.dirname(os.path.abspath(__file__))
ruta_origen = os.path.join(directorio_script, "mda")
ruta_destino = sys.argv[1] if len(sys.argv) > 1 else os.path.join(directorio_script, "mechs.json")

regex_variante = re.compile(r'VariantName\s*=\s*INVTEXT\("([^"]+)"\)', re.IGNORECASE)
regex_keyname = re.compile(r'KeyName\s*=\s*"([^"]+)"', re.IGNORECASE)
regex_tagname = re.compile(r'TagName\s*=\s*"Mech\.[^.]+\.[^.]+\.([^"]+)"', re.IGNORECASE)
regex_chasis = re.compile(r'ChassisFullName\s*=\s*INVTEXT\("([^"]+)"\)', re.IGNORECASE)
regex_mech_type_name = re.compile(r'MechType=\(TagName="Mech\.[^.]+\.([^.\"]+)', re.IGNORECASE)
regex_tech_base = re.compile(r'TechBase=\(TagName="TechBase\.([^.\"]+)', re.IGNORECASE)

regex_tons = re.compile(r'Tons\s*=\s*([0-9.]+)', re.IGNORECASE)
regex_base_tons = re.compile(r'BaseTons\s*=\s*([0-9.]+)', re.IGNORECASE)
regex_speed = re.compile(r'TopSpeed\s*=\s*([0-9.]+)', re.IGNORECASE)
regex_base_cooling_rate = re.compile(r'BaseCoolingRate\s*=\s*([0-9.]+)', re.IGNORECASE)

regex_max_armor = re.compile(r'MaxArmor=\((.*?)\)', re.DOTALL)
regex_max_struct = re.compile(r'MaxStructure=\((.*?)\)', re.DOTALL)
regex_hardpoints = re.compile(r'SelectedWeaponHardPoints=\((.*?)\)', re.DOTALL)

mapa_componentes = {
    "Head": "head", "CenterTorso": "centerTorso", "LeftTorso": "leftTorso",
    "RightTorso": "rightTorso", "LeftArm": "leftArm", "RightArm": "rightArm",
    "LeftLeg": "leftLeg", "RightLeg": "rightLeg"
}
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

def obtener_parte_cuerpo(hp_str):
    hp_lower = hp_str.lower()
    if "head" in hp_lower: return "head"
    if "center" in hp_lower or "centertorso" in hp_lower: return "centerTorso"
    if "left" in hp_lower:
        if "arm" in hp_lower or "forearm" in hp_lower: return "leftArm"
        if "leg" in hp_lower: return "leftLeg"
        if "torso" in hp_lower or "clavicle" in hp_lower: return "leftTorso"
    if "right" in hp_lower:
        if "arm" in hp_lower or "forearm" in hp_lower: return "rightArm"
        if "leg" in hp_lower: return "rightLeg"
        if "torso" in hp_lower or "clavicle" in hp_lower: return "rightTorso"
    return None

def obtener_tipo_arma(hp_str):
    hp_upper = hp_str.upper()
    if "_EH" in hp_upper: return "energy"
    if "_BH" in hp_upper: return "ballistic"
    if "_MH" in hp_upper: return "missile"
    if "_AH" in hp_upper: return "ams"
    if "MELEE" in hp_upper: return "melee"
    return None

def obtener_tamano_arma(hp_str):
    hp_lower = hp_str.lower()

    for token, size in (("large", "large"), ("medium", "medium"), ("small", "small")):
        if token in hp_lower:
            return size

    hp_upper = hp_str.upper()
    if "AMS" in hp_upper or "ANTIMISSILE" in hp_upper or "_AH" in hp_upper:
        return "small"
    if "machinegun" in hp_lower:
        return "small"
    if "gaussrifle" in hp_lower or "ppc" in hp_lower or "erppc" in hp_lower:
        return "large"
    if "largepulselaser" in hp_lower or "largelaser" in hp_lower or "erlargelaser" in hp_lower:
        return "large"
    if "mediumlaser" in hp_lower or "mediumpulselaser" in hp_lower:
        return "medium"
    if "smallpulselaser" in hp_lower or "smalllaser" in hp_lower:
        return "small"

    if "lrm" in hp_lower or "mrm" in hp_lower:
        return "large"
    if "srm" in hp_lower:
        return "medium"

    match_ac = re.search(r'(?:ac|autocannon)(\d+)', hp_lower)
    if match_ac:
        calibre = int(match_ac.group(1))
        if calibre >= 20:
            return "large"
        if calibre >= 10:
            return "medium"
        if calibre >= 5:
            return "medium"
        return "small"

    return "medium"

archivos_no_jugables = {
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

base_de_datos = []
procesados = 0
errores = []
sin_refrigeracion_base = []
variantes_vistas = {}
duplicados = []

if not os.path.exists(ruta_origen):
    print(f"❌ La ruta origen no existe: {ruta_origen}")
    sys.exit(1)

for archivo in sorted(os.listdir(ruta_origen)):
    if not (archivo.endswith(".copy") or archivo.endswith(".txt")):
        continue
    if archivo in archivos_no_jugables:
        continue

    ruta_archivo = os.path.join(ruta_origen, archivo)

    try:
        with open(ruta_archivo, 'rb') as f:
            raw_bytes = f.read()
        
        if raw_bytes.startswith(b'\xff\xfe') or raw_bytes.startswith(b'\xfe\xff'):
            contenido = raw_bytes.decode('utf-16', errors='ignore')
        else:
            contenido = raw_bytes.decode('utf-8', errors='ignore')
            if '\x00' in contenido and len(contenido) > 10:
                contenido = raw_bytes.decode('utf-16-le', errors='ignore')

        contenido_limpio = contenido.replace('\xa0', ' ').replace('\r', '').replace('\x00', '')

        variante = None
        match_var = regex_variante.search(contenido_limpio)
        if match_var: variante = match_var.group(1).strip()
        else:
            match_key = regex_keyname.search(contenido_limpio)
            if match_key: variante = match_key.group(1).strip()
            else:
                match_tag = regex_tagname.search(contenido_limpio)
                if match_tag: variante = match_tag.group(1).strip()

        if not variante:
            errores.append(f"{archivo} (No se pudo identificar el ID/Variante)")
            continue

        if variante in variantes_vistas:
            duplicados.append(f"{archivo} (repite {variante} de {variantes_vistas[variante]})")
            continue
        variantes_vistas[variante] = archivo

        match_chasis = regex_chasis.search(contenido_limpio)
        chasis = match_chasis.group(1).strip() if match_chasis else variante.split('-')[0]
        match_tech_base = regex_tech_base.search(contenido_limpio)
        tech_base = match_tech_base.group(1).strip() if match_tech_base else None
        match_sarna_name = regex_mech_type_name.search(contenido_limpio)
        clan_type_name = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', ' ', match_sarna_name.group(1)).strip() if match_sarna_name else chasis
        sarna_name = clan_type_name if tech_base and tech_base.lower() == 'clan' else quitar_sufijo_variante(chasis, variante)

        match_tons = regex_tons.search(contenido_limpio)
        tonelaje = float(match_tons.group(1)) if match_tons else 0.0

        match_base_tons = regex_base_tons.search(contenido_limpio)
        tonelaje_base = float(match_base_tons.group(1)) if match_base_tons else 0.0

        match_base_cooling_rate = regex_base_cooling_rate.search(contenido_limpio)
        refrigeracion_base = float(match_base_cooling_rate.group(1)) if match_base_cooling_rate else None
        if refrigeracion_base is None:
            sin_refrigeracion_base.append(archivo)

        match_speed = regex_speed.search(contenido_limpio)
        velocidad_raw = float(match_speed.group(1)) if match_speed else 0.0
        velocidad_kph = round((velocidad_raw / 3150.0) * 97.2, 1) if velocidad_raw > 0 else 0.0

        ranuras_gen = {}
        ranuras_jj = {}
        ranuras_eh = {}
        ranuras_especiales = {}
        
        bloques_slots = re.findall(r'MWSlotTypeDataAsset:([^"]+)"\).*?SlotCounts=\(\((.*?)\)\)', contenido_limpio)
        for tipo_asset, raw_counts in bloques_slots:
            pares = re.findall(r'([A-Za-z]+),\s*(\d+)', raw_counts)
            for comp, cant in pares:
                comp_clean = comp.strip()
                if comp_clean in mapa_componentes:
                    if 'General_SlotType' in tipo_asset:
                        ranuras_gen[mapa_componentes[comp_clean]] = int(cant)
                    else:
                        slots_por_componente = ranuras_especiales.setdefault(tipo_asset, {})
                        slots_por_componente[mapa_componentes[comp_clean]] = int(cant)

        armadura_dict = {}
        match_armor = regex_max_armor.search(contenido_limpio)
        if match_armor:
            pares = re.findall(r'([A-Za-z]+)=([0-9.]+)', match_armor.group(1))
            for comp, cant in pares:
                if comp in mapa_componentes:
                    armadura_dict[mapa_componentes[comp]] = float(cant)

        estructura_dict = {}
        match_struct = regex_max_struct.search(contenido_limpio)
        if match_struct:
            pares = re.findall(r'([A-Za-z]+)=([0-9.]+)', match_struct.group(1))
            for comp, cant in pares:
                if comp in mapa_componentes:
                    estructura_dict[mapa_componentes[comp]] = float(cant)

        hardpoints_dict = {key: [] for key in mapa_componentes.values()}
        match_hp = regex_hardpoints.search(contenido_limpio)
        if match_hp:
            hps = re.findall(r'"([^"]+)"', match_hp.group(1))
            for hp in hps:
                parte = obtener_parte_cuerpo(hp)
                tipo = obtener_tipo_arma(hp)
                tamano = obtener_tamano_arma(hp)
                if parte and tipo:
                    hardpoints_dict[parte].append({"type": tipo, "size": tamano})

        componentes_finales = {}
        for comp_unreal, comp_key in mapa_componentes.items():
            has_rear = comp_key in ["centerTorso", "leftTorso", "rightTorso"]
            slots_especiales_parte = {
                tipo: cantidades.get(comp_key, 0)
                for tipo, cantidades in ranuras_especiales.items()
                if cantidades.get(comp_key, 0) > 0
            }
            ranuras_jj[comp_key] = sum(
                cantidad for tipo, cantidad in slots_especiales_parte.items()
                if tipo.startswith("JumpJetClass")
            )
            ranuras_eh[comp_key] = slots_especiales_parte.get("EngineHeatsink_SlotType", 0)
            componentes_finales[comp_key] = {
                "maxSlots": ranuras_gen.get(comp_key, 0),
                "jumpJetSlots": ranuras_jj.get(comp_key, 0),
                "engineHeatsinkSlots": ranuras_eh.get(comp_key, 0),
                "specialSlots": slots_especiales_parte,
                "maxArmor": armadura_dict.get(comp_key, 0.0),
                "structure": estructura_dict.get(comp_key, 0.0),
                "hasRearArmor": has_rear,
                "hardpoints": hardpoints_dict[comp_key]
            }

        mech_data = {
            "id": variante,
            "name": chasis,
            "variant": variante,
            "tonnageMax": tonelaje,
            "baseTonnage": tonelaje_base,
            "baseSpeed": velocidad_kph,
            "components": componentes_finales
        }
        if refrigeracion_base is not None:
            mech_data["BaseCoolingRate"] = refrigeracion_base
        mech_data["sarnaName"] = sarna_name
        if tech_base is not None:
            mech_data["techBase"] = tech_base
        base_de_datos.append(mech_data)

        procesados += 1

    except Exception as e:
        errores.append(f"{archivo} ({str(e)})")

os.makedirs(os.path.dirname(ruta_destino) or ".", exist_ok=True)
with open(ruta_destino, 'w', encoding='utf-8') as f_out:
    json.dump(base_de_datos, f_out, indent=2, ensure_ascii=False)

print(f"\n✅ ¡Proceso completado! Se actualizaron {procesados} mechs en {ruta_destino}")
if duplicados:
    print(f"\n⚠️ Se descartaron {len(duplicados)} variantes repetidas:")
    for duplicado in duplicados:
        print(f"  - {duplicado}")
if sin_refrigeracion_base:
    print(f"\n⚠️ No se encontró BaseCoolingRate en {len(sin_refrigeracion_base)} archivos.")
if errores:
    print(f"\n⚠️ Quedaron {len(errores)} archivos con error:")
    for err in errores[:10]:
        print(f"  - {err}")