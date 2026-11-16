// Spec 179 stage E (TK-324): how the emission reaches the player.
// - protection(): 0…1 — a gas mask in its slot protects completely; a used drink (stage F, TK-340: the vodka) protects
//   partly for a while; the stronger one counts, they never add up.
// - strength(): the screen effect's strength now, the emission's intensity × (1 − protection); 0 outside an emission.
// - isCastBlocked(): from the emission's start to its end a cast needs a gas mask (the vodka does not allow it); a fight
//   that is already on continues (owner, Q10), only new casts are refused.
// It reads the environment's snapshot and the equipment live, allocates nothing and keeps no state.
const clamp01 = (value) => (value <= 0 ? 0 : value >= 1 ? 1 : value);

export class EmissionExposure {
  #getEnvironment;
  #getEquipped;
  #effects;

  // getEnvironment: () => EnvironmentSystem's snapshot ({ emission }); getEquipped: () => the equipment read model;
  // effects: PlayerProtectionEffects (a used drink's protection, TK-340).
  constructor({ getEnvironment, getEquipped, effects }) {
    if (typeof getEnvironment !== "function") throw new TypeError("EmissionExposure requires getEnvironment");
    if (typeof getEquipped !== "function") throw new TypeError("EmissionExposure requires getEquipped");
    if (typeof effects?.protection !== "function") throw new TypeError("EmissionExposure requires effects");
    this.#getEnvironment = getEnvironment;
    this.#getEquipped = getEquipped;
    this.#effects = effects;
  }

  hasGasMask() {
    return Boolean(this.#getEquipped()?.gasMask);
  }

  protection() {
    return this.hasGasMask() ? 1 : clamp01(Number(this.#effects.protection()) || 0);
  }

  isActive() {
    const phase = this.#getEnvironment()?.emission?.phase;
    return typeof phase === "string" && phase !== "idle";
  }

  strength() {
    if (!this.isActive()) return 0;
    const intensity = Number(this.#getEnvironment()?.emission?.intensity);
    return Number.isFinite(intensity) ? clamp01(intensity) * (1 - this.protection()) : 0;
  }

  isCastBlocked() {
    return this.isActive() && !this.hasGasMask();
  }
}
