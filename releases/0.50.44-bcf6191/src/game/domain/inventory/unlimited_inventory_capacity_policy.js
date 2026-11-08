import { InventoryCapacityPolicy } from "./inventory_capacity_policy.js";

export class UnlimitedInventoryCapacityPolicy extends InventoryCapacityPolicy {
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
