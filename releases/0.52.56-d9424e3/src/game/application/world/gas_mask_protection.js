import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";
import { isItemBroken } from "../../domain/items/condition/item_condition_quality.js";
import { gasMaskCrackStage } from "../../domain/items/condition/gas_mask_cracks.js";

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
// - D5 (TK-383): while a filter filters, the mask wears by its quality — 100 → 0 in wearSecPerQuality × quality seconds
//   (quality 3: 5 min); the wear gathers and goes into the inventory every wearWriteEverySec, at once when it would crack
//   the mask, and on flush() (the page hides, the house). The authored quality counts (baseQuality), not the worn one.
// Per frame it reads the cached equipment model and the filters' readings, writes four numbers only when they change and
// allocates nothing.
const NO_FILTERS = Object.freeze([]);

export class GasMaskProtection {
  #getEquipped;
  #power;
  #statuses;
  #inventory;
  #getSettings;
  #statusId;
  #protection = 0;
  #wearMaskId = null;
  #pendingWear = 0;
  #wearElapsedMs = 0;
  #reading = { worn: false, condition: 0, stage: 0, filterSec: 0, protecting: false };
  #emission = 1;
  #radiation = 0.5;
  #activeFilterId = null;
  // The status's own modifiers, changed in place (PlayerStatusEffects reads them with every modifier() call).
  #modifiers = { emission: { vignette: 1, blur: 1, blurRate: 1 }, radiation: { grain: 1 } };
  // TK-382.1: the requests reused every frame (the filter's use; the status's hold while the effects come back).
  #use = { deviceId: null, batteryInstanceId: null, unitsPerSecond: 1, seconds: 0 };
  #holdOptions = { source: "gasMask", modifiers: this.#modifiers };

  // getEquipped: () => the equipment read model ({ gasMask, gasMaskFilters }); power: DevicePowerService ({ consume });
  // statuses: PlayerStatusEffects ({ hold }); inventory: { wearItem(instanceId, points) } (PlayerInventory);
  // getSettings: () => CONFIG.emission.gasMask.
  constructor({ getEquipped, power, statuses, inventory, getSettings, statusId = "gasMask" }) {
    if (typeof getEquipped !== "function") throw new TypeError("GasMaskProtection requires getEquipped");
    if (typeof power?.consume !== "function" || typeof power?.reading !== "function") {
      throw new TypeError("GasMaskProtection requires power");
    }
    if (typeof statuses?.hold !== "function") throw new TypeError("GasMaskProtection requires statuses");
    if (typeof inventory?.wearItem !== "function") throw new TypeError("GasMaskProtection requires inventory");
    if (typeof getSettings !== "function") throw new TypeError("GasMaskProtection requires getSettings");
    this.#getEquipped = getEquipped;
    this.#power = power;
    this.#statuses = statuses;
    this.#inventory = inventory;
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
    const settings = this.#getSettings();
    if (active && filtering && dt > 0) {
      const use = this.#use;
      use.deviceId = mask.instanceId;
      use.batteryInstanceId = active.instanceId;
      use.seconds = dt / 1000;
      this.#power.consume(use);
      this.#wear(mask, dt, settings);
    }
    if (active) {
      this.#emission = clampUnit(finiteOr(active.effectiveStats?.emissionResistance, 1));
      this.#radiation = clampUnit(finiteOr(active.effectiveStats?.radiationResistance, 0.5));
    }
    const protecting = Boolean(active) && this.#percent(active) > 0;
    const fadeSec = Math.max(0, finiteOr(settings?.breakFadeSec, 10));
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

  // Spec 185 D6 (TK-384): what the HUD indicator shows — one reused record: worn, condition 0…100, crack stage (0 whole …
  // the last threshold), the filters' time left together (s), whether it protects.
  read() {
    const reading = this.#reading;
    const mask = this.#mask();
    reading.worn = Boolean(mask);
    reading.condition = mask ? Math.max(0, Math.min(100, finiteOr(mask.effectiveStats?.durability, 100))) : 0;
    reading.stage = mask ? gasMaskCrackStage(reading.condition, this.#getSettings()?.crackAtPercent) : 0;
    let seconds = 0;
    const filters = mask ? this.#getEquipped()?.gasMaskFilters ?? NO_FILTERS : NO_FILTERS;
    for (let index = 0; index < filters.length; index += 1) if (filters[index]) seconds += this.secondsLeft(filters[index]);
    reading.filterSec = seconds;
    reading.protecting = this.isProtecting();
    return reading;
  }

  // A filter's time left, s (its pending use included), or 0.
  secondsLeft(filter) {
    const units = Math.max(0, finiteOr(filter?.effectiveStats?.capacityUnits, 0));
    return units * this.#percent(filter) / 100;
  }

  // Writes the gathered wear (the page hides, the player goes into the house).
  flush() {
    const points = this.#pendingWear;
    const maskId = this.#wearMaskId;
    this.#pendingWear = 0;
    this.#wearElapsedMs = 0;
    if (maskId && points > 0) this.#inventory.wearItem(maskId, points);
  }

  // The page's hide (its flush) writes the wear before a teardown; dispose only lets the status go.
  dispose() {
    this.#apply(0);
  }

  // D5: wearSecPerQuality × quality seconds from 100 to 0; written in steps, at once when it would crack the mask.
  #wear(mask, dt, settings) {
    if (mask.instanceId !== this.#wearMaskId) {
      this.flush();
      this.#wearMaskId = mask.instanceId;
    }
    const stats = mask.effectiveStats || {};
    const quality = Math.max(1, finiteOr(stats.baseQuality ?? stats.quality, 1));
    const fullSec = Math.max(1, finiteOr(settings?.wearSecPerQuality, 100)) * quality;
    this.#pendingWear += dt / 1000 / fullSec * 100;
    this.#wearElapsedMs += dt;
    const condition = finiteOr(stats.durability, 100);
    const everyMs = Math.max(0.1, finiteOr(settings?.wearWriteEverySec, 5)) * 1000;
    if (this.#wearElapsedMs >= everyMs || condition - this.#pendingWear <= 0) this.flush();
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

  // The filter's reading with its pending units, spending nothing (TK-382.1: no request object per call).
  #percent(filter) {
    return finiteOr(this.#power.reading(filter.instanceId)?.percent, 0);
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
    this.#statuses.hold(this.#statusId, protection > 0, this.#holdOptions);
  }
}
