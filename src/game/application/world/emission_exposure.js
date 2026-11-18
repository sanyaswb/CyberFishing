import { isItemBroken } from "../../domain/items/condition/item_condition_quality.js";

// Spec 179 stage E (TK-324), spec 181: how the emission reaches the player.
// - intensity(): the emission's intensity now, 0…1; 0 outside an emission.
// - modifier(key): the share of the emission's screen effect that stays under the player's statuses (spec 181 D1:
//   emission.vignette, .blur, .blurRate — the vodka 0.5, the gas mask in its slot 0; the product over the statuses).
// - isCastBlocked(): from the emission's start to its end a cast needs a gas mask (the vodka does not allow it); a fight
//   that is already on continues (owner, Q10), only new casts are refused.
// It reads the environment's snapshot, the equipment and the statuses live, allocates nothing and keeps no state.
import { clampUnit } from "../../../engine/math/number_normalization.js";

export class EmissionExposure {
  #getEnvironment;
  #getEquipped;
  #statuses;

  // getEnvironment: () => EnvironmentSystem's snapshot ({ emission }); getEquipped: () => the equipment read model;
  // statuses: PlayerStatusEffects (spec 181).
  constructor({ getEnvironment, getEquipped, statuses }) {
    if (typeof getEnvironment !== "function") throw new TypeError("EmissionExposure requires getEnvironment");
    if (typeof getEquipped !== "function") throw new TypeError("EmissionExposure requires getEquipped");
    if (typeof statuses?.modifier !== "function") throw new TypeError("EmissionExposure requires statuses");
    this.#getEnvironment = getEnvironment;
    this.#getEquipped = getEquipped;
    this.#statuses = statuses;
  }

  // Spec 179 D10: a broken gas mask (condition 0) does not protect.
  hasGasMask() {
    const gasMask = this.#getEquipped()?.gasMask;
    return Boolean(gasMask) && !isItemBroken(gasMask);
  }

  isActive() {
    const phase = this.#getEnvironment()?.emission?.phase;
    return typeof phase === "string" && phase !== "idle";
  }

  intensity() {
    if (!this.isActive()) return 0;
    const intensity = Number(this.#getEnvironment()?.emission?.intensity);
    return Number.isFinite(intensity) ? clampUnit(intensity) : 0;
  }

  modifier(key) {
    return clampUnit(this.#statuses.modifier("emission", key));
  }

  isCastBlocked() {
    return this.isActive() && !this.hasGasMask();
  }
}
