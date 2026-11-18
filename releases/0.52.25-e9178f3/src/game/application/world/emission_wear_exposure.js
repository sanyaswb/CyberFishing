import { meanFullEmissionDoseSec } from "../../domain/weather/emission_dose.js";

// Spec 179 D10 (TK-370, owner Q5): the items wear gradually all the time the location's radiation is above zero. A frame
// adds its share of one average full emission (radiation × seconds / that emission's dose, from the location's live
// weather settings); the inventory gets it once every applyEverySec (one transaction and one save), also the rest after
// the radiation ends. Each item has its own random roll in its quality's range: a new one at the start of every
// emission (the radiation rising from 0), and again after every whole emission's worth of exposure. The rolls come from
// the session's own `:wear` stream (the bite and the weather do not shift). Without radiation and nothing gathered a
// frame does nothing. Only frames of play on the location call it (not the house).
export class EmissionWearExposure {
  #inventory;
  #getWeather;
  #getSettings;
  #rng;
  #rolls = new Map();
  #rollFor = (instanceId) => this.#roll(instanceId);
  #pending = 0;
  #sinceRoll = 0;
  #elapsedMs = 0;
  #radiating = false;

  // inventory: { applyRadiationWear(exposure, rollFor, settings) }; getWeather() → MAP_DB.<id>.weather (live);
  // getSettings() → CONFIG.emission.wear (live); rng: { next() } — the session's wear stream.
  constructor({ inventory, getWeather, getSettings, rng }) {
    if (typeof inventory?.applyRadiationWear !== "function") throw new TypeError("EmissionWearExposure requires inventory");
    if (typeof getWeather !== "function" || typeof getSettings !== "function")
      throw new TypeError("EmissionWearExposure requires getWeather and getSettings");
    if (typeof rng?.next !== "function") throw new TypeError("EmissionWearExposure requires rng");
    this.#inventory = inventory;
    this.#getWeather = getWeather;
    this.#getSettings = getSettings;
    this.#rng = rng;
  }

  get pendingExposure() { return this.#pending; }

  // dtMs: the frame; radiation: the location's (0…1). True when the gathered wear reached the inventory this frame.
  update(dtMs, radiation) {
    const r = Number.isFinite(radiation) ? Math.max(0, Math.min(1, radiation)) : 0;
    if (r > 0 && !this.#radiating) { this.#rolls.clear(); this.#sinceRoll = 0; }
    this.#radiating = r > 0;
    if (r <= 0 && this.#pending === 0) return false;
    const settings = this.#getSettings();
    if (settings.enabled === false) { this.#pending = 0; this.#elapsedMs = 0; return false; }
    const dt = Math.max(0, Number(dtMs) || 0);
    const share = r * dt / 1000 / meanFullEmissionDoseSec(this.#getWeather());
    this.#pending += share;
    this.#sinceRoll += share;
    this.#elapsedMs += dt;
    if (this.#elapsedMs < settings.applyEverySec * 1000) return false;
    return this.flush();
  }

  // Applies what was gathered (also before the player leaves the location).
  flush() {
    const exposure = this.#pending;
    this.#pending = 0;
    this.#elapsedMs = 0;
    if (!(exposure > 0)) return false;
    this.#inventory.applyRadiationWear(exposure, this.#rollFor, this.#getSettings());
    if (this.#sinceRoll >= 1) { this.#sinceRoll = 0; this.#rolls.clear(); }
    return true;
  }

  #roll(instanceId) {
    let roll = this.#rolls.get(instanceId);
    if (roll === undefined) { roll = this.#rng.next(); this.#rolls.set(instanceId, roll); }
    return roll;
  }
}
