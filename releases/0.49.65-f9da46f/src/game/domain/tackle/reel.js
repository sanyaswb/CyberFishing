import { Equipment } from "./equipment.js";
import { ReelRetrieveSpeedCalculator } from "../fishing/reel_retrieve_speed_calculator.js";
import { firstFinite } from "../../../engine/math/number_normalization.js";

export class Reel extends Equipment {
  #retrieveSpeedCalculator = new ReelRetrieveSpeedCalculator();
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
    super(equipmentPowerLevel, power);
    this.#maxLoadKg = firstFinite(options.maxLoadKg, 10);
    this.#lineCapacityMeters = firstFinite(
      options.lineCapacityMeters,
      50,
    );
    this.#baseRetrieveSpeedMetersPerSec =
      firstFinite(options.retrieveSpeedMetersPerSec, 0.8);
    this.#bearingCount = firstFinite(options.bearingCount, 0);
    this.#bearingRetrieveSpeedBonusMetersPerSec = firstFinite(
      options.bearingRetrieveSpeedBonusMetersPerSec,
      // The composition passes the live runtime config object.
      (options.runtimeConfig?.fightPhysicsConfig?.getReelConfig?.() || {}).bearingRetrieveSpeedBonusMetersPerSec,
      0,
    );
    this.#dragMinKg = firstFinite(options.dragMinKg, 0);
    this.#dragMaxKg = firstFinite(
      options.dragMaxKg,
      this.#maxLoadKg,
    );
    this.#dragChangeSpeedPerSec =
      firstFinite(options.dragChangeSpeedPerSec, 1.5);
    this.#hasDrag = options.hasDrag !== false;
    if (!this.#hasDrag) {
      this.#dragMinKg = 0;
      this.#dragMaxKg = 0;
      this.#dragChangeSpeedPerSec = 0;
    }
    this.#durability = firstFinite(options.durability, 100);
    this.#durabilityMaxLoadLossPerPercent =
      firstFinite(options.durabilityMaxLoadLossPerPercent, 0.001);
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
}
