import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { isItemBroken } from "../../domain/items/condition/item_condition_quality.js";

// Spec 185 D3, D4, D7, D8 (TK-382): the gas mask protects through its filters.
// - Filters work one at a time (owner Q1): the one with less time left; the other waits. A filter's time is its charge
//   (capacityUnits seconds), spent 1 unit a second by DevicePowerService (pending units, a write every saveIntervalSeconds
//   and on flush) — only while the mask filters (owner Q2: on the location under radiation above 0 or an emission) and
//   only while the mask is whole: a broken mask stops its filters (owner: «вони нічого вже не фільтрують»).
// - Protection: a whole mask with a filter that has time left. The gas mask's status (`gasMask`) is held with the
//   filter's own modifiers: the emission's darkening and blur keep 1 − emissionResistance, the radiation's hiss
//   1 − radiationResistance. When the protection ends (the mask cracks to 0, the last filter runs out, the mask leaves
//   its slot) the effects come back smoothly over breakFadeSec (owner Q3); it returns at once when the mask protects.
// - The cast during an emission needs that protection (owner Q4): isProtecting(); problem() says what is missing.
// Per frame it reads the cached equipment model and the filters' readings, writes four numbers only when they change and
// allocates nothing.
const NO_FILTERS = Object.freeze([]);

export class GasMaskProtection {
  #getEquipped;
  #power;
  #statuses;
  #getSettings;
  #statusId;
  #protection = 0;
  #emission = 1;
  #radiation = 0.5;
  #activeFilterId = null;
  // The status's own modifiers, changed in place (PlayerStatusEffects reads them with every modifier() call).
  #modifiers = { emission: { vignette: 1, blur: 1, blurRate: 1 }, radiation: { grain: 1 } };

  // getEquipped: () => the equipment read model ({ gasMask, gasMaskFilters }); power: DevicePowerService ({ consume });
  // statuses: PlayerStatusEffects ({ hold }); getSettings: () => CONFIG.emission.gasMask.
  constructor({ getEquipped, power, statuses, getSettings, statusId = "gasMask" }) {
    if (typeof getEquipped !== "function") throw new TypeError("GasMaskProtection requires getEquipped");
    if (typeof power?.consume !== "function") throw new TypeError("GasMaskProtection requires power");
    if (typeof statuses?.hold !== "function") throw new TypeError("GasMaskProtection requires statuses");
    if (typeof getSettings !== "function") throw new TypeError("GasMaskProtection requires getSettings");
    this.#getEquipped = getEquipped;
    this.#power = power;
    this.#statuses = statuses;
    this.#getSettings = getSettings;
    this.#statusId = statusId;
  }

  // 0…1: how much of the filter's protection acts now (1 — full, less while the effects come back).
  get protection() {
    return this.#protection;
  }

  // The filter that filters now (its instance id) or null.
  get activeFilterId() {
    return this.#activeFilterId;
  }

  // dtMs: the frame; filtering: the player is on the location and the radiation is above 0 or an emission is on.
  update(dtMs, filtering) {
    const dt = Math.max(0, finiteOr(dtMs, 0));
    const mask = this.#mask();
    const working = Boolean(mask) && !isItemBroken(mask);
    const active = working ? this.#activeFilter() : null;
    this.#activeFilterId = active?.instanceId ?? null;
    if (active && filtering && dt > 0) {
      this.#power.consume({ deviceId: mask.instanceId, batteryInstanceId: active.instanceId, unitsPerSecond: 1,
        seconds: dt / 1000 });
    }
    if (active) {
      this.#emission = clampUnit(finiteOr(active.effectiveStats?.emissionResistance, 1));
      this.#radiation = clampUnit(finiteOr(active.effectiveStats?.radiationResistance, 0.5));
    }
    const protecting = Boolean(active) && this.#percent(active) > 0;
    const fadeSec = Math.max(0, finiteOr(this.#getSettings()?.breakFadeSec, 10));
    const next = protecting ? 1 : fadeSec > 0 ? Math.max(0, this.#protection - dt / (fadeSec * 1000)) : 0;
    this.#apply(next);
  }

  // Spec 185 D8 (owner Q4): a whole gas mask with a filter that has time left.
  isProtecting() {
    const mask = this.#mask();
    return Boolean(mask) && !isItemBroken(mask) && this.#activeFilter() !== null;
  }

  // What keeps the mask from protecting: "missing" (no mask in its slot), "broken", "noFilter" (none with time left), or
  // null when it protects.
  problem() {
    const mask = this.#mask();
    if (!mask) return "missing";
    if (isItemBroken(mask)) return "broken";
    return this.#activeFilter() === null ? "noFilter" : null;
  }

  // A filter's time left, s (its pending use included), or 0.
  secondsLeft(filter) {
    const units = Math.max(0, finiteOr(filter?.effectiveStats?.capacityUnits, 0));
    return units * this.#percent(filter) / 100;
  }

  dispose() {
    this.#apply(0);
  }

  #mask() {
    return this.#getEquipped()?.gasMask || null;
  }

  // Owner Q1: of the filters with time left, the one with the least.
  #activeFilter() {
    const filters = this.#getEquipped()?.gasMaskFilters ?? NO_FILTERS;
    let active = null;
    let least = Infinity;
    for (let index = 0; index < filters.length; index += 1) {
      const filter = filters[index];
      if (!filter) continue;
      const percent = this.#percent(filter);
      if (percent > 0 && percent < least) {
        least = percent;
        active = filter;
      }
    }
    return active;
  }

  // A zero-second use returns the filter's reading with its pending units, without spending anything.
  #percent(filter) {
    return finiteOr(this.#power.consume({ batteryInstanceId: filter.instanceId, unitsPerSecond: 1, seconds: 0 })?.percent, 0);
  }

  #apply(protection) {
    const emission = 1 - this.#emission * protection;
    const radiation = 1 - this.#radiation * protection;
    const modifiers = this.#modifiers;
    if (protection === this.#protection && modifiers.emission.vignette === emission && modifiers.radiation.grain === radiation) {
      return;
    }
    this.#protection = protection;
    modifiers.emission.vignette = emission;
    modifiers.emission.blur = emission;
    modifiers.radiation.grain = radiation;
    this.#statuses.hold(this.#statusId, protection > 0, { source: "gasMask", modifiers });
  }
}
