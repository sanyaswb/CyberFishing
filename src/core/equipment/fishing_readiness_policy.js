class FishingReadinessPolicy {
  #itemReader;
  #assemblyReader;
  #capabilityResolver;

  constructor({
    itemReader = null,
    assemblyReader = null,
    capabilityResolver = null,
  } = {}) {
    this.#itemReader = itemReader;
    this.#assemblyReader = assemblyReader;
    this.#capabilityResolver =
      capabilityResolver ||
      (typeof RodCapabilityResolver !== "undefined"
        ? new RodCapabilityResolver()
        : null);
  }

  validateEquip({ slotId, item, equipmentState } = {}) {
    const reelSlotId = this.#slotId("REEL", "reel");
    const terminalLineSlotId = this.#slotId("TERMINAL_LINE", "terminalLine");
    if (slotId === reelSlotId) {
      return this.#validation(true);
    }
    if (slotId !== terminalLineSlotId || !this.#isLeader(item)) {
      return this.#validation(true);
    }

    const reelRootId = this.#root(equipmentState, reelSlotId);
    const reelLine = reelRootId ? this.#child(reelRootId, "line", 0) : null;
    if (!reelRootId || !reelLine) {
      return this.#validation(
        false,
        "Поводок можна спорядити лише після котушки з установленою ліскою.",
        "reel-line-required-for-leader",
      );
    }
    return this.#validation(true);
  }

  evaluateCast({ equipmentState } = {}) {
    const rodRootId = this.#root(equipmentState, this.#slotId("ROD", "rod"));
    const rod = this.#item(rodRootId);
    if (!rod) {
      return this.#castResult(false, "Спочатку спорядіть вудилище.", "rod-required");
    }

    const supportsReel =
      this.#capabilityResolver?.resolve?.(rod)?.supportsReel === true;
    if (supportsReel) {
      const reelRootId = this.#root(equipmentState, this.#slotId("REEL", "reel"));
      if (!reelRootId) {
        return this.#castResult(false, "Для цієї вудки потрібна котушка.", "reel-required");
      }
      if (!this.#child(reelRootId, "line", 0)) {
        return this.#castResult(
          false,
          "У котушку потрібно встановити ліску.",
          "reel-line-required",
        );
      }
      return this.#castResult(true);
    }

    const lineRootId = this.#root(
      equipmentState,
      this.#slotId("TERMINAL_LINE", "terminalLine"),
    );
    if (!lineRootId) {
      return this.#castResult(
        false,
        "Для закидання потрібно спорядити ліску.",
        "terminal-line-required",
      );
    }
    return this.#castResult(true);
  }

  evaluateBite({ equipmentState } = {}) {
    const rod = this.#item(
      this.#root(equipmentState, this.#slotId("ROD", "rod")),
    );
    const isFeeder =
      this.#capabilityResolver?.resolve?.(rod)?.supportsFeederRig === true;
    if (!isFeeder) {
      return Object.freeze({ canBite: true, warningCode: null, warning: null });
    }

    const tackleRootId = this.#root(
      equipmentState,
      this.#slotId("TACKLE", "tackle"),
    );
    const tackle = this.#item(tackleRootId);
    const hooks = this.#isHook(tackle)
      ? [tackle]
      : this.#children(tackleRootId, ["hook", "hooks"]);
    const canBite = hooks.some(Boolean);
    return Object.freeze({
      canBite,
      warningCode: canBite ? null : "feeder-hook-missing",
      warning: canBite
        ? null
        : "Снасть споряджена без гачків, тому клювання не буде.",
    });
  }

  evaluateChumBonus({ equipmentState } = {}) {
    const tackleRootId = this.#root(
      equipmentState,
      this.#slotId("TACKLE", "tackle"),
    );
    const chum =
      this.#child(tackleRootId, "chum", 0) ||
      this.#child(tackleRootId, "feederChum", 0);
    return Object.freeze({
      hasBonus: Boolean(chum),
      warning: chum ? null : "Прикормка відсутня: бонус прикормки не діє.",
    });
  }

  #castResult(canCast, warning = null, warningCode = null) {
    return Object.freeze({
      canCast,
      shouldOpenInventory: !canCast,
      warning,
      warningCode,
    });
  }

  #validation(isValid, reason = null, warningCode = null) {
    return Object.freeze({ isValid, reason, warningCode });
  }

  #root(state, slotId) {
    if (typeof state?.getRootInstanceId === "function") {
      return state.getRootInstanceId(slotId);
    }
    return state?.rootInstanceIds?.[slotId] ?? state?.[slotId] ?? null;
  }

  #item(reference) {
    if (!reference) return null;
    if (typeof reference === "object") return reference;
    if (typeof this.#itemReader === "function") return this.#itemReader(reference);
    return (
      this.#itemReader?.getById?.(reference) ||
      this.#itemReader?.getInstance?.(reference) ||
      this.#itemReader?.hydrateInstance?.(reference) ||
      this.#itemReader?.get?.(reference) ||
      null
    );
  }

  #child(parentInstanceId, slotId, index) {
    if (!parentInstanceId) return null;
    return this.#item(
      this.#assemblyReader?.getChild?.(parentInstanceId, slotId, index) || null,
    );
  }

  #children(parentInstanceId, slotIds) {
    if (!parentInstanceId) return [];
    for (const slotId of slotIds) {
      const children = this.#assemblyReader?.getChildren?.(parentInstanceId, slotId);
      if (Array.isArray(children) && children.length > 0) {
        return children.map((child) => this.#item(child));
      }
    }
    return [];
  }

  #isLeader(item) {
    return item?.itemType === "leader_line";
  }

  #isHook(item) {
    return item?.itemType === "hook";
  }

  #slotId(key, fallback) {
    return typeof EquipmentSlotId !== "undefined"
      ? EquipmentSlotId[key]
      : fallback;
  }
}
