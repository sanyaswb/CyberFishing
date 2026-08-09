class InventoryCapacityPolicy {
  evaluateTransition(_context = {}) {
    throw new Error(
      "InventoryCapacityPolicy.evaluateTransition() must be implemented",
    );
  }
}

class UnlimitedInventoryCapacityPolicy extends InventoryCapacityPolicy {
  evaluateTransition({
    incomingRootInstanceIds = [],
    outgoingRootInstanceIds = [],
    incomingConceptualCellCount = null,
    outgoingConceptualCellCount = null,
  } = {}) {
    return Object.freeze({
      allowed: true,
      incomingCellCount:
        Number.isInteger(incomingConceptualCellCount) && incomingConceptualCellCount >= 0
          ? incomingConceptualCellCount
          : new Set(incomingRootInstanceIds.filter(Boolean)).size,
      outgoingCellCount:
        Number.isInteger(outgoingConceptualCellCount) && outgoingConceptualCellCount >= 0
          ? outgoingConceptualCellCount
          : new Set(outgoingRootInstanceIds.filter(Boolean)).size,
      warning: null,
    });
  }
}

class DelegatingInventoryCapacityPolicy extends InventoryCapacityPolicy {
  #evaluator;

  constructor(evaluator) {
    super();
    if (typeof evaluator !== "function") {
      throw new TypeError("DelegatingInventoryCapacityPolicy requires an evaluator");
    }
    this.#evaluator = evaluator;
  }

  evaluateTransition(context = {}) {
    const result = this.#evaluator(context);
    if (typeof result === "boolean") {
      return Object.freeze({ allowed: result, warning: result ? null : "Недостатньо місця в інвентарі." });
    }
    return Object.freeze({
      allowed: result?.allowed !== false,
      warning: result?.warning || null,
      ...(result || {}),
    });
  }
}
