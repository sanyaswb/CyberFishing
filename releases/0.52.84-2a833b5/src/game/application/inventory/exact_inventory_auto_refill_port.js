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
    if (typeof inventoryPort?.takeStackExact !== "function") {
      throw new TypeError("ExactInventoryAutoRefillPort requires takeStackExact()");
    }
    if (typeof targetWriter?.fillTarget !== "function") {
      throw new TypeError("ExactInventoryAutoRefillPort requires fillTarget()");
    }
    this.#inventoryPort = inventoryPort;
    this.#targetWriter = targetWriter;
    this.#signaturePolicy = signaturePolicy;
  }

  refillExact(target, signature) {
    // Spec 184 D1 (TK-375): a slot that holds stacks takes the whole one.
    const item = target?.wholeStack === true
      ? this.#inventoryPort.takeStackExact(signature)
      : this.#inventoryPort.takeOneExact(signature);
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
