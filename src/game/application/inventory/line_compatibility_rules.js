import { LineAllocationPolicy } from "../../domain/line/line_allocation_policy.js";

export class LineCompatibilityRules {
  #lineConfig;
  #messages;
  #policy;

  constructor(lineConfig = {}, { messages = null } = {}) {
    this.#lineConfig = lineConfig || {};
    this.#messages = messages;
    this.#policy = new LineAllocationPolicy(this.#lineConfig, { messages });
  }

  get messages() {
    return this.#messages;
  }

  get config() {
    return this.#lineConfig;
  }

  validateLine(lineItem, equippedHydrated) {
    return this.#policy.resolve({ lineItem, equipment: equippedHydrated });
  }

  validateLeader(_leaderItem, equippedHydrated) {
    if (!equippedHydrated?.line) {
      return {
        isValid: false,
        reason: "Поводок можна спорядити тільки після ліски.",
      };
    }
    return { isValid: true };
  }

  getLineLengthMeters(lineItem) {
    return this.#policy.getLineLengthMeters(lineItem);
  }

  getMinimumLineLengthMeters(rod) {
    return this.#policy.getMinimumLineLengthMeters(rod);
  }

  getMaximumLineLengthMeters(rod, reel = null) {
    return this.#policy.getMaximumLineLengthMeters({ rod, reel });
  }

  rodRequiresReel(rod) {
    return this.#policy.rodRequiresReel(rod);
  }
}
