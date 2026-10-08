import { Equipment } from "./equipment.js";
import { ReelRetrieveSpeedCalculator } from "../fishing/reel_retrieve_speed_calculator.js";

export class Reel extends Equipment {
  #retrieveSpeedCalculator = new ReelRetrieveSpeedCalculator();
  #holdConfig;
  #maxLoadKg;
  #lineCapacityMeters;
  #baseRetrieveSpeedMetersPerSec;
  #bearingCount;
  #bearingRetrieveSpeedBonusMetersPerSec;
  #dragMinKg;
  #dragMaxKg;
  #dragChangeSpeedPerSec;
  #hasDrag;
  #durability;
  #durabilityMaxLoadLossPerPercent;

  constructor(equipmentPowerLevel, power, options = {}) {
    super(equipmentPowerLevel, power); // Стара логіка відпрацьовує як і раніше!
    this.#holdConfig = null;
    this.#maxLoadKg = Reel.#numberOrDefault(options.maxLoadKg, 10);
    this.#lineCapacityMeters = Reel.#numberOrDefault(
      options.lineCapacityMeters,
      50,
    );
    this.#baseRetrieveSpeedMetersPerSec =
      Reel.#numberOrDefault(options.retrieveSpeedMetersPerSec, 0.8);
    this.#bearingCount = Reel.#numberOrDefault(options.bearingCount, 0);
    this.#bearingRetrieveSpeedBonusMetersPerSec = Reel.#numberOrDefault(
      options.bearingRetrieveSpeedBonusMetersPerSec,
      // The composition passes the live runtime config object.
      (options.runtimeConfig?.fightPhysicsConfig?.getReelConfig?.() || {}).bearingRetrieveSpeedBonusMetersPerSec,
      0,
    );
    this.#dragMinKg = Reel.#numberOrDefault(options.dragMinKg, 0);
    this.#dragMaxKg = Reel.#numberOrDefault(
      options.dragMaxKg,
      this.#maxLoadKg,
    );
    this.#dragChangeSpeedPerSec =
      Reel.#numberOrDefault(options.dragChangeSpeedPerSec, 1.5);
    this.#hasDrag = options.hasDrag !== false;
    if (!this.#hasDrag) {
      this.#dragMinKg = 0;
      this.#dragMaxKg = 0;
      this.#dragChangeSpeedPerSec = 0;
    }
    this.#durability = Reel.#numberOrDefault(options.durability, 100);
    this.#durabilityMaxLoadLossPerPercent =
      Reel.#numberOrDefault(options.durabilityMaxLoadLossPerPercent, 0.001);
  }

  hasReel() {
    return this.getPower() > 0 || this.#lineCapacityMeters > 0;
  }

  getMaxLoadKg() {
    return this.#maxLoadKg;
  }

  getEffectiveMaxLoadKg() {
    const loss =
      (100 - Math.max(0, Math.min(100, this.#durability))) *
      this.#durabilityMaxLoadLossPerPercent;
    return this.#maxLoadKg * Math.max(0.1, 1 - loss);
  }

  getRetrieveSpeedMetersPerSec() {
    return this.#retrieveSpeedCalculator.calculate({
      baseSpeedMetersPerSec: this.#baseRetrieveSpeedMetersPerSec,
      bearingCount: this.#bearingCount,
      bearingBonusMetersPerSec: this.#bearingRetrieveSpeedBonusMetersPerSec,
    });
  }

  getDragChangeSpeedPerSec() {
    return this.#dragChangeSpeedPerSec;
  }

  hasDrag() {
    return this.#hasDrag;
  }

  getDragRangeKg() {
    return { min: this.#dragMinKg, max: this.#dragMaxKg };
  }

  static #numberOrDefault(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }
}
