// Spec 182 D2 (stage B, TK-351): the starfall's night (owner, 2026-11-16, Q1/Q4/Q5).
// - The window is the game night fromHour → toHour (21:00 → 5:00, it passes midnight). The night is checked ONCE, when
//   the game clock enters the window (or at the first update inside it, so a session that starts at night has its own
//   check): nightChance decides whether this night has a starfall.
// - A starfall night plans its timeline at once: a random number of periods (periods [min, max]) cover the night in
//   random lengths; each has its own strength — 0 with quietChance (a quiet stretch), otherwise a random share of
//   maxStrength. Between the periods, and from / to zero at the night's edges, the strength changes along a cosine curve
//   over blendShare of the shorter neighbour, so it rises and falls several times a night, never linearly and never
//   evenly.
// - The bolide: at most one a night. Its (very small) chance bolideChance is rolled once, right after the night's check
//   succeeds; if so its moment is random over the whole window, quiet stretches too. bolideSerial counts the bolides
//   that fell (a renderer starts one when it changes).
// - During an emission there is no starfall (Q3): update's `blocked` makes the strength 0 and skips a bolide whose moment
//   passes then; the night's timeline goes on. Nothing else hides the stars (Q2: the owner's Spine layers will).
// The strength is a function of the game hour (no dt): a time-of-day jump lands on the plan's value at once. The rng is
// the starfall's own stream (it never shifts the weather's or the fish's numbers; no gameplay effect, Q6). snapshot is
// one object rewritten in place; the plan's arrays are reused between nights.
import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
const MAX_PERIODS = 24;

export class StarfallNight {
  #rng;
  #getSettings;
  #wasInside = false;
  #automatic = true;
  #held = null;
  #starts = new Float64Array(MAX_PERIODS + 1);
  #levels = new Float64Array(MAX_PERIODS);
  #bolidePending = false;
  #lastPosition = -1;
  #snapshot = {
    inWindow: false,
    active: false,
    strength: 0,
    planned: 0,
    held: false,
    nightSerial: 0,
    periodCount: 0,
    // Hours since the window's start of each period's start, and its strength (DevTools shows the plan).
    periodStartHours: [],
    periodLevels: [],
    windowHours: 0,
    positionHours: 0,
    bolideAtHours: null,
    bolideSerial: 0,
    automatic: true,
  };

  // rng: { next(), range(min, max), chance(p) } (the starfall's own seeded stream); getSettings: () =>
  // MAP_DB.<id>.weather.starfall (or null: never).
  constructor({ rng, getSettings }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function" || typeof rng?.chance !== "function") {
      throw new TypeError("StarfallNight requires an rng");
    }
    if (typeof getSettings !== "function") throw new TypeError("StarfallNight requires getSettings");
    this.#rng = rng;
    this.#getSettings = getSettings;
  }

  get snapshot() {
    return this.#snapshot;
  }

  // clock: { hour } (game hours 0…24) or null (no game clock: no starfall); blocked: an emission is on.
  update(clock, blocked = false) {
    const settings = this.#getSettings() || null;
    const snapshot = this.#snapshot;
    const hour = finiteOr(clock?.hour, NaN);
    const enabled = settings?.enabled === true && Number.isFinite(hour);
    const from = finiteOr(settings?.fromHour, 21);
    const to = finiteOr(settings?.toHour, 5);
    const windowHours = ((to - from) % 24 + 24) % 24 || 24;
    const position = ((hour - from) % 24 + 24) % 24;
    const inside = enabled && position < windowHours;
    snapshot.inWindow = inside;
    snapshot.windowHours = windowHours;
    snapshot.positionHours = inside ? position : 0;
    if (inside && !this.#wasInside) this.#checkNight(settings, windowHours);
    this.#wasInside = inside;
    if (!inside) {
      snapshot.active = false;
      snapshot.planned = 0;
      this.#bolidePending = false;
      this.#lastPosition = -1;
    } else {
      snapshot.planned = snapshot.active ? this.#levelAt(position, settings) : 0;
      if (this.#bolidePending && snapshot.bolideAtHours !== null && position >= snapshot.bolideAtHours &&
        this.#lastPosition >= 0 && this.#lastPosition <= snapshot.bolideAtHours + 1e-9) {
        this.#bolidePending = false;
        if (!blocked) snapshot.bolideSerial += 1;
      }
      this.#lastPosition = position;
    }
    snapshot.held = this.#held !== null;
    snapshot.strength = blocked ? 0 : this.#held !== null ? this.#held : snapshot.planned;
  }

  // DEV: the strength pinned (0…1), null releases it to the night's plan.
  hold(strength) {
    this.#held = strength === null || strength === undefined ? null : clampUnit(finiteOr(strength, 0));
    this.#snapshot.held = this.#held !== null;
  }

  // TK-398: automatic on / off. Off: the night's plan and its bolide are dropped and no night is checked (hold() and
  // bolideNow() still work); on again: the night is checked at the next update inside the window.
  setAutomatic(on) {
    if ((on !== false) === this.#automatic) return;
    this.#automatic = on !== false;
    this.#wasInside = false;
    if (!this.#automatic) this.#plan(null, this.#snapshot.windowHours, false);
    this.#snapshot.automatic = this.#automatic;
  }

  // DEV: a bolide now (whatever the night).
  bolideNow() {
    this.#snapshot.bolideSerial += 1;
  }

  // The night's one check, and on success its timeline and the bolide's roll.
  #checkNight(settings, windowHours) {
    this.#plan(settings, windowHours, this.#automatic && this.#rng.chance(clampUnit(finiteOr(settings?.nightChance, 0))));
  }

  #plan(settings, windowHours, success) {
    const snapshot = this.#snapshot;
    snapshot.nightSerial += 1;
    snapshot.active = success;
    snapshot.periodCount = 0;
    snapshot.periodStartHours.length = 0;
    snapshot.periodLevels.length = 0;
    snapshot.bolideAtHours = null;
    this.#bolidePending = false;
    if (!success) return;
    const rng = this.#rng;
    const [low, high] = Array.isArray(settings?.periods) ? settings.periods : [3, 6];
    const minCount = Math.max(1, Math.min(MAX_PERIODS, Math.floor(finiteOr(low, 3))));
    const maxCount = Math.max(minCount, Math.min(MAX_PERIODS, Math.floor(finiteOr(high, minCount))));
    const count = minCount + Math.floor(rng.next() * (maxCount - minCount + 1)) % (maxCount - minCount + 1);
    // Random lengths: each a weight in [0.4, 1.6], scaled to the whole window.
    let total = 0;
    for (let index = 0; index < count; index += 1) { this.#starts[index + 1] = rng.range(0.4, 1.6); total += this.#starts[index + 1]; }
    this.#starts[0] = 0;
    for (let index = 1; index <= count; index += 1) this.#starts[index] = this.#starts[index - 1] + this.#starts[index] / total * windowHours;
    this.#starts[count] = windowHours;
    const maxStrength = clampUnit(finiteOr(settings?.maxStrength, 1));
    const quiet = clampUnit(finiteOr(settings?.quietChance, 0.25));
    for (let index = 0; index < count; index += 1) {
      this.#levels[index] = rng.chance(quiet) ? 0 : maxStrength * rng.range(0.15, 1);
      snapshot.periodStartHours.push(this.#starts[index]);
      snapshot.periodLevels.push(this.#levels[index]);
    }
    snapshot.periodCount = count;
    // Q5: the bolide's chance once, after a successful check; its moment anywhere in the night.
    if (rng.chance(clampUnit(finiteOr(settings?.bolideChance, 0)))) {
      snapshot.bolideAtHours = rng.range(0, windowHours);
      this.#bolidePending = true;
    }
  }

  // The plan's strength at a position (hours since the window's start): the period's level, eased along a cosine toward
  // its neighbours (zero beyond the night's edges) over blendShare of the shorter of the two.
  #levelAt(position, settings) {
    const count = this.#snapshot.periodCount;
    if (count === 0) return 0;
    let index = 0;
    while (index < count - 1 && position >= this.#starts[index + 1]) index += 1;
    const blend = clampUnit(finiteOr(settings?.blendShare, 0.35));
    const level = this.#levels[index];
    const start = this.#starts[index];
    const end = this.#starts[index + 1];
    const length = end - start;
    const previousLength = index > 0 ? start - this.#starts[index - 1] : length;
    const nextLength = index < count - 1 ? this.#starts[index + 2] - end : length;
    const previous = index > 0 ? this.#levels[index - 1] : 0;
    const next = index < count - 1 ? this.#levels[index + 1] : 0;
    // Each inner boundary's transition is centred on it, half on each side; at the night's edges it lies inside the night
    // (0 exactly at fromHour and toHour).
    const halfIn = blend * Math.min(length, previousLength) / 2;
    const halfOut = blend * Math.min(length, nextLength) / 2;
    if (index === 0 && halfIn > 0 && position < start + 2 * halfIn) {
      return StarfallNight.#ease(0, level, (position - start) / (2 * halfIn));
    }
    if (index === count - 1 && halfOut > 0 && position > end - 2 * halfOut) {
      return StarfallNight.#ease(level, 0, (position - (end - 2 * halfOut)) / (2 * halfOut));
    }
    if (index > 0 && halfIn > 0 && position < start + halfIn) {
      return StarfallNight.#ease(previous, level, (position - (start - halfIn)) / (2 * halfIn));
    }
    if (index < count - 1 && halfOut > 0 && position > end - halfOut) {
      return StarfallNight.#ease(level, next, (position - (end - halfOut)) / (2 * halfOut));
    }
    return level;
  }

  static #ease(from, to, share) {
    const t = clampUnit(share);
    return from + (to - from) * (1 - Math.cos(Math.PI * t)) / 2;
  }
}
