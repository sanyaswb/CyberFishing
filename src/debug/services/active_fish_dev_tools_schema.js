/**
 * DevTools visibility/configuration rules for the ACTIVE FISH runtime editor.
 *
 * The editor walks the actual hooked-fish object instead of depending on a
 * fixed hand-written list of paths. When runtime fish config changes nesting,
 * scalar fields are picked up automatically unless a rule disables them.
 */
const ACTIVE_FISH_DEV_TOOLS_SCHEMA = Object.freeze({
  fishRuntimeRootTitle: "🐟 Fish runtime parameters (HOOKED_FISH)",
  globalConfigRootTitle: "🌐 Global fight config shortcuts (CONFIG)",

  visibility: Object.freeze({
    exactPaths: Object.freeze({
      "HOOKED_FISH.id": Object.freeze({ enabled: false }),
      "HOOKED_FISH.name": Object.freeze({ enabled: false }),
      "HOOKED_FISH.maxLevel": Object.freeze({ enabled: false }),
      "HOOKED_FISH.levelAverageWeightKg": Object.freeze({ enabled: false }),
      "HOOKED_FISH.isUnique": Object.freeze({ enabled: false }),
      "HOOKED_FISH.isTrophy": Object.freeze({ enabled: false }),
      "HOOKED_FISH.anomaly": Object.freeze({ enabled: false }),

      // Runtime compatibility aliases. Canonical editable fields live inside
      // forceProfile / staminaProfile / movementProfile / behaviorProfile.
      "HOOKED_FISH.physics.basePower": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.levelBasePower": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.baseStamina": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.staminaWeightMultiplier": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.staminaBossMultiplier": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.staminaRatioFromEndurance": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.minStaminaActivityMultiplier": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.exhaustedSpeedRatio": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.baseSpeed": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.agility": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.bounceCooldownMs": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.dirChangeMinMs": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.dirChangeMaxMs": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.lastDashTrigger": Object.freeze({ enabled: false }),
      "HOOKED_FISH.physics.behaviors": Object.freeze({ enabled: false }),
    }),

    subtreePaths: Object.freeze({
      "HOOKED_FISH.biteSequence": Object.freeze({ enabled: false }),
    }),

    leafKeys: Object.freeze({
      icon: Object.freeze({ enabled: false }),
      imagePath: Object.freeze({ enabled: false }),
      bgUrls: Object.freeze({ enabled: false }),
      depthUrl: Object.freeze({ enabled: false }),
      endpoint: Object.freeze({ enabled: false }),
      backgroundColor: Object.freeze({ enabled: false }),
      colorGradient: Object.freeze({ enabled: false }),
      statuses: Object.freeze({ enabled: false }),
    }),
  }),

  globalConfigShortcuts: Object.freeze([
    Object.freeze({
      enabled: true,
      title: "fight physics",
      path: Object.freeze(["CONFIG", "physics", "fight"]),
    }),
    Object.freeze({
      enabled: true,
      title: "tension physics",
      path: Object.freeze(["CONFIG", "physics", "tension"]),
    }),
    Object.freeze({
      enabled: true,
      title: "retrieve physics",
      path: Object.freeze(["CONFIG", "physics", "retrieve"]),
    }),
  ]),
});

class ActiveFishDevToolsVisibilityPolicy {
  #schema;

  constructor(schema = ACTIVE_FISH_DEV_TOOLS_SCHEMA) {
    this.#schema = schema || ACTIVE_FISH_DEV_TOOLS_SCHEMA;
  }

  get fishRuntimeRootTitle() {
    return this.#schema.fishRuntimeRootTitle || "Fish runtime parameters";
  }

  get globalConfigRootTitle() {
    return this.#schema.globalConfigRootTitle || "Global config shortcuts";
  }

  getGlobalConfigShortcuts() {
    return (this.#schema.globalConfigShortcuts || []).filter(
      (shortcut) => shortcut?.enabled !== false && Array.isArray(shortcut.path),
    );
  }

  isVisible(path, value) {
    const normalizedPath = this.#normalizePath(path);
    if (!normalizedPath) return true;

    if (typeof value === "function") return false;

    const exactRule = this.#schema.visibility?.exactPaths?.[normalizedPath];
    if (exactRule?.enabled === false) return false;

    const subtreeRules = this.#schema.visibility?.subtreePaths || {};
    for (const [prefix, rule] of Object.entries(subtreeRules)) {
      if (rule?.enabled !== false) continue;
      if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}.`)) {
        return false;
      }
    }

    const leafKey = normalizedPath.split(".").pop();
    const leafRule = this.#schema.visibility?.leafKeys?.[leafKey];
    if (leafRule?.enabled === false) return false;

    return true;
  }

  normalizeHookedFish(hookedFish) {
    if (!hookedFish || typeof hookedFish !== "object") return hookedFish;
    hookedFish.physics = this.#normalizePhysics(hookedFish.physics || {});
    return hookedFish;
  }

  #normalizePhysics(physics) {
    if (typeof FishPhysicsProfile !== "undefined") {
      return FishPhysicsProfile.toRuntimeConfig(physics || {});
    }
    return physics || {};
  }

  #normalizePath(path) {
    if (Array.isArray(path)) return path.map(String).join(".");
    return String(path || "").trim();
  }
}

window.ACTIVE_FISH_DEV_TOOLS_SCHEMA = ACTIVE_FISH_DEV_TOOLS_SCHEMA;
window.ActiveFishDevToolsVisibilityPolicy = ActiveFishDevToolsVisibilityPolicy;
