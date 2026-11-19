import { ConsoleTableDebugModule } from "./console_table_debug_module.js";
import { DebugFormatters } from "../formatting/debug_formatters.js";

export class BiteTicksDebugModule extends ConsoleTableDebugModule {
  constructor(options = {}) {
    super({ key: "biteTicks", title: "Bite Tick Logger", configSource: options.configSource });
  }

  render() {
    const config = typeof this.configSource() !== "undefined" ? this.configSource() : {};
    const tickRate = config.spawns?.tickRateMs ?? "n/a";
    const cooldown =
      config.fightPhysicsConfig?.getLureRetrieveConfig?.()
        ?.guaranteedBiteCooldownMs || [];
    const godMode = config.debug?.godMode || {};

    console.table({
      "Logger status": "enabled",
      "Waiting tick rate": `${tickRate} ms`,
      "Guaranteed cooldown min":
        cooldown[0] != null ? DebugFormatters.ms(cooldown[0]) : "n/a",
      "Guaranteed cooldown max":
        cooldown[1] != null ? DebugFormatters.ms(cooldown[1]) : "n/a",
      "GOD fixed chance": godMode.fixedBiteChanceEnabled
        ? `${godMode.fixedBiteChancePercent}%`
        : "off",
      "GOD anomaly chance": godMode.forceAnomalyChance ? "100%" : "default",
      "GOD bite sequence mode": godMode.biteSequenceMode || "default",
      "Event source": "BiteSystem + WaterEntity.startBite/_rollBiteSequence",
    });
  }
}
