// Spec 179 D10 (TK-370): the radiation dose (seconds of full radiation) of one average full emission of a location, from
// its weather settings (MAP_DB.<id>.weather): the course is WeatherEventTimeline's — a smoothstep rise to the peak
// (half its length counts), the peak, a smoothstep fall (half) — so a duration D with a peak share p gives
// D × (p + (1 − p) / 2) × the peak strength, times the emission's share of the radiation (emissionPeak − base).
// Means of the rolled ranges. Infinity when an emission adds no radiation (nothing wears from it).
const mean = (range, fallback) => {
  if (Array.isArray(range) && range.length === 2 && range.every(Number.isFinite)) return (range[0] + range[1]) / 2;
  return Number.isFinite(range) ? range : fallback;
};

export function meanFullEmissionDoseSec(weather) {
  const emission = weather?.emission ?? {};
  const radiation = weather?.radiation ?? {};
  const duration = mean(emission.durationSec, 0);
  const peakShare = Math.max(0, Math.min(1, mean(emission.peakShare, 0)));
  const strength = mean(emission.peakStrength, 1);
  const rise = Math.max(0, Number(radiation.emissionPeak ?? 1) - Number(radiation.base ?? 0));
  const dose = duration * (peakShare + (1 - peakShare) / 2) * strength * rise;
  return dose > 0 ? dose : Infinity;
}
