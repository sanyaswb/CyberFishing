// Spec 178 (TK-298): living world wind as a continuous 0…1 strength process in real seconds (owner Q3) with its own
// seeded RNG stream (owner Q1).
// - Macro episodes: calm / light / moderate / strong weighted transitions with smooth fades (fadeSec).
// - Weather coupling: rain and storm raise minimum strength and boost global gust frequency.
// - Global gusts: smooth pulse envelopes layered over base strength, shared by waves, rain slant and the float.
// - Direction rule (owner Q4): strength === 0 <-> direction === 0; rising from 0 picks -1 or +1 at random and holds
//   that direction until wind drops back to 0. Allocation-free: rewrites one snapshot object in place.
import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { effectOfPair } from "../../../engine/math/strength_value.js";
const WIND_STATES = Object.freeze(["calm", "light", "moderate", "strong"]);
const WIND_EPS = 1e-4;
const DEFAULT_FADE_SEC = 14;
const DEFAULT_STATES = Object.freeze({
  calm: Object.freeze({ weight: 0.2, durationSec: Object.freeze([90, 300]), strength: Object.freeze([0, 0]) }),
  light: Object.freeze({ weight: 0.4, durationSec: Object.freeze([60, 240]), strength: Object.freeze([0.15, 0.35]) }),
  moderate: Object.freeze({ weight: 0.28, durationSec: Object.freeze([60, 200]), strength: Object.freeze([0.4, 0.65]) }),
  strong: Object.freeze({ weight: 0.12, durationSec: Object.freeze([45, 150]), strength: Object.freeze([0.7, 0.9]) }),
});
const DEFAULT_FLOAT = Object.freeze({
  maxAngleDeg: 38,
  returnPctRange: Object.freeze([0.15, 0.45]),
  cycleDurationSec: Object.freeze([0.45, 1.35]),
  amplitudeJitter: Object.freeze([0.8, 1.15]),
});
const DEFAULT_SETTINGS = Object.freeze({
  fadeSec: DEFAULT_FADE_SEC,
  states: DEFAULT_STATES,
  float: DEFAULT_FLOAT,
});

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
  #getGeneral;
  #episode = 0;
  #episodeLeftSec = 0;
  #baseStrength = 0;
  #baseTarget = 0;
  #episodeTarget = 0;
  #autoDirection = 0;
  #forcedDirection = null;
  #forcedStrength = null;
  #automatic = true;
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
    automatic: true,
    float: DEFAULT_FLOAT,
  };

  // rng: { next(), range(min, max), chance(p) } (dedicated wind stream); getSettings: () => MAP_DB.<id>.weather.wind.
  // getGeneralSettings: () => CONFIG.weather (spec 180 D3: a gust's shape, the rain's and the storm's effect on the
  // wind — the same on every location) or null (defaults).
  constructor({ rng, getSettings, getGeneralSettings = () => null }) {
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
    if (typeof getGeneralSettings !== "function") throw new TypeError("WindModel getGeneralSettings must be a function");
    this.#rng = rng;
    this.#getSettings = getSettings;
    this.#getGeneral = getGeneralSettings;
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds since the last update; rain/storm: 0…1 intensities from WeatherModel.
  update(dtMs, { rain = 0, storm = 0 } = {}) {
    const dtSec = Math.max(0, finiteOr(dtMs, 0)) / 1000;
    const settings = this.#getSettings() || DEFAULT_SETTINGS;

    if (this.#forcedDirection === 0) {
      this.#baseStrength = 0;
      this.#baseTarget = 0;
      this.#autoDirection = 0;
      this.#clearGust();
      this.#sync(0, settings);
      return this.#snapshot;
    }

    const rainLevel = clampUnit(finiteOr(rain, 0));
    const stormLevel = clampUnit(finiteOr(storm, 0));

    if (this.#forcedStrength !== null) {
      // Spec 187 D12, D14: a held strength is the wind's own base; the rain's and the storm's floors and the gusts (by
      // their chances at this level) still act on top of it (only DEV holds the wind; the game never does).
      this.#baseStrength = this.#forcedStrength;
      this.#baseTarget = this.#forcedStrength;
    } else {
      // TK-398: without automatic weather no episodes roll (the base stays where a hold or a direction left it).
      if (this.#automatic) {
        if (this.#episode === 0 || this.#episodeLeftSec <= dtSec) this.#nextEpisode(settings);
        else this.#episodeLeftSec -= dtSec;
      }

      if ((this.#forcedDirection === -1 || this.#forcedDirection === 1) && this.#baseTarget <= WIND_EPS) {
        this.#enterState("light", settings);
      }

      const fadeSec = Math.max(0, finiteOr(settings.fadeSec, DEFAULT_FADE_SEC));
      if (fadeSec <= 0) {
        this.#baseStrength = this.#baseTarget;
      } else if (this.#baseStrength !== this.#baseTarget) {
        const step = dtSec / fadeSec;
        this.#baseStrength =
          this.#baseTarget > this.#baseStrength
            ? Math.min(this.#baseTarget, this.#baseStrength + step)
            : Math.max(this.#baseTarget, this.#baseStrength - step);
      }
    }

    // Spec 180 D3: the rain's and the storm's effect on the wind are general (CONFIG.weather.wind.rain, .storm).
    const general = this.#getGeneral();
    const rainFloor = rainLevel > 0 ? rainLevel * Math.max(0, finiteOr(general?.wind?.rain?.minStrength, 0)) : 0;
    // Spec 187 D7: the storm's floor for the wind — [від, до] by the storm's strength, none with no storm.
    const stormFloor = Math.max(0, effectOfPair(general?.storm?.windMinStrength, 0, stormLevel));
    const rainBonus = rainLevel * Math.max(0, finiteOr(general?.wind?.rain?.bonus, 0));
    const dirFloor =
      this.#forcedStrength === null && (this.#forcedDirection === -1 || this.#forcedDirection === 1)
        ? Math.max(
            0.05,
            Number(pair(settings?.states?.light?.strength, DEFAULT_STATES.light.strength)[0]) || 0.15,
          )
        : 0;
    const boostedBase = clampUnit(Math.max(this.#baseStrength, rainFloor, stormFloor, dirFloor) + rainBonus);

    this.#updateGust(settings, boostedBase, rainLevel, stormLevel, dtSec);
    const strength = clampUnit(boostedBase + this.#gustCurrent);
    this.#sync(strength, settings);
    return this.#snapshot;
  }

  // TK-398: automatic weather on / off; on again: a new episode at once. Spec 187 D12–D14 (owner: «погода застигає»):
  // off — no episodes; the wind's own strength and direction freeze where they are; the rain's and the storm's effect
  // and the gusts (by their chances at this level) still act.
  setAutomatic(on) {
    if ((on !== false) === this.#automatic) return;
    this.#automatic = on !== false;
    if (this.#automatic) this.#episodeLeftSec = 0;
    else if (this.#forcedStrength === null) this.#freezeOwnCourse();
    this.#snapshot.automatic = this.#automatic;
  }

  // The wind's own course without automatic weather: it stays at its strength now (no fade anywhere).
  #freezeOwnCourse() {
    this.#episodeTarget = this.#baseStrength;
    this.#baseTarget = this.#baseStrength;
    this.#episodeLeftSec = 0;
  }

  // Forced direction: -1 (left), 0 (calm: disables wind), 1 (right), or null (automatic).
  setDirectionOverride(direction) {
    const next = direction === -1 || direction === 0 || direction === 1 ? direction : null;
    this.#forcedDirection = next;
    const settings = this.#getSettings() || DEFAULT_SETTINGS;
    if (next === null && !this.#automatic && this.#forcedStrength === null) this.#freezeOwnCourse();
    if (next === 0) {
      this.#forcedStrength = null;
      this.#baseStrength = 0;
      this.#baseTarget = 0;
      this.#autoDirection = 0;
      this.#clearGust();
      this.#sync(0, settings);
      return;
    }
    if ((next === -1 || next === 1) && this.#forcedStrength === null && (this.#snapshot.strength <= WIND_EPS || this.#baseTarget <= WIND_EPS)) {
      this.#enterState("light", settings);
      this.#baseStrength = Math.max(this.#baseStrength, this.#baseTarget * 0.5 || 0.2);
    }
    this.#sync(clampUnit(Math.max(this.#forcedStrength ?? this.#baseStrength, 0) + this.#gustCurrent), settings);
  }

  // Forced strength in 0…1, or null for automatic wind. Setting 0 clears direction to 0.
  setStrengthOverride(strength) {
    const settings = this.#getSettings() || DEFAULT_SETTINGS;
    if (strength === null || strength === undefined || !Number.isFinite(Number(strength))) {
      this.#forcedStrength = null;
      if (!this.#automatic) {
        this.#freezeOwnCourse();
      } else if (this.#episode === 0) {
        this.#nextEpisode(settings);
      } else {
        this.#baseTarget = this.#episodeTarget;
      }
      this.#sync(clampUnit(this.#baseStrength + this.#gustCurrent), settings);
      return;
    }
    const clamped = clampUnit(Number(strength));
    if (clamped <= WIND_EPS) {
      this.#forcedDirection = null;
      this.#autoDirection = 0;
    } else if (this.#forcedDirection === 0) {
      this.#forcedDirection = null;
    }
    this.#forcedStrength = clamped;
    this.#baseStrength = clamped;
    this.#baseTarget = clamped;
    this.#clearGust();
    this.#sync(clamped, settings);
  }

  // Triggers a single smooth global gust right now (DEV button or scripted event).
  triggerGust({ delta = null, durationSec = null } = {}) {
    if (this.#forcedDirection === 0) return false;
    const settings = this.#getSettings() || null;
    const gust = this.#getGeneral()?.wind?.gust; // spec 180 D3: a gust's shape is general
    const rolledDelta = delta !== null && Number.isFinite(Number(delta))
      ? Math.max(0, Number(delta))
      : clampUnit(this.#roll(pair(gust?.deltaRange, [0.12, 0.3])));
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
    this.#sync(clampUnit((this.#forcedStrength ?? this.#baseStrength) + this.#gustCurrent));
    return this.#gustActive;
  }

  #nextEpisode(settings) {
    const states = settings?.states;
    const hasCustomStates = Boolean(states && typeof states === "object");
    const disallowCalm = this.#forcedDirection === -1 || this.#forcedDirection === 1;
    let total = 0;
    for (let index = 0; index < WIND_STATES.length; index += 1) {
      const name = WIND_STATES[index];
      if (disallowCalm && name === "calm") continue;
      const weight = hasCustomStates
        ? Math.max(0, finiteOr(states[name]?.weight, 0))
        : DEFAULT_STATES[name].weight;
      total += weight;
    }
    let picked = disallowCalm ? "light" : "calm";
    if (total > 0) {
      let roll = this.#rng.next() * total;
      for (let index = 0; index < WIND_STATES.length; index += 1) {
        const name = WIND_STATES[index];
        if (disallowCalm && name === "calm") continue;
        const weight = hasCustomStates
          ? Math.max(0, finiteOr(states[name]?.weight, 0))
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
    this.#episodeTarget = state === "calm" ? 0 : clampUnit(this.#roll(pair(entry.strength, DEFAULT_STATES[state].strength)));
    this.#baseTarget = this.#episodeTarget;
  }

  #updateGust(settings, boostedBase, rainLevel, stormLevel, dtSec) {
    if (this.#gustActive) {
      this.#updateActiveGust(dtSec, settings);
      return;
    }
    // Spec 187 D14: the gusts roll by their chances at the wind's level, with or without automatic weather.
    if (dtSec <= 0 || (boostedBase <= 0.02 && stormLevel <= 0)) {
      this.#gustCurrent = 0;
      return;
    }
    const gust = settings?.gust;
    const general = this.#getGeneral();
    const baseChance = Math.max(0, finiteOr(gust?.chancePerSec, 0.14));
    const rainMult = 1 + rainLevel * Math.max(0, finiteOr(general?.wind?.rain?.gustChanceMult, 1.5));
    const stormMult = Math.max(0, effectOfPair(general?.storm?.gustChanceMult, 1, stormLevel));
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
    const u = clampUnit(this.#gustAgeSec / this.#gustDurationSec);
    if (u >= 1) {
      this.#clearGust();
      return;
    }
    const attackShare = Math.min(0.8, Math.max(0.05, finiteOr(this.#getGeneral()?.wind?.gust?.attackShare, 0.25)));
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

  #sync(rawStrength, settings = this.#getSettings() || DEFAULT_SETTINGS) {
    const strength = rawStrength <= WIND_EPS ? 0 : clampUnit(rawStrength);
    if (this.#forcedDirection === null) {
      if (strength <= 0) this.#autoDirection = 0;
      else if (this.#autoDirection === 0) this.#autoDirection = this.#pickDirection();
    }
    const direction = this.#forcedDirection !== null ? this.#forcedDirection : this.#autoDirection;
    const snapshot = this.#snapshot;
    snapshot.strength = direction === 0 ? 0 : strength;
    snapshot.direction = snapshot.strength <= 0 ? 0 : direction;
    snapshot.baseStrength = clampUnit(this.#baseStrength);
    snapshot.gustStrength = Math.max(0, this.#gustCurrent);
    snapshot.targetStrength = clampUnit(this.#forcedStrength ?? this.#baseTarget);
    snapshot.state = classifyState(snapshot.strength);
    snapshot.episode = this.#episode;
    snapshot.episodeLeftSec = Math.max(0, this.#episodeLeftSec);
    snapshot.isGusting = this.#gustActive && snapshot.gustStrength > WIND_EPS;
    snapshot.forcedDirection = this.#forcedDirection;
    snapshot.forcedStrength = this.#forcedStrength;
    snapshot.float = settings?.float ?? DEFAULT_FLOAT;
  }
}
