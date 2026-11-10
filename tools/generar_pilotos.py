import json
import os
import re
import sys
from collections import Counter

# Genera src/data/pilots.json para la página de pilotos: los rasgos de piloto
# (tools/datos-juego/pilotos/rasgos.json, de extraer_pilotos.py) con sus efectos en texto, y los
# programas de las academias con las academias que los ofrecen (tools/datos-juego/starmap/, de
# extraer_mapa.py).
#
#   python3 tools/generar_pilotos.py
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_RASGOS = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "pilotos", "rasgos.json")
RUTA_MAPA = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "starmap")
RUTA_DESTINO_POR_DEFECTO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "pilots.json")

# Cada propiedad de un componente: el texto del efecto, cómo se lee el número y si es bueno que
# suba. "pct" es una fracción (0.1 = +10 %); "mult" un multiplicador (1.1 = +10 %); "menos" una
# reducción que el juego guarda en positivo (Heat Reduction 0.05 = -5 % de calor).
EFECTOS = {
    "Top Speed Percent": ("Top speed", "pct", True),
    "Reverse Top Speed Percent": ("Reverse speed", "pct", True),
    "TorsoTwistSpeedPercent": ("Torso twist speed", "pct", True),
    "TurnSpeedPercent": ("Turn speed", "pct", True),
    "AccelerationPercent": ("Acceleration", "pct", True),
    "DecelerationPercent": ("Deceleration", "pct", True),
    "Increased Armor Percent": ("Armor", "pct", True),
    "Increased Structure Percent": ("Structure", "pct", True),
    "SensorRangeMultiplier": ("Sensor range", "mult", True),
    "Increased Sensor Range Percent": ("Sensor range", "pct", True),
    "MechSensorRangeIncrease": ("Sensor range", "pct", True),
    "DistortionReductionMultiplier": ("ECM distortion", "mult", False),
    "NonLosBonus_Meters": ("Lock-on range without line of sight", "m", True),
    "Reduced Lock On Time Percent": ("Lock-on time", "menos", False),
    "JumpJetZ Percent Boost": ("Jump jet vertical thrust", "pct", True),
    "JumpJetXY Percent Boost": ("Jump jet horizontal thrust", "pct", True),
    "Fuel Burn Time Trait Percent": ("Jump jet burn time", "pct", True),
    "Jump Jet Heat Reduction Percent": ("Jump jet heat", "menos", False),
    "Heat Reduction Percent": ("Heat generation", "menos", False),
    "GlobalDamagePercentBoost": ("Damage", "pct", True),
    "ClanOppositionDamagePercentBoost": ("Damage against the Clans", "pct", True),
    "AccuracyBonusPercent": ("Accuracy", "pct", True),
    "AccuracyBonusPercentage": ("Accuracy", "pct", True),
    "LethalityBonusPercent": ("Lethality", "pct", True),
    "LethalityBonusPercentage": ("Lethality", "pct", True),
    "HiringCostAdjustmentPercent": ("Hiring cost", "pct", False),
    "SalaryAdjustmentPercent": ("Salary", "pct", False),
    "SalaryAdjustmentFlat": ("Salary", "cbills", False),
    "NegotiationCBillPayoutAdjustmentPercent": ("Contract C-Bill payout", "pct", True),
    "TrainingTimeAdjustmentPercent": ("Academy training time", "pct", False),
    "TrainingEnrollmentFreeAdjustmentPercent": ("Academy enrollment fee", "pct", False),
    "TrainingTuitionAdjustmentPercent": ("Academy tuition", "pct", False),
    "SalvageAdjustmentFlat": ("Salvage shares", "num", True),
    "InjuryRecoveryAdjustmentPercent": ("Injury recovery time", "pct", False),
    "AcademyXPAdjustmentPercent": ("Academy XP", "pct", True),
    "MissionXPAdjustmentPercent": ("Mission XP", "pct", True),
    "DeathChanceIncreasePercentage": ("Death chance", "pct", False),
    "InjuryChanceIncreasePercentage": ("Injury chance", "pct", False),
    "NobleNegotiatedCBillAdjustmentPercent": ("Contract C-Bills", "pct", True),
    "PatriotNegotiatedCBillAdjustmentPercent": ("Contract C-Bills", "pct", True),
    "CriminalNegotiatedCBillAdjustmentPercent": ("Contract C-Bills", "pct", True),
    "MarketPriceAdjustmentPercent": ("Market prices", "pct", False),
    "BlackMarketPriceAdjustmentPercent": ("Black market prices", "pct", False),
    "FactionSalvageAdjustment": ("Salvage shares", "num", True),
}
# Lo que cuesta o rinde el piloto fuera del combate: va aparte de los efectos en la batalla.
EFECTOS_DE_PILOTO = {
    "HiringCostAdjustmentPercent", "SalaryAdjustmentPercent", "SalaryAdjustmentFlat", "NegotiationCBillPayoutAdjustmentPercent",
    "TrainingTimeAdjustmentPercent", "TrainingEnrollmentFreeAdjustmentPercent", "TrainingTuitionAdjustmentPercent",
    "SalvageAdjustmentFlat", "InjuryRecoveryAdjustmentPercent", "AcademyXPAdjustmentPercent", "MissionXPAdjustmentPercent",
    "DeathChanceIncreasePercentage", "InjuryChanceIncreasePercentage",
}
# Quirks de arma (/Game/Quirks): texto y si es bueno que suba. IdealJamRatio no es un porcentaje.
QUIRKS = {
    "DamagePercentage_Quirk": ("damage", "pct", True),
    "RangePercentage_Quirk": ("range", "pct", True),
    "SpeedPercentage_Quirk": ("projectile speed", "pct", True),
    "RangeAndSpeedPercentage_Quirk": ("range and projectile speed", "pct", True),
    "CooldownPercentage_Quirk": ("cooldown", "pct", False),
    "MinimumCooldownPercentage_Quirk": ("minimum cooldown", "pct", False),
    "SpreadRadiusPercentage_Quirk": ("spread", "pct", False),
    "DurationPercentage_Quirk": ("beam duration", "pct", False),
    "MinRangePercentage_Quirk": ("minimum range", "pct", False),
    "HeatGeneratedPercentage_Quirk": ("heat", "pct", False),
    "HeatDamagePercentage_Quirk": ("heat damage", "pct", True),
    "MaxJamChance_Quirk": ("jam chance", "pct", False),
    "IdealJamRatio_Quirk": ("shots before jamming", "num", True),
}
# Etiquetas de arma de los mapas de quirks (WeaponQuirks), con el nombre que usa el juego en los textos.
ARMAS = {
    "Weapon.ArtemisMissile": "Artemis missiles", "Weapon.ArtemisMissile.LRM": "Artemis LRMs",
    "Weapon.ArtemisMissile.SRM": "Artemis SRMs", "Weapon.Ballistic.AutoCannon": "Autocannons",
    "Weapon.Ballistic.AutoCannon.Ultra": "Ultra autocannons", "Weapon.Ballistic.GaussRifle": "Gauss rifles",
    "Weapon.Ballistic.Rifle": "Rifles", "Weapon.Energy.Laser": "Lasers", "Weapon.Energy.Laser.Binary": "Binary lasers",
    "Weapon.Energy.Laser.Chemical": "Chemical lasers", "Weapon.Energy.Laser.ER": "ER lasers",
    "Weapon.Energy.Laser.Pulse": "Pulse lasers", "Weapon.Energy.Laser.Standard.Large": "Large lasers",
    "Weapon.Energy.ParticleCannon": "PPCs", "Weapon.Energy.ParticleCannon.PPC-X": "PPC-X", "Weapon.Melee": "Melee",
    "Weapon.Missile": "Missiles", "Weapon.Missile.LRM": "LRMs", "Weapon.Missile.SRM": "SRMs",
}
PARTES = {"Head": "head", "CenterTorso": "center torso", "LeftTorso": "left torso", "RightTorso": "right torso",
          "LeftArm": "left arm", "RightArm": "right arm", "LeftLeg": "left leg", "RightLeg": "right leg"}
TODAS_LAS_PARTES = set(PARTES)
# Categorías de la página, por las etiquetas del rasgo o por sus componentes.
COMPONENTES_DE_ARMA = {"WeaponQuirkSetTrait", "Weapon_TraitBP", "ComplexWeaponTrait", "TargetingComputerTrait_BP"}
REGEX_HUECO = re.compile(r"\{(\w+)\}")


def numero(valor):
    texto = f"{valor:.1f}".rstrip("0").rstrip(".")
    return texto if texto not in ("-0", "") else "0"


def formato(valor, tipo):
    """El número de un efecto con su signo, y el cambio en proporción para saber si sube o baja."""
    if tipo == "mult":
        valor, tipo = valor - 1, "pct"
    if tipo == "menos":
        valor, tipo = -valor, "pct"
    if tipo == "pct":
        return f"{'+' if valor > 0 else ''}{numero(valor * 100)}%", valor
    if tipo == "m":
        return f"{'+' if valor > 0 else ''}{numero(valor)} m", valor
    if tipo == "cbills":
        return f"{'+' if valor > 0 else ''}{valor:,.0f} C-Bills", valor
    return f"{'+' if valor > 0 else ''}{numero(valor)}", valor


def efecto(etiqueta, valor, tipo, sube_es_bueno, detalle=None):
    texto, cambio = formato(valor, tipo)
    return {"label": etiqueta + (f" ({detalle})" if detalle else ""), "value": texto, "good": (cambio > 0) == sube_es_bueno}


def partes(lista):
    nombres = [parte.split("::")[-1] for parte in lista or []]
    if set(nombres) == TODAS_LAS_PARTES:
        return None
    return ", ".join(PARTES.get(nombre, nombre) for nombre in nombres)


def quirks(lista):
    return [efecto(QUIRKS[nombre][0].capitalize(), valor, QUIRKS[nombre][1], QUIRKS[nombre][2]) for nombre, valor in lista if nombre in QUIRKS]


def nombre_de_faccion(ids, facciones):
    # La facción y su sucesora (Davion y Federated Commonwealth): basta con la primera para el nombre.
    return facciones.get(ids[0], {}).get("Name", ids[0]) if ids else None


def efectos_de_rasgo(rasgo, facciones):
    """Los efectos de un rasgo en grupos: dónde se aplican y qué cambian."""
    componentes = rasgo["componentes"]
    afinidad = next((c for c in componentes if c["clase"] == "MechAffinityTrait" and c.get("MechTypeText")), None)
    odio = next((c for c in componentes if c.get("HatedFactions")), None)
    # Los efectos de combate de una afinidad (blindaje, sensores, calor…) solo valen con esos 'Mechs;
    # los del odio a una facción, contra ella.
    if afinidad:
        combate = f"While piloting {afinidad['MechTypeText']} 'Mechs"
    elif odio:
        combate = f"Against {nombre_de_faccion(odio['HatedFactions'], facciones)}"
    else:
        combate = "In combat"
    grupos = {}

    def anadir(grupo, nota, lista):
        if lista:
            entrada = grupos.setdefault(grupo, {"scope": grupo, "effects": []})
            if nota:
                entrada["note"] = nota
            entrada["effects"].extend(lista)

    for componente in componentes:
        clase = componente["clase"]
        if clase in ("WeaponQuirkSetTrait", "Weapon_TraitBP"):
            arma = componente.get("WeaponType") or componente.get("WeaponTypeText")
            lista = quirks(componente.get("Quirks", [])) + (quirks([componente["QuirkInfo"]]) if componente.get("QuirkInfo") else [])
            nota = componente.get("MiscInfo") if componente.get("MiscInfo", "").startswith("(") else None
            anadir(f"With {arma}" if arma else combate, nota, lista)
        elif clase == "TargetingComputerTrait_BP":
            anadir("With standard autocannons, solid slug LB-X, Gauss rifles, rifles and PPCs", None,
                   quirks([componente["ProjectileSpeedIncreaseQuirkInfo"]]))
            anadir("With lasers", None, quirks([componente["LaserRangeIncraseQuirkInfo"]]))
        if componente.get("WeaponQuirks"):
            for etiqueta, lista in componente["WeaponQuirks"]:
                anadir(f"With {ARMAS.get(etiqueta, etiqueta.rsplit('.', 1)[-1])}", None, quirks(lista))
        faccion = componente.get("FactionsNobleWith") or componente.get("FactionsPatriotWith") or componente.get("FactionsCriminalWith")
        for clave, valor in componente.items():
            if clave not in EFECTOS or not isinstance(valor, (int, float)) or valor == 0:
                continue
            etiqueta, tipo, sube = EFECTOS[clave]
            detalle = partes(componente.get("ApplicableMechParts")) if clave.startswith("Increased ") and "Percent" in clave and componente.get("ApplicableMechParts") else None
            if clave in EFECTOS_DE_PILOTO:
                grupo = "Pilot"
            elif faccion:
                nombre = nombre_de_faccion(faccion, facciones)
                grupo = f"In {nombre} space" if "Market" in clave else f"On contracts for {nombre}"
            else:
                grupo = combate
            anadir(grupo, None, [efecto(etiqueta, valor, tipo, sube, detalle)])
    # El grupo del piloto va al final: lo que se ve antes es lo que hace en combate.
    return sorted(grupos.values(), key=lambda grupo: grupo["scope"] == "Pilot")


def categoria(rasgo):
    atributos = rasgo["atributos"]
    clases = {componente["clase"] for componente in rasgo["componentes"]}
    if any(a.startswith("PilotTrait.Type.Graduate") for a in atributos):
        return "graduate"
    if any(a.startswith("PilotTrait.Type.MechAffinity") for a in atributos) or any(
            c["clase"] == "MechAffinityTrait" and c.get("MechTypeText") for c in rasgo["componentes"]):
        return "mech"
    if any(a.startswith("PilotTrait.Type.WeaponExpert") for a in atributos) or clases & COMPONENTES_DE_ARMA:
        return "weapon"
    if "PilotTrait.Type.Faction" in atributos or "FactionOriginTrait" in clases:
        return "faction"
    return "career"


def rellenar(texto, valores):
    """Sustituye los huecos de un texto del juego; los que no se conocen quedan como None."""
    if texto is None:
        return None
    resultado = REGEX_HUECO.sub(lambda m: valores.get(m.group(1), m.group(0)), texto)
    return None if REGEX_HUECO.search(resultado) else re.sub(r"\s+", " ", resultado).strip()


def valores_de_textos(rasgo, grupos, facciones):
    componentes = rasgo["componentes"]
    valores = {}
    for componente in componentes:
        if componente.get("MechTypeText") and "MechType" not in valores:
            valores["MechType"] = componente["MechTypeText"]
        if (componente.get("WeaponType") or componente.get("WeaponTypeText")) and "WeaponType" not in valores:
            valores["WeaponType"] = componente.get("WeaponType") or componente.get("WeaponTypeText")
        if componente.get("FactionName"):
            valores["FactionName"] = componente["FactionName"]
        ids = (componente.get("FactionsNobleWith") or componente.get("FactionsPatriotWith")
               or componente.get("FactionsCriminalWith") or componente.get("HatedFactions"))
        if ids:
            valores["Faction"] = nombre_de_faccion(ids, facciones)
        for clave, hueco in (("InjuryRecoveryAdjustmentPercent", "InjuryRecoveryAdjPct"), ("SalaryAdjustmentPercent", "SalaryAdjPct"),
                             ("InjuryChanceIncreasePercentage", "InjuryChancePct"), ("DeathChanceIncreasePercentage", "DeathPct")):
            if isinstance(componente.get(clave), (int, float)):
                valores[hueco] = numero(abs(componente[clave]) * 100)
        if componente.get("NonLosBonus_Meters"):
            valores["NonLosQuirk"] = f"{numero(componente['NonLosBonus_Meters'])} m of lock-on range without line of sight."
    # {Abs0}: la primera cifra del rasgo, sin signo (Bulwark: «Increases armor by 5%»).
    primero = next((efecto for grupo in grupos for efecto in grupo["effects"]), None)
    if primero:
        valores["Abs0"] = primero["value"].lstrip("+-").rstrip("%")
    return valores


def rasgos(rasgos_juego, facciones):
    lista, avisos = [], []
    for rasgo in rasgos_juego:
        grupos = efectos_de_rasgo(rasgo, facciones)
        valores = valores_de_textos(rasgo, grupos, facciones)
        nombre = rellenar(rasgo["nombre"], valores)
        if nombre is None:
            avisos.append(f"{rasgo['id']}: nombre con huecos sin rellenar ({rasgo['nombre']})")
            continue
        descripcion = rellenar(rasgo["corta"], valores)
        atributos = rasgo["atributos"]
        dlc = next((int(a.removeprefix("DLC.DLC")) for a in atributos if a.startswith("DLC.DLC")), None)
        lista.append({
            "id": rasgo["id"].removesuffix("_PilotTrait"),
            "name": nombre,
            "description": descripcion,
            "category": categoria(rasgo),
            # Hero: solo lo tienen los pilotos hero que el juego ofrece como Elite Pilot.
            "hero": "PilotTrait.Hero" in atributos,
            # Generation: puede salir en los pilotos que se contratan; Training: se aprende en una academia.
            "hireable": "PilotTrait.Generation" in atributos,
            "trainable": "PilotTrait.Training" in atributos,
            "negative": "PilotTrait.Negative" in atributos,
            "unique": "PilotTrait.Unique" in atributos,
            "dlc": dlc,
            "available": rasgo["fecha"],
            "groups": grupos,
        })
        if not grupos:
            avisos.append(f"{rasgo['id']}: sin efectos")
    return sorted(lista, key=lambda rasgo: (rasgo["name"], rasgo["id"])), avisos


def programas(programas_juego, academias_juego, sistemas):
    """Los programas de entrenamiento con las academias que los ofrecen."""
    ofrecen = {}
    for academia in academias_juego:
        for id_programa in academia["programas"]:
            ofrecen.setdefault(id_programa, []).append({
                "id": academia["id"].removesuffix("_AcademyAsset"),
                "name": academia["nombre"],
                "system": sistemas.get(academia["sistema"], ""),
            })
    lista = []
    for id_programa, programa in programas_juego.items():
        # El nivel va en el id (SemesterEnrollment1 a 4); los de una academia concreta no lo tienen.
        nivel = re.search(r"(\d+)$", id_programa)
        lista.append({
            "id": id_programa,
            "name": programa["nombre"],
            "level": int(nivel.group(1)) if nivel else None,
            "description": programa["descripcion"].strip(),
            "days": programa.get("DurationDays", 0),
            "fee": programa.get("EnrollmentFee", 0),
            "tuition": programa.get("QuarterlyTuition", 0),
            "skill": [programa.get("MinSkill", 0), programa.get("MaxSkill", 0)],
            "stars": {"skill": programa.get("SkillCapStars", 0), "traits": programa.get("TraitStars", 0), "xp": programa.get("XpStars", 0)},
            "academies": sorted(ofrecen.get(id_programa, []), key=lambda academia: (academia["name"], academia["system"])),
        })
    return sorted(lista, key=lambda programa: (programa["days"], programa["fee"], programa["id"]))


def leer(ruta):
    with open(ruta, encoding="utf-8") as archivo:
        return json.load(archivo)


def main():
    ruta_destino = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(RUTA_DESTINO_POR_DEFECTO)
    facciones = leer(os.path.join(RUTA_MAPA, "facciones.json"))
    sistemas = {int(fila["Name"]): fila["StarSystemName"] for fila in leer(os.path.join(RUTA_MAPA, "sistemas.json"))}
    lista, avisos = rasgos(leer(RUTA_RASGOS), facciones)
    datos = {
        "traits": lista,
        "programs": programas(leer(os.path.join(RUTA_MAPA, "programas.json")), leer(os.path.join(RUTA_MAPA, "academias.json")), sistemas),
    }
    with open(ruta_destino, "w", encoding="utf-8") as archivo:
        json.dump(datos, archivo, indent=1, ensure_ascii=False)
        archivo.write("\n")
    print(f"{len(lista)} rasgos y {len(datos['programs'])} programas en {ruta_destino}")
    print(", ".join(f"{clave}: {valor}" for clave, valor in sorted(Counter(rasgo["category"] for rasgo in lista).items())))
    for aviso in avisos:
        print(f"Aviso: {aviso}")


if __name__ == "__main__":
    main()
