import { ConsoleTableDebugModule } from "./console_table_debug_module.js";
import { DebugDataSelectors } from "../services/debug_data_selectors.js";
import { DebugFormatters } from "../formatting/debug_formatters.js";

export class CatchTimeDebugModule extends ConsoleTableDebugModule {
  constructor(options = {}) {
    super({ key: "catchTime", title: "Catch Time", configSource: options.configSource });
  }

  render(context) {
    const live = context.live || {};
    const fish = DebugDataSelectors.lastKnownFish(context);
    const durationMs = Number(live.exhaustionDurationMs);
    const masteryRatio =
      typeof this.configSource() !== "undefined"
        ? this.configSource().stamina?.mechanics?.masteryTimeRatio ?? 0.5
        : 0.5;

    console.table({
      Fish: fish ? fish.name || fish.id : "n/a",
      "Weight kg": fish
        ? `${DebugFormatters.number(fish.weight, 3)} kg`
        : "n/a",
      Level: fish?.level ?? "n/a",
      "Ideal exhaustion duration": DebugFormatters.ms(durationMs),
      "Mastery starts after": Number.isFinite(durationMs)
        ? DebugFormatters.ms(durationMs * masteryRatio)
        : "n/a",
      "Data source": Number.isFinite(durationMs)
        ? "StaminaSystem.getExhaustionDurationMs"
        : "waiting for live fight data",
    });
  }
}
