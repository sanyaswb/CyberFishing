// Spec 178 (TK-298): living world wind as a continuous 0…1 strength process in real seconds (owner Q3) with its own
// seeded RNG stream (owner Q1).
// - Macro episodes: calm / light / moderate / strong weighted transitions with smooth fades (fadeSec).
// - Weather coupling: rain and storm raise minimum strength and boost global gust frequency.
// - Global gusts: smooth pulse envelopes layered over base strength, shared by waves, rain slant and the float.
// - Direction rule (owner Q4): strength === 0 <-> direction === 0; rising from 0 picks -1 or +1 at random and holds
//   that direction until wind drops back to 0. Allocation-free: rewrites one snapshot object in place.
const WIND_STATES = Object.freeze(["calm", "light", "moderate", "strong"]);
const WIND_EPS = 1e-4;
const DEFAULT_FADE_SEC = 14;
const DEFAULT_STATES = Object.freeze({
  calm: Object.freeze({ weight: 0.2, durationSec: Object.freeze([90, 300]), strength: Object.freeze([0, 0]) }),
  light: Object.freeze({ weight: 0.4, durationSec: Object.freeze([60, 240]), strength: Object.freeze([0.15, 0.35]) }),
  moderate: Object.freeze({ weight: 0.28, durationSec: Object.freeze([60, 200]), strength: Object.freeze([0.4, 0.65]) }),
  strong: Object.freeze({ weight: 0.12, durationSec: Object.freeze([45, 150]), strength: Object.freeze([0.7, 0.9]) }),
});

const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const pair = (value, fallback) =>
  Array.isArray(value) &&
  value.length >= 2 &&
  Number.isFinite(Number(value[0])) &&
  Number.isFinite(Number(value[1]))
    ? value
    : fallback;

function classifyState(strength) {
  if (strength <= WIND_EPS) return "calm";
  if (strength < 0.38) return "light";
  if (strength < 0.68) return "moderate";
  return "strong";
}

export class WindModel {
  #rng;
  #getSettings;
  #episode = 0;
  #episodeLeftSec = 0;
  #baseStrength = 0;
  #baseTarget = 0;
  #autoDirection = 0;
  #forcedDirection = null;
  #forcedStrength = null;
  #gustActive = false;
  #gustAgeSec = 0;
  #gustDurationSec = 0;
  #gustDelta = 0;
  #gustCurrent = 0;
  #snapshot = {
    direction: 0,
    strength: 0,
    baseStrength: 0,
    gustStrength: 0,
    targetStrength: 0,
    state: "calm",
    episode: 0,
    episodeLeftSec: 0,
    isGusting: false,
    forcedDirection: null,
    forcedStrength: null,
  };

  // rng: { next(), range(min, max), chance(p) } (dedicated wind stream); getSettings: () => MAP_DB.<id>.weather.wind.
  constructor({ rng, getSettings }) {
    if (
      typeof rng?.next !== "function" ||
      typeof rng?.range !== "function" ||
      typeof rng?.chance !== "function"
    ) {
      throw new TypeError("WindModel requires an rng");
    }
    if (typeof getSettings !== "function") {
      throw new TypeError("WindModel requires getSettings");
    }
    this.#rng = rng;
    this.#getSettings = getSettings;
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds since the last update; rain/storm: 0…1 intensities from WeatherModel.
  update(dtMs, { rain = 0, storm = 0 } = {}) {
    const dtSec = Math.max(0, finite(dtMs, 0)) / 1000;
    const settings = this.#getSettings() || null;
    if (!settings) {
      this.#baseStrength = 0;
      this.#baseTarget = 0;
      this.#autoDirection = 0;
      this.#clearGust();
      this.#sync(0);
      return this.#snapshot;
    }

    if (this.#forcedDirection === 0) {
      this.#baseStrength = 0;
      this.#baseTarget = 0;
      this.#autoDirection = 0;
      this.#clearGust();
      this.#sync(0);
      return this.#snapshot;
    }

    const rainLevel = clamp01(finite(rain, 0));
    const stormLevel = clamp01(finite(storm, 0));

    if (this.#forcedStrength !== null) {
      this.#baseStrength = this.#forcedStrength;
      this.#baseTarget = this.#forcedStrength;
      this.#updateActiveGust(dtSec);
      const strength = this.#forcedStrength <= WIND_EPS && !this.#gustActive
        ? 0
        : clamp01(this.#baseStrength + this.#gustCurrent);
      this.#sync(strength);
      return this.#snapshot;
    }

    if (this.#episode === 0 || this.#episodeLeftSec <= dtSec) {
      this.#nextEpisode(settings);
    } else {
      this.#episodeLeftSec -= dtSec;
    }

    const fadeSec = Math.max(0, finite(settings.fadeSec, DEFAULT_FADE_SEC));
    if (fadeSec <= 0) {
      this.#baseStrength = this.#baseTarget;
    } else if (this.#baseStrength !== this.#baseTarget) {
      const step = dtSec / fadeSec;
      this.#baseStrength =
        this.#baseTarget > this.#baseStrength
          ? Math.min(this.#baseTarget, this.#baseStrength + step)
          : Math.max(this.#baseTarget, this.#baseStrength - step);
    }

    const boost = settings.weatherBoost;
    const rainFloor = rainLevel > 0 ? rainLevel * Math.max(0, finite(boost?.rainMinStrength, 0)) : 0;
    const stormFloor = stormLevel > 0 ? stormLevel * Math.max(0, finite(boost?.stormMinStrength, 0)) : 0;
    const rainBonus = rainLevel * Math.max(0, finite(boost?.rainBonus, 0));
    const boostedBase = clamp01(Math.max(this.#baseStrength, rainFloor, stormFloor) + rainBonus);

    this.#updateGust(settings, boostedBase, rainLevel, stormLevel, dtSec);
    const strength = clamp01(boostedBase + this.#gustCurrent);
    this.#sync(strength);
    return this.#snapshot;
  }

  // Forced direction: -1 (left), 0 (calm: disables wind), 1 (right), or null (automatic).
  setDirectionOverride(direction) {
    const next = direction === -1 || direction === 0 || direction === 1 ? direction : null;
    this.#forcedDirection = next;
    const settings = this.#getSettings() || null;
    if (next === 0) {
      this.#forcedStrength = null;
      this.#baseStrength = 0;
      this.#baseTarget = 0;
      this.#autoDirection = 0;
      this.#clearGust();
      this.#sync(0);
      return;
    }
    if ((next === -1 || next === 1) && this.#forcedStrength === null && this.#snapshot.strength <= WIND_EPS) {
      this.#enterState("light", settings);
      this.#baseStrength = Math.max(this.#baseStrength, this.#baseTarget * 0.5 || 0.2);
    }
    this.#sync(clamp01(Math.max(this.#forcedStrength ?? this.#baseStrength, 0) + this.#gustCurrent));
  }

  // Forced strength in 0…1, or null for automatic wind. Setting 0 clears direction to 0 unless forced.
  setStrengthOverride(strength) {
    if (strength === null || strength === undefined || !Number.isFinite(Number(strength))) {
      this.#forcedStrength = null;
      this.#sync(clamp01(this.#baseStrength + this.#gustCurrent));
      return;
    }
    const clamped = clamp01(Number(strength));
    if (this.#forcedDirection === 0 && clamped > WIND_EPS) this.#forcedDirection = null;
    this.#forcedStrength = clamped;
    this.#baseStrength = clamped;
    this.#baseTarget = clamped;
    this.#clearGust();
    if (clamped <= WIND_EPS) this.#autoDirection = 0;
    this.#sync(clamped);
  }

  // Triggers a single smooth global gust right now (DEV button or scripted event).
  triggerGust({ delta = null, durationSec = null } = {}) {
    if (this.#forcedDirection === 0) return false;
    const settings = this.#getSettings() || null;
    const gust = settings?.gust;
    const rolledDelta = delta !== null && Number.isFinite(Number(delta))
      ? Math.max(0, Number(delta))
      : clamp01(this.#roll(pair(gust?.deltaRange, [0.12, 0.3])));
    const rolledDuration = durationSec !== null && Number.isFinite(Number(durationSec))
      ? Math.max(0.2, Number(durationSec))
      : Math.max(0.2, this.#roll(pair(gust?.durationSec, [1.5, 4.5])));
    this.#gustActive = rolledDelta > WIND_EPS;
    this.#gustAgeSec = 0;
    this.#gustDurationSec = rolledDuration;
    this.#gustDelta = rolledDelta;
    this.#gustCurrent = 0;
    if (this.#gustActive && this.#forcedDirection === null && this.#autoDirection === 0) {
      this.#autoDirection = this.#pickDirection();
    }
    this.#sync(clamp01((this.#forcedStrength ?? this.#baseStrength) + this.#gustCurrent));
    return this.#gustActive;
  }

  #nextEpisode(settings) {
    const states = settings?.states;
    const hasCustomStates = Boolean(states && typeof states === "object");
    let total = 0;
    for (let index = 0; index < WIND_STATES.length; index += 1) {
      const name = WIND_STATES[index];
      const weight = hasCustomStates
        ? Math.max(0, finite(states[name]?.weight, 0))
        : DEFAULT_STATES[name].weight;
      total += weight;
    }
    let picked = "calm";
    if (total > 0) {
      let roll = this.#rng.next() * total;
      for (let index = 0; index < WIND_STATES.length; index += 1) {
        const name = WIND_STATES[index];
        const weight = hasCustomStates
          ? Math.max(0, finite(states[name]?.weight, 0))
          : DEFAULT_STATES[name].weight;
        roll -= weight;
        if (roll < 0) {
          picked = name;
          break;
        }
      }
    }
    this.#enterState(picked, settings);
  }

  #enterState(state, settings) {
    const entry = settings?.states?.[state] ?? DEFAULT_STATES[state] ?? DEFAULT_STATES.calm;
    this.#episode += 1;
    this.#episodeLeftSec = Math.max(1, this.#roll(pair(entry.durationSec, DEFAULT_STATES[state].durationSec)));
    this.#baseTarget = state === "calm" ? 0 : clamp01(this.#roll(pair(entry.strength, DEFAULT_STATES[state].strength)));
  }

  #updateGust(settings, boostedBase, rainLevel, stormLevel, dtSec) {
    if (this.#gustActive) {
      this.#updateActiveGust(dtSec, settings);
      return;
    }
    if (dtSec <= 0 || (boostedBase <= 0.02 && stormLevel <= 0)) {
      this.#gustCurrent = 0;
      return;
    }
    const gust = settings?.gust;
    const baseChance = Math.max(0, finite(gust?.chancePerSec, 0.14));
    const rainMult = 1 + rainLevel * Math.max(0, finite(gust?.rainChanceMult, 1.5));
    const stormMult = 1 + stormLevel * Math.max(0, finite(gust?.stormChanceMult, 2.5));
    const strengthWeight = 0.35 + 0.65 * Math.max(boostedBase, stormLevel);
    const probability = Math.min(1, baseChance * rainMult * stormMult * strengthWeight * dtSec);
    if (probability > 0 && this.#rng.chance(probability)) {
      this.triggerGust();
    }
  }

  #updateActiveGust(dtSec, settings = this.#getSettings()) {
    if (!this.#gustActive || this.#gustDurationSec <= 0) {
      this.#clearGust();
      return;
    }
    this.#gustAgeSec += dtSec;
    const u = clamp01(this.#gustAgeSec / this.#gustDurationSec);
    if (u >= 1) {
      this.#clearGust();
      return;
    }
    const attackShare = Math.min(0.8, Math.max(0.05, finite(settings?.gust?.attackShare, 0.25)));
    const envelope = u < attackShare
      ? Math.sin((u / attackShare) * Math.PI * 0.5)
      : Math.cos(((u - attackShare) / (1 - attackShare)) * Math.PI * 0.5);
    this.#gustCurrent = Math.max(0, this.#gustDelta * Math.max(0, envelope));
  }

  #clearGust() {
    this.#gustActive = false;
    this.#gustAgeSec = 0;
    this.#gustDurationSec = 0;
    this.#gustDelta = 0;
    this.#gustCurrent = 0;
  }

  #roll(range) {
    const min = Number(range[0]);
    const max = Number(range[1]);
    return max > min ? this.#rng.range(min, max) : min;
  }

  #pickDirection() {
    return this.#rng.chance(0.5) ? 1 : -1;
  }

  #sync(rawStrength) {
    const strength = rawStrength <= WIND_EPS ? 0 : clamp01(rawStrength);
    if (this.#forcedDirection === null) {
      if (strength <= 0) this.#autoDirection = 0;
      else if (this.#autoDirection === 0) this.#autoDirection = this.#pickDirection();
    }
    const direction = this.#forcedDirection !== null ? this.#forcedDirection : this.#autoDirection;
    const snapshot = this.#snapshot;
    snapshot.strength = direction === 0 ? 0 : strength;
    snapshot.direction = snapshot.strength <= 0 && this.#forcedDirection === null ? 0 : direction;
    snapshot.baseStrength = clamp01(this.#baseStrength);
    snapshot.gustStrength = Math.max(0, this.#gustCurrent);
    snapshot.targetStrength = clamp01(this.#forcedStrength ?? this.#baseTarget);
    snapshot.state = classifyState(snapshot.strength);
    snapshot.episode = this.#episode;
    snapshot.episodeLeftSec = Math.max(0, this.#episodeLeftSec);
    snapshot.isGusting = this.#gustActive && snapshot.gustStrength > WIND_EPS;
    snapshot.forcedDirection = this.#forcedDirection;
    snapshot.forcedStrength = this.#forcedStrength;
  }
}
