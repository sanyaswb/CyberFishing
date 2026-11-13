import { BatteryRuntimeDisplayStatsResolver } from "./battery_runtime_display_stats_resolver.js";
import { LineRuntimeDisplayStatsResolver } from "./line_runtime_display_stats_resolver.js";
import { ReelRuntimeDisplayStatsResolver } from "./reel_runtime_display_stats_resolver.js";
import { RuntimeDisplayStatWriter } from "./runtime_display_stat_writer.js";

export class InventoryRuntimeDisplayStatsResolver {
  #reelStatsResolver;
  #lineStatsResolver;
  #batteryStatsResolver;

  constructor({
    statWriter = new RuntimeDisplayStatWriter(),
    reelStatsResolver = new ReelRuntimeDisplayStatsResolver({ statWriter }),
    lineStatsResolver = new LineRuntimeDisplayStatsResolver({ statWriter }),
    batteryStatsResolver = new BatteryRuntimeDisplayStatsResolver({ statWriter }),
  } = {}) {
    this.#reelStatsResolver = reelStatsResolver;
    this.#lineStatsResolver = lineStatsResolver;
    this.#batteryStatsResolver = batteryStatsResolver;
  }

  apply(item, context = {}) {
    this.#reelStatsResolver.apply(item, context);
    this.#lineStatsResolver.apply(item, context);
    this.#batteryStatsResolver.apply(item, context);
  }
}
