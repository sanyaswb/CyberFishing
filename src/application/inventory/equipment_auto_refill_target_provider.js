class EquipmentAutoRefillTargetProvider {
  #equipmentState;
  #assemblyReader;
  #memory;

  constructor({ equipmentState, assemblyReader, memory = null } = {}) {
    this.#equipmentState = equipmentState;
    this.#assemblyReader = assemblyReader;
    this.#memory = memory || (typeof AutoRefillMemory !== "undefined" ? new AutoRefillMemory() : null);
  }

  listTargets(scope, context = {}) {
    if (scope === AutoRefillScope.HAND_CHUM) {
      return this.#getHandChumTargets(context);
    }
    const rootSlotId =
      scope === AutoRefillScope.BOAT_CHUM ? "delivery" : "tackle";
    const rootInstanceId =
      scope === AutoRefillScope.BOAT_CHUM && context.rootInstanceId
        ? context.rootInstanceId
        : this.#getRootInstanceId(rootSlotId, context);
    if (!rootInstanceId) return [];

    const matcher = this.#getPathMatcher(scope);
    const paths = this.#getRememberedPaths(rootInstanceId)
      .filter((path) => matcher.test(path))
      .sort((left, right) => this.#comparePaths(left, right));
    const targets = [];
    for (const path of paths) {
      if (this.#assemblyReader?.readPath?.(rootInstanceId, path)) continue;
      const signature = this.#assemblyReader?.getRefillSignature?.(
        rootInstanceId,
        path,
      ) || this.#readSignatureFromState(rootInstanceId, path);
      if (!signature) continue;
      targets.push(Object.freeze({
        targetType: "assembly-slot",
        scope,
        rootInstanceId,
        path,
        signature,
      }));
    }
    return targets;
  }

  #getHandChumTargets(context) {
    if (this.#getRootInstanceId("handChum", context)) return [];
    const signature =
      context.handChumSignature ||
      this.#memory?.get?.("handChum") ||
      this.#memory?.get?.("equipment.handChum");
    if (!signature) return [];
    return [Object.freeze({
      targetType: "equipment-slot",
      scope: AutoRefillScope.HAND_CHUM,
      slotId: "handChum",
      path: "handChum",
      signature,
    })];
  }

  #getRootInstanceId(slotId, context) {
    const state = context.equipmentState || this.#equipmentState;
    if (typeof state?.getRootInstanceId === "function") {
      return state.getRootInstanceId(slotId);
    }
    return state?.rootInstanceIds?.[slotId] ?? state?.[slotId] ?? null;
  }

  #getRememberedPaths(rootInstanceId) {
    const state = this.#assemblyReader?.getAssemblyState?.(rootInstanceId) || {};
    const source =
      state.refillSignatures ||
      state.rememberedSignatures ||
      state.autoRefillSignatures ||
      {};
    if (source instanceof Map) return [...source.keys()];
    if (Array.isArray(source)) {
      return source.map((entry) => entry?.path).filter(Boolean);
    }
    return Object.keys(source);
  }

  #readSignatureFromState(rootInstanceId, path) {
    const state = this.#assemblyReader?.getAssemblyState?.(rootInstanceId) || {};
    const source =
      state.refillSignatures ||
      state.rememberedSignatures ||
      state.autoRefillSignatures ||
      {};
    if (source instanceof Map) return source.get(path) || null;
    if (Array.isArray(source)) {
      return source.find((entry) => entry?.path === path)?.signature || null;
    }
    return source[path] || null;
  }

  #getPathMatcher(scope) {
    if (scope === AutoRefillScope.TACKLE_BAIT) {
      return /^(?:bait(?:\[0\])?|(?:hook|hooks)\[\d+\]\.bait(?:\[0\])?)$/;
    }
    if (scope === AutoRefillScope.TACKLE_CHUM) {
      return /^(?:chum|feederChum)(?:\[\d+\])?$/;
    }
    return /^(?:cargo|bay|chum)\[\d+\]$/;
  }

  #comparePaths(left, right) {
    const leftIndex = Number(left.match(/\[(\d+)\]/)?.[1] ?? 0);
    const rightIndex = Number(right.match(/\[(\d+)\]/)?.[1] ?? 0);
    return leftIndex - rightIndex || left.localeCompare(right);
  }
}
