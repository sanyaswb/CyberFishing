import { ConsoleTableDebugModule } from "./base_debug_module.js";
import { DebugFormatters } from "../formatting/debug_formatters.js";

export class ExhaustionDebugModule extends ConsoleTableDebugModule {
  constructor(options = {}) {
    super({ key: "exhaustion", title: "Exhaustion", configSource: options.configSource });
  }

  render(context) {
    const live = context.live || {};
    const config =
      typeof this.configSource() !== "undefined" ? this.configSource().stamina?.mechanics || {} : {};

    console.table({
      "Fish condition phase": live.fishConditionPhase || "n/a",
      "Current exhaustion": DebugFormatters.number(live.currentExhaustion, 3),
      "Max endurance": DebugFormatters.number(
        live.fishConditionMaxEndurance,
        3,
      ),
      "Duration live": DebugFormatters.ms(live.exhaustionDurationMs),
      "Mastery time ratio": DebugFormatters.number(
        config.masteryTimeRatio,
        3,
      ),
      "Mastery power multiplier": DebugFormatters.number(
        config.masteryPowerMultiplier,
        3,
      ),
      "Active debuff": live.activeDebuffName || "n/a",
    });
  }
}
