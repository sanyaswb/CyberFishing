export class AutoRefillCoordinator {
  #messages;
  #policy;
  #targetProvider;
  #port;
  #warningSink;

  constructor({ messages, policy, targetProvider, port, warningSink = null } = {}) {
    this.#messages = messages;
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
      ? this.#messages.autoRefillMissing(missing)
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
