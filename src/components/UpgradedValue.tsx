// Con mejoras de la cantina, el valor sin ellas y, en verde, el mejorado (como el mechlab del juego:
// 76,6 ▲ 78,2). Sin mejoras o si no cambia, solo el valor.
export function UpgradedValue({ value, base }: { value: string; base?: string }) {
  if (base === undefined || base === value) return <>{value}</>;
  return <>{base} <span className="readout-upgraded">▲ {value}</span></>;
}
