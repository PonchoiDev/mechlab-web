import { getRangeRadar, type RangeProfileEntry } from '../utils/rangeRadar';

// Hasta un decimal, sin ceros de más: 170, 46.8.
const formatNumber = (value: number) => String(Number(value.toFixed(1)));

const RADAR_RADIUS = 300;
// Radios del radar cada 30°, como las líneas de un campo de tiro.
const RADAR_SPOKES = [30, 60, 90, 120, 150];

// El daño por alcance como un campo de tiro: el 'Mech abajo en el centro y un anillo por distancia, más
// intenso cuanto más daño llega. Lo de las armas por debajo de su alcance mínimo (en BATTLETECH; en MW5 no
// hay) va rayado en ámbar. Los anillos y su intensidad salen de getRangeRadar. Lo usan los dos MechLabs:
// el color de los anillos es el de cada página (--radar-accent).
export function RangeRadar({ profile }: { profile: RangeProfileEntry[] }) {
  const { radius, bands } = getRangeRadar(profile, RADAR_RADIUS);
  const center = radius;
  const reach = bands.filter(band => band.damage + band.belowMin > 0).at(-1)?.distance ?? 0;
  return (
    <svg
      className="range-radar"
      viewBox={`-16 -14 ${radius * 2 + 32} ${radius + 46}`}
      role="img"
      aria-label={`Damage by range: ${bands.map(band => `${band.distance} m ${formatNumber(band.damage)}${band.belowMin > 0 ? ` plus ${formatNumber(band.belowMin)} under minimum range` : ''}`).join(', ')}`}
    >
      <defs>
        <pattern id="range-radar-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="6" className="range-radar-hatch" />
        </pattern>
      </defs>
      {bands.map(band => (
        <g key={band.distance}>
          <path d={band.path} className="range-radar-band" />
          {band.intensity > 0 && <path d={band.path} className="range-radar-fill" style={{ fillOpacity: 0.1 + 0.75 * band.intensity }} />}
          {band.belowMinIntensity > 0 && <path d={band.path} fill="url(#range-radar-hatch)" style={{ opacity: 0.35 + 0.65 * band.belowMinIntensity }} />}
          <title>{`${band.distance} m: ${formatNumber(band.damage)} damage${band.belowMin > 0 ? `, +${formatNumber(band.belowMin)} under minimum range` : ''}`}</title>
        </g>
      ))}
      {RADAR_SPOKES.map(angle => {
        const radians = (angle * Math.PI) / 180;
        return (
          <line
            key={angle}
            className="range-radar-spoke"
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(radians)}
            y2={center - radius * Math.sin(radians)}
          />
        );
      })}
      {bands.map(band => {
        const y = center - (band.inner + band.outer) / 2;
        if (band.damage + band.belowMin === 0) return null;
        return (
          <text key={band.distance} className="range-radar-value" x={center} y={y + 4} textAnchor="middle">
            {formatNumber(band.damage)}
            {band.belowMin > 0 && <tspan className="range-radar-min"> +{formatNumber(band.belowMin)}</tspan>}
          </text>
        );
      })}
      <line className="range-radar-base" x1={0} y1={center} x2={radius * 2} y2={center} />
      {bands.map(band => (
        <text key={band.distance} className={band.distance <= reach ? 'range-radar-distance is-in-reach' : 'range-radar-distance'} x={center + band.outer} y={center + 16} textAnchor="middle">
          {band.distance}
        </text>
      ))}
      <text className="range-radar-distance" x={center - radius} y={center + 16} textAnchor="start">m</text>
      <path className="range-radar-mech" d={`M ${center} ${center - 12} L ${center + 8} ${center} L ${center - 8} ${center} Z`} />
    </svg>
  );
}
