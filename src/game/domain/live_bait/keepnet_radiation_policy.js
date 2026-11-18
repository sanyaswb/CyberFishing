// Spec 179 D8 (TK-369): the radiation dose of the caught fish. A fish in the keepnet or a live bait on the hook takes
// dose = radiation × seconds × (1 − the keepnet's shield); it dies when the dose reaches its tolerance: a live bait —
// liveBaitSec, any other fish — secPerKg × weight^weightExponent (a bigger fish lives longer). A unique fish (it has an
// anomaly) takes none, nor does the aquarium (the house). config: CONFIG.liveBait (read live: DevTools edits apply).
const EXPOSED = Object.freeze(new Set(["keepnet", "hook"]));

export class KeepnetRadiationPolicy {
  #config;

  constructor(config) {
    if (!config?.keepnet) throw new TypeError("KeepnetRadiationPolicy requires CONFIG.liveBait.keepnet");
    this.#config = config;
  }

  // The share of the dose the keepnet of the current conditional level keeps out (0…1).
  shield() {
    const keepnet = this.#config.keepnet;
    const levels = keepnet.radiationShieldByLevel;
    const level = Math.max(1, Math.min(levels.length, Math.round(Number(keepnet.level) || 1)));
    const value = Number(levels[level - 1]);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }

  isExposed(fish) {
    return EXPOSED.has(fish.disposition) && fish.isUnique !== true;
  }

  toleranceSec(fish) {
    const tolerance = this.#config.keepnet.radiationTolerance;
    if (fish.purpose === "live_bait") return tolerance.liveBaitSec;
    return tolerance.secPerKg * Math.pow(Math.max(0, fish.weightKg), tolerance.weightExponent);
  }

  // Seconds of full radiation (before the shield) the exposed fish closest to death can still take; Infinity when none
  // can die (no exposed fish, or a shield of 1).
  headroomSec(fishes) {
    const through = 1 - this.shield();
    if (through <= 0) return Infinity;
    let headroom = Infinity;
    for (const fish of fishes) {
      if (!this.isExposed(fish)) continue;
      const left = Math.max(0, this.toleranceSec(fish) - (fish.radiationDose || 0)) / through;
      if (left < headroom) headroom = left;
    }
    return headroom;
  }

  // Adds the dose (seconds of full radiation, before the shield) to every exposed fish; returns the fish that reached
  // their tolerance (they are still in place: the caller decides what their death means).
  expose(fishes, doseSec, dying = []) {
    const taken = doseSec * (1 - this.shield());
    dying.length = 0;
    if (!(taken > 0)) return dying;
    for (const fish of fishes) {
      if (!this.isExposed(fish)) continue;
      fish.radiationDose = (fish.radiationDose || 0) + taken;
      if (fish.radiationDose >= this.toleranceSec(fish)) dying.push(fish);
    }
    return dying;
  }
}
