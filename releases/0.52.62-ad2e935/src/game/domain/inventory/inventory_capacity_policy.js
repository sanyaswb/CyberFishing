export class InventoryCapacityPolicy {
  evaluateTransition(_context = {}) {
    throw new Error(
      "InventoryCapacityPolicy.evaluateTransition() must be implemented",
    );
  }
}
