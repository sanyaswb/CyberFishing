import { InventoryCapacityPolicy } from "./inventory_capacity_policy.js";

export class DelegatingInventoryCapacityPolicy extends InventoryCapacityPolicy {
  #evaluator;
  #messages;

  // The capacity warning text is injected by composition.
  constructor(evaluator, { messages = null } = {}) {
    super();
    if (typeof evaluator !== "function") {
      throw new TypeError("DelegatingInventoryCapacityPolicy requires an evaluator");
    }
    this.#evaluator = evaluator;
    this.#messages = messages;
  }

  evaluateTransition(context = {}) {
    const result = this.#evaluator(context);
    if (typeof result === "boolean") {
      return Object.freeze({ allowed: result, warning: result ? null : this.#messages.inventoryCapacityExceeded });
    }
    return Object.freeze({
      allowed: result?.allowed !== false,
      warning: result?.warning || null,
      ...(result || {}),
    });
  }
}
