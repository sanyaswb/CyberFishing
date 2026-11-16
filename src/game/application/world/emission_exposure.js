// Spec 179 stage E (TK-324), spec 181: how the emission reaches the player.
// - intensity(): the emission's intensity now, 0…1; 0 outside an emission.
// - modifier(key): the share of the emission's screen effect that stays under the player's statuses (spec 181 D1:
//   emission.vignette, .blur, .blurRate — the vodka 0.5, the gas mask in its slot 0; the product over the statuses).
// - strength(): the screen effect's strength now, intensity × the vignette's share; 0 outside an emission.
// - isCastBlocked(): from the emission's start to its end a cast needs a gas mask (the vodka does not allow it); a fight
//   that is already on continues (owner, Q10), only new casts are refused.
// It reads the environment's snapshot, the equipment and the statuses live, allocates nothing and keeps no state.
const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);

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

  hasGasMask() {
    return Boolean(this.#getEquipped()?.gasMask);
  }

  isActive() {
    const phase = this.#getEnvironment()?.emission?.phase;
    return typeof phase === "string" && phase !== "idle";
  }

  intensity() {
    if (!this.isActive()) return 0;
    const intensity = Number(this.#getEnvironment()?.emission?.intensity);
    return Number.isFinite(intensity) ? clamp01(intensity) : 0;
  }

  modifier(key) {
    return clamp01(this.#statuses.modifier("emission", key));
  }

  strength() {
    return this.intensity() * this.modifier("vignette");
  }

  isCastBlocked() {
    return this.isActive() && !this.hasGasMask();
  }
}
