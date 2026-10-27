import { DevicePowerPolicy } from "../../domain/items/power/device_power_policy.js";
import { RuntimeDisplayStatWriter } from "./runtime_display_stat_writer.js";

// Updates a battery's "Ємність" display stat based on its live charge percent and capacity.
export class BatteryRuntimeDisplayStatsResolver {
  #statWriter;
  #powerPolicy;

  constructor({
    statWriter = new RuntimeDisplayStatWriter(),
    powerPolicy = new DevicePowerPolicy(),
  } = {}) {
    this.#statWriter = statWriter;
    this.#powerPolicy = powerPolicy;
  }

  apply(item) {
    if (item?.itemType !== "battery") return;
    const capacityUnits = Number(item?.effectiveStats?.capacityUnits);
    if (!(capacityUnits > 0)) return;
    const percent = Number(
      item?.charge?.percent ??
      item?.chargeState?.percent ??
      100,
    );
    const remaining = Math.round(this.#powerPolicy.remainingUnits(percent, capacityUnits));
    this.#statWriter.write(item, "capacityUnits", remaining);
  }
}
