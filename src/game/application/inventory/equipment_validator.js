export class EquipmentValidator {
  static VALID_BASE_TYPES = new Set([
    "rod",
    "reel",
    "float",
    "hook",
    "feeder_rig",
    "lure",
    "bait",
    "net",
    "chum_mix",
    "boat",
  ]);

  static validate(itemData, equippedHydrated) {
    if (!itemData) return { isValid: false, reason: "Помилка даних предмета" };
    if (this.VALID_BASE_TYPES.has(itemData.itemType)) return { isValid: true };
    if (itemData.itemType === "fishing_line") {
      return this.validateFishingLine(itemData, equippedHydrated);
    }

    if (itemData.itemType === "leader_line") {
      return this.validateLeader(itemData, equippedHydrated);
    }

    const reqTag = itemData.requiresTag;
    if (!reqTag) return { isValid: true };

    if (!equippedHydrated.rod) {
      return {
        isValid: false,
        reason: "Спочатку екіпіруйте відповідне вудилище!",
      };
    }

    const availableCaps = this.#getAvailableCapabilities(equippedHydrated);

    if (!availableCaps.has(reqTag)) {
      if (reqTag === "bait") {
        return {
          isValid: false,
          reason: "Спочатку екіпіруйте гачок або пружину!",
        };
      }
      return {
        isValid: false,
        reason: `Для цього предмета потрібна оснастка з підтримкою: ${reqTag}`,
      };
    }

    return { isValid: true };
  }

  static validateLeader(itemData, equippedHydrated) {
    if (!equippedHydrated?.line) {
      return {
        isValid: false,
        reason: "Поводок можна спорядити тільки після ліски.",
      };
    }
    return { isValid: true };
  }

  static validateFishingLine(itemData, equippedHydrated) {
    const rod = equippedHydrated?.rod;
    if (!rod) {
      return {
        isValid: false,
        reason: "Спочатку екіпіруйте вудку для ліски.",
      };
    }

    const rodNeedsReel = this.#rodRequiresReel(rod);
    if (rodNeedsReel && !equippedHydrated?.reel) {
      return {
        isValid: false,
        reason: "Для цієї вудки спочатку екіпіруйте котушку.",
      };
    }

    const lineLength = this.#numberOrDefault(
      itemData.effectiveStats?.lengthMeters,
      0,
    );
    const minLength = this.getMinimumLineLengthMeters(rod);
    if (lineLength < minLength) {
      return {
        isValid: false,
        reason: `Ліска закоротка: потрібно мінімум ${this.#formatMeters(minLength)}м для цієї вудки.`,
      };
    }

    const reelCapacity = this.#numberOrDefault(
      equippedHydrated?.reel?.effectiveStats?.lineCapacityMeters,
      Infinity,
    );
    if (rodNeedsReel && Number.isFinite(reelCapacity) && lineLength > reelCapacity) {
      return {
        isValid: false,
        reason: `Ліска не вміщується на котушку: максимум ${this.#formatMeters(reelCapacity)}м.`,
      };
    }

    return { isValid: true };
  }

  static getMinimumLineLengthMeters(rod) {
    const rodLength = this.#numberOrDefault(
      rod?.effectiveStats?.lengthMeters,
      0,
    );
    return Math.max(0, rodLength);
  }

  static #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  static #formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }

  static getCompatibilityInfo(itemData, equippedHydrated) {
    if (itemData?.itemType === "fishing_line") {
      const validation = this.validateFishingLine(itemData, equippedHydrated);
      return {
        hasCompatibility: true,
        isCompatible: validation.isValid,
        requiredTag: "line",
        reason: validation.reason || null,
        rodType: equippedHydrated?.rod?.variant || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    if (itemData?.itemType === "leader_line") {
      const validation = this.validateLeader(itemData, equippedHydrated);
      return {
        hasCompatibility: true,
        isCompatible: validation.isValid,
        requiredTag: "line",
        reason: validation.reason || null,
        rodType: equippedHydrated?.rod?.variant || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    const reqTag = itemData?.requiresTag;
    if (!reqTag) {
      return {
        hasCompatibility: false,
        isCompatible: true,
        requiredTag: null,
        rodType: equippedHydrated?.rod?.variant || null,
        rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
      };
    }

    const availableCaps = this.#getAvailableCapabilities(equippedHydrated || {});
    return {
      hasCompatibility: true,
      isCompatible: availableCaps.has(reqTag),
      requiredTag: reqTag,
      rodType: equippedHydrated?.rod?.variant || null,
      rodHasReel: EquipmentValidator.#rodRequiresReel(equippedHydrated?.rod),
    };
  }

  static #rodRequiresReel(rod) {
    if (!rod) return null;
    return rod.effectiveStats?.hasReel ?? rod.variant !== "pole";
  }

  static #getAvailableCapabilities(equippedHydrated) {
    const caps = new Set();
    const parts = [
      equippedHydrated.rod,
      equippedHydrated.reel,
      equippedHydrated.line,
      equippedHydrated.float,
      equippedHydrated.feederRig,
      ...(equippedHydrated.hooks || []),
    ];

    for (const part of parts) {
      if (!part) continue;
      const partCaps =
        part.capabilities || [];
      for (let i = 0; i < partCaps.length; i++) {
        caps.add(partCaps[i]);
      }
    }
    return caps;
  }
}
