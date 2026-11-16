// Spec 179 stage D, TK-339: when a Geiger counter clicks. Clicks come at random like real counts (a Poisson process:
// exponential gaps), at a rate that rises from clicksPerSec[0] at the threshold radiation (fromRadiation) to
// clicksPerSec[1] at radiation 1, squared so low doses tick sparsely and a peak crackles; nothing below the threshold.
// plan() writes the click times of the next window into a reused array (no allocation per call); the gap to the next
// click carries over between windows, so the rhythm never restarts at a window's edge.
const MAX_CLICKS = 256;

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const number = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export class GeigerClickPlanner {
  #rng;
  #untilNextSec = null;
  #times = new Float64Array(MAX_CLICKS);

  // rng: () => 0…1 (the sound's own random; never the gameplay rng).
  constructor({ rng }) {
    if (typeof rng !== "function") throw new TypeError("GeigerClickPlanner requires rng");
    this.#rng = rng;
  }

  // The click times (seconds from the window's start) planned by the last plan(); the first `count` are valid.
  get times() {
    return this.#times;
  }

  // Clicks a second at this radiation (0 below the threshold or switched off).
  rate(radiation, settings) {
    if (settings?.enabled !== true) return 0;
    const from = clamp01(number(settings.fromRadiation, 0));
    const level = clamp01(number(radiation, 0));
    if (level <= from) return 0;
    const share = clamp01((level - from) / Math.max(1e-6, 1 - from));
    const low = Math.max(0, number(settings.clicksPerSec?.[0], 1));
    const high = Math.max(low, number(settings.clicksPerSec?.[1], low));
    return low + (high - low) * share * share;
  }

  // Plans the clicks of the next windowSec seconds; returns how many (their times are in `times`).
  plan(windowSec, radiation, settings) {
    const rate = this.rate(radiation, settings);
    const window = Math.max(0, number(windowSec, 0));
    if (rate <= 0 || window <= 0) {
      this.#untilNextSec = null;
      return 0;
    }
    if (this.#untilNextSec === null) this.#untilNextSec = this.#gap(rate);
    let at = this.#untilNextSec;
    let count = 0;
    while (at < window && count < MAX_CLICKS) {
      this.#times[count] = at;
      count += 1;
      at += this.#gap(rate);
    }
    this.#untilNextSec = Math.max(0, at - window);
    return count;
  }

  #gap(rate) {
    return -Math.log(1 - Math.min(0.999999, this.#rng())) / rate;
  }
}
