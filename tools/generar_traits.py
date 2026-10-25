import json
import os
import re
import sys

# Mejoras de mech que se instalan en la cantina (MWMechTraitDataAsset). Los rasgos de piloto
# (*_PilotTrait) y el efecto del Targeting Computer (equipo Clan, no mejora) se dejan fuera.
DIRECTORIO_SCRIPT = os.path.dirname(os.path.abspath(__file__))
RUTA_ORIGEN = os.path.join(DIRECTORIO_SCRIPT, "datos-juego", "traits")
RUTA_DESTINO_POR_DEFECTO = os.path.join(DIRECTORIO_SCRIPT, "..", "src", "data", "traits.json")

REGEX_CLASE = re.compile(r'Begin Object Class=/Script/MechWarrior\.MWMechTraitDataAsset Name="([^"]+)"')
REGEX_NOMBRE = re.compile(r'MechTraitName=NSLOCTEXT\([^,]+,\s*"[^"]+",\s*"([^"]+)"\)')
REGEX_DESCRIPCION = re.compile(r'MechTraitShortDescription=NSLOCTEXT\([^,]+,\s*"[^"]+",\s*"([^"]+)"\)')
REGEX_RANURAS = re.compile(r'\n\s*SlotSize=(\d+)')
REGEX_CATEGORIA = re.compile(r'\n   Type=(\w+)')
REGEX_PARAMETRO = re.compile(r'^\s+([A-Za-z][A-Za-z ]+ Percent)=([+-]?[0-9.]+)', re.MULTILINE)
REGEX_QUIRK = re.compile(r"/Game/Quirks/([A-Za-z]+)_Quirk\.[^\"]+\"',Value=([+-]?[0-9.]+)")
REGEX_ARMAS = re.compile(r'SupportedWeapons=\(GameplayTags=\((.*?)\)\)\n')
REGEX_ETIQUETA_ARMA = re.compile(r'TagName="Weapon\.([A-Za-z]+)(?:\.([A-Za-z]+))?"')

# Efectos que cambian las estadísticas de la web. El resto (aceleración, saltos, duración del láser,
# dispersión de misiles) solo se describe.
ESTADISTICA_DE_PARAMETRO = {
    "Increased Armor Percent": "armor",
    "Increased Structure Percent": "structure",
    "Heat Cooling Percent": "cooling",
    "Heat Capacity Percent": "heatCapacity",
    "Heat Reduction Percent": "heatGeneration",
    "Top Speed Percent": "topSpeed",
    "Turn Speed Percent": "turnSpeed",
    "Torso Twist Rate Percent": "torsoTwist",
    "Increased Sensor Range Percent": "sensorRange",
    "Increased Lock Retention Time Percent": "lockRetention",
    "Increased Lose Lock Time Percent": "loseLockTime",
}
ESTADISTICA_DE_QUIRK = {
    "DamagePercentage": "damage",
    "RangeAndSpeedPercentage": "range",
    "CooldownPercentage": "cooldown",
    "HeatGeneratedPercentage": "heat",
}
TIPO_DE_ARMA = {
    "Ballistic": "ballistic", "Energy": "energy", "Missile": "missile", "ArtemisMissile": "missile",
    "Melee": "melee", "Artillery": "artillery",
}
# Parámetros que guardan una reducción en positivo: el juego la muestra con signo menos.
PARAMETROS_DE_REDUCCION = {"Heat Reduction Percent"}
# Valores que el archivo no trae (los toma de su blueprint), comprobados en el juego.
VALORES_COMPROBADOS = {"IncreasedHeatCapacity_Trait2": {"Heat Capacity Percent": 0.10}}


def leer_archivo(ruta):
    with open(ruta, encoding="utf-8", errors="ignore") as archivo:
        return archivo.read()


def buscar_texto(regex, contenido):
    coincidencia = regex.search(contenido)
    return coincidencia.group(1) if coincidencia else None


def tipos_de_arma(contenido):
    # Weapon.Energy.Laser solo afecta a los láseres; para las estadísticas cuenta como energía.
    coincidencia = REGEX_ARMAS.search(contenido)
    if not coincidencia:
        return None
    return sorted({TIPO_DE_ARMA[tipo] for tipo, _ in REGEX_ETIQUETA_ARMA.findall(coincidencia.group(1)) if tipo in TIPO_DE_ARMA})


def formatear_porcentaje(valor):
    porcentaje = round(valor * 100, 2)
    texto = f"{porcentaje:g}"
    return texto if porcentaje < 0 else f"+{texto}"


def parsear_mejora(id_mejora, contenido):
    parametros = dict(VALORES_COMPROBADOS.get(id_mejora, {}))
    parametros.update({nombre: float(valor) for nombre, valor in REGEX_PARAMETRO.findall(contenido)})
    quirk = REGEX_QUIRK.search(contenido)
    armas = tipos_de_arma(contenido)

    efectos = []
    for nombre, valor in parametros.items():
        if nombre in ESTADISTICA_DE_PARAMETRO:
            signo = -1 if nombre in PARAMETROS_DE_REDUCCION else 1
            efectos.append({"stat": ESTADISTICA_DE_PARAMETRO[nombre], "value": signo * valor})
    if quirk and quirk.group(1) in ESTADISTICA_DE_QUIRK:
        efectos.append({"stat": ESTADISTICA_DE_QUIRK[quirk.group(1)], "value": float(quirk.group(2)), "weaponTypes": armas})

    # La descripción corta del juego lleva el valor como {0}: "{0}% ARMOR" -> "+2.5% ARMOR".
    if quirk:
        valor_principal = float(quirk.group(2))
    else:
        nombre, valor_principal = next(iter(parametros.items()), (None, None))
        if nombre in PARAMETROS_DE_REDUCCION:
            valor_principal = -valor_principal
    descripcion = buscar_texto(REGEX_DESCRIPCION, contenido) or ""
    if valor_principal is not None:
        descripcion = descripcion.replace("{0}", formatear_porcentaje(valor_principal))

    return {
        "id": id_mejora,
        "name": buscar_texto(REGEX_NOMBRE, contenido),
        "category": buscar_texto(REGEX_CATEGORIA, contenido),
        "slots": int(buscar_texto(REGEX_RANURAS, contenido) or 1),
        "description": descripcion,
        "effects": efectos,
    }


def main():
    ruta_destino = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(RUTA_DESTINO_POR_DEFECTO)
    mejoras = []
    descartadas = []

    for archivo in sorted(os.listdir(RUTA_ORIGEN)):
        contenido = leer_archivo(os.path.join(RUTA_ORIGEN, archivo))
        id_mejora = buscar_texto(REGEX_CLASE, contenido)
        if not id_mejora:
            continue
        if id_mejora.startswith("TargetingComputer"):
            descartadas.append(id_mejora)
            continue
        mejora = parsear_mejora(id_mejora, contenido)
        if not mejora["name"] or not mejora["category"]:
            descartadas.append(id_mejora)
            continue
        mejoras.append(mejora)

    with open(ruta_destino, "w", encoding="utf-8") as archivo:
        json.dump(mejoras, archivo, indent=2, ensure_ascii=False)
        archivo.write("\n")

    print(f"✅ {len(mejoras)} mejoras en {ruta_destino}")
    if descartadas:
        print(f"ℹ️ Fuera ({len(descartadas)}): {', '.join(descartadas)}")


if __name__ == "__main__":
    main()
