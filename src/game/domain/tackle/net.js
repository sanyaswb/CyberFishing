import { DistanceUnitConverter } from "../casting/distance_unit_converter.js";
import { NetQualityModifier } from "../items/quality/net_quality_modifier.js";

export class Net {
  #config;
  #converter;
  #qualityModifier;

  constructor(config, physicsConfig = null, qualityModifier = null) {
    this.#converter = this.#createConverter(physicsConfig);
    this.#qualityModifier = qualityModifier || new NetQualityModifier();
    this.updateConfig(config);
  }

  updateConfig(config) {
    this.#config = config || { active: false };
  }

  get isActive() {
    return this.#config.active;
  }

  // Convert net length to virtual distance using the existing factor of 10.
  // For example, length 15 reaches 150 virtual pixels from the shore.
  // Current model: length is meters; virtual reach is pixels via DistanceUnitConverter.
  getReachMeters() {
    const reachMeters = Number(
      this.#config.lengthMeters ??
        this.#config.reachMeters ??
        this.#config.length,
    );
    return Number.isFinite(reachMeters) ? Math.max(0, reachMeters) : 0;
  }

  getReachPixels() {
    return this.#converter.metersToPixels(this.getReachMeters());
  }

  get virtualReach() {
    return this.getReachPixels();
  }

  getMaxWeight() {
    return Math.max(0, Number(this.#config.maxWeight) || 0);
  }


  getTriggerVirtualY(virtualBottomY) {
    // Without a net, use the base landing zone near the shore.
    const baseReach = 50;
    const reach = this.isActive ? this.virtualReach : baseReach;
    return virtualBottomY - reach;
  }


  isFloatInZone(floatVirtualY, virtualBottomY) {
    if (!this.isActive) return false;
    const triggerY = this.getTriggerVirtualY(virtualBottomY);
    return floatVirtualY >= triggerY && floatVirtualY < virtualBottomY;
  }


  calculateCatchChance(fishWeight) {
    if (!this.isActive) return 100;

    const maxWeight = this.getMaxWeight();
    if (maxWeight <= 0) return 0;
    if (fishWeight <= maxWeight) return 100;


    const diffPercent = ((fishWeight - maxWeight) / maxWeight) * 100;
    let baseChance = 50;

    if (this.#config.chances) {
      for (const t of this.#config.chances) {
        const maxBoundary = Number(t.max);
        const isOpenEnded = t.openEnded === true || t.max === null;
        if (diffPercent >= t.min && (isOpenEnded || diffPercent <= maxBoundary)) {
          baseChance = t.chance;
          break;
        }
      }
    }

    const qualityBonus = this.#qualityModifier.getCatchChanceBonusPercent(
      this.#config.quality,
    );
    return Math.min(100, Math.max(0, baseChance + qualityBonus));
  }

  #createConverter(physicsConfig) {
    const resolvedPhysics =
      physicsConfig ||
      {};

    return new DistanceUnitConverter(resolvedPhysics);
  }
}
