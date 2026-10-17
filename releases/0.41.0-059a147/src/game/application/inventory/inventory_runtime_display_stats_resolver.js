import { LineRuntimeDisplayStatsResolver } from "./line_runtime_display_stats_resolver.js";
import { ReelRuntimeDisplayStatsResolver } from "./reel_runtime_display_stats_resolver.js";
import { RuntimeDisplayStatWriter } from "./runtime_display_stat_writer.js";

export class InventoryRuntimeDisplayStatsResolver {
  #reelStatsResolver;
  #lineStatsResolver;

  constructor({
    statWriter = new RuntimeDisplayStatWriter(),
    reelStatsResolver = new ReelRuntimeDisplayStatsResolver({ statWriter }),
    lineStatsResolver = new LineRuntimeDisplayStatsResolver({ statWriter }),
  } = {}) {
    this.#reelStatsResolver = reelStatsResolver;
    this.#lineStatsResolver = lineStatsResolver;
  }

  apply(item, context = {}) {
    this.#reelStatsResolver.apply(item, context);
    this.#lineStatsResolver.apply(item, context);
  }
}
