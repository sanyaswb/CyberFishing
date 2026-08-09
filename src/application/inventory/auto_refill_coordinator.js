class AutoRefillPort {
  refillExact(_target, _signature) {
    throw new Error("AutoRefillPort.refillExact() must be implemented");
  }
}

class ExactInventoryAutoRefillPort extends AutoRefillPort {
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
    this.#signaturePolicy =
      signaturePolicy ||
      (typeof ExactAssemblyRefillSignaturePolicy !== "undefined"
        ? new ExactAssemblyRefillSignaturePolicy()
        : typeof ExactItemSignaturePolicy !== "undefined"
        ? new ExactItemSignaturePolicy()
        : null);
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

class AutoRefillCoordinator {
  #policy;
  #targetProvider;
  #port;
  #warningSink;

  constructor({ policy, targetProvider, port, warningSink = null } = {}) {
    if (typeof policy?.resolveScopes !== "function") {
      throw new TypeError("AutoRefillCoordinator requires AutoRefillPolicy");
    }
    if (typeof targetProvider?.listTargets !== "function") {
      throw new TypeError("AutoRefillCoordinator requires a target provider");
    }
    if (typeof port?.refillExact !== "function") {
      throw new TypeError("AutoRefillCoordinator requires AutoRefillPort");
    }
    this.#policy = policy;
    this.#targetProvider = targetProvider;
    this.#port = port;
    this.#warningSink = warningSink;
  }

  handle(trigger, context = {}) {
    const scopes = this.#policy.resolveScopes(trigger, context);
    const attempts = [];
    for (const scope of scopes) {
      const targets = this.#targetProvider.listTargets(scope, context) || [];
      // Deliberately sequential: when stock is scarce, lower slot indices are
      // deterministically restored first and the rest remain empty.
      for (const target of targets) {
        const result = this.#port.refillExact(target, target.signature);
        attempts.push(Object.freeze({
          scope,
          target,
          success: result === true || result?.success === true,
          reason: result?.reason || null,
        }));
      }
    }

    const filled = attempts.filter((attempt) => attempt.success).length;
    const missing = attempts.length - filled;
    const warning = missing > 0
      ? `Не вистачило точних предметів для ${missing} комірок автопоповнення.`
      : null;
    if (warning) {
      if (typeof this.#warningSink === "function") {
        this.#warningSink(warning, attempts);
      } else {
        this.#warningSink?.warn?.(warning, attempts);
      }
    }

    return Object.freeze({
      trigger,
      scopes: Object.freeze([...scopes]),
      attempted: attempts.length,
      filled,
      missing,
      warning,
      attempts: Object.freeze(attempts),
    });
  }
}
