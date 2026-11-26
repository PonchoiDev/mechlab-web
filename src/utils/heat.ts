// Disparando sin parar también se refrigera, así que la capacidad se llena con el calor neto. Si la
// refrigeración iguala o supera al calor disparando, no se llena nunca. Enfriarse es desde el máximo y
// sin disparar.
export const getHeatTimes = ({ heatCapacity, heatPerSecond, coolingRate }: { heatCapacity: number | null; heatPerSecond: number; coolingRate: number | null }) => {
  if (heatCapacity === null || coolingRate === null) return { timeToMaxHeat: null, timeToCoolDown: null };
  const net = heatPerSecond - coolingRate;
  return {
    timeToMaxHeat: net > 0 ? heatCapacity / net : 'never' as const,
    timeToCoolDown: coolingRate > 0 ? heatCapacity / coolingRate : null
  };
};
