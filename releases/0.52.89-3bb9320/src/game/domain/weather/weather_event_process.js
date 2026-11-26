import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { WeatherEventTimeline } from "./weather_event_timeline.js";

// Spec 180 D1, D2, D13: one weather phenomenon (rain, storm, fog) as an independent process.
// - Idle: past its cooldown, once every checkIntervalSec it rolls chancePerCheck + chanceGrowthPerCheck × failed rolls
//   (× the caller's chanceMult, e.g. a storm raising the rain's chance). Nothing holds the time of the next event.
// - Active: the event's whole timeline (WeatherEventTimeline) is rolled at its start; the strength follows it (× the
//   caller's strengthMult). The event ends when the timeline does, or early when it is no longer allowed; then the
//   cooldown runs.
// - Its own time (spec 180 D17, TK-336): the checks, the timeline and the cooldown run timeScale times faster than real
//   time (fog lives in game time); the shown strength always eases in real seconds, so nothing pops.
// - A floor (an emission holding a storm) raises the strength without starting or ending anything.
// - Manual hold (DevTools, scripts): hold(strength) pins this process only; hold(null) returns it to its own course.
//   No other process is touched: there is no shared freeze (the cause of the storm switch defect, spec 180).
// The shown strength moves toward its target at most 1 / smoothSec per second, so a hold, a release or an early end
// never jumps. Settings are read live; nothing is allocated per update; snapshot is rewritten in place.
// TK-398: automatic off — no checks are rolled (an event started by hand still runs its timeline); turning it off ends
// the running event. snapshot.target is the strength the process heads for now (held, or its own and the floor), kept
// true by hold() and stop() too, so a view knows at once that an element was switched off.
const DEFAULT_SMOOTH_SEC = 6;

export class WeatherEventProcess {
  #rng;
  #getSettings;
  #timeline = new WeatherEventTimeline();
  #active = false;
  #elapsedSec = 0;
  #cooldownLeftSec = 0;
  #checkLeftSec = null;
  #failedChecks = 0;
  #held = null;
  #smoothSecOverride = null;
  #automatic = true;
  // The last update's floor and strength multiplier (the target between updates).
  #floor = 0;
  #strengthMult = 1;
  #snapshot = {
    active: false,
    phase: "idle",
    strength: 0,
    target: 0,
    elapsedSec: 0,
    durationSec: 0,
    peakStartSec: 0,
    peakEndSec: 0,
    peakStrength: 0,
    chance: 0,
    failedChecks: 0,
    cooldownLeftSec: 0,
    held: false,
    automatic: true,
    serial: 0,
  };

  // rng: { next(), range(min, max) } (the weather's stream); getSettings: () => this process's settings block or null.
  constructor({ rng, getSettings }) {
    if (typeof rng?.next !== "function" || typeof rng?.range !== "function") throw new TypeError("WeatherEventProcess requires an rng");
    if (typeof getSettings !== "function") throw new TypeError("WeatherEventProcess requires getSettings");
    this.#rng = rng;
    this.#getSettings = getSettings;
  }

  get snapshot() {
    return this.#snapshot;
  }

  get timeline() {
    return this.#timeline;
  }

  // Did the last update start a new event (the storm rolls its lightning then)?
  get startedSerial() {
    return this.#snapshot.serial;
  }

  // dtSec: real seconds; allowed: may an event run now; chanceMult / strengthMult: other processes' effect; floor: a
  // minimum strength (0…1) held from outside; timeScale: how fast this process's own time runs (1: real seconds).
  update(dtSec, allowed = true, chanceMult = 1, strengthMult = 1, floor = 0, timeScale = 1) {
    const settings = this.#getSettings() || null;
    const dt = Math.max(0, finiteOr(dtSec, 0));
    const eventDt = dt * Math.max(0, finiteOr(timeScale, 1));
    if (this.#checkLeftSec === null) this.#checkLeftSec = Math.max(1, finiteOr(settings?.checkIntervalSec, 60));
    if (this.#active) {
      this.#elapsedSec += eventDt;
      if (this.#elapsedSec >= this.#timeline.durationSec || !allowed) this.#end(settings);
    } else if (allowed && this.#automatic && settings?.enabled !== false) {
      this.#rollIdle(settings, eventDt, chanceMult);
    }
    this.#strengthMult = Math.max(0, finiteOr(strengthMult, 1));
    this.#floor = clampUnit(finiteOr(floor, 0));
    const target = this.#target();
    const snapshot = this.#snapshot;
    const smoothSec = this.#smoothSecOverride ?? Math.max(0, finiteOr(settings?.smoothSec, DEFAULT_SMOOTH_SEC));
    snapshot.strength = smoothSec <= 0 ? target
      : snapshot.strength < target ? Math.min(target, snapshot.strength + dt / smoothSec)
        : Math.max(target, snapshot.strength - dt / smoothSec);
    // TK-358: a hold's fade lasts while held and until the release has arrived; then the settings' smoothSec again.
    if (this.#held === null && this.#smoothSecOverride !== null && snapshot.strength === target) this.#smoothSecOverride = null;
    this.#sync(settings, chanceMult);
  }

  // Starts an event now (DEV, initial weather, scripts); peakStrength (0…1 or null: rolled); atPeak: begin at the peak.
  start({ peakStrength = null, atPeak = false } = {}) {
    const settings = this.#getSettings() || null;
    this.#begin(settings, peakStrength);
    if (atPeak) {
      this.#elapsedSec = this.#timeline.peakStartSec;
      this.#snapshot.strength = this.#timeline.peakStrength;
    }
    this.#sync(settings, 1);
  }

  // Ends the running event now (its strength fades over smoothSec); the cooldown starts.
  stop() {
    const settings = this.#getSettings() || null;
    if (this.#active) this.#end(settings);
    this.#sync(settings, 1);
  }

  // strength 0…1 pins this process; null returns it to its own course. fadeSec (null: the settings') sets how fast
  // the shown strength moves while held and right after.
  hold(strength, { fadeSec = null } = {}) {
    this.#held = strength === null || !Number.isFinite(Number(strength)) ? null : clampUnit(Number(strength));
    this.#smoothSecOverride = fadeSec === null || !Number.isFinite(Number(fadeSec)) ? null : Math.max(0, Number(fadeSec));
    this.#snapshot.held = this.#held !== null;
    this.#snapshot.target = this.#target();
  }

  // TK-398: on — the checks roll as usual. Spec 187 D12, D13 (owner: «погода застигає»): off — no checks, and the
  // strength freezes where it is (held at it unless already held); the running event's timeline ends (no fade).
  setAutomatic(on) {
    const automatic = on !== false;
    if (automatic === this.#automatic) return;
    this.#automatic = automatic;
    if (!automatic) {
      // Nothing to freeze at zero: without checks it stays there (an emission's floor may still raise it).
      if (this.#held === null && this.#snapshot.strength > 0) this.hold(this.#snapshot.strength, { fadeSec: 0 });
      this.stop();
    }
    this.#snapshot.automatic = this.#automatic;
  }

  #target() {
    const own = this.#active ? clampUnit(this.#timeline.strengthAt(this.#elapsedSec) * this.#strengthMult) : 0;
    return this.#held ?? Math.max(own, this.#floor);
  }

  #rollIdle(settings, dt, chanceMult) {
    let left = dt;
    if (this.#cooldownLeftSec > 0) {
      const spent = Math.min(left, this.#cooldownLeftSec);
      this.#cooldownLeftSec -= spent;
      left -= spent;
    }
    if (this.#cooldownLeftSec > 0 || left <= 0) return;
    this.#checkLeftSec -= left;
    if (this.#checkLeftSec > 0) return;
    this.#checkLeftSec = Math.max(1, finiteOr(settings?.checkIntervalSec, 60));
    if (this.#rng.next() < this.#chance(settings, chanceMult)) this.#begin(settings, null);
    else this.#failedChecks += 1;
  }

  #begin(settings, peakStrength) {
    this.#timeline.roll(settings, this.#rng, peakStrength);
    this.#active = true;
    this.#elapsedSec = 0;
    this.#failedChecks = 0;
    this.#cooldownLeftSec = 0;
    this.#snapshot.serial += 1;
  }

  #end(settings) {
    this.#active = false;
    this.#elapsedSec = 0;
    this.#cooldownLeftSec = Math.max(0, finiteOr(settings?.cooldownSec, 0));
    this.#checkLeftSec = Math.max(1, finiteOr(settings?.checkIntervalSec, 60));
    this.#failedChecks = 0;
  }

  #chance(settings, chanceMult) {
    const base = Math.max(0, finiteOr(settings?.chancePerCheck, 0)) +
      Math.max(0, finiteOr(settings?.chanceGrowthPerCheck, 0)) * this.#failedChecks;
    return clampUnit(base * Math.max(0, finiteOr(chanceMult, 1)));
  }

  #sync(settings, chanceMult) {
    const snapshot = this.#snapshot;
    const timeline = this.#timeline;
    snapshot.active = this.#active;
    snapshot.phase = this.#active ? timeline.phaseAt(this.#elapsedSec) : "idle";
    snapshot.elapsedSec = this.#active ? this.#elapsedSec : 0;
    snapshot.durationSec = this.#active ? timeline.durationSec : 0;
    snapshot.peakStartSec = this.#active ? timeline.peakStartSec : 0;
    snapshot.peakEndSec = this.#active ? timeline.peakEndSec : 0;
    snapshot.peakStrength = this.#active ? timeline.peakStrength : 0;
    snapshot.chance = this.#active || !this.#automatic ? 0 : this.#chance(settings, chanceMult);
    snapshot.failedChecks = this.#failedChecks;
    snapshot.cooldownLeftSec = Math.max(0, this.#cooldownLeftSec);
    snapshot.held = this.#held !== null;
    snapshot.automatic = this.#automatic;
    snapshot.target = this.#target();
  }
}
