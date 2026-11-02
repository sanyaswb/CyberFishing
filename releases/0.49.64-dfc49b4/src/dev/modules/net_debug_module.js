import { ConsoleTableDebugModule } from "./console_table_debug_module.js";
import { DebugDataSelectors } from "../services/debug_data_selectors.js";
import { DebugFormatters } from "../formatting/debug_formatters.js";

export class NetDebugModule extends ConsoleTableDebugModule {
  constructor(options = {}) {
    super({ key: "net", title: "Landing Net", configSource: options.configSource });
  }

  render(context) {
    const eq = DebugDataSelectors.lastKnownEquipment(context);
    const fish = DebugDataSelectors.lastKnownFish(context);
    const net = eq.net || {};

    console.table({
      "Equipped net": net.name || net.id || "none",
      "Net active": net.active === true,
      "Quality grade": net.effectiveStats?.quality ?? "n/a",
      Fish: fish ? fish.name || fish.id : "n/a",
      "Fish weight": fish
        ? `${DebugFormatters.number(fish.weight, 3)} kg`
        : "n/a",
      "Last net roll": context.lastNetRoll
        ? `${context.lastNetRoll.roll.toFixed(1)} / ${context.lastNetRoll.chance}%`
        : "none",
      "Last net success": context.lastNetRoll
        ? context.lastNetRoll.success
        : "n/a",
    });
  }
}
