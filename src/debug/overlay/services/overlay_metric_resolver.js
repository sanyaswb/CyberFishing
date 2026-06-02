class OverlayMetricResolver {
  #liveData = {};

  updateLiveData(data) {
    this.#liveData = data || {};
  }

  buildParameterRow(path) {
    const valueResult = this.resolvePath(path);
    return {
      path,
      value: valueResult.found ? this.#formatValue(valueResult.value) : "not available",
      source: this.#getSourceDescription(path),
      status: valueResult.found ? "ok" : valueResult.reason,
    };
  }

  buildSmallSnapshot() {
    const keys = [
      "fishPassiveKg",
      "fishActiveKg",
      "fishOppositionKg",
      "fishTensionKg",
      "rodPullForceKg",
      "effectiveRodHoldKg",
      "holdTensionRatio",
      "playerHoldTensionKg",
      "movableHoldTensionCapKg",
      "totalTensionKg",
      "netForceKg",
      "simpleFightSpeedMps",
      "rodStressRatio",
      "lineStressRatio",
      "hookStressRatio",
      "holdReelRecoverActive",
      "holdReelRecoverBlockedReason",
      "holdReelRecoverSpeedMps",
    ];
    const snapshot = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(Object(this.#liveData), key)) {
        snapshot[key] = this.#liveData[key];
      }
    }
    return snapshot;
  }

  resolvePath(path) {
    if (path.includes("<state>")) {
      return { found: false, reason: "state-specific path" };
    }
    const parts = String(path || "").split(".").filter(Boolean);
    const rootName = parts.shift();
    const root = this.#getRoot(rootName);

    if (root === undefined || root === null) {
      return { found: false, reason: `${rootName || "root"} unavailable` };
    }

    let current = root;
    for (const part of parts) {
      if (current === undefined || current === null) {
        return { found: false, reason: `missing before ${part}` };
      }
      if (!Object.prototype.hasOwnProperty.call(Object(current), part)) {
        return { found: false, reason: `missing ${part}` };
      }
      current = current[part];
    }

    return { found: true, value: current };
  }

  #getRoot(rootName) {
    switch (rootName) {
      case "CONFIG":
        return typeof CONFIG !== "undefined" ? CONFIG : undefined;
      case "BASE_CONFIG":
        return typeof BASE_CONFIG !== "undefined" ? BASE_CONFIG : undefined;
      case "HOOKED_FISH":
        return this.#liveData?.hookedFish || undefined;
      case "DEBUG_DATA":
        return this.#liveData;
      default:
        return undefined;
    }
  }

  #getSourceDescription(path) {
    if (path.startsWith("CONFIG.")) return "global runtime CONFIG";
    if (path.startsWith("BASE_CONFIG.")) return "immutable base config";
    if (path.startsWith("HOOKED_FISH.")) {
      return "currently hooked fish runtime data";
    }
    if (path.startsWith("DEBUG_DATA.")) return "current overlay debug snapshot";
    return "runtime";
  }

  #formatValue(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : String(value);
    }
    if (typeof value === "boolean" || typeof value === "string") return value;
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }
}

window.OverlayMetricResolver = OverlayMetricResolver;
