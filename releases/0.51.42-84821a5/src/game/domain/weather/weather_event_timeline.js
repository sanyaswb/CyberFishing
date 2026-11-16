// Spec 180 D13 (owner, 2026-11-16): one weather event's course, rolled whole when the event starts — its duration, where
// its peak begins, how long the peak lasts and how strong it is. The strength rises from 0 to the peak, stays there and
// falls back to 0 by the end; the rise and the fall follow a smoothstep, so there is no kink at the peak's edges.
// Settings (shares of the duration, so they suit any length): durationSec [min, max], peakAtShare [min, max],
// peakShare [min, max], peakStrength [min, max] (0…1). One record rewritten in place.
const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const smooth = (value) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};
const pairOf = (value, fallback) => (Array.isArray(value) && value.length >= 2 &&
  Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])) ? value : fallback);

export const DEFAULT_TIMELINE = Object.freeze({
  durationSec: Object.freeze([300, 900]),
  peakAtShare: Object.freeze([0.25, 0.5]),
  peakShare: Object.freeze([0.1, 0.3]),
  peakStrength: Object.freeze([0.4, 1]),
});

export class WeatherEventTimeline {
  durationSec = 0;
  peakStartSec = 0;
  peakEndSec = 0;
  peakStrength = 0;

  // settings: the event's block (see above); rng: { range(min, max) }. peakStrength (0…1 or null) overrides the roll.
  roll(settings, rng, peakStrength = null) {
    const roll = (key) => {
      const [min, max] = pairOf(settings?.[key], DEFAULT_TIMELINE[key]);
      const low = Number(min);
      const high = Math.max(low, Number(max));
      return high > low ? rng.range(low, high) : low;
    };
    this.durationSec = Math.max(1, roll("durationSec"));
    const peakAt = clamp01(roll("peakAtShare"));
    const peakLength = clamp01(roll("peakShare"));
    this.peakStartSec = this.durationSec * Math.min(peakAt, 0.98);
    this.peakEndSec = Math.min(this.durationSec * 0.99, this.peakStartSec + this.durationSec * peakLength);
    const rolledStrength = clamp01(roll("peakStrength"));
    this.peakStrength = peakStrength === null || !Number.isFinite(Number(peakStrength)) ? rolledStrength : clamp01(Number(peakStrength));
    return this;
  }

  strengthAt(elapsedSec) {
    const t = Number(elapsedSec);
    if (!(t > 0) || t >= this.durationSec) return 0;
    if (t < this.peakStartSec) return this.peakStrength * smooth(t / this.peakStartSec);
    if (t <= this.peakEndSec) return this.peakStrength;
    return this.peakStrength * smooth((this.durationSec - t) / Math.max(1e-6, this.durationSec - this.peakEndSec));
  }

  // "rise" before the peak, "peak", "fall" after it; "idle" outside the event.
  phaseAt(elapsedSec) {
    const t = Number(elapsedSec);
    if (!(t >= 0) || t >= this.durationSec) return "idle";
    if (t < this.peakStartSec) return "rise";
    return t <= this.peakEndSec ? "peak" : "fall";
  }
}
