import { ReelRetrieveSpeedCalculator } from "../../domain/fishing/reel_retrieve_speed_calculator.js";
import { RuntimeDisplayStatWriter } from "./runtime_display_stat_writer.js";

export class ReelRuntimeDisplayStatsResolver {
  #retrieveSpeedCalculator;
  #statWriter;

  constructor({
    retrieveSpeedCalculator = new ReelRetrieveSpeedCalculator(),
    statWriter = new RuntimeDisplayStatWriter(),
  } = {}) {
    this.#retrieveSpeedCalculator = retrieveSpeedCalculator;
    this.#statWriter = statWriter;
  }

  apply(item, { reelConfig = {} } = {}) {
    if (!this.#isReel(item)) return;

    const speed = this.#retrieveSpeedCalculator.calculate({
      baseSpeedMetersPerSec: item.effectiveStats?.retrieveSpeedMetersPerSec,
      bearingCount: item.effectiveStats?.bearingCount,
      bearingBonusMetersPerSec:
        reelConfig.bearingRetrieveSpeedBonusMetersPerSec,
    });
    this.#statWriter.write(item, "retrieveSpeedMetersPerSec", speed);
  }

  #isReel(item) {
    return item?.itemType === "reel";
  }
}
