import json
import os
import re
import sys

DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "items")
RUTA_DESTINO_POR_DEFECTO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "items.json")
# Los computadores de puntería guardan sus efectos en un rasgo de 'Mech (EquipmentTrait), no en el objeto.
RUTA_RASGOS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "traits")

REGEX_CLASE = re.compile(r'Begin Object Class=/Script/MechWarrior\.([^\s]+)')
REGEX_NOMBRE = re.compile(r'(?:ShortName|Name)=NSLOCTEXT\([^,]+,\s*"[^"]+",\s*"([^"]+)"\)')
# El nombre corto que enseña el juego en el HUD («TAG», «AC/10»): los buscadores lo usan, porque mucha
# gente busca así el arma y su nombre completo no lo contiene (Target Acquisition Gear).
REGEX_NOMBRE_CORTO = re.compile(r'^\s*ShortName=NSLOCTEXT\([^,]+,\s*"[^"]+",\s*"([^"]+)"\)', re.MULTILINE)
REGEX_TONS = re.compile(r'(?:Tons|Tonnage)=([0-9.]+)')
REGEX_SLOTS = re.compile(r'Slots=([0-9]+)')
REGEX_TAG = re.compile(r'(?:WeaponType|EquipmentType|AmmoType)=\(TagName="([^"]+)"\)')
REGEX_SLOT_TYPE = re.compile(r'(?:WeaponSlotTypeAssetId|SupportedSlotTypesAssetId).*?Id="MWSlotTypeDataAsset:([^"]+)"')
REGEX_WEAPON_SIZE = re.compile(r'WeaponSize=([A-Za-z0-9_]+)')
REGEX_CAPACITY = re.compile(r'Capacity=([0-9.]+)')
REGEX_REFRIGERACION = re.compile(r'HeatSink=\([^)]*HealthyEfficiency=([0-9.]+)')
# Capacidad de calor que suma cada disipador (doble 2, simple 1).
REGEX_CAPACIDAD_CALOR = re.compile(r'HeatSink=\([^)]*HealthyCapacity=([0-9.]+)')
# Velocidad del proyectil en cm/s; los láseres no tienen.
REGEX_VELOCIDAD = re.compile(r'(?<![A-Za-z])Speed=([0-9.]+)')
# MASC y Supercharger: aumento de velocidad mientras se usan (0.5 = +50 %).
REGEX_IMPULSO = re.compile(r'MASCStats=\([^)]*BoostSpeed=([0-9.]+)')
REGEX_TIER = re.compile(r'_Lvl(\d+)$', re.IGNORECASE)
REGEX_COPIA = re.compile(r'\(\d+\)$')
REGEX_TIPO_MUNICION = re.compile(r'AmmoType=\(TagName="([^"]+)"\)')
REGEX_MISILES = re.compile(r'(?<![A-Za-z])NumberOfMissiles=([0-9]+)')
REGEX_PROYECTILES = re.compile(r'(?<![A-Za-z])NumberOfProjectiles=([0-9]+)')
REGEX_DISPAROS = re.compile(r'(?<![A-Za-z])NumberOfTimesToFire=([0-9]+)')
REGEX_CONSUME_POR_DISPARO = re.compile(r'bConsumeAmmoOnSubsequentFire=True')
CLASE_TIPO_DE_RANURA = "MWSlotTypeDataAsset"
REGEX_RANURAS_ADMITIDAS = re.compile(r'SupportedSlotTypesAssetId(?:\(\d+\))?=\(Id="MWSlotTypeDataAsset:([^"]+)"')
REGEX_TECH_BASE = re.compile(r'TechBase=\(TagName="TechBase\.(\w+)"')
REGEX_CLASE_CUERPO_A_CUERPO = re.compile(r'WeaponType=\(TagName="Weapon\.Melee\.(Light|Medium|Heavy|Assault)\.', re.IGNORECASE)

REGEX_DAMAGE = re.compile(r'(?:DamageOverDuration|(?<![a-zA-Z])Damage)=([0-9.]+)')
REGEX_HEAT = re.compile(r'(?:HeatGeneratedOverDuration|(?<![a-zA-Z])HeatGenerated)=([0-9.]+)')
REGEX_COOLDOWN = re.compile(r'(?<![a-zA-Z])Cooldown=([0-9.]+)')
REGEX_RANGE = re.compile(r'(?<![A-Za-z])(?:OptimalRange|MaxRange)=([0-9.]+)')
# Alcance máximo: el juego muestra este como "Max range" (PPC 920 frente a 460 de óptimo).
REGEX_MAX_RANGE = re.compile(r'(?<![A-Za-z])MaxRange=([0-9.]+)')
# Página de equipo: fabricante de cada tier, DLC y efectos de cada pieza. Los precios no se enseñan.
REGEX_FABRICANTE = re.compile(r'Manufacturer="([^"]+)"')
# Algunos objetos (la munición de los rifles) vienen en varios DLC: MultipleAssociatedDLC.
REGEX_DLC = re.compile(r'AssociatedDLC.*?DLC\.DLC(\d+)')
REGEX_FECHA_INTRODUCCION = re.compile(r'IntroDate=(\d{4})\.(\d{2})\.(\d{2})')
# El último día de la partida (el mapa estelar llega hasta aquí). Lo que se introduce después no llega a
# las tiendas ni lo lleva ningún 'Mech: el Heavy Gauss Rifle y su munición son del 1 de enero de 3061.
FIN_DEL_JUEGO = "3060-12-31"
REGEX_DESCRIPCION = re.compile(r'Description=NSLOCTEXT\([^,]+,\s*"[^"]+",\s*"((?:[^"\\]|\\.)*)"\)')
REGEX_MASC = re.compile(r'MASCStats=\(([^\n]*)\)')
REGEX_DANO_EXPLOSION = re.compile(r'(?<![A-Za-z])ExplosionDamagePerRound=([0-9.]+)')
REGEX_RASGO_EQUIPO = re.compile(r"EquipmentTrait=[^']*'\"[^\"]*\.([A-Za-z0-9_]+)\"'")
REGEX_QUIRK = re.compile(r"/Game/Quirks/([A-Za-z0-9_]+)\.[^\"]+\"',Value=([+-]?[0-9.]+)")



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


def buscar_texto(regex, contenido, por_defecto=None):
    coincidencia = regex.search(contenido)
    return coincidencia.group(1) if coincidencia else por_defecto


def buscar_numero(regex, contenido, por_defecto=None):
    coincidencia = regex.search(contenido)
    return float(coincidencia.group(1)) if coincidencia else por_defecto


def determinar_tipo_general(clase_ue4):
    clase_lower = clase_ue4.lower()
    if "weapon" in clase_lower or "ams" in clase_lower:
        return "weapon"
    if "ammo" in clase_lower:
        return "ammo"
    return "equipment"


def determinar_subtipo_arma(tag, tipo_ranura=""):
    # El Arrow IV va en anclajes de artillería, aunque su primera etiqueta sea la de su munición (Ammo.Missile).
    if tipo_ranura.lower().startswith("artillery"):
        return "artillery"
    tag_lower = tag.lower()
    if "ams" in tag_lower:
        return "ams"
    if "energy" in tag_lower or "laser" in tag_lower or "ppc" in tag_lower:
        return "energy"
    if "ballistic" in tag_lower or "autocannon" in tag_lower or "gauss" in tag_lower or "rifle" in tag_lower:
        return "ballistic"
    if "missile" in tag_lower or "lrm" in tag_lower or "srm" in tag_lower:
        return "missile"
    if "melee" in tag_lower:
        return "melee"
    return None


def determinar_tamano(tamano_arma, tipo_ranura, tipo_general):
    if tipo_general == "ammo":
        return "small"
    if tipo_general == "equipment":
        if "double" in tipo_ranura.lower() or "large" in tipo_ranura.lower():
            return "medium"
        return "small"
    if tamano_arma and tamano_arma.lower() in ("small", "medium", "large"):
        return tamano_arma.lower()
    # En UE4 el valor por defecto de WeaponSize (índice 0 del enum) es Small.
    return "small"


def determinar_slots(tipo_general, slots_archivo):
    # En MW5 Mercenaries las armas solo ocupan un anclaje; los slots son del equipo y la munición.
    if tipo_general == "weapon":
        return None
    return slots_archivo if slots_archivo is not None else 1


def agrupar_archivos_por_item(errores, copias):
    archivos_por_item = {}
    procesados = 0

    for archivo in sorted(os.listdir(RUTA_ORIGEN)):
        if not archivo.endswith((".copy", ".txt")):
            continue

        try:
            contenido = leer_archivo(os.path.join(RUTA_ORIGEN, archivo))
        except OSError as error:
            errores.append(f"{archivo} ({error})")
            continue

        clase = buscar_texto(REGEX_CLASE, contenido)
        if not clase:
            continue
        nombre_archivo = os.path.splitext(archivo)[0]
        if clase == CLASE_TIPO_DE_RANURA:
            continue
        if REGEX_COPIA.search(nombre_archivo):
            copias.append(archivo)
            continue
        tipo_general = determinar_tipo_general(clase)
        # Las armas de vehículos y torretas de la IA no se pueden montar en un 'Mech.
        if tipo_general == "weapon" and "bMechEquippable=True" not in contenido:
            continue
        # Un "equipo" sin tonelaje es un archivo de configuración (p. ej. NarcBeaconData), no un objeto.
        if tipo_general == "equipment" and not REGEX_TONS.search(contenido):
            continue
        fecha = REGEX_FECHA_INTRODUCCION.search(contenido)
        if fecha and "-".join(fecha.groups()) > FIN_DEL_JUEGO:
            continue

        coincidencia_tier = REGEX_TIER.search(nombre_archivo)
        # El archivo sin _LvlN es el tier 1 de fábrica.
        tier = coincidencia_tier.group(1) if coincidencia_tier else "1"
        id_base = REGEX_TIER.sub('', nombre_archivo)

        archivos_por_item.setdefault(id_base, {})[tier] = contenido
        procesados += 1

    return archivos_por_item, procesados


def obtener_estadisticas_base(contenido):
    rango = buscar_numero(REGEX_RANGE, contenido)
    rango_maximo = buscar_numero(REGEX_MAX_RANGE, contenido)
    return {
        "damage": buscar_numero(REGEX_DAMAGE, contenido, 0.0),
        "heatPerShot": buscar_numero(REGEX_HEAT, contenido, 0.0),
        "cooldown": buscar_numero(REGEX_COOLDOWN, contenido, 0.0),
        "range": round(rango / 100.0, 1) if rango is not None else 0.0,
        "maxRange": round((rango_maximo if rango_maximo is not None else rango or 0.0) / 100.0, 1),
        "speed": round(buscar_numero(REGEX_VELOCIDAD, contenido, 0.0) / 100.0, 1)
    }


def calcular_tier(contenido, base):
    quirks = {quirk: float(valor) for quirk, valor in REGEX_QUIRK.findall(contenido)}
    # Cada tier tiene su fabricante. El exportador escapa los apóstrofos («Dragon\\'s Fire»).
    fabricante = (buscar_texto(REGEX_FABRICANTE, contenido) or '').replace("\\'", "'")

    if quirks:
        # Los …Percentage_Quirk multiplican; Damage_Quirk y Cooldown_Quirk suman su valor tal cual, en
        # daño y en segundos. Lo dice el mechlab del juego: la Katana de asalto pasa de 55 a 67.5 de daño
        # y de 2.55 a 1.925 s con +12.5 y -0.625 en tier 5, y el Gauss Rifle de tier 2 hace 15.05 con
        # +0.05, aunque ese valor parezca un porcentaje (src/utils/gameReference.test.ts).
        q_dmg = quirks.get("DamagePercentage_Quirk", 0.0)
        q_heat = quirks.get("HeatGeneratedPercentage_Quirk", 0.0)
        q_cd = quirks.get("CooldownPercentage_Quirk", 0.0)
        q_rng = quirks.get("RangePercentage_Quirk", quirks.get("RangeAndSpeedPercentage_Quirk", 0.0))
        dano = round((base["damage"] + quirks.get("Damage_Quirk", 0.0)) * (1.0 + q_dmg), 2)
        calor = round(base["heatPerShot"] * (1.0 + q_heat), 3)
        enfriamiento = round((base["cooldown"] + quirks.get("Cooldown_Quirk", 0.0)) * (1.0 + q_cd), 3)
        rango = round(base["range"] * (1.0 + q_rng), 1)
        rango_maximo = round(base["maxRange"] * (1.0 + q_rng), 1)
        q_vel = quirks.get("SpeedPercentage_Quirk", quirks.get("RangeAndSpeedPercentage_Quirk", 0.0))
        velocidad = round(base["speed"] * (1.0 + q_vel), 1)
    else:
        # Sin quirks: tier 1 o armas con valores directos, como el AMS.
        propias = obtener_estadisticas_base(contenido)
        dano = round(propias["damage"], 2) if REGEX_DAMAGE.search(contenido) else base["damage"]
        calor = round(propias["heatPerShot"], 3) if REGEX_HEAT.search(contenido) else base["heatPerShot"]
        enfriamiento = round(propias["cooldown"], 3) if REGEX_COOLDOWN.search(contenido) else base["cooldown"]
        rango = propias["range"] if REGEX_RANGE.search(contenido) else base["range"]
        rango_maximo = propias["maxRange"] if REGEX_RANGE.search(contenido) else base["maxRange"]
        velocidad = propias["speed"] if REGEX_VELOCIDAD.search(contenido) else base["speed"]

    estadisticas = {
        "damage": dano,
        "heatPerShot": calor,
        "cooldown": enfriamiento,
        "range": rango,
        "maxRange": rango_maximo,
        "rpm": round(60.0 / enfriamiento, 1) if enfriamiento > 0 else 0.0
    }
    if velocidad > 0:
        estadisticas["speed"] = velocidad
    if fabricante:
        estadisticas["manufacturer"] = fabricante
    return estadisticas


def obtener_multiplicadores_salva(contenido):
    misiles = int(buscar_texto(REGEX_MISILES, contenido, 0))
    proyectiles = int(buscar_texto(REGEX_PROYECTILES, contenido, 0))
    disparos = int(buscar_texto(REGEX_DISPAROS, contenido, 0)) or 1
    # El daño es por proyectil (misil o perdigón); el calor es por misil y por disparo,
    # pero no por perdigón: un LB-X genera el calor de un disparo aunque lance varios.
    return (misiles or proyectiles or 1) * disparos, (misiles or 1) * disparos


def obtener_municion_por_salva(contenido):
    # Los misiles gastan uno cada uno; las ráfagas solo gastan en cada disparo si el arma lo indica,
    # y los perdigones de un LB-X no gastan munición propia.
    misiles = int(buscar_texto(REGEX_MISILES, contenido, 0))
    disparos = int(buscar_texto(REGEX_DISPAROS, contenido, 0)) or 1
    por_disparo = misiles or 1
    return por_disparo * disparos if REGEX_CONSUME_POR_DISPARO.search(contenido) else por_disparo


def leer_rasgo_computador(contenido):
    # Efectos del computador de puntería, en su rasgo: alcance de sensores, velocidad del proyectil de
    # balísticas y PPC y alcance de los láseres. La precisión y la letalidad (UnitCardTrait) son de la
    # resolución automática de misiones y no se guardan.
    rasgo_id = buscar_texto(REGEX_RASGO_EQUIPO, contenido)
    if not rasgo_id:
        return None
    try:
        rasgo = leer_archivo(os.path.join(RUTA_RASGOS, f"{rasgo_id}.copy"))
    except OSError:
        return None
    velocidad = re.search(r"ProjectileSpeedIncreaseQuirkInfo=\(.*?Value=([0-9.]+)", rasgo)
    alcance_laser = re.search(r"LaserRangeIncraseQuirkInfo=\(.*?Value=([0-9.]+)", rasgo)
    return {
        "sensorRange": buscar_numero(re.compile(r'MechSensorRangeIncrease=([0-9.]+)'), rasgo, 0.0),
        "projectileSpeed": float(velocidad.group(1)) if velocidad else 0.0,
        "laserRange": float(alcance_laser.group(1)) if alcance_laser else 0.0
    }


def leer_efectos_equipo(contenido):
    """Lo que hace cada pieza de equipo, en las unidades de la interfaz (metros, no centímetros)."""
    efectos = {}

    def numero(clave):
        return buscar_numero(re.compile(rf'(?<![A-Za-z]){clave}=([-0-9.]+)'), contenido)

    if "InitialVelocityZ=" in contenido:
        # Los cinco retrorreactores tienen el mismo empuje y combustible; cambia la clase de 'Mech que
        # los monta, que solo dice la descripción («Designed for 'Mechs weighing 60 - 75 tons»).
        tonelaje = re.search(r'weighing (\d+) - (\d+) tons', contenido)
        efectos["jumpJet"] = {
            "thrust": round(numero("InitialVelocityZ") / 100.0, 1),
            "burnTime": numero("BurnTime"),
            "regenTime": numero("RegenTime"),
            "mechTonnage": [int(tonelaje.group(1)), int(tonelaje.group(2))] if tonelaje else None
        }
    if "DisruptModeRange=" in contenido:
        efectos["ecm"] = {
            "disruptRange": round(numero("DisruptModeRange") / 100.0),
            "counterRange": round(numero("CounterModeRange") / 100.0),
            "shielding": numero("ShieldingSensorModifier"),
            "suppression": numero("SuppressionSensorModifier"),
            "lrmSpread": numero("LRMSpreadModifier"),
            "streakTracking": numero("StreakTrackingModifer"),
            "aiAccuracy": numero("AIAccuracyModifier")
        }
    elif "SensorRangeModifier=" in contenido:
        efectos["probe"] = {
            "range": round(numero("Range") / 100.0),
            "sensorRange": numero("SensorRangeModifier"),
            "distortionReduction": numero("DistortionReductionMultiplier")
        }
    masc = buscar_texto(REGEX_MASC, contenido)
    if masc:
        # BoostAccel multiplica la aceleración y BoostTurn suma al giro (los Supercharger de arena lo
        # restan); DamageParts son las piezas que se dañan al pasarse del indicador.
        campos = dict(re.findall(r'(\w+)=([-0-9.]+)', masc))
        partes = re.search(r'DamageParts=\(([^)]*)\)', masc)
        efectos["masc"] = {
            "accel": float(campos.get("BoostAccel", 0)),
            "turn": float(campos.get("BoostTurn", 0)),
            "damagedParts": partes.group(1).split(",") if partes else []
        }
    computador = leer_rasgo_computador(contenido)
    if computador:
        efectos["targetingComputer"] = computador
    return efectos


def construir_item(id_base, tiers):
    contenido = tiers["1"] if "1" in tiers else tiers[sorted(tiers)[0]]
    tipo_general = determinar_tipo_general(buscar_texto(REGEX_CLASE, contenido))
    nombre = buscar_texto(REGEX_NOMBRE, contenido, id_base).strip()
    tipo_ranura = buscar_texto(REGEX_SLOT_TYPE, contenido, "")
    slots_archivo = buscar_texto(REGEX_SLOTS, contenido)

    item = {
        "id": id_base,
        "name": nombre,
        "type": tipo_general,
        "weaponType": determinar_subtipo_arma(buscar_texto(REGEX_TAG, contenido, ""), tipo_ranura),
        "size": determinar_tamano(buscar_texto(REGEX_WEAPON_SIZE, contenido), tipo_ranura, tipo_general),
        "tonnage": buscar_numero(REGEX_TONS, contenido, 0.0)
    }
    nombre_corto = buscar_texto(REGEX_NOMBRE_CORTO, contenido, "").strip()
    if nombre_corto and nombre_corto.lower() != nombre.lower():
        item["shortName"] = nombre_corto
    slots = determinar_slots(tipo_general, int(slots_archivo) if slots_archivo else None)
    if slots is not None:
        item["slots"] = slots

    if tipo_general != "weapon":
        # Ranuras donde se puede montar, con las especiales primero (p. ej. motor antes que general).
        ranuras = REGEX_RANURAS_ADMITIDAS.findall(contenido)
        if ranuras:
            item["specialSlotTypes"] = sorted(ranuras, key=lambda ranura: ranura == "General_SlotType")

    refrigeracion = buscar_numero(REGEX_REFRIGERACION, contenido)
    if refrigeracion is not None:
        item["cooling"] = refrigeracion
    capacidad_calor = buscar_numero(REGEX_CAPACIDAD_CALOR, contenido)
    if capacidad_calor is not None:
        item["heatCapacity"] = capacidad_calor
    impulso = buscar_numero(REGEX_IMPULSO, contenido)
    if impulso is not None:
        item["speedBoost"] = impulso
    item["tiers"] = {} if tipo_general == "weapon" else None

    if "jumpjet" in id_base.lower() or "jump jet" in nombre.lower():
        item["equipmentType"] = "jumpJet"

    if tipo_general == "ammo":
        capacidad = buscar_numero(REGEX_CAPACITY, contenido)
        if capacidad is not None:
            item["capacity"] = int(capacidad)
    elif tipo_general == "weapon":
        base = obtener_estadisticas_base(contenido)
        for tier in sorted(tiers, key=int):
            item["tiers"][tier] = calcular_tier(tiers[tier], base)
        item["volleyProjectiles"], item["volleyHeatShots"] = obtener_multiplicadores_salva(contenido)
        clase_de_peso = buscar_texto(REGEX_CLASE_CUERPO_A_CUERPO, contenido)
        if clase_de_peso:
            item["weightClass"] = clase_de_peso.lower()

    tech_base = buscar_texto(REGEX_TECH_BASE, contenido)
    if tech_base:
        item["techBase"] = tech_base

    dlc = REGEX_DLC.search(contenido)
    if dlc:
        # Con varios DLC (la munición de los rifles: DLC1 y DLC6) vale el primero, el que trajo el objeto.
        item["dlc"] = int(dlc.group(1))
    if tipo_general == "equipment":
        descripcion = buscar_texto(REGEX_DESCRIPCION, contenido)
        if descripcion:
            item["description"] = re.sub(r'\s+', ' ', descripcion.replace("\\'", "'")).strip()
        item.update(leer_efectos_equipo(contenido))
    if tipo_general == "ammo":
        dano_explosion = buscar_numero(REGEX_DANO_EXPLOSION, contenido)
        if dano_explosion is not None:
            item["explosionDamagePerRound"] = dano_explosion

    tipo_municion = buscar_texto(REGEX_TIPO_MUNICION, contenido)
    if tipo_municion and tipo_general in ("weapon", "ammo"):
        item["ammoType"] = tipo_municion
        if tipo_general == "weapon":
            item["ammoPerVolley"] = obtener_municion_por_salva(contenido)

    return item


def main():
    ruta_destino = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(RUTA_DESTINO_POR_DEFECTO)

    if not os.path.exists(RUTA_ORIGEN):
        print(f"❌ La ruta origen no existe: {RUTA_ORIGEN}")
        sys.exit(1)

    errores = []
    copias = []
    archivos_por_item, procesados = agrupar_archivos_por_item(errores, copias)
    catalogo = {id_base: construir_item(id_base, tiers) for id_base, tiers in archivos_por_item.items()}

    armas = [item for item in catalogo.values() if item["type"] == "weapon"]
    # La munición toma el tipo del arma que la usa, para que la de artillería no figure como de misiles.
    tipo_por_municion = {arma["ammoType"]: arma["weaponType"] for arma in armas if arma.get("ammoType")}
    for item in catalogo.values():
        if item["type"] == "ammo" and tipo_por_municion.get(item.get("ammoType")) == "artillery":
            item["weaponType"] = "artillery"
    municiones = {item["ammoType"] for item in catalogo.values() if item["type"] == "ammo" and "ammoType" in item}
    sin_municion = sorted({item["ammoType"] for item in armas if "ammoType" in item and item["ammoType"] not in municiones})

    os.makedirs(os.path.dirname(ruta_destino) or ".", exist_ok=True)
    with open(ruta_destino, 'w', encoding='utf-8') as f_out:
        json.dump(catalogo, f_out, indent=2, ensure_ascii=False)

    print(f"\n✅ Catálogo generado en {ruta_destino}")
    print(f"📊 Se procesaron {procesados} archivos en {len(catalogo)} objetos únicos.")
    if copias:
        print(f"\n⚠️ Se ignoraron {len(copias)} archivos duplicados: {', '.join(copias)}")
    if sin_municion:
        print(f"\n⚠️ {len(sin_municion)} tipos de munición usados por armas sin archivo de munición:")
        for tipo in sin_municion:
            print(f"  - {tipo}")
    if errores:
        print(f"\n⚠️ Quedaron {len(errores)} archivos con error:")
        for error in errores[:10]:
            print(f"  - {error}")


if __name__ == "__main__":
    main()
