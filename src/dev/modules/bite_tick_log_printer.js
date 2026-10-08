import { formatBiteResult } from "../formatting/bite_log_labels.js";
import { DebugFormatters } from "../formatting/debug_formatters.js";

export class BiteTickLogPrinter {
  #debugModulesSource;

  constructor({ debugModulesSource } = {}) {
    this.#debugModulesSource = debugModulesSource;
  }

  print(detail = {}) {
    if (!this.#debugModulesSource().biteTicks) return;

    const tick = detail.tickIndex ?? "?";
    const result = formatBiteResult(detail.result) || "n/a";
    const cooldown = detail.cooldown || {};
    const title =
      cooldown.active && result === "COOLDOWN"
        ? `[BITE:WAITING] #${tick} cooldown active - next checks paused`
        : `[BITE:WAITING] #${tick} ${result}`;

    console.groupCollapsed(
      `%c${title}`,
      "color: #00d1ff; font-weight: bold;",
    );
    console.table({
      Mode: detail.mode || "WAITING",
      Tick: tick,
      "Tick rate": DebugFormatters.ms(detail.tickRateMs),
      "Checked fish": detail.checkedFishCount ?? 0,
      Result: result,
      "Bite candidates": detail.bitesCount ?? 0,
      "Selected fish": detail.selectedFish
        ? `${detail.selectedFish.name || detail.selectedFish.id} (${detail.selectedFish.chancePercent})`
        : "none",
      "GOD fixed chance": detail.godMode?.fixedBiteChanceEnabled
        ? `${detail.godMode.fixedBiteChancePercent}%`
        : "off",
      "GOD anomaly chance": detail.godMode?.forceAnomalyChance
        ? "100%"
        : "default",
      "GOD sequence mode": detail.godMode?.biteSequenceMode || "default",
    });

    if (Array.isArray(detail.fishRolls) && detail.fishRolls.length > 0) {
      console.table(
        detail.fishRolls.map((fish, index) => ({
          "#": index + 1,
          Fish: fish.name || fish.id,
          Chance: fish.chancePercent,
          Roll: fish.rollPercent,
          Result: fish.skipped ? "skip: chance 0%" : formatBiteResult(fish.result),
        })),
      );
    }

    if (cooldown.active) {
      console.table({
        "Cooldown active": true,
        Reason: cooldown.reason || "n/a",
        "Started at": cooldown.startedMs
          ? DebugFormatters.ms(cooldown.startedMs)
          : "n/a",
        "Before remaining": cooldown.beforeMs
          ? DebugFormatters.ms(cooldown.beforeMs)
          : "n/a",
        "After remaining": cooldown.afterMs
          ? DebugFormatters.ms(cooldown.afterMs)
          : "n/a",
      });
    } else {
      console.info("Cooldown after bite: not started.");
    }

    console.groupEnd();
  }
}
