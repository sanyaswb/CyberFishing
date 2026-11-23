import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { WeatherEventTimeline } from "./weather_event_timeline.js";

// Spec 179 (stage A, TK-321.1) and spec 180 D13 (TK-325): the location's emission and radiation.
// - An emission starts by chance, like a bite: while idle the model rolls once every checkIntervalSec (real seconds);
//   nothing holds the moment of the next emission. The chance is chancePerCheck + chanceGrowthPerCheck × failed rolls
//   since the last emission; no rolls during cooldownSec after the session's start and after each emission, nor while
//   canStart() is false (its background has not loaded, spec 179 D4).
// - Its course is the weather events' timeline (WeatherEventTimeline), rolled whole at the start: durationSec, peak
//   start and length (shares of the duration) and peak strength. The intensity rises to the peak, holds and falls
//   (smoothstep). The phases the views read follow it: onset (before the peak), peak, fade (after it), idle.
// - Radiation (0…1): base + (emissionPeak − base) × intensity; a DEV or script override replaces it until cleared.
// The rng is the emission's own stream. Settings are read live (MAP_DB.<id>.weather: `emission`, `radiation`); nothing
// is allocated per update; snapshot is one object rewritten in place.
const PHASES = Object.freeze(["idle", "onset", "peak", "fade"]);
const PHASE_OF = Object.freeze({ rise: "onset", peak: "peak", fall: "fade", idle: "idle" });


export class EmissionModel {
  #rng;
  #getSettings;
  #canStart;
  #timeline = new WeatherEventTimeline();
  #active = false;
  #elapsedSec = 0;
  #cooldownLeftSec = null;
  #checkLeftSec = 0;
  #failedChecks = 0;
  #frozen = false;
  #automatic = true;
  #radiationOverride = null;
  #intensityHold = null;
  #snapshot = {
    phase: "idle",
    phaseLeftSec: 0,
    phaseDurationSec: 0,
    elapsedSec: 0,
    durationSec: 0,
    peakStartSec: 0,
    peakEndSec: 0,
    peakStrength: 0,
    intensity: 0,
    radiation: 0,
    serial: 0,
    chance: 0,
    failedChecks: 0,
    cooldownLeftSec: 0,
    frozen: false,
    radiationForced: false,
    intensityHeld: false,
    automatic: true,
  };

  // rng: { next(), range(min, max) } (the emission's own seeded stream); getSettings: () => MAP_DB.<id>.weather (or null:
  // no emission, radiation 0); canStart: () => boolean, whether an emission may begin now; while false the rolls wait
  // (none is counted as failed).
  constructor({ rng, getSettings, canStart = () => true }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function") {
      throw new TypeError("EmissionModel requires an rng");
    }
    if (typeof getSettings !== "function") throw new TypeError("EmissionModel requires getSettings");
    if (typeof canStart !== "function") throw new TypeError("EmissionModel canStart must be a function");
    this.#rng = rng;
    this.#getSettings = getSettings;
    this.#canStart = canStart;
    this.#sync(this.#getSettings() || null);
  }

  get snapshot() {
    return this.#snapshot;
  }

  // dtMs: real milliseconds since the last update.
  update(dtMs) {
    const settings = this.#getSettings() || null;
    const emission = settings?.emission;
    const dtSec = Math.max(0, finiteOr(dtMs, 0)) / 1000;
    if (this.#cooldownLeftSec === null) this.#startIdle(emission);
    if (!this.#frozen) {
      if (this.#active) {
        this.#elapsedSec += dtSec;
        if (this.#elapsedSec >= this.#timeline.durationSec) this.#end(emission);
      } else {
        this.#updateIdle(emission, dtSec);
      }
    }
    this.#sync(settings);
  }

  // DEV, scripted emission: "onset" starts a new emission, "peak" / "fade" jump to the peak / its end on the current
  // one (starting one first if none runs), "idle" ends it (the cooldown starts).
  force(phase) {
    if (!PHASES.includes(phase)) return false;
    const emission = this.#getSettings()?.emission;
    if (this.#cooldownLeftSec === null) this.#startIdle(emission);
    if (phase === "idle") {
      if (this.#active) this.#end(emission);
    } else {
      this.#intensityHold = null;
      if (phase === "onset" || !this.#active) this.#begin(emission);
      if (phase === "peak") this.#elapsedSec = this.#timeline.peakStartSec;
      if (phase === "fade") this.#elapsedSec = this.#timeline.peakEndSec + 1e-3;
    }
    this.#sync(this.#getSettings() || null);
    return true;
  }

  // Frozen: the emission's time stops (its intensity stays where it is).
  setFrozen(frozen) {
    this.#frozen = frozen === true;
    this.#sync(this.#getSettings() || null);
  }

  // Spec 180 D4: the emission's intensity 0…1 held by hand (DEV: tune its look at a steady strength); null releases it.
  // While held, the phase shown is "peak" (> 0) or "idle" (0), so the screen, the cast gate and the radiation follow.
  holdIntensity(intensity) {
    this.#intensityHold = intensity === null || !Number.isFinite(Number(intensity)) ? null : clampUnit(Number(intensity));
    this.#sync(this.#getSettings() || null);
  }

  // Radiation 0…1 held by hand (DEV, tests); null returns to base + emission.
  setRadiationOverride(radiation) {
    this.#radiationOverride = radiation === null || !Number.isFinite(Number(radiation))
      ? null : clampUnit(Number(radiation));
    this.#sync(this.#getSettings() || null);
  }

  // TK-398: automatic on / off — off: no rolls and the running emission ends; force() and holdIntensity() still work.
  setAutomatic(on) {
    this.#automatic = on !== false;
    const emission = this.#getSettings()?.emission;
    if (this.#cooldownLeftSec === null) this.#startIdle(emission);
    if (!this.#automatic && this.#active) this.#end(emission);
    this.#sync(this.#getSettings() || null);
  }

  // The rolls run only past the cooldown, one per checkIntervalSec of idle time; a disabled emission never rolls.
  #updateIdle(emission, dtSec) {
    if (emission?.enabled === false || !this.#automatic) return;
    let left = dtSec;
    if (this.#cooldownLeftSec > 0) {
      const spent = Math.min(left, this.#cooldownLeftSec);
      this.#cooldownLeftSec -= spent;
      left -= spent;
    }
    if (this.#cooldownLeftSec > 0 || left <= 0) return;
    this.#checkLeftSec -= left;
    if (this.#checkLeftSec > 0) return;
    this.#checkLeftSec = Math.max(1, finiteOr(emission?.checkIntervalSec, 60));
    if (!this.#canStart()) return;
    if (this.#rng.next() < this.#chance(emission)) this.#begin(emission);
    else this.#failedChecks += 1;
  }

  #chance(emission) {
    return clampUnit(Math.max(0, finiteOr(emission?.chancePerCheck, 0)) +
      Math.max(0, finiteOr(emission?.chanceGrowthPerCheck, 0)) * this.#failedChecks);
  }

  #startIdle(emission) {
    this.#cooldownLeftSec = Math.max(0, finiteOr(emission?.cooldownSec, 0));
    this.#checkLeftSec = Math.max(1, finiteOr(emission?.checkIntervalSec, 60));
    this.#failedChecks = 0;
  }

  #begin(emission) {
    this.#timeline.roll(emission, this.#rng);
    this.#active = true;
    this.#elapsedSec = 0;
    this.#snapshot.serial += 1;
  }

  #end(emission) {
    this.#active = false;
    this.#elapsedSec = 0;
    this.#startIdle(emission);
  }

  #sync(settings) {
    const snapshot = this.#snapshot;
    const timeline = this.#timeline;
    const own = this.#active ? clampUnit(timeline.strengthAt(this.#elapsedSec)) : 0;
    const intensity = this.#intensityHold ?? own;
    const base = clampUnit(finiteOr(settings?.radiation?.base, 0));
    const peak = clampUnit(finiteOr(settings?.radiation?.emissionPeak, 1));
    const phase = this.#intensityHold !== null ? (this.#intensityHold > 0 ? "peak" : "idle")
      : this.#active ? PHASE_OF[timeline.phaseAt(this.#elapsedSec)] : "idle";
    snapshot.phase = phase;
    const [phaseStart, phaseEnd] = phase === "onset" ? [0, timeline.peakStartSec]
      : phase === "peak" ? [timeline.peakStartSec, timeline.peakEndSec]
        : phase === "fade" ? [timeline.peakEndSec, timeline.durationSec] : [0, 0];
    snapshot.phaseDurationSec = phaseEnd - phaseStart;
    snapshot.phaseLeftSec = this.#active ? Math.max(0, phaseEnd - this.#elapsedSec) : 0;
    snapshot.elapsedSec = this.#active ? this.#elapsedSec : 0;
    snapshot.durationSec = this.#active ? timeline.durationSec : 0;
    snapshot.peakStartSec = this.#active ? timeline.peakStartSec : 0;
    snapshot.peakEndSec = this.#active ? timeline.peakEndSec : 0;
    snapshot.peakStrength = this.#active ? timeline.peakStrength : 0;
    snapshot.intensity = intensity;
    snapshot.radiation = this.#radiationOverride ?? clampUnit(base + (peak - base) * intensity);
    snapshot.chance = this.#active || !this.#automatic ? 0 : this.#chance(settings?.emission);
    snapshot.automatic = this.#automatic;
    snapshot.failedChecks = this.#failedChecks;
    snapshot.cooldownLeftSec = Math.max(0, this.#cooldownLeftSec ?? 0);
    snapshot.frozen = this.#frozen;
    snapshot.radiationForced = this.#radiationOverride !== null;
    snapshot.intensityHeld = this.#intensityHold !== null;
  }
}
