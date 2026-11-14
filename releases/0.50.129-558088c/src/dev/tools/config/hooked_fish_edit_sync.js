// Keeps a hooked fish consistent after a DevTools edit of HOOKED_FISH (spec 174 B2, moved from DevTools): a profile
// field is mirrored into its legacy physics alias, and a weight, level or anomaly edit recomputes the level's force and
// speed through the game's HookedFishProfileSynchronizer.
const PROFILE_ALIASES = Object.freeze({
  forceProfile: Object.freeze({ basePower: "basePower", levelBasePower: "levelBasePower" }),
  staminaProfile: Object.freeze({
    baseStamina: "baseStamina",
    staminaWeightMultiplier: "staminaWeightMultiplier",
    minStaminaActivityMultiplier: "minStaminaActivityMultiplier",
    exhaustedSpeedRatio: "exhaustedSpeedRatio",
  }),
  movementProfile: Object.freeze({
    baseSpeed: "baseSpeed",
    agility: "agility",
    bounceCooldownMs: "bounceCooldownMs",
    dirChangeMinMs: "dirChangeMinMs",
    dirChangeMaxMs: "dirChangeMaxMs",
    lastDashTrigger: "lastDashTrigger",
  }),
});
const BALANCE_KEYS = new Set(["weight", "level", "hasAnomaly"]);

export class HookedFishEditSync {
  #synchronizer;
  #fishes;

  // synchronizer: the game's HookedFishProfileSynchronizer; fishes: FISH_DB (the species templates).
  constructor({ synchronizer, fishes }) {
    if (typeof synchronizer?.synchronize !== "function") {
      throw new TypeError("HookedFishEditSync requires synchronizer");
    }
    this.#synchronizer = synchronizer;
    this.#fishes = Array.isArray(fishes) ? fishes : [];
  }

  // After HOOKED_FISH.<path> = value was written into fish.
  afterEdit(path, value, fish) {
    if (path[0] !== "HOOKED_FISH" || !fish) return;
    this.#syncProfileAlias(path, value, fish);
    this.#syncLevelBalance(path, fish);
  }

  #syncProfileAlias(path, value, fish) {
    if (path[1] !== "physics" || !fish.physics) return;
    const alias = PROFILE_ALIASES[path[2]]?.[path[3]];
    if (alias) fish.physics[alias] = value;
  }

  #syncLevelBalance(path, fish) {
    const changedKey = path[path.length - 1];
    if (!BALANCE_KEYS.has(changedKey)) return;
    const template = this.#fishes.find((candidate) => candidate?.id === fish.id) || null;
    const range = this.#synchronizer.synchronize({ fish, template, changedKey })?.range;
    if (!range) return;
    fish.physics = fish.physics || {};
    fish.physics.forceProfile = fish.physics.forceProfile || {};
    fish.physics.movementProfile = fish.physics.movementProfile || {};
    HookedFishEditSync.#applyFinite(fish.physics.forceProfile, "levelBasePower", range.basePower);
    HookedFishEditSync.#applyFinite(fish.physics, "levelBasePower", range.basePower);
    const levelSpeed = [range.baseSpeed, range.speedMultiplier, range.speed]
      .map(Number).find((candidate) => Number.isFinite(candidate)) ?? NaN;
    HookedFishEditSync.#applyFinite(fish.physics.movementProfile, "baseSpeed", levelSpeed);
    HookedFishEditSync.#applyFinite(fish.physics, "baseSpeed", levelSpeed);
  }

  static #applyFinite(target, key, value) {
    if (!Number.isFinite(Number(value))) return;
    target[key] = Math.max(0, Number(value));
  }
}
