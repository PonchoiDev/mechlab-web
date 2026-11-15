// El daño por alcance como un campo de tiro: un semicírculo con el 'Mech abajo en el centro y un anillo por
// cada distancia del perfil (de 90 en 90 m). Las coordenadas son las de un SVG de 2 × radius de ancho y
// radius de alto, con el 'Mech en (radius, radius).
export interface RangeProfileEntry {
  distance: number;
  damage: number;
  belowMin: number;
}

export interface RadarBand extends RangeProfileEntry {
  inner: number;
  outer: number;
  // De 0 a 1 frente al anillo con más daño: lo que se pinta en el color de la página y lo que va en
  // ámbar, el de las armas por debajo de su alcance mínimo.
  intensity: number;
  belowMinIntensity: number;
  // Sector de 180° entre el radio interior y el exterior.
  path: string;
}

const round = (value: number) => Number(value.toFixed(2));

const sectorPath = (center: number, inner: number, outer: number) => {
  const outerArc = `M ${round(center - outer)} ${center} A ${outer} ${outer} 0 0 1 ${round(center + outer)} ${center}`;
  if (inner === 0) return `${outerArc} Z`;
  return `${outerArc} L ${round(center + inner)} ${center} A ${inner} ${inner} 0 0 0 ${round(center - inner)} ${center} Z`;
};

export const getRangeRadar = (profile: RangeProfileEntry[], radius: number) => {
  const peak = Math.max(1, ...profile.map(entry => entry.damage + entry.belowMin));
  const step = radius / profile.length;
  const bands: RadarBand[] = profile.map((entry, index) => {
    const inner = round(step * index);
    const outer = index === profile.length - 1 ? radius : round(step * (index + 1));
    return {
      ...entry,
      inner,
      outer,
      intensity: round(entry.damage / peak),
      belowMinIntensity: round(entry.belowMin / peak),
      path: sectorPath(radius, inner, outer)
    };
  });
  return { radius, bands };
};
