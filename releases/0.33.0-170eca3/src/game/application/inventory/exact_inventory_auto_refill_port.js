import { AutoRefillPort } from "./auto_refill_port.js";

export class ExactInventoryAutoRefillPort extends AutoRefillPort {
  #inventoryPort;
  #targetWriter;
  #signaturePolicy;

  constructor({ inventoryPort, targetWriter, signaturePolicy = null } = {}) {
    super();
    if (typeof inventoryPort?.takeOneExact !== "function") {
      throw new TypeError("ExactInventoryAutoRefillPort requires takeOneExact()");
    }
    if (typeof targetWriter?.fillTarget !== "function") {
      throw new TypeError("ExactInventoryAutoRefillPort requires fillTarget()");
    }
    this.#inventoryPort = inventoryPort;
    this.#targetWriter = targetWriter;
    this.#signaturePolicy = signaturePolicy;
  }

  refillExact(target, signature) {
    const item = this.#inventoryPort.takeOneExact(signature);
    if (!item) return Object.freeze({ success: false, reason: "not-found" });
    if (!this.#signaturePolicy?.matches?.(item, signature)) {
      this.#inventoryPort.returnOne?.(item);
      return Object.freeze({ success: false, reason: "signature-mismatch" });
    }

    try {
      const filled = this.#targetWriter.fillTarget(target, item);
      if (filled === false) {
        this.#inventoryPort.returnOne?.(item);
        return Object.freeze({ success: false, reason: "target-rejected" });
      }
      return Object.freeze({ success: true, item });
    } catch (error) {
      this.#inventoryPort.returnOne?.(item);
      return Object.freeze({ success: false, reason: "target-error", error });
    }
  }
}
