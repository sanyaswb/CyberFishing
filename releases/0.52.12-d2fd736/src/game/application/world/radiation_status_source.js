// Spec 181 D4 (stage E, owner Q2): the debuff «Радіація» — held while the location's radiation is above zero (the
// environment's snapshot.radiation). It has no timer and no modifiers (the emission's effects come from the emission);
// it shows the player that radiation acts on them. Updated once a frame, it reads one number and calls the statuses only
// when the state changes. The house (spec 179 stage I, owner Q5): inside, the debuff will not act and its badge will hide
// while its time keeps flowing — wired when the house exists.
const SOURCE = Object.freeze({ source: "location" });

export class RadiationStatusSource {
  #getEnvironment;
  #statuses;
  #statusId;
  #held = false;

  // getEnvironment: () => EnvironmentSystem's snapshot ({ radiation }); statuses: PlayerStatusEffects.
  constructor({ getEnvironment, statuses, statusId = "radiation" }) {
    if (typeof getEnvironment !== "function") throw new TypeError("RadiationStatusSource requires getEnvironment");
    if (typeof statuses?.hold !== "function") throw new TypeError("RadiationStatusSource requires statuses");
    this.#getEnvironment = getEnvironment;
    this.#statuses = statuses;
    this.#statusId = statusId;
  }

  update() {
    const held = Number(this.#getEnvironment()?.radiation) > 0;
    if (held === this.#held) return;
    // TK-358: remembered only once the statuses hold it (a description added later in DevTools is picked up then).
    this.#statuses.hold(this.#statusId, held, SOURCE);
    this.#held = held ? this.#statuses.has(this.#statusId) : false;
  }
}
