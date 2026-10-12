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

  getMinimumLineLengthMeters(rod) {
    return this.#policy.getMinimumLineLengthMeters(rod);
  }
}
